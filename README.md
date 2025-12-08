# Auto Parsers

Система парсинга объявлений об автомобилях с различных сайтов ОАЭ.

## 📋 Доступные парсеры

- **autotraders** - Autotraders.ae
- **carswitch** - CarSwitch.com
- **dubicars** - DubiCars.com
- **dubizzle** - Dubizzle.com
- **oneclickdrive** - OneClickDrive.com
- **opensooq** - OpenSooq.com

## 🚀 Запуск

### Локальный запуск

#### Запуск всех парсеров в цикле
```bash
node --expose-gc --max-old-space-size=512 src/index.js cycle
```

#### Запуск одного конкретного парсера
```bash
node --expose-gc --max-old-space-size=512 src/index.js single <имя_парсера>
```

**Примеры запуска отдельных парсеров:**

```bash
# Autotraders
node --expose-gc --max-old-space-size=512 src/index.js single autotraders

# CarSwitch
node --expose-gc --max-old-space-size=512 src/index.js single carswitch

# DubiCars
node --expose-gc --max-old-space-size=512 src/index.js single dubicars

# Dubizzle
node --expose-gc --max-old-space-size=512 src/index.js single dubizzle

# OneClickDrive
node --expose-gc --max-old-space-size=512 src/index.js single oneclickdrive

# OpenSooq
node --expose-gc --max-old-space-size=512 src/index.js single opensooq
```

### Запуск через Docker

#### Запуск всех парсеров
```bash
docker-compose up -d
```

#### Запуск одного конкретного парсера
```bash
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single <имя_парсера>
```

**Примеры:**

```bash
# Autotraders
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single autotraders

# CarSwitch
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single carswitch

# DubiCars
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single dubicars

# Dubizzle
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single dubizzle

# OneClickDrive
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single oneclickdrive

# OpenSooq
docker-compose run --rm parser node --expose-gc --max-old-space-size=512 src/index.js single opensooq
```

## 📦 Установка зависимостей

```bash
npm install

# Установка браузеров Playwright (обязательно!)
npx playwright install chromium
```

## 🔧 Настройка

### Установка браузеров Playwright

**Важно!** После установки зависимостей необходимо установить браузеры:

```bash
npx playwright install chromium
```

### Настройка базы данных

Создайте файл `.env` в корне проекта:

```env
# База данных
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auto_db
DB_USER=root
DB_PASSWORD=your_password

# Режим парсера (опционально)
PARSER_MODE=cycle
PARSER_NAMES=autotraders,dubizzle

# Задержка между запросами (мс)
DELAY_MS=1000

# Загрузка изображений
ENABLE_IMAGES=false
```

**Примечание:** Если база данных недоступна, парсер будет работать, но данные не будут сохраняться в БД.

## 🐳 Docker команды

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Просмотр логов
docker-compose logs -f parser

# Перезапуск
docker-compose restart parser

# Пересборка и запуск
docker-compose up -d --build
```

## 📊 Структура проекта

```
src/
├── parsers/
│   ├── modules/          # Модули парсеров
│   │   ├── autotraders/
│   │   ├── carswitch/
│   │   ├── dubicars/
│   │   ├── dubizzle/
│   │   ├── oneclickdrive/
│   │   └── opensooq/
│   ├── configs/          # Конфигурации парсеров
│   └── ...
├── database/             # Работа с БД
├── services/             # Сервисы (логирование, ошибки, телеграм)
└── utils/                # Утилиты
```

## 🔍 Мониторинг

Логи сохраняются в:
- `logs/parser.log` - основные логи
- `logs/errors.log` - ошибки

## ⚠️ Решение проблем

### Ошибка: "Executable doesn't exist" (Playwright)

Если видите ошибку о том, что браузер не найден:
```bash
npx playwright install chromium
```

### Ошибка: "База данных недоступна"

Если база данных не запущена:
- Для локального запуска: запустите PostgreSQL или используйте Docker
- Для Docker: база данных запускается автоматически через `docker-compose up`

### Ошибка подключения к БД

Проверьте настройки в `.env` файле и убедитесь что:
- PostgreSQL запущен
- Параметры подключения корректны
- База данных создана

## 📝 Примечания

- Парсеры работают в headless режиме браузера
- Данные сохраняются в PostgreSQL
- Каждый парсер имеет свою конфигурацию в `src/parsers/configs/`
- При отсутствии БД парсер продолжит работу, но данные не будут сохраняться

