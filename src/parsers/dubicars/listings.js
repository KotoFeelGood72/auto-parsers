/**
 * Модуль для извлечения списка объявлений с Dubicars
 */

async function* scrapeDubicarsListings(browser) {
  let attempt = 0;
  const maxRetries = 3;

  while (attempt < maxRetries) {
    const page = await browser.newPage();

    try {
      console.log("🔍 Открываем каталог Dubicars...");

      await page.setExtraHTTPHeaders({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      });

      let currentPage = 1;
      const maxPages = 50; // Ограничиваем для демонстрации

      while (currentPage <= maxPages) {
        const url = `https://www.dubicars.com/dubai/used?page=${currentPage}`;
        console.log(`📄 Загружаем страницу: ${url}`);

        await page.goto(url, { 
          waitUntil: "domcontentloaded", 
          timeout: 60000 
        });

        // Ждём основной список машин
        await page.waitForSelector('section#serp-list li.serp-list-item a.image-container', { 
          timeout: 30000 
        });

        // Даем странице немного времени дорендерить элементы
        await new Promise(r => setTimeout(r, 500));

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
      console.error(`❌ Ошибка при парсинге Dubicars (попытка ${attempt + 1}):`, error);
      attempt++;
      console.log("🔄 Перезапуск страницы...");
    } finally {
      await page.close();
      console.log("🛑 Страница Dubicars закрыта.");
    }
  }

  console.error("🚨 Все попытки исчерпаны! Парсер Dubicars остановлен.");
}

module.exports = { scrapeDubicarsListings };
