#!/usr/bin/env node

/**
 * Комплексный тест системы источников
 * Проверяет все компоненты новой функциональности
 */

const { databaseManager } = require('./src/database/database');

async function testSourcesSystem() {
    console.log('🧪 Комплексное тестирование системы источников...\n');
    
    try {
        // 1. Проверка инициализации базы данных
        console.log('1️⃣ Проверка инициализации базы данных...');
        await databaseManager.initialize();
        await databaseManager.initializeSources();
        console.log('✅ База данных инициализирована\n');

        // 2. Проверка таблиц
        console.log('2️⃣ Проверка существования таблиц...');
        const tableStatus = await databaseManager.checkTables();
        console.log('Статус таблиц:', tableStatus);
        
        if (!tableStatus.allTablesExist) {
            throw new Error('Не все таблицы созданы');
        }
        console.log('✅ Все таблицы существуют\n');

        // 3. Проверка источников
        console.log('3️⃣ Проверка источников...');
        const sources = await databaseManager.getActiveSources();
        console.log(`Найдено активных источников: ${sources.length}`);
        sources.forEach(source => {
            console.log(`  - ${source.display_name} (${source.name})`);
        });
        console.log('✅ Источники загружены\n');

        // 4. Тест получения источника по имени
        console.log('4️⃣ Тест получения источника по имени...');
        const dubizzleSource = await databaseManager.getSourceByName('dubizzle');
        if (dubizzleSource) {
            console.log(`✅ Источник Dubizzle найден: ID ${dubizzleSource.id}`);
        } else {
            console.log('⚠️ Источник Dubizzle не найден');
        }

        // 5. Тест получения объявлений по источнику
        console.log('\n5️⃣ Тест получения объявлений по источнику...');
        const listings = await databaseManager.getListingsBySource('dubizzle', 5);
        console.log(`Найдено объявлений с Dubizzle: ${listings.length}`);
        
        if (listings.length > 0) {
            console.log('Примеры объявлений:');
            listings.slice(0, 3).forEach((listing, index) => {
                console.log(`  ${index + 1}. ${listing.title}`);
                console.log(`     Источник: ${listing.source_display_name}`);
                console.log(`     Цена: ${listing.price_formatted}`);
            });
        } else {
            console.log('ℹ️ Нет объявлений с источника Dubizzle');
        }

        // 6. Статистика
        console.log('\n6️⃣ Получение статистики...');
        const stats = await databaseManager.getStats();
        if (stats) {
            console.log(`Всего источников: ${stats.totalSources}`);
            console.log(`Всего объявлений: ${stats.totalListings}`);
            console.log(`Всего фотографий: ${stats.totalPhotos}`);
            
            if (stats.sourceStats && stats.sourceStats.length > 0) {
                console.log('\nСтатистика по источникам:');
                stats.sourceStats.forEach(source => {
                    console.log(`  ${source.display_name}: ${source.count} объявлений`);
                });
            }
        }

        // 7. Тест добавления нового источника
        console.log('\n7️⃣ Тест добавления нового источника...');
        const testSource = await databaseManager.addSource({
            name: 'test_source',
            display_name: 'Test Source',
            base_url: 'https://test.com',
            is_active: true
        });
        
        if (testSource) {
            console.log(`✅ Тестовый источник добавлен: ID ${testSource.id}`);
            
            // Удаляем тестовый источник
            const client = await databaseManager.pool.connect();
            await client.query('DELETE FROM sources WHERE id = $1', [testSource.id]);
            client.release();
            console.log('✅ Тестовый источник удален');
        }

        console.log('\n🎉 Все тесты пройдены успешно!');
        console.log('\nСистема источников готова к использованию!');
        console.log('\nДоступные команды:');
        console.log('  - node src/demo_sources.js - демонстрация работы');
        console.log('  - node run_migration.js - повторная миграция');
        console.log('  - node src/index.js - запуск парсеров');

    } catch (error) {
        console.error('❌ Ошибка при тестировании:', error);
        process.exit(1);
    } finally {
        await databaseManager.close();
    }
}

// Запускаем тесты
if (require.main === module) {
    testSourcesSystem()
        .then(() => {
            console.log('\n🏁 Тестирование завершено!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { testSourcesSystem };
