// // const { scrapeListings } = require("./pages/listings");
// // const { scrapeCarDetails } = require("./pages/details");
// // const { parseAndSave } = require("./utils/saveData");
// // // const { saveData } = require("./utils/saveData");


// // (async () => {
// //     console.log("🚀 Запуск парсера...");

// //     try {
// //         for await (const link of scrapeListings()) { // 🔥 Получаем ссылки по одной
// //             console.log(`🚗 Обрабатываем ${link}`);
// //             try {
// //                 const carDetails = await scrapeCarDetails(link);
// //                 if (carDetails) {
// //                     await saveData(carDetails);
// //                 }
// //             } catch (error) {
// //                 console.error(`❌ Ошибка при обработке ${link}:`, error);
// //             }
// //         }
// //     } catch (error) {
// //         console.error("❌ Ошибка при запуске парсера:", error);
// //     }

// //     console.log("✅ Парсер завершил работу.");
// // })();

// const { scrapeListings } = require("./pages/listings");
// const { scrapeCarDetails } = require("./pages/details");
// const { parseAndSave } = require("./utils/saveData");

// const CONCURRENT_LIMIT = 5; // Сколько ссылок обрабатывать одновременно
// const BATCH_SIZE = 50; // Сколько машин сохранять в БД за один раз

// (async () => {
//     console.log("🚀 Запуск парсера...");

//     const activePromises = new Set();
//     const carsToSave = [];

//     try {
//         for await (const link of scrapeListings()) {
//             console.log(`🚗 Начинаем парсинг: ${link}`);

//             // Запускаем парсинг машины
//             const promise = scrapeCarDetails(link)
//                 .then(carDetails => {
//                     if (carDetails) {
//                         carsToSave.push(carDetails);
//                     }
//                 })
//                 .catch(error => {
//                     console.error(`❌ Ошибка при обработке ${link}:`, error);
//                 })
//                 .finally(() => {
//                     activePromises.delete(promise);
//                 });

//             activePromises.add(promise);

//             // Ограничиваем количество активных потоков
//             if (activePromises.size >= CONCURRENT_LIMIT) {
//                 await Promise.race(activePromises);
//             }

//             // Если накопили BATCH_SIZE записей – сохраняем в БД
//             if (carsToSave.length >= BATCH_SIZE) {
//                 await parseAndSave([...carsToSave]); // Копируем, чтобы избежать изменений во время сохранения
//                 carsToSave.length = 0; // Очищаем массив после сохранения
//             }
//         }

//         // Дожидаемся завершения всех потоков
//         await Promise.all(activePromises);

//         // Сохраняем оставшиеся данные в БД
//         if (carsToSave.length > 0) {
//             await parseAndSave(carsToSave);
//         }
//     } catch (error) {
//         console.error("❌ Ошибка при запуске парсера:", error);
//     }

//     console.log("✅ Парсер завершил работу.");
// })();

const { scrapeListings } = require("./pages/listings");
const { scrapeCarDetails } = require("./pages/details");
const { parseAndSave } = require("./utils/saveData");
const { startBrowser } = require("./utils/browser");

const CONCURRENT_LIMIT = 5; // Одновременно парсим 5 машин
const BATCH_SIZE = 50; // Записываем в БД по 50 машин
const RESTART_BROWSER_THRESHOLD = 1000; // Перезапускаем браузер каждые 1000 записей

let browser;
let context;
let totalParsed = 0;

async function restartBrowser() {
    console.log("♻ Перезапускаем браузер для очистки ресурсов...");
    if (browser) {
        await browser.close();
    }
    browser = await startBrowser();
    context = await browser.newContext();
}

(async () => {
    console.log("🚀 Запуск парсера...");
    await restartBrowser(); // Инициализируем браузер

    const activePromises = new Set();
    const carsToSave = [];

    try {
        for await (const link of scrapeListings()) {
            console.log(`🚗 Начинаем парсинг: ${link}`);

            // Запускаем парсинг машины
            const promise = scrapeCarDetails(link, context)
                .then(carDetails => {
                    if (carDetails) {
                        carsToSave.push(carDetails);
                        totalParsed++;
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
                await Promise.all([...activePromises]); // Вместо race ждем все промисы
            }
            // Если накопили BATCH_SIZE записей – сохраняем в БД
            if (carsToSave.length >= BATCH_SIZE) {
                await parseAndSave([...carsToSave]);
                carsToSave.length = 0;
            }

            // Перезапускаем браузер каждые RESTART_BROWSER_THRESHOLD записей
            if (totalParsed >= RESTART_BROWSER_THRESHOLD) {
                await Promise.all(activePromises); // Ждем завершения всех потоков
                await restartBrowser(); // Перезапускаем браузер
                totalParsed = 0; // Обнуляем счетчик
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
    } finally {
        console.log("🔻 Очищаем ресурсы...");
        if (browser) await browser.close();
        if (global.gc) global.gc(); // Принудительный Garbage Collector
    }

    console.log("✅ Парсер завершил работу.");
})();