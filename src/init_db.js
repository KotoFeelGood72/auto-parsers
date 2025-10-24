const { databaseManager } = require('./database/database');

async function initDB() {
    try {
        console.log('🚀 Инициализация базы данных...');
        
        // Используем современный databaseManager
        const success = await databaseManager.initialize();
        
        if (success) {
            console.log('✅ База данных инициализирована успешно');
            
            // Инициализируем источники
            await databaseManager.initializeSources();
            console.log('✅ Источники инициализированы');
        } else {
            console.error('❌ Ошибка при инициализации базы данных');
        }
    } catch (error) {
        console.error('❌ Ошибка при инициализации:', error);
    } finally {
        await databaseManager.close();
    }
}

// Запуск инициализации БД
initDB().catch(console.error);