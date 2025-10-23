#!/bin/bash

# Скрипт быстрого старта CI/CD
# Помогает настроить автоматический деплой за несколько шагов

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

echo -e "${GREEN}"
echo "🚀 Быстрый старт CI/CD для парсера автомобилей"
echo "=============================================="
echo -e "${NC}"

# Проверяем, что мы в правильной директории
if [ ! -f "package.json" ] || [ ! -f "docker-compose.yml" ]; then
    error "Запустите скрипт из корневой директории проекта!"
    exit 1
fi

log "Проверяем наличие необходимых файлов..."

# Проверяем наличие файлов CI/CD
required_files=(
    ".github/workflows/deploy.yml"
    ".github/workflows/test.yml"
    "docker-compose.prod.yml"
    "deploy.sh"
    "setup_server.sh"
    "env.prod.example"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        error "Отсутствует файл: $file"
        exit 1
    fi
done

success "Все необходимые файлы найдены!"

echo -e "\n${YELLOW}📋 Инструкции по настройке CI/CD:${NC}"
echo ""
echo "1️⃣ Настройка сервера:"
echo "   - Загрузите setup_server.sh на сервер"
echo "   - Выполните: chmod +x setup_server.sh && ./setup_server.sh"
echo ""
echo "2️⃣ Настройка GitHub Secrets:"
echo "   - Перейдите в Settings → Secrets and variables → Actions"
echo "   - Добавьте следующие секреты:"
echo "     • SERVER_HOST - IP адрес сервера"
echo "     • SERVER_USER - имя пользователя на сервере"
echo "     • SERVER_SSH_KEY - приватный SSH ключ"
echo "     • SERVER_PORT - порт SSH (обычно 22)"
echo ""
echo "3️⃣ Настройка SSH ключей:"
echo "   - Сгенерируйте SSH ключ: ssh-keygen -t rsa -b 4096"
echo "   - Скопируйте публичный ключ на сервер: ssh-copy-id user@server"
echo "   - Добавьте приватный ключ в GitHub Secrets"
echo ""
echo "4️⃣ Настройка переменных окружения:"
echo "   - На сервере: cp env.prod.example .env.prod"
echo "   - Отредактируйте .env.prod с вашими настройками"
echo ""

# Проверяем Git репозиторий
if [ -d ".git" ]; then
    current_branch=$(git branch --show-current)
    log "Текущая ветка: $current_branch"
    
    if [ "$current_branch" != "main" ] && [ "$current_branch" != "master" ]; then
        warning "CI/CD настроен для веток main/master. Текущая ветка: $current_branch"
    fi
    
    # Проверяем удаленный репозиторий
    remote_url=$(git remote get-url origin 2>/dev/null || echo "не настроен")
    log "Удаленный репозиторий: $remote_url"
    
    if [[ "$remote_url" == *"github.com"* ]]; then
        success "GitHub репозиторий настроен!"
    else
        warning "Убедитесь, что репозиторий размещен на GitHub"
    fi
else
    warning "Это не Git репозиторий. Инициализируйте Git и подключите к GitHub"
fi

echo ""
echo -e "${YELLOW}🔧 Полезные команды:${NC}"
echo ""
echo "Локальная разработка:"
echo "  npm run start:dev          # Запуск в режиме разработки"
echo "  npm run docker:up         # Запуск через Docker"
echo "  npm run docker:logs       # Просмотр логов"
echo ""
echo "На сервере:"
echo "  ./deploy.sh               # Ручной деплой"
echo "  ./monitor.sh              # Мониторинг системы"
echo "  ./backup.sh               # Создание бэкапа"
echo ""
echo "GitHub Actions:"
echo "  - Автоматический деплой при push в main/master"
echo "  - Тестирование при создании PR"
echo "  - Проверка в Actions → Deploy to Server"
echo ""

# Проверяем Docker
if command -v docker > /dev/null && command -v docker-compose > /dev/null; then
    success "Docker и Docker Compose установлены!"
    
    # Тестируем сборку
    log "Тестируем сборку Docker образа..."
    if docker build -t auto-parser-test . > /dev/null 2>&1; then
        success "Docker образ собирается успешно!"
        docker rmi auto-parser-test > /dev/null 2>&1
    else
        warning "Проблемы с сборкой Docker образа"
    fi
else
    warning "Docker не установлен. Установите Docker и Docker Compose"
fi

echo ""
echo -e "${GREEN}✅ CI/CD готов к настройке!${NC}"
echo ""
echo -e "${BLUE}📚 Дополнительная документация:${NC}"
echo "  - CICD_README.md - Подробное руководство"
echo "  - SOURCES_README.md - Документация по источникам"
echo ""
echo -e "${YELLOW}🚀 Следующие шаги:${NC}"
echo "1. Настройте сервер с помощью setup_server.sh"
echo "2. Добавьте GitHub Secrets"
echo "3. Сделайте push в main ветку для тестирования деплоя"
echo ""
echo -e "${GREEN}Удачи с настройкой CI/CD! 🎉${NC}"
