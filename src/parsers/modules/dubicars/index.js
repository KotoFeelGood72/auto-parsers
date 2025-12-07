const { DubicarsParser } = require('./DubicarsParser');
const { configLoader } = require('../../ConfigLoader');
const { startBrowser } = require('../../../utils/browser');

/**
 * Модуль парсера Dubicars
 */
class DubicarsModule {
    constructor() {
        this.name = 'Dubicars';
        this.config = this.loadConfig();
        this.parser = new DubicarsParser(this.config);
        this.browser = null;
        this.context = null;
    }

    /**
     * Загрузка конфигурации модуля из централизованного хранилища
     */
    loadConfig() {
        try {
            const config = configLoader.getConfig('dubicars');
            if (!config) {
                throw new Error(`Конфигурация ${this.name} не найдена в централизованном хранилище`);
            }
            return config;
        } catch (error) {
            console.error(`❌ Ошибка загрузки конфигурации ${this.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Получение списка объявлений
     */
    async* getListings() {
        console.log(`🚀 Запускаем парсер ${this.name}...`);
        yield* this.parser.getListings();
    }

    /**
     * Парсинг детальной информации об объявлении
     */
    async parseListing(url) {
        return await this.parser.parseListing(url);
    }

    /**
     * Нормализация данных
     */
    normalizeData(rawData) {
        return this.parser.normalizeData(rawData);
    }

    /**
     * Инициализация модуля
     */
    async initialize() {
        try {
            console.log(`🚀 Инициализация модуля ${this.name}...`);
            
            // Инициализируем браузер
            const browserData = await startBrowser();
            this.browser = browserData;
            this.context = await this.browser.newContext();
            
            // Инициализируем парсер с контекстом браузера
            await this.parser.initialize(this.context);
            
            console.log(`🚀 Инициализация парсера: ${this.name}`);
            console.log(`✅ Модуль ${this.name} инициализирован`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка инициализации модуля ${this.name}:`, error.message);
            return false;
        }
    }

    /**
     * Запуск парсера
     */
    async run() {
        try {
            console.log(`🚀 Запускаем парсер ${this.name}...`);
            
            // Запускаем парсинг
            const results = await this.parser.run();
            
            console.log(`✅ Парсер ${this.name} завершен. Обработано: ${results.length} объявлений`);
            
            // Закрываем браузер
            if (this.browser) {
                await this.browser.close();
            }
            
            return {
                success: true,
                processed: results.length,
                results: results
            };
            
        } catch (error) {
            console.error(`❌ Ошибка в модуле ${this.name}:`, error.message);
            
            // Закрываем браузер при ошибке
            if (this.browser) {
                await this.browser.close();
            }
            
            return {
                success: false,
                error: error.message,
                processed: 0
            };
        }
    }

    /**
     * Очистка ресурсов модуля
     */
    async cleanup() {
        try {
            if (this.parser && typeof this.parser.cleanup === 'function') {
                await this.parser.cleanup();
            }
        } catch (err) {
            console.error(`❌ Ошибка очистки парсера в модуле ${this.name}:`, err.message);
        }

        try {
            if (this.context) {
                await this.context.close();
            }
        } catch (err) {
            console.error(`❌ Ошибка закрытия контекста в модуле ${this.name}:`, err.message);
        }

        try {
            if (this.browser) {
                await this.browser.close();
            }
        } catch (err) {
            console.error(`❌ Ошибка закрытия браузера в модуле ${this.name}:`, err.message);
        }
    }

    /**
     * Получение информации о модуле
     */
    getInfo() {
        return {
            name: this.name,
            baseUrl: this.config.baseUrl,
            timeout: this.config.timeout
        };
    }

    /**
     * Проверка доступности модуля
     */
    async isAvailable() {
        // Пока что всегда возвращаем true
        // В будущем можно добавить реальную проверку доступности сайта
        return true;
    }
}

module.exports = { DubicarsModule };
