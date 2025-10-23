# CI/CD Setup Guide для парсера автомобилей

## Обзор

Настроена автоматическая система деплоя с GitHub Actions, которая:
- Автоматически деплоит код при push в main/master ветку
- Перезапускает Docker контейнеры на сервере
- Создает бэкапы базы данных
- Проверяет здоровье контейнеров
- Отправляет уведомления о статусе деплоя

## Файлы CI/CD

### 1. GitHub Actions Workflow
- `.github/workflows/deploy.yml` - Основной workflow для деплоя

### 2. Docker конфигурация
- `docker-compose.prod.yml` - Продакшн конфигурация с healthcheck
- `Dockerfile` - Оптимизированный образ с безопасностью

### 3. Скрипты деплоя
- `deploy.sh` - Основной скрипт деплоя
- `setup_server.sh` - Первоначальная настройка сервера
- `env.prod.example` - Пример переменных окружения

## Настройка сервера

### 1. Первоначальная настройка

```bash
# На сервере выполните:
wget https://raw.githubusercontent.com/YOUR_USERNAME/auto-parsers/main/setup_server.sh
chmod +x setup_server.sh
./setup_server.sh
```

### 2. Настройка переменных окружения

```bash
# Отредактируйте файл переменных окружения
nano ~/auto-parsers/.env.prod

# Основные переменные:
DB_HOST=db
DB_PORT=5432
DB_NAME=auto_db
DB_USER=root
DB_PASSWORD=YOUR_SECURE_PASSWORD
NODE_ENV=production
```

### 3. Клонирование репозитория

```bash
cd ~/auto-parsers
git clone https://github.com/YOUR_USERNAME/auto-parsers.git .
```

## Настройка GitHub Secrets

В настройках репозитория GitHub добавьте следующие секреты:

### Обязательные секреты:
- `SERVER_HOST` - IP адрес вашего сервера
- `SERVER_USER` - имя пользователя на сервере
- `SERVER_SSH_KEY` - приватный SSH ключ для доступа к серверу
- `SERVER_PORT` - порт SSH (обычно 22)

### Опциональные секреты:
- `WEBHOOK_URL` - URL для уведомлений (Slack, Discord, etc.)
- `SLACK_WEBHOOK` - Slack webhook для уведомлений

## Как добавить SSH ключ

### 1. Генерация SSH ключа (на локальной машине)
```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

### 2. Копирование публичного ключа на сервер
```bash
ssh-copy-id -i ~/.ssh/id_rsa.pub user@your-server-ip
```

### 3. Добавление приватного ключа в GitHub Secrets
```bash
# Скопируйте содержимое приватного ключа
cat ~/.ssh/id_rsa

# Добавьте в GitHub Secrets как SERVER_SSH_KEY
```

## Процесс деплоя

### Автоматический деплой
1. Push в main/master ветку
2. GitHub Actions запускает workflow
3. Подключается к серверу по SSH
4. Выполняет скрипт деплоя
5. Перезапускает контейнеры
6. Проверяет здоровье системы

### Ручной деплой
```bash
# На сервере
cd ~/auto-parsers
./deploy.sh
```

## Мониторинг и управление

### Проверка статуса
```bash
# Общий статус
~/auto-parsers/monitor.sh

# Статус контейнеров
docker-compose -f ~/auto-parsers/docker-compose.prod.yml ps

# Логи парсера
docker-compose -f ~/auto-parsers/docker-compose.prod.yml logs -f parser

# Использование ресурсов
docker stats
```

### Управление сервисом
```bash
# Запуск через systemd
sudo systemctl start auto-parser

# Остановка
sudo systemctl stop auto-parser

# Статус
sudo systemctl status auto-parser

# Автозапуск
sudo systemctl enable auto-parser
```

### Бэкапы
```bash
# Ручной бэкап
~/auto-parsers/backup.sh

# Автоматические бэкапы (настроены в cron)
# Выполняются каждый день в 2:00
```

## Безопасность

### Настроенные меры безопасности:
- Firewall (UFW) с ограниченными портами
- Fail2ban для защиты от брутфорса
- Docker контейнеры запускаются от непривилегированного пользователя
- SSH ключи вместо паролей
- Регулярные бэкапы базы данных

### Рекомендации:
- Регулярно обновляйте систему
- Мониторьте логи на предмет подозрительной активности
- Используйте сильные пароли для базы данных
- Настройте мониторинг ресурсов

## Troubleshooting

### Проблемы с деплоем
```bash
# Проверка логов GitHub Actions
# В репозитории: Actions -> Deploy to Server

# Проверка подключения к серверу
ssh user@your-server-ip

# Проверка Docker
docker --version
docker-compose --version
```

### Проблемы с контейнерами
```bash
# Перезапуск всех контейнеров
cd ~/auto-parsers
docker-compose -f docker-compose.prod.yml restart

# Пересборка контейнеров
docker-compose -f docker-compose.prod.yml up -d --build

# Очистка неиспользуемых ресурсов
docker system prune -f
```

### Проблемы с базой данных
```bash
# Проверка подключения
docker-compose -f docker-compose.prod.yml exec db psql -U root -d auto_db

# Восстановление из бэкапа
docker-compose -f docker-compose.prod.yml exec -T db psql -U root -d auto_db < backup_file.sql
```

## Полезные команды

```bash
# Быстрый деплой
cd ~/auto-parsers && ./deploy.sh

# Мониторинг в реальном времени
watch -n 5 '~/auto-parsers/monitor.sh'

# Просмотр логов
tail -f ~/logs/parser.log

# Проверка места на диске
df -h

# Проверка использования памяти
free -h
```

## Уведомления

### Настройка Slack уведомлений
1. Создайте Slack App
2. Получите Webhook URL
3. Добавьте в GitHub Secrets как `SLACK_WEBHOOK`

### Настройка Discord уведомлений
1. Создайте Discord Webhook
2. Добавьте URL в GitHub Secrets как `WEBHOOK_URL`

## Обновление системы

### Обновление кода
```bash
# На сервере
cd ~/auto-parsers
git pull origin main
./deploy.sh
```

### Обновление Docker образов
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

Система готова к использованию! 🚀
