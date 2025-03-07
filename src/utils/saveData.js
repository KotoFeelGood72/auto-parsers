// // const pool = require("../db");

// // async function saveData(carDetails) {
// //     if (!carDetails || !carDetails.short_url) {
// //         console.error("❌ Ошибка: Данные пустые или невалидные!");
// //         return;
// //     }

// //     const client = await pool.connect();

// //     try {
// //         await client.query("BEGIN");

// //         // Вставка или обновление объявления
// //         const insertCarQuery = `
// //             INSERT INTO car_listings (
// //                 short_url, title, make, model, year, body_type, horsepower, fuel_type, 
// //                 motors_trim, kilometers, price_formatted, price_raw, currency, 
// //                 exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link,
// //                 updated_at
// //             ) VALUES (
// //                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 
// //                 $14, $15, $16, $17, $18, $19, $20, NOW()
// //             ) ON CONFLICT (short_url) DO UPDATE 
// //             SET title = EXCLUDED.title,
// //                 make = EXCLUDED.make,
// //                 model = EXCLUDED.model,
// //                 year = EXCLUDED.year,
// //                 body_type = EXCLUDED.body_type,
// //                 horsepower = EXCLUDED.horsepower,
// //                 fuel_type = EXCLUDED.fuel_type,
// //                 motors_trim = EXCLUDED.motors_trim,
// //                 kilometers = EXCLUDED.kilometers,
// //                 price_formatted = EXCLUDED.price_formatted,
// //                 price_raw = EXCLUDED.price_raw,
// //                 currency = EXCLUDED.currency,
// //                 exterior_color = EXCLUDED.exterior_color,
// //                 location = EXCLUDED.location,
// //                 phone = EXCLUDED.phone,
// //                 seller_name = EXCLUDED.seller_name,
// //                 seller_type = EXCLUDED.seller_type,
// //                 seller_logo = EXCLUDED.seller_logo,
// //                 seller_profile_link = EXCLUDED.seller_profile_link,
// //                 updated_at = NOW()
// //             RETURNING id;
// //         `;

// //         const values = [
// //             carDetails.short_url || null,
// //             carDetails.title || "Неизвестно",
// //             carDetails.make || "Неизвестно",
// //             carDetails.model || "Неизвестно",
// //             carDetails.year || "Неизвестно",
// //             carDetails.body_type || "Неизвестно",
// //             carDetails.horsepower || "Неизвестно",
// //             carDetails.fuel_type || "Неизвестно",
// //             carDetails.motors_trim || "Неизвестно",
// //             parseInt(carDetails.kilometers, 10) || 0,
// //             carDetails.price?.formatted || "0",
// //             carDetails.price?.raw || 0,
// //             carDetails.price?.currency || "Неизвестно",
// //             carDetails.exterior_color || "Неизвестно",
// //             carDetails.location || "Неизвестно",
// //             carDetails.contact?.phone || "Не указан",
// //             carDetails.sellers?.sellerName || "Неизвестен",
// //             carDetails.sellers?.sellerType || "Неизвестен",
// //             carDetails.sellers?.sellerLogo || null,
// //             carDetails.sellers?.sellerProfileLink || null,
// //         ];

// //         const res = await client.query(insertCarQuery, values);
// //         const listingId = res.rows[0].id;

// //         console.log(`✅ Объявление сохранено (ID: ${listingId})`);

// //         // Сохранение фото
// //         if (carDetails.photos && carDetails.photos.length > 0) {
// //             const insertPhotoQuery = `
// //                 INSERT INTO car_photos (listing_id, photo_url) 
// //                 VALUES ($1, $2)
// //                 ON CONFLICT (listing_id, photo_url) DO NOTHING;
// //             `;

// //             for (let photo of carDetails.photos) {
// //                 await client.query(insertPhotoQuery, [listingId, photo]);
// //             }

// //             console.log(`📸 Сохранено ${carDetails.photos.length} фото для ID: ${listingId}`);
// //         } else {
// //             console.warn(`⚠️ Нет фото для ID: ${listingId}`);
// //         }

// //         await client.query("COMMIT");
// //     } catch (error) {
// //         await client.query("ROLLBACK");
// //         console.error("❌ Ошибка записи в базу данных:", error);
// //     } finally {
// //         client.release();
// //     }
// // }

// // module.exports = { saveData };

// const pool = require("../db");

// // Размер батча (сколько записей вставлять за раз)
// const BATCH_SIZE = 10;

// async function saveDataBatch(carList) {
//     if (!carList || carList.length === 0) {
//         console.error("❌ Ошибка: Пустые данные!");
//         return;
//     }

//     const client = await pool.connect();
//     try {
//         await client.query("BEGIN");

//         let carValues = [];
//         let photoValues = [];
//         let carPlaceholders = [];
//         let photoPlaceholders = [];

//         for (let i = 0; i < carList.length; i++) {
//             const car = carList[i];
//             const offset = i * 20;

//             carValues.push(
//                 car.short_url || null,
//                 car.title || "Неизвестно",
//                 car.make || "Неизвестно",
//                 car.model || "Неизвестно",
//                 car.year || "Неизвестно",
//                 car.body_type || "Неизвестно",
//                 car.horsepower || "Неизвестно",
//                 car.fuel_type || "Неизвестно",
//                 car.motors_trim || "Неизвестно",
//                 parseInt(car.kilometers, 10) || 0,
//                 car.price?.formatted || "0",
//                 car.price?.raw || 0,
//                 car.price?.currency || "Неизвестно",
//                 car.exterior_color || "Неизвестно",
//                 car.location || "Неизвестно",
//                 car.contact?.phone || "Не указан",
//                 car.sellers?.sellerName || "Неизвестен",
//                 car.sellers?.sellerType || "Неизвестен",
//                 car.sellers?.sellerLogo || null,
//                 car.sellers?.sellerProfileLink || null
//             );

//             carPlaceholders.push(`($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11}, $${offset+12}, $${offset+13}, $${offset+14}, $${offset+15}, $${offset+16}, $${offset+17}, $${offset+18}, $${offset+19}, $${offset+20}, NOW())`);

//             if (car.photos && car.photos.length > 0) {
//                 for (let photo of car.photos) {
//                     photoValues.push(car.short_url, photo);
//                     photoPlaceholders.push(`((SELECT id FROM car_listings WHERE short_url = $${photoValues.length-1}), $${photoValues.length})`);
//                 }
//             }
//         }

//         // Вставляем или обновляем объявления
//         if (carValues.length > 0) {
//             const insertCarQuery = `
//                 INSERT INTO car_listings (
//                     short_url, title, make, model, year, body_type, horsepower, fuel_type, 
//                     motors_trim, kilometers, price_formatted, price_raw, currency, 
//                     exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link, updated_at
//                 ) VALUES ${carPlaceholders.join(", ")}
//                 ON CONFLICT (short_url) DO UPDATE 
//                 SET title = EXCLUDED.title,
//                     make = EXCLUDED.make,
//                     model = EXCLUDED.model,
//                     year = EXCLUDED.year,
//                     body_type = EXCLUDED.body_type,
//                     horsepower = EXCLUDED.horsepower,
//                     fuel_type = EXCLUDED.fuel_type,
//                     motors_trim = EXCLUDED.motors_trim,
//                     kilometers = EXCLUDED.kilometers,
//                     price_formatted = EXCLUDED.price_formatted,
//                     price_raw = EXCLUDED.price_raw,
//                     currency = EXCLUDED.currency,
//                     exterior_color = EXCLUDED.exterior_color,
//                     location = EXCLUDED.location,
//                     phone = EXCLUDED.phone,
//                     seller_name = EXCLUDED.seller_name,
//                     seller_type = EXCLUDED.seller_type,
//                     seller_logo = EXCLUDED.seller_logo,
//                     seller_profile_link = EXCLUDED.seller_profile_link,
//                     updated_at = NOW();
//             `;
//             await client.query(insertCarQuery, carValues);
//         }

//         // Вставляем фото
//         if (photoValues.length > 0) {
//             const insertPhotoQuery = `
//                 INSERT INTO car_photos (listing_id, photo_url) 
//                 VALUES ${photoPlaceholders.join(", ")}
//                 ON CONFLICT (listing_id, photo_url) DO NOTHING;
//             `;
//             await client.query(insertPhotoQuery, photoValues);
//         }

//         await client.query("COMMIT");
//         console.log(`✅ Сохранено ${carList.length} объявлений`);
//     } catch (error) {
//         await client.query("ROLLBACK");
//         console.error("❌ Ошибка:", error);
//     } finally {
//         client.release();
//     }
// }

// // Парсим данные пачками
// async function parseAndSave(cars) {
//     for (let i = 0; i < cars.length; i += BATCH_SIZE) {
//         const batch = cars.slice(i, i + BATCH_SIZE);
//         await saveDataBatch(batch);
//     }
// }

// // Пример вызова
// // parseAndSave(список_машин);
// module.exports = { parseAndSave };




const pool = require("../db");

// Размер батча (сколько объявлений вставлять за раз)
const BATCH_SIZE = 50;

async function saveDataBatch(carList) {
    if (!carList || carList.length === 0) {
        console.error("❌ Ошибка: Пустой список машин!");
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let carValues = [];
        let carPlaceholders = [];
        let photoMap = new Map(); // Сохраняем фото отдельно

        for (let i = 0; i < carList.length; i++) {
            const car = carList[i];
            const offset = i * 20;

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
                car.sellers?.sellerName || "Неизвестен",
                car.sellers?.sellerType || "Неизвестен",
                car.sellers?.sellerLogo || null,
                car.sellers?.sellerProfileLink || null
            );

            carPlaceholders.push(
                `($${offset+1}, $${offset+2}, $${offset+3}, $${offset+4}, $${offset+5}, $${offset+6}, 
                  $${offset+7}, $${offset+8}, $${offset+9}, $${offset+10}, $${offset+11}, $${offset+12}, 
                  $${offset+13}, $${offset+14}, $${offset+15}, $${offset+16}, $${offset+17}, $${offset+18}, 
                  $${offset+19}, $${offset+20}, NOW())`
            );

            // Сохраняем фото для последующей вставки
            if (car.photos && car.photos.length > 0) {
                photoMap.set(car.short_url, car.photos);
            }
        }

        // 🔹 Вставляем или обновляем объявления
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
                    seller_name = EXCLUDED.seller_name,
                    seller_type = EXCLUDED.seller_type,
                    seller_logo = EXCLUDED.seller_logo,
                    seller_profile_link = EXCLUDED.seller_profile_link,
                    updated_at = NOW()
                RETURNING id, short_url;
            `;
            const result = await client.query(insertCarQuery, carValues);

            // Создаем map {short_url -> id}
            let carIdMap = new Map();
            result.rows.forEach(row => {
                carIdMap.set(row.short_url, row.id);
            });

            // 🔹 Вставляем фото (только после получения ID)
            let photoValues = [];
            let photoPlaceholders = [];
            let photoIndex = 1;

            for (let [short_url, photos] of photoMap) {
                const listing_id = carIdMap.get(short_url);
                if (!listing_id) continue;

                for (let photo of photos) {
                    photoValues.push(listing_id, photo);
                    photoPlaceholders.push(`($${photoIndex}, $${photoIndex+1})`);
                    photoIndex += 2;
                }
            }

            if (photoValues.length > 0) {
                const insertPhotoQuery = `
                    INSERT INTO car_photos (listing_id, photo_url) 
                    VALUES ${photoPlaceholders.join(", ")}
                    ON CONFLICT (listing_id, photo_url) DO NOTHING;
                `;
                await client.query(insertPhotoQuery, photoValues);
            }
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

// 🔹 Парсим и сохраняем данные пачками (асинхронно)
async function parseAndSave(cars) {
    let batches = [];
    for (let i = 0; i < cars.length; i += BATCH_SIZE) {
        batches.push(cars.slice(i, i + BATCH_SIZE));
    }
    
    await Promise.all(batches.map(batch => saveDataBatch(batch)));
}

// Пример вызова
// parseAndSave(список_машин);
module.exports = { parseAndSave };