const { BaseParser } = require('./BaseParser');
const { DubicarsParser } = require('./DubicarsParser');
const { DubizzleParser } = require('./DubizzleParser');

/**
 * Менеджер для управления парсерами
 */
class ParserManager {
    constructor() {
        this.parsers = new Map();
        this.registerDefaultParsers();
    }

    /**
     * Регистрация парсера по умолчанию
     */
    registerDefaultParsers() {
        this.register('dubicars', DubicarsParser);
        this.register('dubizzle', DubizzleParser);
    }

    /**
     * Регистрация нового парсера
     * @param {string} name - Имя парсера
     * @param {Class} ParserClass - Класс парсера
     */
    register(name, ParserClass) {
        if (!ParserClass.prototype instanceof BaseParser) {
            throw new Error(`Парсер ${name} должен наследоваться от BaseParser`);
        }
        this.parsers.set(name, ParserClass);
        console.log(`✅ Парсер ${name} зарегистрирован`);
    }

    /**
     * Получение парсера по имени
     * @param {string} name - Имя парсера
     * @param {Object} config - Конфигурация парсера
     * @returns {BaseParser} Экземпляр парсера
     */
    getParser(name, config = {}) {
        const ParserClass = this.parsers.get(name);
        if (!ParserClass) {
            throw new Error(`Парсер ${name} не найден. Доступные парсеры: ${Array.from(this.parsers.keys()).join(', ')}`);
        }
        return new ParserClass(config);
    }

    /**
     * Получение списка доступных парсеров
     * @returns {Array<string>} Массив имен парсеров
     */
    getAvailableParsers() {
        return Array.from(this.parsers.keys());
    }

    /**
     * Проверка существования парсера
     * @param {string} name - Имя парсера
     * @returns {boolean} true если парсер существует
     */
    hasParser(name) {
        return this.parsers.has(name);
    }

    /**
     * Удаление парсера
     * @param {string} name - Имя парсера
     * @returns {boolean} true если парсер был удален
     */
    unregister(name) {
        return this.parsers.delete(name);
    }

    /**
     * Получение информации о парсере
     * @param {string} name - Имя парсера
     * @returns {Object} Информация о парсере
     */
    getParserInfo(name) {
        const ParserClass = this.parsers.get(name);
        if (!ParserClass) {
            return null;
        }

        const instance = new ParserClass();
        return {
            name: instance.name,
            config: instance.config,
            methods: Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
                .filter(method => method !== 'constructor' && typeof instance[method] === 'function')
        };
    }

    /**
     * Получение статистики по всем парсерам
     * @returns {Object} Статистика парсеров
     */
    getStats() {
        const stats = {
            totalParsers: this.parsers.size,
            parsers: []
        };

        for (const [name, ParserClass] of this.parsers) {
            const instance = new ParserClass();
            stats.parsers.push({
                name: instance.name,
                config: instance.config
            });
        }

        return stats;
    }
}

// Создаем глобальный экземпляр менеджера
const parserManager = new ParserManager();

module.exports = { ParserManager, parserManager };
