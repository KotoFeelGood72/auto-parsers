


// const pool = require("../db");

// async function saveData(carDetails) {
//     if (!carDetails || !carDetails.short_url) {
//         console.error("❌ Ошибка: Данные пустые или невалидные!");
//         return;
//     }

//     const client = await pool.connect();

//     try {
//         await client.query("BEGIN");

//         // Проверяем, существует ли запись с таким short_url
//         const checkQuery = `
//             SELECT id FROM car_listings WHERE short_url = $1;
//         `;
//         const checkResult = await client.query(checkQuery, [carDetails.short_url]);

//         let listingId;

//         if (checkResult.rows.length > 0) {
//             // Если запись существует - обновляем
//             listingId = checkResult.rows[0].id;
//             const updateCarQuery = `
//                 UPDATE car_listings SET
//                     title = $2,
//                     make = $3,
//                     model = $4,
//                     year = $5,
//                     body_type = $6,
//                     horsepower = $7,
//                     fuel_type = $8,
//                     motors_trim = $9,
//                     kilometers = $10,
//                     price_formatted = $11,
//                     price_raw = $12,
//                     currency = $13,
//                     exterior_color = $14,
//                     location = $15,
//                     phone = $16,
//                     seller_name = $17,
//                     seller_type = $18,
//                     seller_logo = $19,
//                     seller_profile_link = $20
//                 WHERE id = $1;
//             `;

//             const values = [
//                 listingId,
//                 carDetails.title || "Неизвестно",
//                 carDetails.make || "Неизвестно",
//                 carDetails.model || "Неизвестно",
//                 carDetails.year || "Неизвестно",
//                 carDetails.body_type || "Неизвестно",
//                 carDetails.horsepower || "Неизвестно",
//                 carDetails.fuel_type || "Неизвестно",
//                 carDetails.motors_trim || "Неизвестно",
//                 parseInt(carDetails.kilometers, 10) || 0,
//                 carDetails.price?.formatted || "0",
//                 carDetails.price?.raw || 0,
//                 carDetails.price?.currency || "Неизвестно",
//                 carDetails.exterior_color || "Неизвестно",
//                 carDetails.location || "Неизвестно",
//                 carDetails.contact?.phone || "Не указан",
//                 carDetails.sellers?.sellerName || "Неизвестен",
//                 carDetails.sellers?.sellerType || "Неизвестен",
//                 carDetails.sellers?.sellerLogo || null,
//                 carDetails.sellers?.sellerProfileLink || null,
//             ];

//             await client.query(updateCarQuery, values);
//             console.log(`🔄 Обновлены данные об авто (ID: ${listingId})`);
//         } else {
//             // Если записи нет - вставляем новую
//             const insertCarQuery = `
//                 INSERT INTO car_listings (
//                     short_url, title, make, model, year, body_type, horsepower, fuel_type, 
//                     motors_trim, kilometers, price_formatted, price_raw, currency, 
//                     exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link
//                 ) VALUES (
//                     $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
//                     $14, $15, $16, $17, $18, $19, $20
//                 ) RETURNING id;
//             `;

//             const values = [
//                 carDetails.short_url || null,
//                 carDetails.title || "Неизвестно",
//                 carDetails.make || "Неизвестно",
//                 carDetails.model || "Неизвестно",
//                 carDetails.year || "Неизвестно",
//                 carDetails.body_type || "Неизвестно",
//                 carDetails.horsepower || "Неизвестно",
//                 carDetails.fuel_type || "Неизвестно",
//                 carDetails.motors_trim || "Неизвестно",
//                 parseInt(carDetails.kilometers, 10) || 0,
//                 carDetails.price?.formatted || "0",
//                 carDetails.price?.raw || 0,
//                 carDetails.price?.currency || "Неизвестно",
//                 carDetails.exterior_color || "Неизвестно",
//                 carDetails.location || "Неизвестно",
//                 carDetails.contact?.phone || "Не указан",
//                 carDetails.sellers?.sellerName || "Неизвестен",
//                 carDetails.sellers?.sellerType || "Неизвестен",
//                 carDetails.sellers?.sellerLogo || null,
//                 carDetails.sellers?.sellerProfileLink || null,
//             ];

//             const res = await client.query(insertCarQuery, values);
//             listingId = res.rows[0].id;
//             console.log(`✅ Добавлены данные об авто (ID: ${listingId})`);
//         }

//         // Сохраняем фото (если они есть)
//         if (carDetails.photos && carDetails.photos.length > 0) {
//             const insertPhotoQuery = `
//                 INSERT INTO car_photos (listing_id, photo_url) 
//                 VALUES ($1, $2)
//                 ON CONFLICT DO NOTHING;
//             `;

//             for (let photo of carDetails.photos) {
//                 await client.query(insertPhotoQuery, [listingId, photo]);
//             }

//             console.log(`📸 Сохранено ${carDetails.photos.length} фото для ID: ${listingId}`);
//         } else {
//             console.warn(`⚠️ Нет фото для ID: ${listingId}`);
//         }

//         await client.query("COMMIT");
//     } catch (error) {
//         await client.query("ROLLBACK");
//         console.error("❌ Ошибка записи в базу данных:", error);
//     } finally {
//         client.release();
//     }
// }

// module.exports = { saveData };




const pool = require("../db");

async function saveData(carDetails) {
    if (!carDetails || !carDetails.short_url) {
        console.error("❌ Ошибка: Данные пустые или невалидные!");
        return;
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const upsertCarQuery = `
            INSERT INTO car_listings (
                short_url, title, make, model, year, body_type, horsepower, fuel_type, 
                motors_trim, kilometers, price_formatted, price_raw, currency, 
                exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
                $14, $15, $16, $17, $18, $19, $20
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
                seller_profile_link = EXCLUDED.seller_profile_link
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
        ];

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
        await client.query("ROLLBACK");
        console.error("❌ Ошибка записи в базу данных:", error);
    } finally {
        client.release();
    }
}

module.exports = { saveData };