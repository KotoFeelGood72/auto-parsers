const pool = require("./db");

async function recreateTables() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        console.log("🗑️ Удаляем старые таблицы...");
        
        // Удаляем таблицы в правильном порядке (сначала зависимые)
        await client.query("DROP TABLE IF EXISTS car_photos CASCADE;");
        await client.query("DROP TABLE IF EXISTS car_listings CASCADE;");

        console.log("🔧 Создаем новые таблицы...");

        // Таблица car_listings с правильной структурой
        const createCarListingsTable = `
            CREATE TABLE car_listings (
                id SERIAL PRIMARY KEY,
                short_url TEXT UNIQUE NOT NULL,
                title TEXT DEFAULT 'Неизвестно',
                make TEXT DEFAULT 'Неизвестно',
                model TEXT DEFAULT 'Неизвестно',
                year TEXT DEFAULT 'Неизвестно',
                body_type TEXT DEFAULT 'Неизвестно',
                horsepower TEXT DEFAULT 'Неизвестно',
                fuel_type TEXT DEFAULT 'Неизвестно',
                motors_trim TEXT DEFAULT 'Неизвестно',
                kilometers INT DEFAULT 0,
                price_formatted TEXT DEFAULT '0',
                price_raw NUMERIC DEFAULT 0,
                currency TEXT DEFAULT 'Неизвестно',
                exterior_color TEXT DEFAULT 'Неизвестно',
                location TEXT DEFAULT 'Неизвестно',
                phone TEXT DEFAULT 'Не указан',
                seller_name TEXT DEFAULT 'Неизвестен',
                seller_type TEXT DEFAULT 'Неизвестен',
                seller_logo TEXT,
                seller_profile_link TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;

        // Таблица car_photos
        const createCarPhotosTable = `
            CREATE TABLE car_photos (
                id SERIAL PRIMARY KEY,
                listing_id INT REFERENCES car_listings(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                UNIQUE(listing_id, photo_url)
            );
        `;

        await client.query(createCarListingsTable);
        await client.query(createCarPhotosTable);

        await client.query("COMMIT");
        console.log("✅ Таблицы успешно пересозданы с правильной структурой");
        
        // Показываем структуру новой таблицы
        const showColumnsQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'car_listings' 
            ORDER BY ordinal_position;
        `;
        
        const columns = await client.query(showColumnsQuery);
        console.log("\n📋 Структура таблицы car_listings:");
        columns.rows.forEach(row => {
            console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });

    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Ошибка при пересоздании таблиц:", error);
    } finally {
        client.release();
    }
}

// Запуск пересоздания таблиц
recreateTables().catch(console.error);
