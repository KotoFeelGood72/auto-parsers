async function* scrapeListings(context) { // ✅ Принимаем контекст
  console.log("🔍 Открываем главную страницу каталога...");
  const page = await context.newPage(); // ✅ Открываем вкладку в общем контексте

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
  await page.close(); // ✅ Закрываем страницу после сбора ссылок

  for (const brandLink of brandLinks) {
      const fullBrandUrl = `https://uae.dubizzle.com${brandLink}`;
      console.log(`🚗 Переход в бренд: ${fullBrandUrl}`);

      const brandPage = await context.newPage(); // ✅ Открываем новую вкладку в общем контексте

      try {
          await brandPage.goto(fullBrandUrl, { waitUntil: "domcontentloaded", timeout: 90000 });

          let currentPage = 1;
          while (true) {
              console.log(`📄 Загружаем страницу ${currentPage} для бренда ${fullBrandUrl}...`);
              await brandPage.waitForSelector('[data-testid^="listing-"]', { timeout: 30000 });

              const links = await brandPage.$$eval("[data-testid^='listing-']", (elements) =>
                  elements.map((el) => el.getAttribute("href")).filter((href) => href !== null)
              );

              for (const link of links) {
                  yield `https://uae.dubizzle.com${link}`;
              }

              console.log(`✅ Страница ${currentPage}: найдено ${links.length} объявлений`);

              const nextButton = await brandPage.$('[data-testid="page-next"]');
              if (!nextButton) {
                  console.log("🏁 Достигнута последняя страница бренда.");
                  break;
              }

              const nextPageNumber = await brandPage.$eval('[data-testid="page-next"]', (el) => {
                  const href = el.getAttribute("href");
                  const match = href.match(/page=(\d+)/);
                  return match ? parseInt(match[1], 10) : null;
              });

              if (!nextPageNumber || nextPageNumber <= currentPage) {
                  console.log("🏁 Больше страниц нет. Переходим к следующему бренду.");
                  break;
              }

              console.log(`➡️ Переход на страницу ${nextPageNumber} для бренда ${fullBrandUrl}...`);
              await brandPage.goto(`${fullBrandUrl}?page=${nextPageNumber}`, { waitUntil: "domcontentloaded", timeout: 90000 });
              currentPage = nextPageNumber;
          }
      } catch (error) {
          console.error(`❌ Ошибка при обработке бренда ${fullBrandUrl}:`, error);
      } finally {
          await brandPage.close(); // ✅ Закрываем вкладку после парсинга бренда
      }
  }
}

module.exports = { scrapeListings };