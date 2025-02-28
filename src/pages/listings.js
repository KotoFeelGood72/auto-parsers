

// const { startBrowser } = require("../utils/browser");

// async function* scrapeListings() {
//   const browser = await startBrowser();
//   const page = await browser.newPage();

//   try {
//     console.log("🔍 Открываем страницу списка объявлений...");
//     await page.setExtraHTTPHeaders({
//       "User-Agent":
//         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
//     });

//     let currentPage = 1;

//     while (true) {
//       console.log(`📄 Загружаем страницу ${currentPage}...`);
//       await page.goto(
//         `https://uae.dubizzle.com/motors/used-cars/?page=${currentPage}`,
//         {
//           waitUntil: "domcontentloaded",
//           timeout: 90000,
//         }
//       );

//       console.log("📄 Собираем ссылки на объявления...");
//       await page.waitForSelector('[data-testid^="listing-"]', {
//         timeout: 30000,
//       });

//       // 🛠️ Собираем href правильно
//       const links = await page.$$eval('[data-testid^="listing-"]', (elements) =>
//         elements
//           .map((el) => el.getAttribute("href"))
//           .filter((href) => href !== null)
//       );

//       // 🔹 Отдаем ссылки **по одной**
//       for (const link of links) {
//         yield `https://uae.dubizzle.com${link}`;
//       }

//       console.log(`✅ Страница ${currentPage}: найдено ${links.length} объявлений`);

//       // 🔹 Проверяем, есть ли кнопка "Next"
//       const nextButton = await page.$('[data-testid="page-next"]');
//       if (!nextButton) {
//         console.log("🏁 Достигнута последняя страница. Парсинг завершен.");
//         break;
//       }

//       // 🔹 Получаем номер следующей страницы
//       const nextPageNumber = await page.$eval(
//         '[data-testid="page-next"]',
//         (el) => {
//           const href = el.getAttribute("href");
//           const match = href.match(/page=(\d+)/);
//           return match ? parseInt(match[1], 10) : null;
//         }
//       );

//       if (!nextPageNumber || nextPageNumber <= currentPage) {
//         console.log("🏁 Больше страниц нет. Завершаем.");
//         break;
//       }

//       console.log(`➡️ Переход на страницу ${nextPageNumber}...`);
//       currentPage = nextPageNumber;
//     }
//   } catch (error) {
//     console.error("❌ Ошибка при парсинге списка объявлений:", error);
//   } finally {
//     await browser.close();
//   }
// }

// module.exports = { scrapeListings };

const { startBrowser } = require("../utils/browser");

async function* scrapeListings() {
  const browser = await startBrowser();
  const page = await browser.newPage();

  try {
    console.log("🔍 Открываем главную страницу каталога...");
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto("https://uae.dubizzle.com/motors/used-cars/", {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    console.log("📄 Собираем ссылки на бренды...");
    await page.waitForSelector(".tagList a", { timeout: 30000 });

    const brandLinks = await page.$$eval(".tagList a", (elements) =>
      elements.map((el) => el.getAttribute("href")).filter((href) => href !== null)
    );

    console.log(`✅ Найдено ${brandLinks.length} брендов. Начинаем парсинг...`);

    for (const brandLink of brandLinks) {
      const fullBrandUrl = `https://uae.dubizzle.com${brandLink}`;
      console.log(`🚗 Переход в бренд: ${fullBrandUrl}`);
      await page.goto(fullBrandUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

      let currentPage = 1;
      while (true) {
        console.log(`📄 Загружаем страницу ${currentPage} для бренда ${fullBrandUrl}...`);
        await page.waitForSelector('[data-testid^="listing-"]', { timeout: 30000 });

        const links = await page.$$eval("[data-testid^='listing-']", (elements) =>
          elements.map((el) => el.getAttribute("href")).filter((href) => href !== null)
        );

        for (const link of links) {
          yield `https://uae.dubizzle.com${link}`;
        }

        console.log(`✅ Страница ${currentPage}: найдено ${links.length} объявлений`);

        const nextButton = await page.$('[data-testid="page-next"]');
        if (!nextButton) {
          console.log("🏁 Достигнута последняя страница бренда. Возвращаемся к списку брендов.");
          await page.goto("https://uae.dubizzle.com/motors/used-cars/", { waitUntil: "domcontentloaded", timeout: 90000 });
          break;
        }

        const nextPageNumber = await page.$eval('[data-testid="page-next"]', (el) => {
          const href = el.getAttribute("href");
          const match = href.match(/page=(\d+)/);
          return match ? parseInt(match[1], 10) : null;
        });

        if (!nextPageNumber || nextPageNumber <= currentPage) {
          console.log("🏁 Больше страниц нет. Возвращаемся к списку брендов.");
          await page.goto("https://uae.dubizzle.com/motors/used-cars/", { waitUntil: "domcontentloaded", timeout: 90000 });
          break;
        }

        console.log(`➡️ Переход на страницу ${nextPageNumber} для бренда ${fullBrandUrl}...`);
        await page.goto(`${fullBrandUrl}?page=${nextPageNumber}`, { waitUntil: "domcontentloaded", timeout: 90000 });
        currentPage = nextPageNumber;
      }
    }
  } catch (error) {
    console.error("❌ Ошибка при парсинге объявлений:", error);
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeListings };
