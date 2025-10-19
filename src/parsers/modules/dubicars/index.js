const { DubicarsParser } = require('./DubicarsParser');
const { configLoader } = require('../../ConfigLoader');

/**
 * Модуль парсера Dubicars
 */
class DubicarsModule {
    constructor() {
        this.name = 'Dubicars';
        this.config = this.loadConfig();
        this.parser = new DubicarsParser(this.config);
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
     * Запуск парсера
     */
    async run() {
        try {
            console.log(`🚀 Запускаем парсер ${this.name}...`);
            
            // Инициализируем парсер с контекстом браузера
            await this.parser.initialize(this.context);
            
            // Запускаем парсинг
            const results = await this.parser.run();
            
            console.log(`✅ Парсер ${this.name} завершен. Обработано: ${results.length} объявлений`);
            return results;
            
        } catch (error) {
            console.error(`❌ Ошибка в модуле ${this.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Получение информации о модуле
     */
    getInfo() {
        return {
            name: this.name,
            baseUrl: this.config.baseUrl,
            maxPages: this.config.maxPages,
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
