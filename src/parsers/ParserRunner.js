const { configLoader } = require('./ConfigLoader');
const { startBrowser, logMemoryUsage, forceGarbageCollection } = require('../utils/browser');
const { MemoryManager } = require('../utils/memoryManager');
const { saveData } = require('../utils/saveData');
const { databaseManager } = require('../database/database');

/**
 * Система циклического запуска парсеров
 */
class ParserRunner {
    constructor() {
        this.isRunning = false;
        this.currentParser = null;
        this.browser = null;
        this.context = null;
        this.memoryManager = null;
        this.parserQueue = [];
        this.parserStats = new Map();
    }

    /**
     * Запуск циклического парсинга
     * @param {Array<string>} parserNames - Список имен парсеров для запуска
     * @param {Object} globalConfig - Глобальная конфигурация
     */
    async startCycling(parserNames = [], globalConfig = {}) {
        if (this.isRunning) {
            console.log("⚠️ Парсер уже запущен");
            return;
        }

        // Если не указаны парсеры, используем все доступные
        if (parserNames.length === 0) {
            parserNames = configLoader.getAvailableConfigs();
        }

        if (parserNames.length === 0) {
            console.error("❌ Нет доступных парсеров для запуска");
            return;
        }

        this.isRunning = true;
        this.parserQueue = [...parserNames];
        
        console.log(`🚀 Запуск циклического парсинга с парсерами: ${parserNames.join(', ')}`);

        // Инициализируем базу данных
        try {
            await databaseManager.initialize();
        } catch (error) {
            console.error("❌ Не удалось инициализировать базу данных:", error);
            console.log("⚠️ Парсер будет работать в режиме файлового сохранения");
        }

        // Инициализируем браузер
        try {
            const browserData = await startBrowser();
            this.browser = browserData.browser;
            this.context = browserData.context;
        } catch (error) {
            console.error("❌ Не удалось инициализировать браузер:", error);
            this.isRunning = false;
            return;
        }

        // Инициализируем менеджер памяти
        this.memoryManager = new MemoryManager();
        this.memoryManager.setConfig({
            memoryCheckInterval: 3,
            forceCleanupInterval: 10,
            maxMemoryMB: 512,
            cleanupThreshold: 0.7
        });

        // Запускаем цикл парсинга
        await this.runCycle(globalConfig);
    }

    /**
     * Основной цикл парсинга
     */
    async runCycle(globalConfig = {}) {
        let cycleCount = 0;

        while (this.isRunning) {
            cycleCount++;
            console.log(`\n🔄 === ЦИКЛ ${cycleCount} ===`);

            for (const parserName of this.parserQueue) {
                if (!this.isRunning) break;

                try {
                    await this.runParser(parserName, globalConfig);
                } catch (error) {
                    console.error(`❌ Ошибка при запуске парсера ${parserName}:`, error);
                }

                // Пауза между парсерами
                if (this.isRunning) {
                    console.log(`⏸️ Пауза между парсерами: 5 секунд`);
                    await this.delay(5000);
                }
            }

            // Очистка памяти после каждого цикла
            if (this.isRunning) {
                console.log(`🧹 Очистка памяти после цикла ${cycleCount}`);
                forceGarbageCollection();
                logMemoryUsage();
            }
        }

        console.log("✅ Циклический парсинг остановлен");
    }

    /**
     * Запуск одного парсера
     */
    async runParser(parserName, globalConfig = {}) {
        console.log(`\n🎯 Запуск парсера: ${parserName}`);

        // Проверяем доступность парсера
        if (!configLoader.getAvailableConfigs().includes(parserName)) {
            console.error(`❌ Парсер ${parserName} не найден!`);
            return;
        }

        // Создаем парсер
        const parser = configLoader.createParser(parserName, globalConfig);
        this.currentParser = parser;

        // Инициализируем парсер
        await parser.initialize(this.context);

        // Логируем использование памяти
        logMemoryUsage();

        let processedCount = 0;

        try {
            // Запускаем парсинг
            for await (const link of parser.getListings()) {
                if (!this.isRunning) break;

                console.log(`🚗 Обрабатываем ${link}`);
                try {
                    const rawData = await parser.parseListing(link);
                    if (rawData && parser.validateData(rawData)) {
                        const normalizedData = parser.normalizeData(rawData);
                        await saveData(normalizedData);
                        processedCount++;
                        this.memoryManager.increment();

                        // Проверяем и выполняем очистку памяти при необходимости
                        await this.memoryManager.checkAndCleanup();
                    } else {
                        console.warn(`⚠️ Данные для ${link} не прошли валидацию`);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при обработке ${link}:`, error);
                }
            }

            // Обновляем статистику парсера
            this.updateParserStats(parserName, processedCount);

        } catch (error) {
            console.error(`❌ Ошибка при парсинге ${parserName}:`, error);
        } finally {
            // Очищаем ресурсы парсера
            try {
                await parser.cleanup();
            } catch (cleanupError) {
                console.error("❌ Ошибка при очистке парсера:", cleanupError);
            }
        }

        console.log(`✅ Парсер ${parserName} завершил работу. Обработано: ${processedCount} объявлений`);
    }

    /**
     * Обновление статистики парсера
     */
    updateParserStats(parserName, processedCount) {
        const currentStats = this.parserStats.get(parserName) || {
            totalProcessed: 0,
            lastRun: null,
            runs: 0
        };

        currentStats.totalProcessed += processedCount;
        currentStats.lastRun = new Date();
        currentStats.runs++;

        this.parserStats.set(parserName, currentStats);
    }

    /**
     * Остановка циклического парсинга
     */
    async stop() {
        console.log("🛑 Остановка циклического парсинга...");
        this.isRunning = false;

        // Очищаем ресурсы текущего парсера
        if (this.currentParser) {
            try {
                await this.currentParser.cleanup();
            } catch (error) {
                console.error("❌ Ошибка при очистке текущего парсера:", error);
            }
        }

        // Закрываем браузер
        if (this.context) {
            try {
                await this.context.close();
            } catch (error) {
                console.error("❌ Ошибка при закрытии контекста:", error);
            }
        }

        if (this.browser) {
            try {
                await this.browser.close();
                console.log("🛑 Браузер закрыт");
            } catch (error) {
                console.error("❌ Ошибка при закрытии браузера:", error);
            }
        }

        // Финальная очистка памяти
        forceGarbageCollection();
        logMemoryUsage();

        // Выводим статистику
        this.printStats();
    }

    /**
     * Вывод статистики парсеров
     */
    printStats() {
        console.log("\n📊 === СТАТИСТИКА ПАРСЕРОВ ===");
        
        for (const [parserName, stats] of this.parserStats) {
            console.log(`\n🎯 ${parserName}:`);
            console.log(`   Всего обработано: ${stats.totalProcessed} объявлений`);
            console.log(`   Количество запусков: ${stats.runs}`);
            console.log(`   Последний запуск: ${stats.lastRun ? stats.lastRun.toLocaleString() : 'Никогда'}`);
        }

        const totalProcessed = Array.from(this.parserStats.values())
            .reduce((sum, stats) => sum + stats.totalProcessed, 0);
        
        console.log(`\n📈 Общий итог: ${totalProcessed} объявлений`);
    }

    /**
     * Получение статистики
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            currentParser: this.currentParser?.name || null,
            parserQueue: [...this.parserQueue],
            parserStats: Object.fromEntries(this.parserStats),
            memoryStats: this.memoryManager?.getMemoryStats() || null
        };
    }

    /**
     * Добавление парсера в очередь
     */
    addParser(parserName) {
        if (!this.parserQueue.includes(parserName)) {
            this.parserQueue.push(parserName);
            console.log(`✅ Парсер ${parserName} добавлен в очередь`);
        }
    }

    /**
     * Удаление парсера из очереди
     */
    removeParser(parserName) {
        const index = this.parserQueue.indexOf(parserName);
        if (index > -1) {
            this.parserQueue.splice(index, 1);
            console.log(`✅ Парсер ${parserName} удален из очереди`);
        }
    }

    /**
     * Задержка
     */
    async delay(ms) {
        await new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Создаем глобальный экземпляр раннера
const parserRunner = new ParserRunner();

module.exports = { ParserRunner, parserRunner };
