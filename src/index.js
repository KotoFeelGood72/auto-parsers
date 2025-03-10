// const { scrapeListings } = require("./pages/listings");
// const { scrapeCarDetails } = require("./pages/details");
// const { parseAndSave } = require("./utils/saveData");
// const { startBrowser } = require("./utils/browser");

// const CONCURRENT_LIMIT = 3; // 🔹 Количество одновременных потоков
// const BATCH_SIZE = 10; // 🔹 Записываем в БД каждые 10 машин
// const RESTART_BROWSER_THRESHOLD = 1000; // 🔹 Перезапускаем браузер каждые 1000 машин

// let browser;
// let context;
// let totalParsed = 0;
// const activePromises = new Set();
// const carsToSave = [];

// async function restartBrowser() {
//     console.log("♻ Перезапускаем браузер для очистки ресурсов...");
//     if (browser) {
//         await browser.close();
//     }
//     browser = await startBrowser();
//     context = await browser.newContext();
// }

// (async () => {
//     console.log("🚀 Запуск парсера...");
//     await restartBrowser(); // Инициализируем браузер

//     try {
//         for await (const link of scrapeListings(context)) {
//             console.log(`🚗 Начинаем парсинг: ${link}`);

//             while (activePromises.size >= CONCURRENT_LIMIT) {
//                 await Promise.race(activePromises); // 🔹 Ждём освобождения хотя бы одного потока
//             }

//             const promise = scrapeCarDetails(link, context)
//                 .then(carDetails => {
//                     if (carDetails) {
//                         carsToSave.push(carDetails);
//                         totalParsed++;
//                     }
//                 })
//                 .catch(error => {
//                     console.error(`❌ Ошибка при обработке ${link}:`, error);
//                 })
//                 .finally(() => {
//                     activePromises.delete(promise); // 🔹 Удаляем promise только после завершения
//                 });

//             activePromises.add(promise);

//             // 🔹 Если накопили BATCH_SIZE записей – сохраняем в БД
//             if (carsToSave.length >= BATCH_SIZE) {
//                 await parseAndSave([...carsToSave]);
//                 carsToSave.length = 0;
//             }

//             // 🔹 Перезапуск браузера каждые RESTART_BROWSER_THRESHOLD записей
//             if (totalParsed >= RESTART_BROWSER_THRESHOLD) {
//                 console.log("🛑 Дождёмся всех потоков перед перезапуском браузера...");
//                 await Promise.all(activePromises); // 🔹 Ждём завершения всех потоков
//                 activePromises.clear(); // 🔹 Очистить Set перед перезапуском
//                 await restartBrowser();
//                 totalParsed = 0;
//             }
//         }

//         // 🔹 Дожидаемся завершения всех потоков
//         await Promise.all(activePromises);

//         // 🔹 Сохраняем оставшиеся данные в БД
//         if (carsToSave.length > 0) {
//             await parseAndSave(carsToSave);
//         }
//     } catch (error) {
//         console.error("❌ Ошибка при запуске парсера:", error);
//     } finally {
//         console.log("🔻 Очищаем ресурсы...");
//         if (browser) await browser.close();
//         if (global.gc) global.gc(); // 🔹 Принудительный Garbage Collector
//     }

//     console.log("✅ Парсер завершил работу.");
// })();

const { scrapeListings } = require("./pages/listings");
const { scrapeCarDetails } = require("./pages/details");
const { parseAndSave } = require("./utils/saveData");
const { startBrowser } = require("./utils/browser");

const CONCURRENT_LIMIT = 3; // 🔹 Количество одновременных потоков
const BATCH_SIZE = 10; // 🔹 Записываем в БД каждые 10 машин

let browser;
let context;
const activePromises = new Set();
const carsToSave = [];

(async () => {
    console.log("🚀 Запуск парсера...");
    
    browser = await startBrowser(); // 🔹 Запускаем браузер один раз
    context = await browser.newContext();

    try {
        for await (const link of scrapeListings(context)) {
            console.log(`🚗 Начинаем парсинг: ${link}`);

            while (activePromises.size >= CONCURRENT_LIMIT) {
                await Promise.race(activePromises); // 🔹 Ждём освобождения хотя бы одного потока
            }

            const promise = scrapeCarDetails(link, context)
                .then(carDetails => {
                    if (carDetails) {
                        carsToSave.push(carDetails);
                    }
                })
                .catch(error => {
                    console.error(`❌ Ошибка при обработке ${link}:`, error);
                })
                .finally(() => {
                    activePromises.delete(promise); // 🔹 Удаляем promise только после завершения
                });

            activePromises.add(promise);

            // 🔹 Если накопили BATCH_SIZE записей – сохраняем в БД
            if (carsToSave.length >= BATCH_SIZE) {
                await parseAndSave([...carsToSave]);
                carsToSave.length = 0;
            }
        }

        // 🔹 Дожидаемся завершения всех потоков
        await Promise.all(activePromises);

        // 🔹 Сохраняем оставшиеся данные в БД
        if (carsToSave.length > 0) {
            await parseAndSave(carsToSave);
        }
    } catch (error) {
        console.error("❌ Ошибка при запуске парсера:", error);
    } finally {
        console.log("🔻 Очищаем ресурсы...");
        if (browser) await browser.close();
        if (global.gc) global.gc(); // 🔹 Принудительный Garbage Collector
    }

    console.log("✅ Парсер завершил работу.");
})();