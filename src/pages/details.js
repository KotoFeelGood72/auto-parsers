const { extractText } = require("./details/extractText");
const { extractSellerDetails } = require("./details/extractSellerDetails");
const { extractPhoneNumber } = require("./details/extractPhoneNumber");

async function scrapeCarDetails(url, context) {
  const page = await context.newPage();
  let carDetails = { short_url: url, sellers: {}, photos: [], contact: {} };

  try {
    console.log(`🚗 Переходим к ${url}`);

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded", // Ждем, пока загрузятся все запросы
      timeout: 10000,
    });

    console.log("📄 Загружаем данные...");

    // Дожидаемся появления цены, иначе страница могла не прогрузиться
    await page
      .waitForSelector('[data-testid="listing-price"]')
      .catch(() => console.warn("⚠️ Не удалось дождаться загрузки цены"));

    // 🔹 Оптимизированный парсинг характеристик
    const fields = [
      {
        key: "title",
        selector: '[data-testid="listing-sub-heading"]',
        default: "Не указано",
      },
      {
        key: "year",
        selector: '[data-testid="listing-year-value"]',
        default: "Не указано",
      },
      {
        key: "body_type",
        selector: '[data-testid="overview-body_type-value"]',
        default: "Не указано",
      },
      {
        key: "horsepower",
        selector: '[data-testid="overview-horsepower-value"]',
        default: "Не указано",
      },
      {
        key: "fuel_type",
        selector: '[data-testid="overview-fuel_type-value"]',
        default: "Не указано",
      },
      {
        key: "kilometers",
        selector: '[data-testid="listing-kilometers-value"]',
        default: "0",
        sanitize: (v) => v.replace(/\D/g, ""),
      },
      {
        key: "exterior_color",
        selector: '[data-testid="overview-exterior_color-value"]',
        default: "Не указано",
      },
      {
        key: "location",
        selector: '[data-testid="listing-location-map"]',
        default: "Не указано",
      },
      {
        key: "motors_trim",
        selector: '[data-testid="overview-engine_capacity_cc-value"]',
        default: "Не указано",
      },
    ];

    for (const field of fields) {
      try {
        carDetails[field.key] = await extractText(page, field.selector);
        if (field.sanitize) {
          carDetails[field.key] = field.sanitize(carDetails[field.key]);
        }
      } catch {
        carDetails[field.key] = field.default;
      }
    }

    // 🔹 Обработка `make` и `model`
    const titleParts = carDetails.title.split(" ");
    carDetails.make = titleParts[0] || "Не указано";
    carDetails.model = titleParts[1] || "Не указано";

    // 🔹 Обработка цены
    try {
      const priceFormatted = await extractText(
        page,
        '[data-testid="listing-price"] span'
      );
      carDetails.price = {
        formatted: priceFormatted,
        raw:
          parseFloat(
            priceFormatted.replace(/,/g, "").replace("AED", "").trim()
          ) || 0,
        currency: "AED",
      };
    } catch {
      carDetails.price = { formatted: "0", raw: 0, currency: "AED" };
    }

    // 🔹 Продавец
    try {
      carDetails.sellers = await extractSellerDetails(page);
    } catch {
      carDetails.sellers = {
        name: "Не указан",
        type: "Частное лицо",
        logo: null,
        profileLink: null,
      };
    }

    // 🔹 Телефон
    try {
      carDetails.contact.phone = await extractPhoneNumber(page);
    } catch {
      carDetails.contact.phone = "Не указан";
    }

    // 🔹 Обработка изображений
    try {
      const mainImageSelector = ".MuiImageListItem-standard";
      await page.waitForSelector(mainImageSelector, { timeout: 1000 });

      let clicked = false;
      for (let attempt = 0; attempt < 3; attempt++) {
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

      if (clicked) {
        console.log("📸 Кликнули, ждем загрузки модалки...");
        await page.waitForSelector(".MuiModal-root", { timeout: 15000 });

        await page.waitForFunction(
          () => {
            const modal = document.querySelector(".MuiModal-root");
            return (
              modal &&
              modal.querySelectorAll(".MuiImageList-root img").length > 0
            );
          },
          { timeout: 3000 }
        );

        // 🔹 Собираем изображения
        carDetails.photos = await page.evaluate(() => {
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

        console.log(`📸 Собрано изображений: ${carDetails.photos.length}`);
      }
    } catch (error) {
      console.warn("⚠️ Ошибка при загрузке изображений:", error);
    }

    console.log(carDetails);
    return carDetails;
  } catch (error) {
    console.error(`❌ Ошибка при загрузке данных с ${url}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

module.exports = { scrapeCarDetails };
