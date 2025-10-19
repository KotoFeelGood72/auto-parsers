async function scrapeCarDetails(url, context) {
  const page = await context.newPage();

  try {
    console.log(`🚗 Переходим к ${url}`);

    await page.setExtraHTTPHeaders({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    // Отключаем загрузку изображений для экономии памяти
    await page.route('**/*.{png,jpg,jpeg,gif,svg,webp}', route => route.abort());

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    console.log("⏳ Ждем загрузку страницы...");
    await page.waitForSelector(".car-title", { timeout: 15000 });

    async function safeEval(page, selector, callback) {
      try {
        return await page.$eval(selector, callback);
      } catch (error) {
        return null;
      }
    }

    console.log("📄 Парсим данные...");

    const title = await safeEval(page, ".car-title", el => el.textContent.trim());

    const priceFormatted = await safeEval(page, "div.price.currency-price-field", el => el.textContent.replace(/[^\d,]/g, "").trim());
    const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "").replace(/\s/g, "")) : null;
    const currency = "USD";

    const year = await safeEval(page, '#item-specifications ul li:nth-child(2) span:nth-child(3)', el => el.textContent.trim());
    const kilometers = await safeEval(page, '#item-specifications ul li:nth-child(3) span:nth-child(3)', el => el.textContent.trim());
    const fuel_type = await page.$$eval('#item-specifications ul li', (elements) => {
      const el = elements.find(el => el.innerText.includes('Fuel Type'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const make = await page.$$eval('#item-specifications ul li', (elements) => {
      const el = elements.find(el => el.innerText.includes('Make'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const model = await page.$$eval('#item-specifications ul li', (elements) => {
      const el = elements.find(el => el.innerText.includes('Model'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const photos = await page.$$eval('#car-images-slider img', imgs =>
      imgs.map(img => img.src.startsWith('//') ? 'https:' + img.src : img.src)
    );

    const sellerName = await safeEval(page, "#seller-info .seller-intro strong", el => el.textContent.trim());
    const sellerLogo = await safeEval(page, "#seller-info .seller-intro img", img => img.src.startsWith('//') ? 'https:' + img.src : img.src);
    const sellerProfileLink = await safeEval(page, "#seller-info .links li a", a => a.href);

    const whatsappHref = await safeEval(page, 'a.whatsapp-link', a => a.href);
    const phoneMatch = whatsappHref ? whatsappHref.match(/phone=(\d+)/) : null;
    const phone = phoneMatch ? `+${phoneMatch[1]}` : "Не указан";

    const carDetails = {
      short_url: url,
      title,
      photos,
      make: make || null,
      model: model || null,
      year,
      body_type: null,
      horsepower: null,
      fuel_type,
      motors_trim: null,
      kilometers,
      sellers: {
        sellerName: sellerName || "Не указан",
        sellerType: "Dealer",
        sellerLogo: sellerLogo || null,
        sellerProfileLink: sellerProfileLink || null,
      },
      price: {
        formatted: priceFormatted,
        raw: priceRaw,
        currency,
      },
      exterior_color: null,
      location: "Dubai",
      contact: {
        phone,
      },
    };

    console.log(carDetails);
    return carDetails;
  } catch (error) {
    console.error(`❌ Ошибка при загрузке ${url}:`, error);
    return null;
  } finally {
    await page.close();
    console.log("🛑 Страница закрыта.");
  }
}

module.exports = { scrapeCarDetails };