// // const fs = require('fs');

// // function saveData(filename, data) {
// //     fs.writeFileSync(`data/${filename}.json`, JSON.stringify(data, null, 2));
// //     console.log(`Данные сохранены в data/${filename}.json`);
// // }

// // module.exports = { saveData };

// const pool = require("./db");

// async function saveData(carDetails) {
//     const client = await pool.connect();

//     try {
//         await client.query("BEGIN");

//         // Вставляем данные о машине
//         const insertCarQuery = `
//             INSERT INTO car_listings (
//                 short_url, title, make, model, year, body_type, horsepower, fuel_type, 
//                 motors_trim, kilometers, price_formatted, price_raw, currency, 
//                 exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link
//             ) VALUES (
//                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
//                 $14, $15, $16, $17, $18, $19, $20
//             ) RETURNING id;
//         `;

//         const values = [
//             carDetails.short_url,
//             carDetails.title,
//             carDetails.make,
//             carDetails.model,
//             carDetails.year,
//             carDetails.body_type,
//             carDetails.horsepower,
//             carDetails.fuel_type,
//             carDetails.motors_trim,
//             parseInt(carDetails.kilometers, 10),
//             carDetails.price.formatted,
//             carDetails.price.raw,
//             carDetails.price.currency,
//             carDetails.exterior_color,
//             carDetails.location,
//             carDetails.contact.phone,
//             carDetails.sellers.sellerName,
//             carDetails.sellers.sellerType,
//             carDetails.sellers.sellerLogo,
//             carDetails.sellers.sellerProfileLink,
//         ];

//         const res = await client.query(insertCarQuery, values);
//         const listingId = res.rows[0].id;

//         console.log(`✅ Данные об авто сохранены в БД. ID: ${listingId}`);

//         // Сохраняем фото
//         const insertPhotoQuery = `
//             INSERT INTO car_photos (listing_id, photo_url) VALUES ($1, $2)
//         `;

//         for (let photo of carDetails.photos) {
//             await client.query(insertPhotoQuery, [listingId, photo]);
//         }

//         console.log(`📸 Сохранено ${carDetails.photos.length} фото для ID: ${listingId}`);

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

        // Вставляем данные о машине
        const insertCarQuery = `
            INSERT INTO car_listings (
                short_url, title, make, model, year, body_type, horsepower, fuel_type, 
                motors_trim, kilometers, price_formatted, price_raw, currency, 
                exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
                $14, $15, $16, $17, $18, $19, $20
            ) RETURNING id;
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

        const res = await client.query(insertCarQuery, values);
        const listingId = res.rows[0].id;

        console.log(`✅ Данные об авто сохранены в БД. ID: ${listingId}`);

        // Сохраняем фото
        const insertPhotoQuery = `
            INSERT INTO car_photos (listing_id, photo_url) VALUES ($1, $2)
        `;

        if (carDetails.photos && carDetails.photos.length > 0) {
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