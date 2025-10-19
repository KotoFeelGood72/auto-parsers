# Модульная система парсеров

Система позволяет создавать модульные парсеры для разных сайтов и запускать их циклически.

## Структура проекта

```
src/parsers/
├── ConfigParser.js          # Базовый парсер
├── ModuleManager.js         # Менеджер модулей
└── modules/                 # Папка с модулями
    └── dubicars/           # Модуль Dubicars
        ├── index.js        # Основной файл модуля
        └── config.json     # Конфигурация модуля
```

## Создание нового модуля

1. **Создайте папку модуля**:
   ```bash
   mkdir src/parsers/modules/название_сайта
   ```

2. **Создайте файл модуля** (`index.js`):
   ```javascript
   const { ConfigParser } = require('../../ConfigParser');
   const fs = require('fs');
   const path = require('path');

   class НазваниеСайтаModule {
       constructor() {
           this.name = 'НазваниеСайта';
           this.configPath = path.join(__dirname, 'config.json');
           this.config = this.loadConfig();
           this.parser = new ConfigParser(this.config);
       }

       loadConfig() {
           const configData = fs.readFileSync(this.configPath, 'utf8');
           return JSON.parse(configData);
       }

       async* getListings() {
           yield* this.parser.getListings();
       }

       async parseListing(url) {
           return await this.parser.parseListing(url);
       }

       getInfo() {
           return {
               name: this.name,
               baseUrl: this.config.baseUrl,
               maxPages: this.config.maxPages
           };
       }

       async isAvailable() {
           // Проверка доступности сайта
           return true;
       }
   }

   module.exports = { НазваниеСайтаModule };
   ```

3. **Создайте конфигурацию** (`config.json`):
   ```json
   {
     "name": "НазваниеСайта",
     "baseUrl": "https://example.com",
     "listingsUrl": "https://example.com/cars?page={page}",
     "maxPages": 50,
     "timeout": 60000,
     "delayBetweenRequests": 1000,
     "selectors": {
       "listings": {
         "container": ".car-item",
         "link": "a.car-link"
       },
       "details": {
         "title": ".car-title",
         "price": ".price",
         "specs": {
           "make": {
             "label": "Make",
             "selector": ".specs li"
           }
         }
       }
     }
   }
   ```

## Запуск парсеров

### Циклический парсинг всех модулей:
```bash
node run_parsers.js
```

### Использование в коде:
```javascript
const { ParserModuleManager } = require('./src/parsers/ModuleManager');

const manager = new ParserModuleManager();

// Получить все модули
const modules = manager.getModules();

// Получить конкретный модуль
const dubicars = manager.getModule('dubicars');

// Запустить циклический парсинг
for await (const result of manager.runCyclicParsing()) {
    console.log(`Данные из ${result.module}:`, result.data);
}
```

## Преимущества модульной системы

1. **Модульность**: Каждый парсер изолирован в своей папке
2. **Циклический запуск**: Автоматическое переключение между модулями
3. **Легкое добавление**: Просто создайте новую папку с модулем
4. **Проверка доступности**: Автоматическая проверка доступности сайтов
5. **Централизованное управление**: Один менеджер для всех модулей

## Текущие модули

- **Dubicars** - парсер сайта dubicars.com
  - URL: https://www.dubicars.com
  - Макс. страниц: 50
  - Таймаут: 60 сек

## Добавление нового модуля

1. Скопируйте папку `dubicars` как шаблон
2. Переименуйте в название нового сайта
3. Обновите конфигурацию в `config.json`
4. Обновите класс в `index.js`
5. Перезапустите систему

Модуль автоматически будет обнаружен и добавлен в циклический парсинг!
