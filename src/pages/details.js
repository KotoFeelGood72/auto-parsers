const {
  exec
} = require("child_process");

async function killChromium() {
  console.log("🛑 Принудительное завершение Chromium...");
  exec("pkill -9 -f chromium", (error, stdout, stderr) => {
    if (error) {
      console.error("Ошибка при закрытии Chromium:", error);
    } else {
      console.log("✅ Chromium закрыт.");
    }
  });
}

async function scrapeCarDetails(url, browser) {
  const page = await browser.newPage();
  try {
    console.log(`🚗 Переходим к ${url}`);

    await page.setExtraHTTPHeaders({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });


    async function safeEval(page, selector, callback) {
      try {
        return await page.$eval(selector, callback);
      } catch (error) {
        return null;
      }
    }


    console.log("📄 Загружаем данные...");

    const title = await safeEval(page, "h1.dsktit", el => el.textContent.trim().split("\n")[0]);
    const make = await safeEval(page, ".priceingdt:nth-of-type(3) a.text-right", el => el.textContent.trim());
    const model = await safeEval(page, ".priceingdt:nth-of-type(4) span.text-right", el => el.textContent.trim());
    const year = await safeEval(page, ".priceingdt:nth-of-type(1) .text-right.info", el => el.textContent.trim().replace(/\D/g, ""));
    const bodyType = await safeEval(page, ".priceingdt:nth-of-type(2) a.text-right", el => el.textContent.trim());
    const motorsTrim = await safeEval(page, ".priceingdt:nth-of-type(5) span.text-right", el => el.textContent.trim());
    const fuelType = await safeEval(page, ".priceingdt:nth-of-type(10) span.text-right", el => el.textContent.trim());
    const kilometers = await page.$eval(
      '.priceingdt:nth-of-type(1) .text-right.info',
      el => {
        const raw = el.childNodes[0].nodeValue || '';
        return parseInt(raw.trim().replace(/\D/g, ''), 10);
      }
    );

    const exteriorColor = await safeEval(page, ".priceingdt:last-child span.text-right", el => el.textContent.trim());
    const location = await safeEval(page, ".dtlloc", el => el.textContent.replace(/\s+/g, " ").trim());

    const priceFormatted = await safeEval(page, ".mainprice", el => el.textContent.replace(/[^\d,]/g, "").trim());
    const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
    const currency = "AED";

    const photos = await page.$$eval(".collage-slide-images img.imagegal", imgs => imgs.map(img => img.src));

    const sellerName = await safeEval(page, ".cmpbrndlogo", img => img.getAttribute("title"));
    const sellerType = await safeEval(page, ".priceingdt:nth-of-type(6) span.text-right", el => el.textContent.trim());
    const sellerLogo = await safeEval(page, ".cmpbrndlogo", el => el.src);
    const sellerProfileLink = await safeEval(page, ".moredealer", el => el.href);

    const phoneNumber = await safeEval(page, ".callnwbtn", el => el.textContent.trim());

    const shortUrl = url;

    const carDetails = {
      short_url: shortUrl,
      title,
      photos,
      make,
      model,
      year,
      body_type: bodyType,
      horsepower: null,
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
    return null;
  } finally {
    await page.close();
  }
}

module.exports = {
  scrapeCarDetails
};