# Система источников для парсера автомобилей

## Обзор

Добавлена система источников, которая позволяет:
- Отслеживать, с какого сайта получено каждое объявление
- Получать все объявления по определенному источнику
- Анализировать статистику по источникам
- Управлять активностью источников

## Структура базы данных

### Таблица `sources`
- `id` - Уникальный идентификатор источника
- `name` - Системное имя источника (например, 'dubizzle')
- `display_name` - Отображаемое имя (например, 'Dubizzle')
- `base_url` - Базовый URL источника
- `is_active` - Активен ли источник
- `created_at` - Дата создания
- `updated_at` - Дата обновления

### Таблица `car_listings` (обновлена)
- Добавлено поле `source_id` - ссылка на источник
- Все остальные поля остались без изменений

## Миграция

### 1. Запуск миграции
```bash
node run_migration.js
```

Миграция выполнит:
- Создание таблицы `sources`
- Добавление поля `source_id` в `car_listings`
- Инициализацию источников из конфигураций парсеров
- Попытку определить источники для существующих записей

### 2. Демонстрация работы
```bash
node src/demo_sources.js
```

## Использование

### Получение всех активных источников
```javascript
const { databaseManager } = require('./src/database/database');

const sources = await databaseManager.getActiveSources();
console.log(sources);
```

### Получение объявлений по источнику
```javascript
// Получить первые 10 объявлений с Dubizzle
const dubizzleListings = await databaseManager.getListingsBySource('dubizzle', 10);

// Получить объявления с определенным смещением
const moreListings = await databaseManager.getListingsBySource('dubizzle', 10, 10);
```

### Получение источника по имени
```javascript
const dubizzleSource = await databaseManager.getSourceByName('dubizzle');
if (dubizzleSource) {
    console.log(`Источник: ${dubizzleSource.display_name}`);
    console.log(`URL: ${dubizzleSource.base_url}`);
    console.log(`Активен: ${dubizzleSource.is_active}`);
}
```

### Статистика по источникам
```javascript
const stats = await databaseManager.getStats();
console.log('Статистика по источникам:', stats.sourceStats);
```

## Доступные источники

По умолчанию инициализируются следующие источники:
- **dubizzle** - Dubizzle (https://www.dubizzle.com)
- **dubicars** - Dubicars (https://www.dubicars.com)
- **carswitch** - Carswitch (https://carswitch.com)
- **opensooq** - OpenSooq (https://www.opensooq.com)

## Добавление нового источника

```javascript
const newSource = await databaseManager.addSource({
    name: 'new_site',
    display_name: 'New Site',
    base_url: 'https://newsite.com',
    is_active: true
});
```

## SQL запросы для анализа

### Количество объявлений по источникам
```sql
SELECT s.display_name, COUNT(cl.id) as count
FROM sources s
LEFT JOIN car_listings cl ON s.id = cl.source_id
GROUP BY s.id, s.display_name
ORDER BY count DESC;
```

### Объявления конкретного источника
```sql
SELECT cl.*, s.display_name as source_name
FROM car_listings cl
JOIN sources s ON cl.source_id = s.id
WHERE s.name = 'dubizzle'
ORDER BY cl.created_at DESC;
```

### Статистика по ценам по источникам
```sql
SELECT 
    s.display_name,
    COUNT(cl.id) as total_listings,
    AVG(cl.price_raw) as avg_price,
    MIN(cl.price_raw) as min_price,
    MAX(cl.price_raw) as max_price
FROM sources s
LEFT JOIN car_listings cl ON s.id = cl.source_id
WHERE cl.price_raw > 0
GROUP BY s.id, s.display_name
ORDER BY avg_price DESC;
```

## Обновления парсеров

Все парсеры теперь автоматически:
- Получают ID источника при инициализации
- Включают `source_id` в нормализованные данные
- Сохраняют связь с источником в базе данных

## Файлы

- `src/database/schema.js` - Обновленная схема БД
- `src/database/database.js` - Обновленный DatabaseManager
- `src/parsers/BaseParser.js` - Обновленный базовый парсер
- `src/parsers/ParserRunner.js` - Обновленный раннер парсеров
- `src/migrate_sources.js` - Скрипт миграции
- `src/demo_sources.js` - Демонстрация работы
- `run_migration.js` - Запуск миграции
