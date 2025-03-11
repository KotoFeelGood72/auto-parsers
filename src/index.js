const { scrapeListings } = require("./pages/listings");
const { scrapeCarDetails } = require("./pages/details");
const { saveData } = require("./utils/saveData");
const { startBrowser } = require("./utils/browser");

const CONCURRENT_LIMIT = 1; // 🔹 Количество одновременных потоков
const RESTART_BROWSER_THRESHOLD = 1000; // 🔹 Перезапускаем браузер каждые 1000 машин

let browser;
let context;
let totalParsed = 0;
const activePromises = new Set();

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

  try {
    for await (const link of scrapeListings(context)) {
      console.log(`🚗 Начинаем парсинг: ${link}`);

      while (activePromises.size >= CONCURRENT_LIMIT) {
        await Promise.race(activePromises); // 🔹 Ждём освобождения хотя бы одного потока
      }

      const promise = scrapeCarDetails(link, context)
        .then(async (carDetails) => {
          if (carDetails) {
            await saveData(carDetails); // 🔹 Сохраняем сразу после парсинга
            totalParsed++;
          }
        })
        .catch((error) => {
          console.error(`❌ Ошибка при обработке ${link}:`, error);
        })
        .finally(() => {
          activePromises.delete(promise); // 🔹 Удаляем promise только после завершения
        });

      activePromises.add(promise);

      // 🔹 Перезапуск браузера каждые RESTART_BROWSER_THRESHOLD записей
      if (totalParsed >= RESTART_BROWSER_THRESHOLD) {
        console.log("🛑 Дождёмся всех потоков перед перезапуском браузера...");
        await Promise.all(activePromises); // 🔹 Ждём завершения всех потоков
        activePromises.clear(); // 🔹 Очистить Set перед перезапуском
        await restartBrowser();
        totalParsed = 0;
      }
    }

    // 🔹 Дожидаемся завершения всех потоков
    await Promise.all(activePromises);
  } catch (error) {
    console.error("❌ Ошибка при запуске парсера:", error);
  } finally {
    console.log("🔻 Очищаем ресурсы...");
    if (browser) await browser.close();
    if (global.gc) global.gc(); // 🔹 Принудительный Garbage Collector
  }

  console.log("✅ Парсер завершил работу.");
})();
