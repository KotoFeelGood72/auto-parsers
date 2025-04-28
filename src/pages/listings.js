async function* scrapeListings(context) {
  console.log("🔍 Открываем главную страницу каталога...");
  const page = await context.newPage();

  await page.setExtraHTTPHeaders({
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const baseUrl = "https://carswitch.com/uae/used-cars/search";
  let currentPage = 1;

  while (true) {
    const url = `${baseUrl}?page=${currentPage}`;
    console.log(`📄 Загружаем страницу ${currentPage}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });

    try {
      // 🔃 Скроллим страницу, чтобы подгрузить все карточки
      await autoScroll(page);
      await page.waitForTimeout(1000); // немного подождать после скролла

      // ✅ Ждём хотя бы одну видимую карточку
      await page.waitForSelector(
        "#main-listing-div .pro-item a.image-wrapper[href]",
        {
          timeout: 30000,
        }
      );

      const links = await page.$$eval(
        "#main-listing-div .pro-item a.image-wrapper",
        (anchors) => anchors.map((a) => a.href).filter(Boolean)
      );

      const ready = links.length;
      console.log(`🧪 Найдено карточек: ${ready}`);

      if (ready === 0) {
        await page.screenshot({
          path: `page-${currentPage}.png`,
          fullPage: true,
        });
        console.warn("⚠️ Карточки не найдены. Сохранили скриншот.");
        break;
      }

      for (const link of links) {
        yield link;
      }

      console.log(
        `✅ Страница ${currentPage}: найдено ${links.length} объявлений`
      );
      currentPage++;
    } catch (error) {
      console.error(`❌ Ошибка на странице ${currentPage}:`, error);
      await page.screenshot({
        path: `error-page-${currentPage}.png`,
        fullPage: true,
      });
      console.warn("⚠️ Сохранили скриншот с ошибкой.");
      break;
    }
  }

  await page.close();
}

// 👇 Автоскролл
async function autoScroll(page) {
  await page.evaluate(async () => {
    const container = document.querySelector("#main-listing-div");
    if (!container) return;

    await new Promise((resolve) => {
      let lastScrollHeight = 0;
      let attemptsWithoutChange = 0;

      const interval = setInterval(() => {
        container.scrollBy(0, 300);

        const currentHeight = container.scrollHeight;
        if (currentHeight !== lastScrollHeight) {
          attemptsWithoutChange = 0;
          lastScrollHeight = currentHeight;
        } else {
          attemptsWithoutChange++;
        }

        // остановка после 3 "пустых" скроллов
        if (attemptsWithoutChange >= 3) {
          clearInterval(interval);
          resolve();
        }
      }, 400);
    });
  });
}

module.exports = { scrapeListings };
