const { ParserModuleManager } = require('./src/parsers/ModuleManager');
const { saveData } = require('./src/utils/saveData');
const { startBrowser } = require('./src/utils/browser');

/**
 * Основной файл для запуска циклического парсинга
 */
async function runCyclicParsing() {
    console.log('🚀 Запускаем циклический парсинг...');
    
    let browser = null;
    
    try {
        // Инициализируем браузер
        console.log('🌐 Инициализируем браузер...');
        browser = await startBrowser();
        const context = await browser.newContext();
        
        // Создаем менеджер модулей
        const moduleManager = new ParserModuleManager();
        
        // Передаем контекст браузера в модули
        for (const [name, module] of moduleManager.modules) {
            module.context = context;
        }
        
        // Показываем информацию о модулях
        console.log('\n📊 Информация о модулях:');
        const modulesInfo = moduleManager.getModulesInfo();
        for (const [name, info] of Object.entries(modulesInfo)) {
            console.log(`   ${name}: ${info.baseUrl} (макс. страниц: ${info.maxPages})`);
        }
        
        // Проверяем доступность модулей
        console.log('\n🔍 Проверяем доступность модулей...');
        const availability = await moduleManager.checkAvailability();
        for (const [name, isAvailable] of Object.entries(availability)) {
            console.log(`   ${name}: ${isAvailable ? '✅ Доступен' : '❌ Недоступен'}`);
        }
        
        // Запускаем циклический парсинг
        console.log('\n🔄 Начинаем циклический парсинг...');
        let totalProcessed = 0;
        
        for await (const result of moduleManager.runCyclicParsing(2)) { // 2 итерации для теста
            console.log(`\n📝 Обрабатываем данные из модуля ${result.module}:`);
            console.log(`   URL: ${result.url}`);
            console.log(`   Название: ${result.data.title}`);
            console.log(`   Цена: ${result.data.price_formatted}`);
            
            // Сохраняем данные в базу
            try {
                await saveData(result.data);
                totalProcessed++;
                console.log(`✅ Данные сохранены (всего обработано: ${totalProcessed})`);
            } catch (error) {
                console.error(`❌ Ошибка сохранения данных:`, error.message);
            }
        }
        
        console.log(`\n🎉 Циклический парсинг завершен! Всего обработано: ${totalProcessed} объявлений`);
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error);
    } finally {
        // Закрываем браузер
        if (browser) {
            console.log('🔒 Закрываем браузер...');
            await browser.close();
        }
    }
}

// Запускаем парсинг
if (require.main === module) {
    runCyclicParsing().catch(console.error);
}

module.exports = { runCyclicParsing };
