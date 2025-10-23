#!/usr/bin/env node

/**
 * Скрипт для демонстрации работы с источниками
 * Показывает как получать объявления по определенному источнику
 */

const { databaseManager } = require('./database/database');

async function demonstrateSources() {
    console.log('🔍 Демонстрация работы с источниками...');
    
    try {
        // Получаем все активные источники
        console.log('\n📋 Активные источники:');
        const sources = await databaseManager.getActiveSources();
        sources.forEach(source => {
            console.log(`  - ${source.display_name} (${source.name}) - ${source.base_url}`);
        });

        // Получаем статистику по источникам
        console.log('\n📊 Статистика по источникам:');
        const stats = await databaseManager.getStats();
        if (stats && stats.sourceStats) {
            stats.sourceStats.forEach(source => {
                console.log(`  ${source.display_name}: ${source.count} объявлений`);
            });
        }

        // Демонстрируем получение объявлений по каждому источнику
        for (const source of sources) {
            console.log(`\n🚗 Объявления с ${source.display_name} (первые 5):`);
            const listings = await databaseManager.getListingsBySource(source.name, 5);
            
            if (listings.length > 0) {
                listings.forEach((listing, index) => {
                    console.log(`  ${index + 1}. ${listing.title}`);
                    console.log(`     Цена: ${listing.price_formatted}`);
                    console.log(`     Год: ${listing.year}, Пробег: ${listing.kilometers} км`);
                    console.log(`     URL: ${listing.short_url}`);
                    console.log('');
                });
            } else {
                console.log(`  Нет объявлений с источника ${source.display_name}`);
            }
        }

        // Пример поиска конкретного источника
        console.log('\n🔍 Поиск источника "dubizzle":');
        const dubizzleSource = await databaseManager.getSourceByName('dubizzle');
        if (dubizzleSource) {
            console.log(`  Найден: ${dubizzleSource.display_name}`);
            console.log(`  URL: ${dubizzleSource.base_url}`);
            console.log(`  Активен: ${dubizzleSource.is_active ? 'Да' : 'Нет'}`);
            
            // Получаем несколько объявлений с этого источника
            const dubizzleListings = await databaseManager.getListingsBySource('dubizzle', 3);
            console.log(`  Количество объявлений: ${dubizzleListings.length}`);
        } else {
            console.log('  Источник "dubizzle" не найден');
        }

        console.log('\n✅ Демонстрация завершена!');

    } catch (error) {
        console.error('❌ Ошибка при демонстрации:', error);
    } finally {
        await databaseManager.close();
    }
}

// Запускаем демонстрацию
if (require.main === module) {
    demonstrateSources()
        .then(() => {
            console.log('🎉 Демонстрация завершена!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { demonstrateSources };
