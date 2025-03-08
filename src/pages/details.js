const { extractText } = require("./details/extractText");
const { extractSellerDetails } = require("./details/extractSellerDetails");
const { extractPhoneNumber } = require("./details/extractPhoneNumber");
const { extractPhotos } = require("./details/extractPhotos");

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
    }, { timeout: 60000 }).catch(() => console.warn("⚠️ Не удалось дождаться загрузки данных"));

    const title = await extractText(page, '[data-testid="listing-sub-heading"]').catch(() => "Не указано");
    const make = title.split(" ")[0] || "Не указано";
    const model = title.split(" ")[1] || "Не указано";
    const year = await extractText(page, '[data-testid="listing-year-value"]').catch(() => "Не указано");
    const bodyType = await extractText(page, '[data-testid="overview-body_type-value"]').catch(() => "Не указано");
    const horsepower = await extractText(page, '[data-testid="overview-horsepower-value"]').catch(() => "Не указано");
    const fuelType = await extractText(page, '[data-testid="overview-fuel_type-value"]').catch(() => "Не указано");
    const kilometers = (await extractText(page, '[data-testid="listing-kilometers-value"]').catch(() => "0")).replace(/\D/g, "");
    const exteriorColor = await extractText(page, '[data-testid="overview-exterior_color-value"]').catch(() => "Не указано");
    const location = await extractText(page, '[data-testid="listing-location-map"]').catch(() => "Не указано");
    const motorsTrim = await extractText(page, '[data-testid="overview-engine_capacity_cc-value"]').catch(() => "Не указано");

    const priceFormatted = await extractText(page, '[data-testid="listing-price"] span').catch(() => "0");
    const priceRaw = parseFloat(priceFormatted.replace(/,/g, "").replace("AED", "").trim()) || 0;
    const currency = "AED";

    const shortUrl = url;

    const seller = await extractSellerDetails(page).catch(() => ({
      name: "Не указан",
      type: "Частное лицо",
      logo: null,
      profileLink: null,
    }));
    
    const phoneNumber = await extractPhoneNumber(page).catch(() => "Не указан");
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
      sellers: seller,
      price: {
        formatted: priceFormatted,
        raw: priceRaw,
        currency,
      },
      exterior_color: exteriorColor,
      location,
      contact: {
        phone: phoneNumber,
      },
    };

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
