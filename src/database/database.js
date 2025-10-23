const pool = require('../db');
const { 
    getCreateTablesSQL, 
    getCreateIndexesSQL, 
    getCreateTriggersSQL,
    getDropTablesSQL,
    getCheckTablesSQL
} = require('./schema');

/**
 * Класс для управления базой данных
 */
class DatabaseManager {
    constructor() {
        this.pool = pool;
    }

    /**
     * Инициализация базы данных (создание таблиц, индексов, триггеров)
     * @returns {Promise<boolean>} true если инициализация прошла успешно
     */
    async initialize() {
        const client = await this.pool.connect();
        
        try {
            await client.query("BEGIN");

            console.log("🔧 Создание таблиц...");
            const createTablesSQL = getCreateTablesSQL();
            for (const sql of createTablesSQL) {
                await client.query(sql);
            }

            console.log("🔧 Создание индексов...");
            const createIndexesSQL = getCreateIndexesSQL();
            for (const sql of createIndexesSQL) {
                await client.query(sql);
            }

            console.log("🔧 Создание триггеров...");
            const createTriggersSQL = getCreateTriggersSQL();
            for (const sql of createTriggersSQL) {
                await client.query(sql);
            }

            await client.query("COMMIT");
            console.log("✅ База данных инициализирована успешно");
            return true;

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("❌ Ошибка при инициализации базы данных:", error);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Пересоздание базы данных (удаление и создание заново)
     * @returns {Promise<boolean>} true если пересоздание прошло успешно
     */
    async recreate() {
        const client = await this.pool.connect();
        
        try {
            await client.query("BEGIN");

            console.log("🗑️ Удаление старых таблиц...");
            const dropTablesSQL = getDropTablesSQL();
            for (const sql of dropTablesSQL) {
                await client.query(sql);
            }

            console.log("🔧 Создание новых таблиц...");
            const createTablesSQL = getCreateTablesSQL();
            for (const sql of createTablesSQL) {
                await client.query(sql);
            }

            console.log("🔧 Создание индексов...");
            const createIndexesSQL = getCreateIndexesSQL();
            for (const sql of createIndexesSQL) {
                await client.query(sql);
            }

            console.log("🔧 Создание триггеров...");
            const createTriggersSQL = getCreateTriggersSQL();
            for (const sql of createTriggersSQL) {
                await client.query(sql);
            }

            await client.query("COMMIT");
            console.log("✅ База данных пересоздана успешно");
            return true;

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("❌ Ошибка при пересоздании базы данных:", error);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Проверка существования таблиц
     * @returns {Promise<Object>} Объект с информацией о существующих таблицах
     */
    async checkTables() {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(getCheckTablesSQL()[0]);
            const existingTables = result.rows.map(row => row.table_name);
            
            return {
                sources: existingTables.includes('sources'),
                car_listings: existingTables.includes('car_listings'),
                car_photos: existingTables.includes('car_photos'),
                allTablesExist: existingTables.length === 3
            };
        } catch (error) {
            console.error("❌ Ошибка при проверке таблиц:", error);
            return {
                sources: false,
                car_listings: false,
                car_photos: false,
                allTablesExist: false
            };
        } finally {
            client.release();
        }
    }

    /**
     * Получение статистики базы данных
     * @returns {Promise<Object>} Статистика БД
     */
    async getStats() {
        const client = await this.pool.connect();
        
        try {
            const stats = {};
            
            // Количество источников
            const sourcesResult = await client.query('SELECT COUNT(*) as count FROM sources');
            stats.totalSources = parseInt(sourcesResult.rows[0].count);

            // Количество записей в car_listings
            const listingsResult = await client.query('SELECT COUNT(*) as count FROM car_listings');
            stats.totalListings = parseInt(listingsResult.rows[0].count);

            // Количество записей в car_photos
            const photosResult = await client.query('SELECT COUNT(*) as count FROM car_photos');
            stats.totalPhotos = parseInt(photosResult.rows[0].count);

            // Статистика по источникам
            const sourceStats = await client.query(`
                SELECT s.name, s.display_name, COUNT(cl.id) as count 
                FROM sources s
                LEFT JOIN car_listings cl ON s.id = cl.source_id
                GROUP BY s.id, s.name, s.display_name
                ORDER BY count DESC
            `);
            stats.sourceStats = sourceStats.rows;

            // Статистика по маркам
            const makeStats = await client.query(`
                SELECT make, COUNT(*) as count 
                FROM car_listings 
                WHERE make != 'Неизвестно' 
                GROUP BY make 
                ORDER BY count DESC 
                LIMIT 10
            `);
            stats.topMakes = makeStats.rows;

            // Статистика по годам
            const yearStats = await client.query(`
                SELECT year, COUNT(*) as count 
                FROM car_listings 
                WHERE year != 'Неизвестно' 
                GROUP BY year 
                ORDER BY year DESC 
                LIMIT 10
            `);
            stats.topYears = yearStats.rows;

            // Средняя цена
            const priceStats = await client.query(`
                SELECT 
                    AVG(price_raw) as avg_price,
                    MIN(price_raw) as min_price,
                    MAX(price_raw) as max_price
                FROM car_listings 
                WHERE price_raw > 0
            `);
            stats.priceStats = priceStats.rows[0];

            return stats;
        } catch (error) {
            console.error("❌ Ошибка при получении статистики:", error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Очистка базы данных (удаление всех данных)
     * @returns {Promise<boolean>} true если очистка прошла успешно
     */
    async clear() {
        const client = await this.pool.connect();
        
        try {
            await client.query("BEGIN");

            console.log("🗑️ Очистка данных...");
            await client.query('DELETE FROM car_photos');
            await client.query('DELETE FROM car_listings');

            await client.query("COMMIT");
            console.log("✅ База данных очищена");
            return true;

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("❌ Ошибка при очистке базы данных:", error);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Добавление нового источника
     * @param {Object} sourceData - Данные источника
     * @returns {Promise<Object|null>} Созданный источник или null при ошибке
     */
    async addSource(sourceData) {
        const client = await this.pool.connect();
        
        try {
            const { name, display_name, base_url, is_active = true } = sourceData;
            
            const result = await client.query(`
                INSERT INTO sources (name, display_name, base_url, is_active)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [name, display_name, base_url, is_active]);
            
            console.log(`✅ Источник "${name}" добавлен`);
            return result.rows[0];
        } catch (error) {
            console.error("❌ Ошибка при добавлении источника:", error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Получение источника по имени
     * @param {string} name - Имя источника
     * @returns {Promise<Object|null>} Источник или null если не найден
     */
    async getSourceByName(name) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT * FROM sources WHERE name = $1
            `, [name]);
            
            return result.rows[0] || null;
        } catch (error) {
            console.error("❌ Ошибка при получении источника:", error);
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Получение всех активных источников
     * @returns {Promise<Array>} Массив активных источников
     */
    async getActiveSources() {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT * FROM sources WHERE is_active = true ORDER BY name
            `);
            
            return result.rows;
        } catch (error) {
            console.error("❌ Ошибка при получении активных источников:", error);
            return [];
        } finally {
            client.release();
        }
    }

    /**
     * Получение всех объявлений по источнику
     * @param {string} sourceName - Имя источника
     * @param {number} limit - Лимит записей
     * @param {number} offset - Смещение
     * @returns {Promise<Array>} Массив объявлений
     */
    async getListingsBySource(sourceName, limit = 100, offset = 0) {
        const client = await this.pool.connect();
        
        try {
            const result = await client.query(`
                SELECT cl.*, s.name as source_name, s.display_name as source_display_name
                FROM car_listings cl
                JOIN sources s ON cl.source_id = s.id
                WHERE s.name = $1
                ORDER BY cl.created_at DESC
                LIMIT $2 OFFSET $3
            `, [sourceName, limit, offset]);
            
            return result.rows;
        } catch (error) {
            console.error("❌ Ошибка при получении объявлений по источнику:", error);
            return [];
        } finally {
            client.release();
        }
    }

    /**
     * Инициализация источников из конфигураций парсеров
     * @returns {Promise<boolean>} true если инициализация прошла успешно
     */
    async initializeSources() {
        const client = await this.pool.connect();
        
        try {
            await client.query("BEGIN");

            // Источники из конфигураций
            const sources = [
                { name: 'dubizzle', display_name: 'Dubizzle', base_url: 'https://www.dubizzle.com' },
                { name: 'dubicars', display_name: 'Dubicars', base_url: 'https://www.dubicars.com' },
                { name: 'carswitch', display_name: 'Carswitch', base_url: 'https://carswitch.com' },
                { name: 'opensooq', display_name: 'OpenSooq', base_url: 'https://www.opensooq.com' }
            ];

            for (const source of sources) {
                // Проверяем, существует ли источник
                const existing = await client.query(`
                    SELECT id FROM sources WHERE name = $1
                `, [source.name]);

                if (existing.rows.length === 0) {
                    await client.query(`
                        INSERT INTO sources (name, display_name, base_url, is_active)
                        VALUES ($1, $2, $3, $4)
                    `, [source.name, source.display_name, source.base_url, true]);
                    console.log(`✅ Источник "${source.name}" инициализирован`);
                } else {
                    console.log(`ℹ️ Источник "${source.name}" уже существует`);
                }
            }

            await client.query("COMMIT");
            console.log("✅ Источники инициализированы успешно");
            return true;

        } catch (error) {
            await client.query("ROLLBACK");
            console.error("❌ Ошибка при инициализации источников:", error);
            return false;
        } finally {
            client.release();
        }
    }

    /**
     * Закрытие соединения с базой данных
     */
    async close() {
        await this.pool.end();
        console.log("🔌 Соединение с базой данных закрыто");
    }
}

// Создаем глобальный экземпляр менеджера БД
const databaseManager = new DatabaseManager();

module.exports = { DatabaseManager, databaseManager };
