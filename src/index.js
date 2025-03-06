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