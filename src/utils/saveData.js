const fs = require("fs");
const path = require("path");
const pool = require("../db");

async function saveData(carDetails) {
    console.log("🔍 Получены данные для сохранения:");
    console.log(JSON.stringify(carDetails, null, 2));
    
    if (!carDetails || !carDetails.short_url) {
        console.error("❌ Ошибка: Данные пустые или невалидные!");
        return;
    }

    // Если нет настроек БД — сохраняем в файл
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
        console.log("⚠️ Настройки БД не найдены, сохраняем в файл");
        console.log(`DB_HOST: ${process.env.DB_HOST}`);
        console.log(`DB_USER: ${process.env.DB_USER}`);
        console.log(`DB_NAME: ${process.env.DB_NAME}`);
        return saveToFile(carDetails);
    }

    console.log("🔗 Подключение к базе данных:");
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Port: ${process.env.DB_PORT}`);
    console.log(`   Database: ${process.env.DB_NAME}`);
    console.log(`   User: ${process.env.DB_USER}`);

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");

        const upsertCarQuery = `
            INSERT INTO car_listings (
                short_url, title, make, model, year, body_type, horsepower, fuel_type, 
                motors_trim, kilometers, price_formatted, price_raw, currency, 
                exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link, main_image
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
                $14, $15, $16, $17, $18, $19, $20, $21
            ) ON CONFLICT (short_url) DO UPDATE SET
                title = EXCLUDED.title,
                make = EXCLUDED.make,
                model = EXCLUDED.model,
                year = EXCLUDED.year,
                body_type = EXCLUDED.body_type,
                horsepower = EXCLUDED.horsepower,
                fuel_type = EXCLUDED.fuel_type,
                motors_trim = EXCLUDED.motors_trim,
                kilometers = EXCLUDED.kilometers,
                price_formatted = EXCLUDED.price_formatted,
                price_raw = EXCLUDED.price_raw,
                currency = EXCLUDED.currency,
                exterior_color = EXCLUDED.exterior_color,
                location = EXCLUDED.location,
                phone = EXCLUDED.phone,
                seller_name = EXCLUDED.seller_name,
                seller_type = EXCLUDED.seller_type,
                seller_logo = EXCLUDED.seller_logo,
                seller_profile_link = EXCLUDED.seller_profile_link,
                main_image = EXCLUDED.main_image
            RETURNING id;
        `;

        const values = [
            carDetails.short_url || null,
            carDetails.title || "Неизвестно",
            carDetails.make || "Неизвестно",
            carDetails.model || "Неизвестно",
            carDetails.year || "Неизвестно",
            carDetails.body_type || "Неизвестно",
            carDetails.horsepower || "Неизвестно",
            carDetails.fuel_type || "Неизвестно",
            carDetails.motors_trim || "Неизвестно",
            parseInt(carDetails.kilometers, 10) || 0,
            carDetails.price?.formatted || "0",
            carDetails.price?.raw || 0,
            carDetails.price?.currency || "Неизвестно",
            carDetails.exterior_color || "Неизвестно",
            carDetails.location || "Неизвестно",
            carDetails.contact?.phone || "Не указан",
            carDetails.sellers?.sellerName || "Неизвестен",
            carDetails.sellers?.sellerType || "Неизвестен",
            carDetails.sellers?.sellerLogo || null,
            carDetails.sellers?.sellerProfileLink || null,
            carDetails.main_image || null,
        ];

        // Подробное логирование данных перед записью
        console.log("📝 Данные для записи в БД:");
        console.log(`   URL: ${values[0]}`);
        console.log(`   Название: ${values[1]}`);
        console.log(`   Марка: ${values[2]}`);
        console.log(`   Модель: ${values[3]}`);
        console.log(`   Год: ${values[4]}`);
        console.log(`   Тип кузова: ${values[5]}`);
        console.log(`   Мощность: ${values[6]}`);
        console.log(`   Тип топлива: ${values[7]}`);
        console.log(`   Комплектация: ${values[8]}`);
        console.log(`   Пробег: ${values[9]}`);
        console.log(`   Цена (формат): ${values[10]}`);
        console.log(`   Цена (число): ${values[11]}`);
        console.log(`   Валюта: ${values[12]}`);
        console.log(`   Цвет: ${values[13]}`);
        console.log(`   Локация: ${values[14]}`);
        console.log(`   Телефон: ${values[15]}`);
        console.log(`   Продавец: ${values[16]}`);
        console.log(`   Тип продавца: ${values[17]}`);
        console.log(`   Логотип: ${values[18]}`);
        console.log(`   Профиль: ${values[19]}`);
        console.log(`   Главное фото: ${values[20]}`);

        const res = await client.query(upsertCarQuery, values);
        const listingId = res.rows[0].id;
        console.log(`✅ Данные об авто сохранены/обновлены (ID: ${listingId})`);

        // Сохранение фото (без дубликатов)
        if (carDetails.photos && carDetails.photos.length > 0) {
            const insertPhotoQuery = `
                INSERT INTO car_photos (listing_id, photo_url) 
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING;
            `;

            for (let photo of carDetails.photos) {
                await client.query(insertPhotoQuery, [listingId, photo]);
            }

            console.log(`📸 Сохранено ${carDetails.photos.length} фото для ID: ${listingId}`);
        } else {
            console.warn(`⚠️ Нет фото для ID: ${listingId}`);
        }

        await client.query("COMMIT");
    } catch (error) {
        if (client) {
            try { await client.query("ROLLBACK"); } catch (_) {}
        }
        console.error("❌ Ошибка записи в базу данных:", error.message);
        console.error("❌ Полная ошибка:", error);
        
        // Если ошибка связана с соединением, попробуем переподключиться
        if (error.message.includes('Connection terminated') || 
            error.message.includes('ECONNRESET') || 
            error.message.includes('ENOTFOUND')) {
            console.log("🔄 Попытка переподключения к БД...");
            try {
                // Ждем немного перед переподключением
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await saveData(carDetails); // Рекурсивный вызов
            } catch (retryError) {
                console.error("❌ Не удалось переподключиться:", retryError.message);
            }
        }
        
        console.warn("💾 Перехожу на файловое сохранение (data/dubizzle_cars.json)");
        return saveToFile(carDetails);
    } finally {
        if (client) {
            try {
                client.release();
            } catch (releaseError) {
                console.error("❌ Ошибка при освобождении клиента:", releaseError.message);
            }
        }
    }
}

module.exports = { saveData };

// === Файловый фолбэк ===
async function saveToFile(carDetails) {
    try {
        const dataDir = path.join(__dirname, "..", "..", "data");
        const filePath = path.join(dataDir, "dubizzle_cars.json");

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        let items = [];
        if (fs.existsSync(filePath)) {
            try {
                const raw = fs.readFileSync(filePath, "utf-8");
                items = JSON.parse(raw || "[]");
            } catch (_) {
                items = [];
            }
        }

        const existingIndex = items.findIndex(x => x.short_url === carDetails.short_url);
        if (existingIndex >= 0) {
            items[existingIndex] = carDetails;
        } else {
            items.push(carDetails);
        }

        fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf-8");
        console.log(`💾 Данные сохранены в файл: ${filePath} (всего записей: ${items.length})`);
    } catch (e) {
        console.error("❌ Ошибка сохранения в файл:", e);
    }
}