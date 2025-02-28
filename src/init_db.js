const pool = require("../db");

async function initDB() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Таблица car_listings
        const createCarListingsTable = `
            CREATE TABLE IF NOT EXISTS car_listings (
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
            CREATE TABLE IF NOT EXISTS car_photos (
                id SERIAL PRIMARY KEY,
                listing_id INT REFERENCES car_listings(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                UNIQUE(listing_id, photo_url)
            );
        `;

        await client.query(createCarListingsTable);
        await client.query(createCarPhotosTable);

        await client.query("COMMIT");
        console.log("✅ Таблицы успешно созданы или уже существуют.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Ошибка при создании таблиц:", error);
    } finally {
        client.release();
    }
}

// Запуск инициализации БД
initDB().catch(console.error);