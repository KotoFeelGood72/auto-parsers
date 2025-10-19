/**
 * Основной файл для запуска всех парсеров
 * Запускает все модули парсеров циклично
 */

const { ParserManager } = require('./src/parsers/ParserManager');

async function main() {
    console.log('🚀 Запуск системы парсеров автомобилей...');
    
    const manager = new ParserManager();
    
    try {
        // Регистрируем модули
        manager.registerModules();
        
        // Инициализируем все модули
        const initialized = await manager.initializeAll();
        
        if (!initialized) {
            console.error('❌ Не удалось инициализировать ни одного модуля');
            process.exit(1);
        }
        
        // Показываем статус
        console.log('\n📊 Статус модулей:');
        const status = manager.getStatus();
        status.modules.forEach((module, index) => {
            const statusIcon = module.initialized ? '✅' : '❌';
            console.log(`   ${statusIcon} ${module.name}: ${module.initialized ? 'Готов' : 'Ошибка'}`);
        });
        
        // Запускаем циклический парсинг
        console.log('\n🔄 Запуск циклического парсинга...');
        console.log('💡 Для остановки нажмите Ctrl+C');
        
        await manager.startCyclicParsing();
        
    } catch (error) {
        console.error('❌ Критическая ошибка:', error.message);
        process.exit(1);
    }
}

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
    console.log('\n🛑 Получен сигнал завершения...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Получен сигнал завершения...');
    process.exit(0);
});

// Запускаем основную функцию
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Необработанная ошибка:', error);
        process.exit(1);
    });
}

module.exports = { main };
