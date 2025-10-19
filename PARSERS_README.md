# 🚗 Система модульных парсеров автомобилей

## 🎯 Возможности

- **Циклический запуск**: Парсеры запускаются по очереди бесконечно
- **Простое добавление**: Новые парсеры добавляются через JSON конфигурацию
- **Управление памятью**: Автоматическая очистка памяти и мониторинг
- **Модульность**: Каждый парсер в отдельной папке
- **Конфигурация**: Гибкая настройка через переменные окружения

## 🚀 Быстрый старт

### Запуск всех парсеров по очереди (циклически)
```bash
npm start
```

### Запуск конкретного парсера
```bash
npm run dubicars
npm run dubizzle
```

### Запуск с параметрами
```bash
# Циклический режим с конкретными парсерами
node src/index.js cycle dubicars,dubizzle

# Одиночный режим
node src/index.js single dubicars
```

## 📁 Структура проекта

```
src/
├── parsers/
│   ├── configs/           # Конфигурации парсеров
│   │   ├── dubicars.json
│   │   ├── dubizzle.json
│   │   └── example.json
│   ├── BaseParser.js      # Базовый класс парсера
│   ├── ConfigParser.js    # Универсальный парсер
│   ├── ConfigLoader.js    # Загрузчик конфигураций
│   └── ParserRunner.js    # Система запуска парсеров
├── database/              # Управление БД
├── utils/                 # Утилиты
└── index.js              # Главный файл
```

## ⚙️ Добавление нового парсера

### 1. Создайте конфигурационный файл

Создайте файл `src/parsers/configs/your-site.json`:

```json
{
  "name": "Your Site Parser",
  "baseUrl": "https://your-site.com",
  "listingsUrl": "https://your-site.com/cars?page={page}",
  "maxPages": 30,
  "timeout": 60000,
  "delayBetweenRequests": 1000,
  "enableImageLoading": false,
  "selectors": {
    "listings": {
      "container": ".car-item",
      "link": "a.car-link"
    },
    "details": {
      "title": ".car-title",
      "price": {
        "formatted": ".price-text",
        "raw": ".price-value",
        "currency": ".currency"
      },
      "year": ".car-year",
      "kilometers": ".car-mileage",
      "make": ".car-make",
      "model": ".car-model",
      "fuel_type": ".car-fuel",
      "photos": {
        "selector": ".car-gallery img"
      },
      "sellers": {
        "sellerName": ".seller-name",
        "sellerType": ".seller-type"
      },
      "contact": {
        "phone": ".phone-number"
      }
    }
  },
  "validation": {
    "required": ["title", "price"],
    "minPrice": 100
  }
}
```

### 2. Запустите парсер

```bash
# Добавьте команду в package.json
"your-site": "node --expose-gc --max-old-space-size=512 src/index.js single your-site"

# Или запустите напрямую
node src/index.js single your-site
```

## 🔧 Конфигурация

### Переменные окружения

```bash
# Режим запуска (cycle/single)
PARSER_MODE=cycle

# Список парсеров (через запятую)
PARSER_NAMES=dubicars,dubizzle

# Максимум страниц для парсинга
MAX_PAGES=10

# Задержка между запросами (мс)
DELAY_MS=1000

# Загрузка изображений
ENABLE_IMAGES=false
```

### Структура конфигурации парсера

```json
{
  "name": "Название парсера",
  "baseUrl": "https://example.com",
  "listingsUrl": "https://example.com/cars?page={page}",
  "maxPages": 50,
  "timeout": 60000,
  "delayBetweenRequests": 1000,
  "enableImageLoading": false,
  "selectors": {
    "listings": {
      "container": "CSS селектор контейнера объявлений",
      "link": "CSS селектор ссылки на объявление"
    },
    "details": {
      "title": "CSS селектор заголовка",
      "price": {
        "formatted": "CSS селектор отформатированной цены",
        "raw": "CSS селектор числовой цены",
        "currency": "CSS селектор валюты"
      },
      "year": "CSS селектор года",
      "kilometers": "CSS селектор пробега",
      "make": "CSS селектор марки",
      "model": "CSS селектор модели",
      "fuel_type": "CSS селектор типа топлива",
      "photos": {
        "selector": "CSS селектор фотографий"
      },
      "sellers": {
        "sellerName": "CSS селектор имени продавца",
        "sellerType": "CSS селектор типа продавца"
      },
      "contact": {
        "phone": "CSS селектор телефона"
      }
    }
  },
  "validation": {
    "required": ["title", "price"],
    "minPrice": 1000
  }
}
```

## 📊 Мониторинг

### Статистика парсеров
Система автоматически ведет статистику:
- Количество обработанных объявлений
- Время последнего запуска
- Количество запусков

### Управление памятью
- Автоматическая очистка памяти каждые 3 операции
- Принудительная очистка каждые 10 операций
- Мониторинг использования памяти

## 🛠️ Команды

```bash
# Циклический запуск всех парсеров
npm start

# Запуск конкретного парсера
npm run dubicars
npm run dubizzle

# Запуск с параметрами
node src/index.js cycle dubicars,dubizzle
node src/index.js single dubicars

# Разработка (больше памяти)
npm run start:dev

# Продакшн (меньше памяти)
npm run start:prod
```

## 🔄 Циклический режим

В циклическом режиме парсеры запускаются по очереди:
1. Dubicars → обрабатывает все страницы
2. Пауза 5 секунд
3. Dubizzle → обрабатывает все страницы
4. Пауза 5 секунд
5. Повтор с начала

## 🎯 Преимущества

- **Простота**: Добавление парсера = создание JSON файла
- **Гибкость**: Настройка через CSS селекторы
- **Надежность**: Автоматическое управление памятью
- **Масштабируемость**: Легко добавлять новые сайты
- **Мониторинг**: Детальная статистика работы

## 🚨 Остановка

Для корректной остановки используйте `Ctrl+C` - система автоматически:
- Завершит текущий парсер
- Закроет браузер
- Очистит память
- Покажет статистику
