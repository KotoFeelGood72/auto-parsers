/**
 * Модуль для извлечения детальной информации об объявлении с Dubicars
 */

async function scrapeDubicarsDetails(url, browser) {
  const page = await browser.newPage();

  try {
    console.log(`🚗 Переходим к ${url}`);

    await page.setExtraHTTPHeaders({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

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

    console.log("📄 Парсим данные Dubicars...");

    // Основные данные
    const title = await safeEval(page, ".car-title", el => el.textContent.trim());

    // Цена
    const priceFormatted = await safeEval(page, "div.price.currency-price-field", el => el.textContent.trim());
    const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/[^\d.,]/g, '').replace(/,/g, '')) : 0;

    // Характеристики через specs
    const year = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('year'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const kilometers = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('kilometers'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const fuel_type = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('fuel type'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const make = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('make'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const model = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('model'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const body_type = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('vehicle type'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const horsepower = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('horsepower'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const exterior_color = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('color'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
    });

    const location = await page.$$eval('#specifications-container ul li', (elements) => {
      const el = elements.find(el => el.innerText.toLowerCase().includes('location'));
      return el ? el.querySelector('span:last-child')?.textContent.trim() : 'Dubai';
    });

    // Фотографии
    const photos = await page.$$eval('#car-images-slider img', imgs =>
      imgs.map(img => {
        const src = img.src || img.getAttribute('data-src');
        return src && src.startsWith('//') ? 'https:' + src : src;
      }).filter(src => src)
    );

    // Информация о продавце
    const sellerName = await safeEval(page, "#seller-info .seller-intro strong", el => el.textContent.trim());
    const sellerLogo = await safeEval(page, "#seller-info .seller-intro img", img => {
      const src = img.src || img.getAttribute('data-src');
      return src && src.startsWith('//') ? 'https:' + src : src;
    });
    const sellerProfileLink = await safeEval(page, "#seller-info .links li a", a => a.href);

    // Контактная информация
    const whatsappHref = await safeEval(page, 'a.whatsapp-link', a => a.href);
    const phoneMatch = whatsappHref ? whatsappHref.match(/phone=([\d+]+)/) : null;
    const phone = phoneMatch ? phoneMatch[1] : "Не указан";

    // Формируем данные в новом формате
    const carDetails = {
      short_url: url,
      title: title || "Неизвестно",
      make: make || "Неизвестно",
      model: model || "Неизвестно",
      year: year || "Неизвестно",
      body_type: body_type || "Неизвестно",
      horsepower: horsepower ? parseInt(horsepower) : "Неизвестно",
      fuel_type: fuel_type || "Неизвестно",
      motors_trim: "Неизвестно",
      kilometers: kilometers ? parseInt(kilometers.replace(/[^\d]/g, '')) : 0,
      price_formatted: priceFormatted || "0",
      price_raw: priceRaw || 0,
      exterior_color: exterior_color || "Неизвестно",
      location: location || "Dubai",
      phone: phone,
      seller_name: sellerName || "Неизвестен",
      seller_type: "Неизвестен",
      seller_logo: sellerLogo,
      seller_profile_link: sellerProfileLink,
      photos: photos || []
    };

    console.log("✅ Данные Dubicars извлечены:", {
      title: carDetails.title,
      price: carDetails.price_formatted,
      make: carDetails.make,
      model: carDetails.model,
      photos: carDetails.photos.length
    });

    return carDetails;
  } catch (error) {
    console.error(`❌ Ошибка при загрузке ${url}:`, error);
    return null;
  } finally {
    await page.close();
    console.log("🛑 Страница Dubicars закрыта.");
  }
}

module.exports = { scrapeDubicarsDetails };
