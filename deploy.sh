#!/bin/bash

# Скрипт деплоя для сервера
# Автоматически обновляет и перезапускает Docker контейнеры

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Конфигурация
PROJECT_DIR="/home/$(whoami)/auto-parsers"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/home/$(whoami)/backups"
LOG_FILE="/home/$(whoami)/deploy.log"

# Создаем директории если не существуют
mkdir -p "$BACKUP_DIR"
mkdir -p "$PROJECT_DIR/data"
mkdir -p "$PROJECT_DIR/logs"

log "🚀 Начинаем деплой парсера автомобилей..."

# Переходим в директорию проекта
cd "$PROJECT_DIR" || {
    error "Не удалось перейти в директорию $PROJECT_DIR"
    exit 1
}

# Проверяем наличие docker-compose файла
if [ ! -f "$COMPOSE_FILE" ]; then
    warning "Файл $COMPOSE_FILE не найден, используем docker-compose.yml"
    COMPOSE_FILE="docker-compose.yml"
fi

# Создаем бэкап базы данных перед обновлением
log "📦 Создаем бэкап базы данных..."
if docker-compose -f "$COMPOSE_FILE" ps db | grep -q "Up"; then
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump -U root auto_db > "$BACKUP_FILE"
    success "Бэкап создан: $BACKUP_FILE"
else
    warning "База данных не запущена, пропускаем бэкап"
fi

# Останавливаем текущие контейнеры
log "🛑 Останавливаем текущие контейнеры..."
docker-compose -f "$COMPOSE_FILE" down

# Очищаем неиспользуемые образы и контейнеры
log "🧹 Очищаем неиспользуемые Docker ресурсы..."
docker system prune -f

# Получаем последние изменения из Git
log "📥 Получаем последние изменения из Git..."
git fetch origin
git reset --hard origin/main

# Проверяем наличие изменений
if [ -z "$(git diff HEAD~1 HEAD --name-only)" ]; then
    warning "Нет изменений для деплоя"
    exit 0
fi

# Пересобираем и запускаем контейнеры
log "🔨 Пересобираем и запускаем контейнеры..."
docker-compose -f "$COMPOSE_FILE" up -d --build

# Ждем запуска контейнеров
log "⏳ Ждем запуска контейнеров..."
sleep 30

# Проверяем статус контейнеров
log "📊 Проверяем статус контейнеров..."
docker-compose -f "$COMPOSE_FILE" ps

# Проверяем здоровье контейнеров
log "🏥 Проверяем здоровье контейнеров..."
for i in {1..5}; do
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy"; then
        warning "Некоторые контейнеры нездоровы, ждем..."
        sleep 30
    else
        success "Все контейнеры здоровы!"
        break
    fi
done

# Проверяем подключение к базе данных
log "🔍 Проверяем подключение к базе данных..."
if docker-compose -f "$COMPOSE_FILE" exec -T db psql -U root -d auto_db -c "SELECT COUNT(*) FROM sources;" > /dev/null 2>&1; then
    success "Подключение к базе данных работает!"
else
    error "Не удалось подключиться к базе данных!"
    exit 1
fi

# Проверяем логи парсера
log "📋 Проверяем логи парсера..."
docker-compose -f "$COMPOSE_FILE" logs --tail=20 parser

# Проверяем использование ресурсов
log "💾 Проверяем использование ресурсов..."
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Создаем файл с информацией о деплое
DEPLOY_INFO="$PROJECT_DIR/deploy_info.txt"
cat > "$DEPLOY_INFO" << EOF
Deploy Information
==================
Date: $(date)
Git Commit: $(git rev-parse HEAD)
Git Branch: $(git branch --show-current)
Docker Compose File: $COMPOSE_FILE
Containers Status:
$(docker-compose -f "$COMPOSE_FILE" ps)
EOF

success "🎉 Деплой завершен успешно!"

# Отправляем уведомление (если настроено)
if command -v curl > /dev/null && [ -n "$WEBHOOK_URL" ]; then
    log "📤 Отправляем уведомление..."
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"✅ Парсер автомобилей успешно обновлен на сервере!\"}" \
        || warning "Не удалось отправить уведомление"
fi

log "📝 Информация о деплое сохранена в $DEPLOY_INFO"

# Показываем последние логи
log "📋 Последние логи парсера:"
docker-compose -f "$COMPOSE_FILE" logs --tail=10 parser

success "✅ Деплой завершен! Парсер работает."
