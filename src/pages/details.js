const { startBrowser } = require("../utils/browser");
const { extractText } = require("./details/extractText");
const { extractSellerDetails } = require("./details/extractSellerDetails");
const { extractPhoneNumber } = require("./details/extractPhoneNumber");
const { extractPhotos } = require("./details/extractPhotos");

async function scrapeCarDetails(url) {
  const browser = await startBrowser();
  const page = await browser.newPage();

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
    const motorsTrim = await extractText(page, '[data-testid="overview-fuel_type-value"]').catch(() => "Не указано");

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
    const photos = await extractPhotos(page).catch(() => []);

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
    await browser.close();
  }
}

module.exports = { scrapeCarDetails };
