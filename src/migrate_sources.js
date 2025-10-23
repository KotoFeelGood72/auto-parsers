#!/usr/bin/env node

/**
 * Скрипт миграции для добавления таблицы sources и связи с car_listings
 * Этот скрипт:
 * 1. Создает таблицу sources
 * 2. Добавляет поле source_id в car_listings
 * 3. Инициализирует источники
 * 4. Обновляет существующие записи (если возможно определить источник по URL)
 */

const { databaseManager } = require('./database/database');

async function migrateToSources() {
    console.log('🚀 Начинаем миграцию к новой схеме с источниками...');
    
    try {
        // Проверяем текущее состояние таблиц
        console.log('📊 Проверяем текущее состояние базы данных...');
        const tableStatus = await databaseManager.checkTables();
        console.log('Статус таблиц:', tableStatus);

        // Если таблица sources не существует, создаем её
        if (!tableStatus.sources) {
            console.log('🔧 Создаем таблицу sources...');
            await databaseManager.initialize();
        }

        // Инициализируем источники
        console.log('🔧 Инициализируем источники...');
        await databaseManager.initializeSources();

        // Если таблица car_listings существует, добавляем поле source_id
        if (tableStatus.car_listings) {
            console.log('🔧 Добавляем поле source_id в car_listings...');
            const client = await databaseManager.pool.connect();
            
            try {
                // Проверяем, существует ли уже поле source_id
                const columnCheck = await client.query(`
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'car_listings' 
                    AND column_name = 'source_id'
                `);

                if (columnCheck.rows.length === 0) {
                    // Добавляем поле source_id
                    await client.query(`
                        ALTER TABLE car_listings 
                        ADD COLUMN source_id INT REFERENCES sources(id) ON DELETE SET NULL
                    `);
                    console.log('✅ Поле source_id добавлено в car_listings');

                    // Создаем индекс для нового поля
                    await client.query(`
                        CREATE INDEX IF NOT EXISTS idx_car_listings_source_id 
                        ON car_listings(source_id)
                    `);
                    console.log('✅ Индекс для source_id создан');
                } else {
                    console.log('ℹ️ Поле source_id уже существует');
                }

                // Попытка определить источник для существующих записей по URL
                console.log('🔍 Пытаемся определить источники для существующих записей...');
                
                const updateResult = await client.query(`
                    UPDATE car_listings 
                    SET source_id = (
                        SELECT s.id 
                        FROM sources s 
                        WHERE car_listings.short_url LIKE '%' || s.name || '%'
                        LIMIT 1
                    )
                    WHERE source_id IS NULL
                `);

                console.log(`✅ Обновлено ${updateResult.rowCount} записей с определением источника`);

                // Статистика по источникам
                const sourceStats = await client.query(`
                    SELECT s.name, s.display_name, COUNT(cl.id) as count
                    FROM sources s
                    LEFT JOIN car_listings cl ON s.id = cl.source_id
                    GROUP BY s.id, s.name, s.display_name
                    ORDER BY count DESC
                `);

                console.log('\n📊 Статистика по источникам:');
                sourceStats.rows.forEach(row => {
                    console.log(`  ${row.display_name} (${row.name}): ${row.count} объявлений`);
                });

            } finally {
                client.release();
            }
        }

        // Получаем финальную статистику
        console.log('\n📊 Финальная статистика базы данных:');
        const stats = await databaseManager.getStats();
        if (stats) {
            console.log(`  Всего источников: ${stats.totalSources}`);
            console.log(`  Всего объявлений: ${stats.totalListings}`);
            console.log(`  Всего фотографий: ${stats.totalPhotos}`);
            
            if (stats.sourceStats && stats.sourceStats.length > 0) {
                console.log('\n  Статистика по источникам:');
                stats.sourceStats.forEach(source => {
                    console.log(`    ${source.display_name}: ${source.count} объявлений`);
                });
            }
        }

        console.log('\n✅ Миграция завершена успешно!');
        console.log('\nТеперь вы можете:');
        console.log('  - Получать все объявления по определенному источнику');
        console.log('  - Анализировать статистику по источникам');
        console.log('  - Управлять активностью источников');

    } catch (error) {
        console.error('❌ Ошибка при миграции:', error);
        process.exit(1);
    } finally {
        await databaseManager.close();
    }
}

// Запускаем миграцию
if (require.main === module) {
    migrateToSources()
        .then(() => {
            console.log('🎉 Миграция завершена!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { migrateToSources };
