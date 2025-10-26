const { configLoader } = require('./ConfigLoader');
const { startBrowser, logMemoryUsage, forceGarbageCollection } = require('../utils/browser');
const { saveData } = require('../utils/saveData');
const { databaseManager } = require('../database/database');
const { ParserModuleManager } = require('./ModuleManager');
const { errorHandler } = require('../services/ErrorHandler');
const { telegramService } = require('../services/TelegramService');

/**
 * Система циклического запуска парсеров
 */
class ParserRunner {
    constructor() {
        this.isRunning = false;
        this.currentParser = null;
        this.browser = null;
        this.context = null;
        this.memoryCheckCounter = 0;
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
        
        console.log(`🚀 Запуск парсеров: ${parserNames.join(', ')}`);

        // Отправляем уведомление о запуске парсеров
        if (telegramService.getStatus().enabled) {
            await telegramService.sendParserStartNotification('ParserRunner', { 
                mode: 'cycle',
                parsers: parserNames.join(', ')
            });
        }

        // Инициализируем базу данных
        try {
            await databaseManager.initialize();
            // Инициализируем источники
            await databaseManager.initializeSources();
        } catch (error) {
            console.error("❌ База данных недоступна, используем файлы");
            await errorHandler.handleSystemError('database', error, {
                component: 'ParserRunner',
                action: 'initialize'
            });
        }

        // Инициализируем браузер
        try {
            const browserData = await startBrowser();
            this.browser = browserData.browser;
            this.context = browserData.context;
        } catch (error) {
            console.error("❌ Не удалось инициализировать браузер:", error);
            await errorHandler.handleBrowserError('ParserRunner', error, {
                component: 'ParserRunner',
                action: 'startBrowser'
            });
            this.isRunning = false;
            return;
        }

        // Инициализируем счетчик для проверки памяти
        this.memoryCheckCounter = 0;

        // Запускаем цикл парсинга
        await this.runCycle(globalConfig, databaseManager);
    }

    /**
     * Основной цикл парсинга
     */
    async runCycle(globalConfig = {}, databaseManager = null) {
        let cycleCount = 0;

        while (this.isRunning) {
            cycleCount++;
            console.log(`🔄 Цикл ${cycleCount}`);

            for (const parserName of this.parserQueue) {
                if (!this.isRunning) break;

                try {
                    await this.runParser(parserName, globalConfig, databaseManager);
                } catch (error) {
                    console.error(`❌ Ошибка парсера ${parserName}: ${error.message}`);
                    await errorHandler.handleParserError(parserName, error, {
                        parserName,
                        cycleCount,
                        context: 'parser_runner'
                    });
                }

                // Пауза между парсерами
                if (this.isRunning) {
                    await this.delay(5000);
                }
            }

            // Очистка памяти после каждого цикла
            if (this.isRunning) {
                forceGarbageCollection();
            }
        }

        console.log("✅ Циклический парсинг остановлен");
    }

    /**
     * Запуск одного парсера
     */
    async runParser(parserName, globalConfig = {}, databaseManager = null) {
        console.log(`🎯 ${parserName}`);

        // Проверяем доступность парсера
        if (!configLoader.getAvailableConfigs().includes(parserName)) {
            console.error(`❌ Парсер ${parserName} не найден!`);
            const error = new Error(`Парсер ${parserName} не найден`);
            await errorHandler.handleParserError(parserName, error, {
                parserName,
                context: 'parser_not_found'
            });
            return;
        }

        // Создаем парсер через ModuleManager
        const moduleManager = new ParserModuleManager();
        const parser = moduleManager.getModule(parserName);
        if (!parser) {
            console.error(`❌ Парсер ${parserName} не найден в модулях`);
            const error = new Error(`Парсер ${parserName} не найден в модулях`);
            await errorHandler.handleParserError(parserName, error, {
                parserName,
                context: 'parser_not_found'
            });
            return;
        }
        this.currentParser = parser;

        // Инициализируем парсер
        try {
            await parser.initialize(this.context, databaseManager);
        } catch (error) {
            console.error(`❌ Ошибка инициализации парсера ${parserName}:`, error);
            await errorHandler.handleParserError(parserName, error, {
                parserName,
                context: 'parser_initialization'
            });
            return;
        }

        let processedCount = 0;

        try {
            // Запускаем парсинг
            for await (const link of parser.getListings()) {
                if (!this.isRunning) break;

                try {
                    const rawData = await parser.parseListing(link);
                    if (rawData && parser.validateData(rawData)) {
                        const normalizedData = parser.normalizeData(rawData);
                        await saveData(normalizedData);
                        processedCount++;
                        this.memoryCheckCounter++;

                        // Проверяем память каждые 10 обработанных элементов
                        if (this.memoryCheckCounter % 10 === 0) {
                            logMemoryUsage();
                        }
                    }
                } catch (error) {
                    console.error(`❌ Ошибка обработки: ${error.message}`);
                    await errorHandler.handleParsingError(parserName, error, {
                        url: link,
                        parserName,
                        context: 'listing_processing'
                    });
                }
            }

            // Обновляем статистику парсера
            this.updateParserStats(parserName, processedCount);

            // Отправляем уведомление об успешном завершении
            if (telegramService.getStatus().enabled && processedCount > 0) {
                await telegramService.sendParserSuccessNotification(parserName, {
                    processed: processedCount,
                    duration: 'completed'
                });
            }

        } catch (error) {
            console.error(`❌ Ошибка парсинга ${parserName}: ${error.message}`);
            await errorHandler.handleParserError(parserName, error, {
                parserName,
                context: 'main_parsing_loop'
            });
        } finally {
            // Очищаем ресурсы парсера
            try {
                await parser.cleanup();
            } catch (cleanupError) {
                console.error("❌ Ошибка очистки:", cleanupError.message);
                await errorHandler.handleSystemError('parser_cleanup', cleanupError, {
                    parserName,
                    context: 'cleanup'
                });
            }
        }

        console.log(`✅ ${parserName}: ${processedCount} объявлений`);
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
        console.log("🛑 Остановка...");
        this.isRunning = false;

        // Очищаем ресурсы текущего парсера
        if (this.currentParser) {
            try {
                await this.currentParser.cleanup();
            } catch (error) {
                console.error("❌ Ошибка очистки парсера:", error.message);
                await errorHandler.handleSystemError('parser_cleanup', error, {
                    component: 'ParserRunner',
                    action: 'stop_cleanup'
                });
            }
        }

        // Закрываем браузер
        if (this.context) {
            try {
                await this.context.close();
            } catch (error) {
                console.error("❌ Ошибка закрытия контекста:", error.message);
                await errorHandler.handleBrowserError('ParserRunner', error, {
                    component: 'ParserRunner',
                    action: 'close_context'
                });
            }
        }

        if (this.browser) {
            try {
                await this.browser.close();
            } catch (error) {
                console.error("❌ Ошибка закрытия браузера:", error.message);
                await errorHandler.handleBrowserError('ParserRunner', error, {
                    component: 'ParserRunner',
                    action: 'close_browser'
                });
            }
        }

        // Финальная очистка памяти
        forceGarbageCollection();

        // Выводим статистику
        this.printStats();
    }

    /**
     * Вывод статистики парсеров
     */
    printStats() {
        console.log("\n📊 Статистика:");
        
        for (const [parserName, stats] of this.parserStats) {
            console.log(`   ${parserName}: ${stats.totalProcessed} объявлений`);
        }

        const totalProcessed = Array.from(this.parserStats.values())
            .reduce((sum, stats) => sum + stats.totalProcessed, 0);
        
        console.log(`   Всего: ${totalProcessed} объявлений`);
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
            memoryStats: this.getMemoryStats()
        };
    }

    /**
     * Получение статистики памяти
     */
    getMemoryStats() {
        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024),
            processedCount: this.memoryCheckCounter
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
