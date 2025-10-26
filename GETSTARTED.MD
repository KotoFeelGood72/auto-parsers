# Auto Parser

![Node.js](https://img.shields.io/badge/Node.js-16.x-green.svg) ![Playwright](https://img.shields.io/badge/Playwright-1.50.1-blue.svg) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg) ![Docker](https://img.shields.io/badge/Docker-%3E%3D20.10-blue.svg)

## Описание

Проект `auto-parser` представляет собой модульный парсер на Node.js с использованием Playwright, который собирает и сохраняет данные о подержанных автомобилях с сайта [dubizzle.com](https://uae.dubizzle.com/motors/used-cars/).

Особенности:

* Парсинг списка объявлений (файл `listings.js`).
* Парсинг деталей каждого объявления (файл `details.js`).
* Сохранение в базу данных PostgreSQL через модуль `pg`.
* Скрипт `init_db.js` создаёт необходимые таблицы в БД.
* Управление параллелизмом через `p-limit`.
* Настраиваемые параметры через `.env`.

## Технологии и стек

* **Ядро:** Node.js (CommonJS)
* **Парсинг браузером:** Playwright
* **База данных:** PostgreSQL (через Docker или локально)
* **ORM/драйвер:** `pg`
* **Утилиты:** `dotenv`, `p-limit`

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/ваш_аккаунт/auto-parser.git
cd auto-parser
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Установка Playwright

Playwright требует установки движков браузеров:

```bash
npx playwright install
```

### 4. Настройка окружения

Скопируйте шаблон и заполните переменные:

```bash
cp .env.example .env
```

#### Пример содержимого `.env`

```dotenv
# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_USER=parser_user
PG_PASSWORD=пароль_бд
PG_DATABASE=auto_db

# Playwright
PWL_HEADLESS=true      # Запуск в headless режиме
PWL_TIMEOUT=30000      # Таймаут ожидания загрузки страницы (ms)

# Параллелизм
MAX_CONCURRENT_PAGES=5  # Максимум одновременно запущенных вкладок
```

### 5. Запуск базы данных (Docker)

В корне репозитория есть `docker-compose.yml` для быстрого подъёма Postgres:

```yaml
version: '3.8'
services:
  db:
    image: postgres:13
    container_name: auto_parser_db
    restart: always
    environment:
      POSTGRES_USER: parser_user
      POSTGRES_PASSWORD: пароль_бд
      POSTGRES_DB: auto_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

```bash
# Запуск контейнера
docker-compose up -d
```

### 6. Инициализация базы данных

Создание таблиц и схем через скрипт:

```bash
npm run db
```

> В скрипте `src/init_db.js` описаны все DDL-команды для создания таблицы `car_listings`.

### 7. Запуск парсера

```bash
npm run start
```

По умолчанию парсер пройдётся по списку объявлений и сохранит данные в таблице `car_listings`.

## Структура проекта

```text
auto-parser/
├── data/                # Сырьё: сохранённые JSON-данные
├── src/
│   ├── pages/
│   │   ├── listings.js   # Модуль сбора ссылок на объявления
│   │   └── details.js    # Модуль подробного парсинга объявлений
│   ├── utils/
│   │   ├── browser.js    # Конфигурация Playwright BrowserContext
│   │   ├── logger.js     # Логгер (консоль + файл)
│   │   └── saveData.js   # Сохранение в БД или файлы
│   ├── init_db.js        # Скрипт создания таблиц в PostgreSQL
│   └── index.js          # Точка входа: orchestration
├── .env.example          # Шаблон переменных окружения
├── docker-compose.yml    # Подъём PostgreSQL через Docker
├── package.json          # Скрипты и зависимости
└── README.md             # Документация проекта (вы здесь)
```

## Скрипты и команды

| Команда                  | Описание                                |
| ------------------------ | --------------------------------------- |
| `npm install`            | Установка зависимостей                  |
| `npx playwright install` | Установка браузерных движков Playwright |
| `npm run db`             | Инициализация БД (создание таблиц)      |
| `npm run start`          | Запуск основного парсера                |

## Логирование

Лог-файлы сохраняются в папке `logs/` (если включено в `logger.js`).
Можно отслеживать progress и ошибки в реальном времени.

## Настройка уровня параллелизма

Параметр `MAX_CONCURRENT_PAGES` задаёт, сколько страниц Playwright может обрабатывать одновременно. Рекомендуется не превышать `5-10`, чтобы не перегружать ресурсы.

## Полезные советы

* **Timeouts:** Если страницы грузятся медленно, увеличьте `PWL_TIMEOUT`.
* **Headful режим:** Во время отладки удобно запускать с `PWL_HEADLESS=false`.
* **Рестарт контейнера:** После изменения `.env` или схемы в `init_db.js` рекомендуется пересоздать таблицы: `npm run db`.
