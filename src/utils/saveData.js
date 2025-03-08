const pool = require("../db");

const BATCH_SIZE = 10; // 🔹 Оптимальный размер пакета записей

async function saveDataBatch(carList) {
    if (!carList || carList.length === 0) {
        console.error("❌ Ошибка: Пустые данные!");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 🔹 Готовим SQL для вставки объявлений
        let carValues = [];
        let carPlaceholders = [];
        let photoValues = [];
        let photoPlaceholders = [];
        let index = 1;

        for (const car of carList) {
            carValues.push(
                car.short_url || null,
                car.title || "Неизвестно",
                car.make || "Неизвестно",
                car.model || "Неизвестно",
                car.year || "Неизвестно",
                car.body_type || "Неизвестно",
                car.horsepower || "Неизвестно",
                car.fuel_type || "Неизвестно",
                car.motors_trim || "Неизвестно",
                parseInt(car.kilometers, 10) || 0,
                car.price?.formatted || "0",
                car.price?.raw || 0,
                car.price?.currency || "Неизвестно",
                car.exterior_color || "Неизвестно",
                car.location || "Неизвестно",
                car.contact?.phone || "Не указан",
                car.sellers?.name || "Неизвестен", // ✅ Исправлено
                car.sellers?.type || "Неизвестен", // ✅ Исправлено
                car.sellers?.logo || null, // ✅ Исправлено
                car.sellers?.profileLink || null // ✅ Исправлено
            );

            carPlaceholders.push(`(
                $${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, 
                $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, 
                $${index + 10}, $${index + 11}, $${index + 12}, $${index + 13}, $${index + 14}, 
                $${index + 15}, $${index + 16}, $${index + 17}, $${index + 18}, $${index + 19}, NOW()
            )`);

            index += 20;

            // 🔹 Собираем фото
            if (car.photos && car.photos.length > 0) {
                for (const photo of car.photos) {
                    photoValues.push(car.short_url, photo);
                    photoPlaceholders.push(`(
                        (SELECT id FROM car_listings WHERE short_url = $${photoValues.length - 1}), 
                        $${photoValues.length}
                    )`);
                }
            }
        }

        // 🔹 Вставляем объявления одним запросом
        if (carValues.length > 0) {
            const insertCarQuery = `
                INSERT INTO car_listings (
                    short_url, title, make, model, year, body_type, horsepower, fuel_type, 
                    motors_trim, kilometers, price_formatted, price_raw, currency, 
                    exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link, updated_at
                ) VALUES ${carPlaceholders.join(", ")}
                ON CONFLICT (short_url) DO UPDATE 
                SET title = EXCLUDED.title,
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
                    seller_name = EXCLUDED.seller_name,  -- ✅ Исправлено
                    seller_type = EXCLUDED.seller_type,  -- ✅ Исправлено
                    seller_logo = EXCLUDED.seller_logo,  -- ✅ Исправлено
                    seller_profile_link = EXCLUDED.seller_profile_link,  -- ✅ Исправлено
                    updated_at = NOW();
            `;
            await client.query(insertCarQuery, carValues);
        }

        // 🔹 Вставляем фото одним запросом
        if (photoValues.length > 0) {
            const insertPhotoQuery = `
                INSERT INTO car_photos (listing_id, photo_url) 
                VALUES ${photoPlaceholders.join(", ")}
                ON CONFLICT (listing_id, photo_url) DO NOTHING;
            `;
            await client.query(insertPhotoQuery, photoValues);
        }

        await client.query("COMMIT");
        console.log(`✅ Сохранено ${carList.length} объявлений`);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Ошибка:", error);
    } finally {
        client.release();
    }
}

// 🔹 Функция для обработки данных пачками
async function parseAndSave(cars) {
    for (let i = 0; i < cars.length; i += BATCH_SIZE) {
        const batch = cars.slice(i, i + BATCH_SIZE);
        await saveDataBatch(batch);
    }
}

// 🔹 Экспортируем функцию
module.exports = { parseAndSave };