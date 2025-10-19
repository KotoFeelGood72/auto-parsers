require('dotenv').config();
const { runCyclicParsing } = require("../run_parsers");

// Обработка сигналов для корректного завершения
process.on('SIGINT', async () => {
    console.log('\n🛑 Получен сигнал SIGINT. Останавливаем парсер...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Получен сигнал SIGTERM. Останавливаем парсер...');
    process.exit(0);
});

// Получаем параметры из командной строки или переменных окружения
const mode = process.argv[2] || process.env.PARSER_MODE || 'cycle';
const parserNames = process.argv[3] ? process.argv[3].split(',') : (process.env.PARSER_NAMES ? process.env.PARSER_NAMES.split(',') : []);
const globalConfig = {
    maxPages: parseInt(process.env.MAX_PAGES) || 10,
    delayBetweenRequests: parseInt(process.env.DELAY_MS) || 1000,
    enableImageLoading: process.env.ENABLE_IMAGES === 'true'
};

// Запускаем парсер
(async () => {
    console.log("🔧 Конфигурация парсера:");
    console.log(`   Режим: ${mode}`);
    console.log(`   Парсеры: ${parserNames.length > 0 ? parserNames.join(', ') : 'все доступные'}`);
    console.log(`   Максимум страниц: ${globalConfig.maxPages}`);
    console.log(`   Задержка между запросами: ${globalConfig.delayBetweenRequests}ms`);
    console.log(`   Загрузка изображений: ${globalConfig.enableImageLoading}`);
    console.log("");

    if (mode === 'cycle') {
        // Циклический режим - парсеры запускаются по очереди бесконечно
        console.log("🔄 Запуск в циклическом режиме");
        await runCyclicParsing();
    } else if (mode === 'single') {
        // Одиночный режим - запуск одного парсера
        console.log(`🎯 Запуск парсера в одиночном режиме`);
        await runCyclicParsing();
    } else {
        console.error(`❌ Неизвестный режим: ${mode}`);
        console.log("Доступные режимы: cycle, single");
    }
})();