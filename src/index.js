// const { scrapeListings } = require("./pages/listings");
// const { scrapeCarDetails } = require("./pages/details");
// const { parseAndSave } = require("./utils/saveData");
// // const { saveData } = require("./utils/saveData");


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
const { parseAndSave } = require("./utils/saveData");

const CONCURRENT_LIMIT = 5; // Сколько ссылок обрабатывать одновременно
const BATCH_SIZE = 50; // Сколько машин сохранять в БД за один раз

(async () => {
    console.log("🚀 Запуск парсера...");

    const activePromises = new Set();
    const carsToSave = [];

    try {
        for await (const link of scrapeListings()) {
            console.log(`🚗 Начинаем парсинг: ${link}`);

            // Запускаем парсинг машины
            const promise = scrapeCarDetails(link)
                .then(carDetails => {
                    if (carDetails) {
                        carsToSave.push(carDetails);
                    }
                })
                .catch(error => {
                    console.error(`❌ Ошибка при обработке ${link}:`, error);
                })
                .finally(() => {
                    activePromises.delete(promise);
                });

            activePromises.add(promise);

            // Ограничиваем количество активных потоков
            if (activePromises.size >= CONCURRENT_LIMIT) {
                await Promise.race(activePromises);
            }

            // Если накопили BATCH_SIZE записей – сохраняем в БД
            if (carsToSave.length >= BATCH_SIZE) {
                await parseAndSave([...carsToSave]); // Копируем, чтобы избежать изменений во время сохранения
                carsToSave.length = 0; // Очищаем массив после сохранения
            }
        }

        // Дожидаемся завершения всех потоков
        await Promise.all(activePromises);

        // Сохраняем оставшиеся данные в БД
        if (carsToSave.length > 0) {
            await parseAndSave(carsToSave);
        }
    } catch (error) {
        console.error("❌ Ошибка при запуске парсера:", error);
    }

    console.log("✅ Парсер завершил работу.");
})();