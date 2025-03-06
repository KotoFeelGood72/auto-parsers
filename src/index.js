// const { scrapeListings } = require("./pages/listings");
// const { scrapeCarDetails } = require("./pages/details");
// const { saveData } = require("./utils/saveData");


// (async () => {
//     console.log("🚀 Запуск парсера...");

//     try {
//         for await (const link of scrapeListings()) { // 🔥 Получаем ссылки по одной
//             console.log(`🚗 Обрабатываем ${link}`);
//             try {
//                 const carDetails = await scrapeCarDetails(link);
//                 if (carDetails) {
//                     await saveData(carDetails);
//                 }
//             } catch (error) {
//                 console.error(`❌ Ошибка при обработке ${link}:`, error);
//             }
//         }
//     } catch (error) {
//         console.error("❌ Ошибка при запуске парсера:", error);
//     }

//     console.log("✅ Парсер завершил работу.");
// })();

const { scrapeListings } = require("./pages/listings");
const { scrapeCarDetails } = require("./pages/details");
const { saveData } = require("./utils/saveData");
const pool = require("./db"); // Подключаем БД

// Функция для получения последнего ID из базы
async function getLastSavedId() {
    try {
        const res = await pool.query("SELECT MAX(id) AS last_id FROM car_listings");
        return res.rows[0].last_id || 0; // Если базы пустая, вернуть 0
    } catch (error) {
        console.error("❌ Ошибка при получении последнего ID:", error);
        return 0;
    }
}

(async () => {
    console.log("🚀 Запуск парсера...");

    try {
        const lastId = await getLastSavedId();
        console.log(`📌 Последний сохранённый ID: ${lastId}`);

        for await (const link of scrapeListings()) { // 🔥 Получаем ссылки по одной
            const idMatch = link.match(/-(\d+)$/); // Парсим ID из ссылки
            const carId = idMatch ? parseInt(idMatch[1], 10) : null;

            if (!carId || carId <= lastId) {
                console.log(`⏭ Пропускаем уже существующую запись: ${link}`);
                continue;
            }

            console.log(`🚗 Обрабатываем ${link}`);
            try {
                const carDetails = await scrapeCarDetails(link);
                if (carDetails) {
                    await saveData(carDetails);
                }
            } catch (error) {
                console.error(`❌ Ошибка при обработке ${link}:`, error);
            }
        }
    } catch (error) {
        console.error("❌ Ошибка при запуске парсера:", error);
    }

    console.log("✅ Парсер завершил работу.");
})();