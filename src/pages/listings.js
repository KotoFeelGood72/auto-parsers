async function* scrapeListings(browser) {
  let attempt = 0;

  while (attempt < 3) {
    const page = await browser.newPage();

    try {
      console.log("🔍 Открываем главную страницу каталога...");
      await page.setExtraHTTPHeaders({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      let currentPage = 1;
      while (true) {
        const url = `https://www.oneclickdrive.com/buy-used-cars-dubai?page=${currentPage}`;
        console.log(`📄 Загружаем страницу ${currentPage}: ${url}`);
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

        await page.waitForSelector(".gallery-img-link", { timeout: 30000 });

        const carLinks = await page.$$eval(".gallery-img-link", (elements) =>
          elements.map((el) => el.getAttribute("href")).filter(Boolean)
        );

        console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

        for (const link of carLinks) {
          yield `${link}`;
        }

        const hasNextPage = await page.$(".paginationdesign a.nextbtn");
        if (!hasNextPage) {
          console.log("🏁 Последняя страница достигнута. Завершаем парсинг.");
          break;
        }

        currentPage++;
      }

      return;

    } catch (error) {
      console.error(`❌ Ошибка при парсинге (попытка ${attempt + 1}):`, error);
      attempt++;
      console.log("🔄 Перезапуск браузера...");
    } finally {
      await browser.close();
      console.log("🛑 Браузер закрыт.");
    }
  }

  console.error("🚨 Все попытки исчерпаны! Парсер остановлен.");
}

module.exports = { scrapeListings };