// const { startBrowser } = require('../utils/browser');

// async function scrapeListings() {
//     const browser = await startBrowser();
//     const page = await browser.newPage();

//     try {
//         console.log('🔍 Открываем страницу списка объявлений...');
//         await page.setExtraHTTPHeaders({
//             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
//         });

//         await page.goto('https://uae.dubizzle.com/motors/used-cars/', {
//             waitUntil: 'domcontentloaded',
//             timeout: 90000
//         });

//         console.log('📄 Собираем ссылки на объявления...');
//         await page.waitForSelector('[data-testid^="listing-"]', { timeout: 30000 });

//         // 🛠️ Фиксим ошибку: собираем href правильно
//         const links = await page.$$eval('[data-testid^="listing-"]', elements =>
//             elements.map(el => el.getAttribute('href')).filter(href => href !== null)
//         );

//         // Добавляем полный URL
//         const fullLinks = links.map(link => `https://uae.dubizzle.com${link}`);

//         console.log(`✅ Найдено ${fullLinks.length} объявлений`);
//         return fullLinks;
//     } catch (error) {
//         console.error('❌ Ошибка при парсинге списка объявлений:', error);
//         return [];
//     } finally {
//         await browser.close();
//     }
// }

// module.exports = { scrapeListings };

const { startBrowser } = require("../utils/browser");

async function scrapeListings() {
  const browser = await startBrowser();
  const page = await browser.newPage();
  let allLinks = [];

  try {
    console.log("🔍 Открываем страницу списка объявлений...");
    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    let currentPage = 1;

    while (true) {
      console.log(`📄 Загружаем страницу ${currentPage}...`);
      await page.goto(
        `https://uae.dubizzle.com/motors/used-cars/?page=${currentPage}`,
        {
          waitUntil: "domcontentloaded",
          timeout: 90000,
        }
      );

      console.log("📄 Собираем ссылки на объявления...");
      await page.waitForSelector('[data-testid^="listing-"]', {
        timeout: 30000,
      });

      // 🛠️ Собираем href правильно
      const links = await page.$$eval('[data-testid^="listing-"]', (elements) =>
        elements
          .map((el) => el.getAttribute("href"))
          .filter((href) => href !== null)
      );

      // Добавляем полный URL
      const fullLinks = links.map((link) => `https://uae.dubizzle.com${link}`);
      allLinks = [...allLinks, ...fullLinks];

      console.log(
        `✅ Страница ${currentPage}: найдено ${fullLinks.length} объявлений (всего: ${allLinks.length})`
      );

      // 🔹 Проверяем, есть ли кнопка "Next"
      const nextButton = await page.$('[data-testid="page-next"]');
      if (!nextButton) {
        console.log("🏁 Достигнута последняя страница. Парсинг завершен.");
        break;
      }

      // 🔹 Получаем номер следующей страницы
      const nextPageNumber = await page.$eval(
        '[data-testid="page-next"]',
        (el) => {
          const href = el.getAttribute("href");
          const match = href.match(/page=(\d+)/);
          return match ? parseInt(match[1], 10) : null;
        }
      );

      if (!nextPageNumber || nextPageNumber <= currentPage) {
        console.log("🏁 Больше страниц нет. Завершаем.");
        break;
      }

      console.log(`➡️ Переход на страницу ${nextPageNumber}...`);
      currentPage = nextPageNumber;
    }

    console.log(`🎯 Итог: собрано ${allLinks.length} ссылок`);
    return allLinks;
  } catch (error) {
    console.error("❌ Ошибка при парсинге списка объявлений:", error);
    return [];
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeListings };
