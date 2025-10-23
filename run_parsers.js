const { ParserModuleManager } = require('./src/parsers/ModuleManager');
const { saveData } = require('./src/utils/saveData');
const { startBrowser } = require('./src/utils/browser');

/**
 * Основной файл для запуска циклического парсинга
 */
async function runCyclicParsing() {
    console.log('🚀 Запуск парсера...');
    
    let browser = null;
    
    try {
        // Инициализируем браузер
        browser = await startBrowser();
        const context = await browser.newContext();
        
        // Создаем менеджер модулей
        const moduleManager = new ParserModuleManager();
        
        // Передаем контекст браузера в модули
        for (const [name, module] of moduleManager.modules) {
            module.context = context;
        }
        
        // Показываем информацию о модулях
        const modulesInfo = moduleManager.getModulesInfo();
        console.log(`📊 Модули: ${Object.keys(modulesInfo).join(', ')}`);
        
        // Запускаем циклический парсинг
        let totalProcessed = 0;
        
        for await (const result of moduleManager.runCyclicParsing()) { // Убрано ограничение на 2 итерации
            // Сохраняем данные в базу
            try {
                await saveData(result.data);
                totalProcessed++;
                console.log(`✅ ${result.data.title} - ${result.data.price_formatted} (${totalProcessed})`);
            } catch (error) {
                console.error(`❌ Ошибка сохранения: ${error.message}`);
            }
        }
        
        console.log(`🎉 Завершено: ${totalProcessed} объявлений`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        // Закрываем браузер
        if (browser) {
            await browser.close();
        }
    }
}

// Запускаем парсинг
if (require.main === module) {
    runCyclicParsing().catch(console.error);
}

module.exports = { runCyclicParsing };