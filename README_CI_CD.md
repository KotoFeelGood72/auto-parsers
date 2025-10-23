# 🚗 Auto Parser - CI/CD Setup

Автоматическая система деплоя для парсера автомобилей с GitHub Actions и Docker.

## 🚀 Быстрый старт

```bash
# Проверка готовности к CI/CD
./setup_cicd.sh

# Настройка сервера (выполнить на сервере)
./setup_server.sh

# Ручной деплой (на сервере)
./deploy.sh
```

## 📁 Структура CI/CD

```
├── .github/workflows/
│   ├── deploy.yml          # Автоматический деплой
│   └── test.yml            # Тестирование кода
├── docker-compose.prod.yml # Продакшн конфигурация
├── Dockerfile              # Оптимизированный образ
├── deploy.sh               # Скрипт деплоя
├── setup_server.sh         # Настройка сервера
├── setup_cicd.sh           # Проверка готовности
└── env.prod.example        # Пример переменных
```

## ⚙️ Настройка

### 1. GitHub Secrets
- `SERVER_HOST` - IP сервера
- `SERVER_USER` - пользователь
- `SERVER_SSH_KEY` - приватный SSH ключ
- `SERVER_PORT` - порт SSH (22)

### 2. Переменные окружения
```bash
# На сервере
cp env.prod.example .env.prod
nano .env.prod
```

### 3. SSH ключи
```bash
# Генерация ключа
ssh-keygen -t rsa -b 4096

# Копирование на сервер
ssh-copy-id user@server-ip
```

## 🔄 Процесс деплоя

1. **Push в main/master** → GitHub Actions запускается
2. **Тестирование** → Проверка кода и сборка
3. **Деплой** → Подключение к серверу и обновление
4. **Проверка** → Healthcheck контейнеров
5. **Уведомления** → Статус деплоя

## 📊 Мониторинг

```bash
# Статус системы
./monitor.sh

# Логи парсера
docker-compose -f docker-compose.prod.yml logs -f parser

# Использование ресурсов
docker stats
```

## 🛡️ Безопасность

- ✅ Firewall (UFW)
- ✅ Fail2ban
- ✅ SSH ключи
- ✅ Непривилегированные контейнеры
- ✅ Автоматические бэкапы

## 📚 Документация

- [CICD_README.md](CICD_README.md) - Подробное руководство
- [SOURCES_README.md](SOURCES_README.md) - Система источников

## 🆘 Troubleshooting

### Проблемы с деплоем
```bash
# Проверка логов GitHub Actions
# Actions → Deploy to Server

# Проверка подключения
ssh user@server-ip

# Перезапуск контейнеров
docker-compose -f docker-compose.prod.yml restart
```

### Проблемы с базой данных
```bash
# Проверка подключения
docker-compose exec db psql -U root -d auto_db

# Восстановление из бэкапа
docker-compose exec -T db psql -U root -d auto_db < backup.sql
```

## 🎯 Возможности

- 🔄 Автоматический деплой при push
- 🧪 Автоматическое тестирование
- 🐳 Docker контейнеризация
- 📊 Мониторинг и healthcheck
- 💾 Автоматические бэкапы
- 🔔 Уведомления о статусе
- 🛡️ Безопасность и защита

---

**Готово к использованию!** 🚀

Следуйте инструкциям в `CICD_README.md` для подробной настройки.
