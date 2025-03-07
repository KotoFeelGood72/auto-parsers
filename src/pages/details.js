async function scrapeCarDetails(url, context, attempt = 0) {


const page = await context.newPage(); 

  try {
    console.log(`🚗 Переходим к ${url}`);

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });

    console.log("📄 Загружаем данные...");

    await page.waitForFunction(() => {
      const elem = document.querySelector('[data-testid="listing-price"]');
      return elem && elem.innerText.trim().length > 0;
   }, { timeout: 60000 });

    const title = await page.$eval(
      '[data-testid="listing-sub-heading"]',
      (el) => el.innerText.trim()
    );
    const make = await page.$eval('[data-testid="listing-sub-heading"]', (el) =>
      el.innerText.split(" ")[0].trim()
    );
    const model = await page.$eval(
      '[data-testid="listing-sub-heading"]',
      (el) => el.innerText.split(" ")[1].trim()
    );
    const year = await page.$eval('[data-testid="listing-year-value"]', (el) =>
      el.innerText.trim()
    );
    const bodyType = await page.$eval(
      '[data-testid="overview-body_type-value"]',
      (el) => el.innerText.trim()
    );
    const horsepower = await page.$eval(
      '[data-testid="overview-horsepower-value"]',
      (el) => el.innerText.trim()
    );
    const fuelType = await page.$eval(
      '[data-testid="overview-fuel_type-value"]',
      (el) => el.innerText.trim()
    );
    const motorsTrim = await page.$eval(
      '[data-testid="overview-fuel_type-value"]',
      (el) => el.innerText.trim()
    );
    const kilometers = await page.$eval(
      '[data-testid="listing-kilometers-value"]',
      (el) => el.innerText.trim().replace(/\D/g, "")
    );
    const exteriorColor = await page.$eval(
      '[data-testid="overview-exterior_color-value"]',
      (el) => el.innerText.trim()
    );
    const location = await page.$eval(
      '[data-testid="listing-location-map"]',
      (el) => el.innerText.trim()
    );

    const priceFormatted = await page.$eval(
      '[data-testid="listing-price"] span',
      (el) => el.innerText.trim().replace("AED", "").trim()
    );
    const priceRaw = parseFloat(priceFormatted.replace(/,/g, ""));
    const currency = "AED";

    const shortUrl = url;

    let phoneNumber = null;


// Парсим информацию о продавце
let sellerName = "Не указан";
let sellerType = "Частное лицо";
let sellerLogo = null;
let sellerProfileLink = null;

try {
  console.log("⌛ Ожидаем загрузку блока продавца...");
  await page.waitForSelector('[data-testid="name"]', { timeout: 30000, state: "attached" });

  sellerName = await page.$eval(
    '[data-testid="name"]',
    (el) => el.innerText.trim()
  );

  sellerType = await page.$eval(
    '[data-testid="type"]',
    (el) => el.innerText.trim()
  );

  sellerLogo = await page.$eval('[data-testid="logo"] img', (el) => el.src);

  const sellerProfileElement = await page.$('[data-testid="view-all-cars"]');
  if (sellerProfileElement) {
    sellerProfileLink = await page.$eval(
      '[data-testid="view-all-cars"]',
      (el) => el.href
    );
  }

  console.log(`🏢 Продавец: ${sellerName} (${sellerType})`);
} catch (error) {
  console.warn("⚠️ Ошибка при получении данных о продавце:", error);
}

    // Берём первый локатор кнопки "Call"
    const callButton = page.locator('[data-testid="call-cta-button"]').first();

    // Проверяем, есть ли хоть одна кнопка
    const callButtonCount = await callButton.count();

    if (callButtonCount > 0) {
      console.log(
        `📞 Найдено ${callButtonCount} кнопок вызова. Кликаем по первой...`
      );

      let clicked = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔄 Попытка ${attempt}...`);

          // Иногда можно явно проскроллить (но Playwright и так скроллит при клике):
          await callButton.scrollIntoViewIfNeeded();
          await page.waitForTimeout(2000);

          // Кликаем
          await callButton.click();
          clicked = true;
          console.log("✅ Успешно кликнули по кнопке 'Call'");
          break;
        } catch (error) {
          console.warn(`⚠️ Попытка ${attempt} не удалась. Ошибка:`, error);
          await page.waitForTimeout(2000);
        }
      }

      if (!clicked) {
        console.error(
          "🚨 Не удалось кликнуть по кнопке 'Call' даже за 3 попытки!"
        );
        return;
      }

      console.log("⌛ Ждем появления модального окна...");
      const modal = page.locator(".MuiDialog-container");
      await modal.waitFor({ state: "visible", timeout: 10000 });
      console.log("✅ Модальное окно найдено!");

      // Ожидаем появления номера телефона
      const phoneNumberLocator = modal.locator(
        '[data-testid="phone-number"] p'
      );
      await phoneNumberLocator.waitFor({ state: "visible", timeout: 15000 });

      // Считываем текст
      phoneNumber = await phoneNumberLocator.innerText();
      console.log(`📞 Получен номер телефона: ${phoneNumber}`);

      // Закрываем модальное окно (если нужно)
      const closeButton = modal.locator('[data-testid="close-button"]');
      if ((await closeButton.count()) > 0) {
        await closeButton.click();
        await page.waitForTimeout(2000);
        console.log("✅ Модальное окно закрыто.");
      }
    } else {
      console.warn("⚠️ Кнопка вызова не найдена, пропускаем...");
    }

    // 🔹 Кликаем по первому `.MuiImageListItem-standard`
    const mainImageSelector = ".MuiImageListItem-standard";
    await page.waitForSelector(mainImageSelector, { timeout: 20000, state: "attached" });

    let clicked = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      // 3 попытки клика
      console.log(`📸 Попытка клика #${attempt + 1}...`);

      const mainImage = await page.$(mainImageSelector);
      if (!mainImage) {
        console.warn("⚠️ Главное изображение исчезло, пробуем заново...");
        await page.waitForTimeout(1000);
        continue;
      }

      try {
        await mainImage.hover();
        await page.waitForTimeout(500);
        await mainImage.click({ delay: 200 });
        clicked = true;
        break;
      } catch (error) {
        console.warn("⚠️ Элемент изменился, пробуем снова...");
        await page.waitForTimeout(1000);
      }
    }

    if (!clicked) {
      throw new Error("🚨 Не удалось кликнуть на главное изображение!");
    }

    console.log("📸 Кликнули, ждем загрузки модалки...");

    // 🔹 Ждем появления модального окна
    await page.waitForSelector(".MuiModal-root", { timeout: 15000, state: "attached" });

    // 🔹 Проверяем, загрузились ли изображения в модалке
    await page.waitForFunction(
      () => {
        const modal = document.querySelector(".MuiModal-root");
        return (
          modal && modal.querySelectorAll(".MuiImageList-root img").length > 0
        );
      },
      { timeout: 45000, state: "attached" }
    );

    // 🔹 Собираем изображения
    const photos = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".MuiModal-root .MuiImageList-root img")
      )
        .map((img) => img.src)
        .filter(
          (src) =>
            src.includes(".jpeg") ||
            src.includes(".jpg") ||
            src.includes(".png")
        );
    });

    console.log(`📸 Собрано изображений: ${photos.length}`);

    await page.waitForTimeout(500);

    const carDetails = {
      short_url: shortUrl,
      title,
      photos,
      make,
      model,
      year,
      body_type: bodyType,
      horsepower,
      fuel_type: fuelType,
      motors_trim: motorsTrim,
      kilometers,
      sellers: {
        sellerName: sellerName || "Не указан",
        sellerType: sellerType || "Частное лицо",
        sellerLogo: sellerLogo || null,
        sellerProfileLink: sellerProfileLink || null,
      },
      price: {
        formatted: priceFormatted,
        raw: priceRaw,
        currency,
      },
      exterior_color: exteriorColor,
      location,
      contact: {
        phone: phoneNumber || "Не указан",
      },
    };

    console.log(carDetails);
    return carDetails;
  } catch (error) {
    console.error(`❌ Ошибка при загрузке данных с ${url}:`, error);
    if (attempt < 2) {
        return await scrapeCarDetails(url, context, attempt + 1);
    }
    return null;
  } finally {
    try {
      await page.close(); // ✅ Закрываем вкладку
  } catch (err) {
      console.warn("⚠ Ошибка при закрытии страницы:", err);
  }
}
}


process.on('SIGINT', async () => {
  console.log("🛑 Завершение работы, закрываем браузер...");
  if (browser) await browser.close();
  process.exit();
});



module.exports = { scrapeCarDetails };








