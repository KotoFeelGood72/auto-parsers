// const { scrapeListings } = require('./pages/listings');
// const { scrapeCarDetails } = require('./pages/details');
// const { saveData } = require('./utils/saveData');

// (async () => {
//     console.log('🚀 Запуск парсера...');

//     let links;
//     try {
//         links = await scrapeListings();
//     } catch (error) {
//         console.error('❌ Ошибка при получении списка объявлений:', error);
//         return;
//     }

//     if (!links || links.length === 0) {
//         console.error('❌ Ошибка: Не найдено ни одного объявления. Проверь парсер списка.');
//         return;
//     }

//     console.log(`🔗 Найдено ${links.length} объявлений. Начинаем парсинг...`);

//     for (const link of links) {
//         try {
//             if (!link || typeof link !== 'string') {
//                 console.error('⚠️ Ошибка: URL объявления undefined или некорректен, пропускаем.');
//                 continue;
//             }

//             console.log(`🚗 Обрабатываем ${link}`);
//             const carDetails = await scrapeCarDetails(link);
//             if (carDetails) {
//                 await saveData(carDetails);
//             }
//         } catch (error) {
//             console.error(`❌ Ошибка при обработке ${link}:`, error);
//         }
//     }

//     console.log('✅ Парсер завершил работу.');
// })();

const { scrapeListings } = require("./pages/listings");
const { scrapeCarDetails } = require("./pages/details");
const { saveData } = require("./utils/saveData");

(async () => {
    console.log("🚀 Запуск парсера...");

    try {
        for await (const link of scrapeListings()) { // 🔥 Получаем ссылки по одной
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