require('dotenv').config();
const { scrapeListings } = require("./pages/listings");
const { scrapeCarDetails } = require("./pages/details");
const { saveData } = require("./utils/saveData");
const { startBrowser } = require("./utils/browser");

(async () => {
    console.log("🚀 Запуск парсера...");
    const browser = await startBrowser();
    try {
        for await (const link of scrapeListings(browser)) { // 🔥 Получаем ссылки по одной
            console.log(`🚗 Обрабатываем ${link}`);
            try {
                const carDetails = await scrapeCarDetails(link, browser);
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