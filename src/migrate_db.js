const pool = require("./db");

async function migrateDB() {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Проверяем, существует ли колонка short_url
        const checkColumnQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'car_listings' 
            AND column_name = 'short_url';
        `;

        const result = await client.query(checkColumnQuery);
        
        if (result.rows.length === 0) {
            console.log("🔧 Добавляем колонку short_url...");
            
            // Добавляем колонку short_url
            await client.query(`
                ALTER TABLE car_listings 
                ADD COLUMN short_url TEXT UNIQUE;
            `);
            
            console.log("✅ Колонка short_url добавлена");
        } else {
            console.log("✅ Колонка short_url уже существует");
        }

        // Проверяем другие возможные недостающие колонки
        const checkAllColumnsQuery = `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'car_listings' 
            ORDER BY ordinal_position;
        `;

        const allColumns = await client.query(checkAllColumnsQuery);
        console.log("📋 Существующие колонки в car_listings:");
        allColumns.rows.forEach(row => {
            console.log(`  - ${row.column_name}`);
        });

        await client.query("COMMIT");
        console.log("✅ Миграция завершена успешно");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Ошибка при миграции:", error);
    } finally {
        client.release();
    }
}

// Запуск миграции
migrateDB().catch(console.error);
