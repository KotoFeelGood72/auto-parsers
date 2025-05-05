async function* scrapeListings(browser) {
  let attempt = 0;

  while (attempt < 3) {
    const page = await browser.newPage();

    try {
      console.log("🔍 Открываем каталог Dubicars...");

      await page.setExtraHTTPHeaders({
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      let currentPage = 1;

      while (true) {
        const url = `https://www.dubicars.com/dubai/used?page=${currentPage}`;
        console.log(`📄 Загружаем страницу: ${url}`);

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Ждём основной список машин
        await page.waitForSelector('section#serp-list li.serp-list-item a.image-container', { timeout: 30000 });

        const carLinks = await page.$$eval('section#serp-list li.serp-list-item a.image-container', (elements) =>
          elements
            .map((el) => el.getAttribute("href"))
            .filter((href) => href && href.startsWith("https://www.dubicars.com/"))
        );

        if (carLinks.length === 0) {
          console.log(`🏁 На странице ${currentPage} нет объявлений. Завершаем.`);
          break;
        }

        console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

        for (const link of carLinks) {
          yield link;
        }

        console.log(`➡️ Переход к следующей странице: ${currentPage + 1}`);
        currentPage++;
      }

      return;
    } catch (error) {
      console.error(`❌ Ошибка при парсинге (попытка ${attempt + 1}):`, error);
      attempt++;
      console.log("🔄 Перезапуск страницы...");
    } finally {
      await page.close();
      console.log("🛑 Страница закрыта.");
    }
  }

  console.error("🚨 Все попытки исчерпаны! Парсер остановлен.");
}

module.exports = { scrapeListings };