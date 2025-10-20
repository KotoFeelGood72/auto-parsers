/**
 * Запуск конкретного модуля парсера
 * Использование: node run_module.js dubicars
 */

const { DubicarsModule } = require('./src/parsers/modules/dubicars/index');
const { OneclickdriveModule } = require('./src/parsers/modules/oneclickdrive/index');
const { AutotradersModule } = require('./src/parsers/modules/autotraders/index');

// Реестр доступных модулей
const modules = {
    dubicars: DubicarsModule,
    oneclickdrive: OneclickdriveModule,
    autotraders: AutotradersModule,
};

async function runModule(moduleName) {
    console.log(`🚀 Запуск модуля ${moduleName}...`);
    
    const ModuleClass = modules[moduleName];
    if (!ModuleClass) {
        throw new Error(`Модуль ${moduleName} не найден`);
    }
    
    const module = new ModuleClass();
    
    try {
        // Инициализируем модуль
        const initialized = await module.initialize();
        if (!initialized) {
            throw new Error('Не удалось инициализировать модуль');
        }
        
        // Запускаем парсинг
        const result = await module.run();
        
        if (result.success) {
            console.log(`✅ Модуль ${moduleName} выполнен успешно`);
            console.log(`📊 Обработано объявлений: ${result.processed}`);
        } else {
            console.log(`❌ Модуль ${moduleName} завершился с ошибками: ${result.error}`);
            process.exit(1);
        }
        
    } catch (error) {
        console.error(`❌ Ошибка при запуске модуля ${moduleName}:`, error.message);
        process.exit(1);
    }
}

// Получаем имя модуля из аргументов командной строки
const moduleName = process.argv[2];

if (!moduleName) {
    console.log('❌ Укажите имя модуля для запуска');
    console.log('📋 Доступные модули:');
    console.log('   - dubicars (автономный модуль)');
    console.log('   - oneclickdrive (автономный модуль)');
    console.log('   - autotraders (автономный модуль)');
    console.log('');
    console.log('💡 Использование: node run_module.js <имя_модуля>');
    process.exit(1);
}

// Запускаем модуль
runModule(moduleName).catch(error => {
    console.error('❌ Необработанная ошибка:', error);
    process.exit(1);
});
