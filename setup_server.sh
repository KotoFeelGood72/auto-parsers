#!/bin/bash

# Скрипт для первоначальной настройки сервера
# Запускать на сервере один раз для настройки окружения

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

log "🚀 Настройка сервера для парсера автомобилей..."

# Обновляем систему
log "📦 Обновляем систему..."
sudo apt update && sudo apt upgrade -y

# Устанавливаем необходимые пакеты
log "🔧 Устанавливаем необходимые пакеты..."
sudo apt install -y \
    git \
    curl \
    wget \
    unzip \
    htop \
    nano \
    ufw \
    fail2ban \
    docker.io \
    docker-compose \
    postgresql-client

# Добавляем пользователя в группу docker
log "👤 Добавляем пользователя в группу docker..."
sudo usermod -aG docker $USER

# Запускаем и включаем Docker
log "🐳 Настраиваем Docker..."
sudo systemctl start docker
sudo systemctl enable docker

# Создаем директории проекта
log "📁 Создаем директории проекта..."
mkdir -p ~/auto-parsers
mkdir -p ~/backups
mkdir -p ~/logs

# Клонируем репозиторий (если еще не клонирован)
if [ ! -d ~/auto-parsers/.git ]; then
    log "📥 Клонируем репозиторий..."
    cd ~/auto-parsers
    git clone https://github.com/YOUR_USERNAME/auto-parsers.git .
else
    log "ℹ️ Репозиторий уже клонирован"
fi

# Настраиваем файрвол
log "🔥 Настраиваем файрвол..."
sudo ufw allow ssh
sudo ufw allow 5432/tcp
sudo ufw allow 9090/tcp
sudo ufw --force enable

# Настраиваем fail2ban
log "🛡️ Настраиваем fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Создаем файл переменных окружения
log "⚙️ Создаем файл переменных окружения..."
if [ ! -f ~/auto-parsers/.env.prod ]; then
    cp ~/auto-parsers/env.prod.example ~/auto-parsers/.env.prod
    warning "Не забудьте отредактировать файл ~/auto-parsers/.env.prod"
fi

# Делаем скрипт деплоя исполняемым
log "🔧 Настраиваем скрипты..."
chmod +x ~/auto-parsers/deploy.sh

# Создаем cron задачу для автоматических бэкапов
log "⏰ Настраиваем автоматические бэкапы..."
(crontab -l 2>/dev/null; echo "0 2 * * * $HOME/auto-parsers/backup.sh") | crontab -

# Создаем скрипт бэкапа
cat > ~/auto-parsers/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups"
PROJECT_DIR="$HOME/auto-parsers"
DATE=$(date +%Y%m%d_%H%M%S)

cd "$PROJECT_DIR"
if docker-compose -f docker-compose.prod.yml ps db | grep -q "Up"; then
    docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U root auto_db > "$BACKUP_DIR/backup_$DATE.sql"
    # Удаляем старые бэкапы (старше 7 дней)
    find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
    echo "Backup completed: backup_$DATE.sql"
fi
EOF

chmod +x ~/auto-parsers/backup.sh

# Создаем systemd сервис для автозапуска
log "🔄 Создаем systemd сервис..."
sudo tee /etc/systemd/system/auto-parser.service > /dev/null << EOF
[Unit]
Description=Auto Parser Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$HOME/auto-parsers
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0
User=$USER
Group=$USER

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable auto-parser.service

# Создаем скрипт мониторинга
cat > ~/auto-parsers/monitor.sh << 'EOF'
#!/bin/bash
PROJECT_DIR="$HOME/auto-parsers"

cd "$PROJECT_DIR"

echo "=== Docker Containers Status ==="
docker-compose -f docker-compose.prod.yml ps

echo -e "\n=== Container Health ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo -e "\n=== Resource Usage ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo -e "\n=== Database Status ==="
docker-compose -f docker-compose.prod.yml exec -T db psql -U root -d auto_db -c "SELECT COUNT(*) as total_listings FROM car_listings;"

echo -e "\n=== Recent Logs ==="
docker-compose -f docker-compose.prod.yml logs --tail=10 parser
EOF

chmod +x ~/auto-parsers/monitor.sh

success "✅ Настройка сервера завершена!"

echo -e "\n${GREEN}🎉 Сервер готов к работе!${NC}"
echo -e "\n${YELLOW}Следующие шаги:${NC}"
echo "1. Отредактируйте файл ~/auto-parsers/.env.prod"
echo "2. Настройте GitHub Secrets для CI/CD:"
echo "   - SERVER_HOST: IP адрес сервера"
echo "   - SERVER_USER: имя пользователя"
echo "   - SERVER_SSH_KEY: приватный SSH ключ"
echo "   - SERVER_PORT: порт SSH (обычно 22)"
echo "3. Запустите первый деплой: ~/auto-parsers/deploy.sh"
echo "4. Проверьте статус: ~/auto-parsers/monitor.sh"

echo -e "\n${BLUE}Полезные команды:${NC}"
echo "- Мониторинг: ~/auto-parsers/monitor.sh"
echo "- Логи: docker-compose -f ~/auto-parsers/docker-compose.prod.yml logs -f"
echo "- Перезапуск: ~/auto-parsers/deploy.sh"
echo "- Бэкап: ~/auto-parsers/backup.sh"
