// const pool = require("../db");

// async function saveData(car) {
//   if (!car) {
//     console.error("❌ Ошибка: Пустые данные!");
//     return;
//   }

//   const client = await pool.connect();
//   try {
//     await client.query("BEGIN");

//     // 🔹 SQL для вставки объявления
//     const insertCarQuery = `
//             INSERT INTO car_listings (
//                 short_url, title, make, model, year, body_type, horsepower, fuel_type,
//                 motors_trim, kilometers, price_formatted, price_raw, currency,
//                 exterior_color, location, phone, seller_name, seller_type, seller_logo, seller_profile_link, updated_at
//             ) VALUES (
//                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
//                 $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
//             )
//             ON CONFLICT (short_url) DO NOTHING;
//         `;

//     const carValues = [
//       car.short_url || null,
//       car.title || "Неизвестно",
//       car.make || "Неизвестно",
//       car.model || "Неизвестно",
//       car.year || "Неизвестно",
//       car.body_type || "Неизвестно",
//       car.horsepower || "Неизвестно",
//       car.fuel_type || "Неизвестно",
//       car.motors_trim || "Неизвестно",
//       parseInt(car.kilometers, 10) || 0,
//       car.price?.formatted || "0",
//       car.price?.raw || 0,
//       car.price?.currency || "Неизвестно",
//       car.exterior_color || "Неизвестно",
//       car.location || "Неизвестно",
//       car.contact?.phone || "Не указан",
//       car.sellers?.name || "Неизвестен",
//       car.sellers?.type || "Неизвестен",
//       car.sellers?.logo || null,
//       car.sellers?.profileLink || null,
//     ];

//     // 🔹 Вставка объявления
//     await client.query(insertCarQuery, carValues);

//     // 🔹 Вставка фотографий
//     if (car.photos && car.photos.length > 0) {
//       const insertPhotoQuery = `
//                 INSERT INTO car_photos (listing_id, photo_url)
//                 VALUES ${car.photos
//                   .map(
//                     (_, i) =>
//                       `( (SELECT id FROM car_listings WHERE short_url = $1), $${
//                         i + 2
//                       } )`
//                   )
//                   .join(", ")}
//                 ON CONFLICT (listing_id, photo_url) DO NOTHING;
//             `;

//       const photoValues = [car.short_url, ...car.photos];
//       await client.query(insertPhotoQuery, photoValues);
//     }

//     await client.query("COMMIT");
//     console.log(`✅ Сохранено объявление: ${car.short_url}`);
//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("❌ Ошибка при сохранении данных:", error);
//   } finally {
//     client.release();
//   }
// }

// // 🔹 Экспортируем функцию
// module.exports = { saveData };

const fs = require("fs");
const path = require("path");

const OUTPUT_PATH = path.resolve(__dirname, "../../data/output.json");

async function saveData(car) {
  if (!car) {
    console.error("❌ Ошибка: Пустые данные!");
    return;
  }

  try {
    // 🔹 Читаем текущие данные (если файл существует)
    let existing = [];
    if (fs.existsSync(OUTPUT_PATH)) {
      const raw = fs.readFileSync(OUTPUT_PATH, "utf-8");

      if (raw.trim()) {
        existing = JSON.parse(raw); // ✅ Только если непустой
      } else {
        console.warn("⚠️ Файл пустой, начинаем с нуля.");
      }
    }

    // 🔍 Проверка на дубликат по short_url
    if (existing.some((item) => item.short_url === car.short_url)) {
      console.log(`⚠️ Уже есть: ${car.short_url}`);
      return;
    }

    // ➕ Добавляем новое объявление
    existing.push(car);

    // 💾 Сохраняем в файл
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(existing, null, 2), "utf-8");
    console.log(`✅ Сохранено в файл: ${car.short_url}`);
  } catch (error) {
    console.error("❌ Ошибка при сохранении в JSON:", error);
  }
}

module.exports = { saveData };
