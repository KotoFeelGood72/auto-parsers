const {
  extractText
} = require("./details/extractText");

async function scrapeCarDetails(url, browser) {
  const page = await browser.newPage();

  // Не падаем, если селектор не найден
  async function safeEval(page, selector, fn) {
    try {
      return await page.$eval(selector, fn);
    } catch {
      return null;
    }
  }

  // Выбираем первое из возможных названий
  function pick(map, keys, def = null) {
    for (const k of keys) {
      if (map[k] != null) return map[k];
    }
    return def;
  }

  try {
    console.log(`🚗 Переходим к ${url}`);
    await page.setExtraHTTPHeaders({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000
    });

    console.log("📄 Стягиваем базовые данные…");

    // ─── Сырой набор фич из Car Overview ───────────────────────────────
    const overviewFeatures = await page.$$eval(
      ".cs-block--overview .item",
      items => {
        const map = {};
        items.forEach(item => {
          const key = item.querySelector(".cs-block_sub-title")?.textContent.trim();
          const val = item.querySelector("p")?.textContent.trim();
          if (key) map[key] = val;
        });
        return map;
      }
    );

    // ─── Сырой набор фич из Car details ───────────────────────────────
    const detailFeatures = await page.$$eval(
      ".cs-block--car-detail .item",
      items => {
        const map = {};
        items.forEach(item => {
          const key = item.querySelector(".item-title")?.textContent.trim().replace(/:$/, "");
          const val = item.querySelector("p.text")?.textContent.trim();
          if (key) map[key] = val;
        });
        return map;
      }
    );

    // ─── Объединяем их в одну карту ─────────────────────────────────────
    const rawFeatures = {
      ...overviewFeatures,
      ...detailFeatures
    };

    // ─── Стягиваем остальные поля ───────────────────────────────────────
    const title =
      (await extractText(page, ".car-info-holder h1.title")) || "Не указано";

    const yearText =
      (await safeEval(
        page,
        ".mileage .item:nth-child(1) .mileage_text",
        el => el.textContent
      )) || "0";
    const year = yearText.replace(/\D/g, "") || null;

    const kmText =
      (await safeEval(
        page,
        ".mileage .item:nth-child(2) .mileage_text",
        el => el.textContent
      )) || "0";
    const kilometers = kmText.replace(/\D/g, "") || "0";

    const priceText =
      (await safeEval(
        page,
        ".show-old-price",
        el => el.textContent
      )) || "";
    const priceFormatted = priceText.replace(/[^\d,]/g, "").trim();
    const priceRaw = priceFormatted ?
      parseFloat(priceFormatted.replace(/,/g, "")) :
      null;
    const currency = "AED";

    // ─── 3. Фотографии ──────────────────────────────────────────────────────
    const photos =
      (await page.$$eval(
        // собираем все <img class="imagegal"> из главного слайдера
        ".banner-swiper .slide-image",
        imgs =>
        Array.from(
          new Set(
            imgs
            .map(img => img.getAttribute("data-src") || img.src)
            .map(src => src.startsWith("//") ? "https:" + src : src)
            .filter(src => src)
          )
        )
      )) || [];


    const location =
      (await safeEval(
        page,
        ".location_text#location_text",
        el => el.textContent.trim()
      )) || "Не указано";

    // ─── Продавец и контакт ────────────────────────────────────────────
    const sellerName =
      (await safeEval(
        page,
        ".cmpbrndlogo",
        img => img.getAttribute("title")
      )) || "Не указан";
    const sellerType =
      (await safeEval(
        page,
        ".priceingdt:nth-of-type(6) .text-right",
        el => el.textContent.trim()
      )) || "Частное лицо";
    const sellerLogo =
      (await safeEval(page, ".cmpbrndlogo", el => el.src)) || null;
    const sellerProfileLink =
      (await safeEval(page, ".moredealer", a => a.href)) || null;
    const phoneNumber =
      (await safeEval(
        page,
        ".callnwbtn",
        el => el.textContent.trim()
      )) || "Не указан";

    // ─── Составляем итоговый объект ────────────────────────────────────
    const carDetails = {
      short_url: url,
      title,
      photos,
      make: pick(rawFeatures, ["Make", "Марка"], title.split(" ")[0]),
      model: pick(rawFeatures, ["Model", "Модель"], title.replace(/^\S+\s*/, "")),
      year,
      body_type: pick(rawFeatures, ["Body Type", "Тип кузова"], "Не указано"),
      horsepower: pick(rawFeatures, ["Engine Size", "Мощность"], null) ?
        parseInt(
          pick(rawFeatures, ["Engine Size", "Мощность"]).replace(/\D/g, ""),
          10
        ) : null,
      fuel_type: pick(rawFeatures, ["Fuel Type", "Тип топлива"], "Не указано"),
      motors_trim: pick(rawFeatures, ["Specs", "Комплектация"], "Не указано"),
      kilometers,
      sellers: {
        sellerName,
        sellerType,
        sellerLogo,
        sellerProfileLink,
      },
      price: {
        formatted: priceFormatted,
        raw: priceRaw,
        currency,
      },
      exterior_color: pick(rawFeatures, ["Color", "Цвет"], "Не указано"),
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

module.exports = {
  scrapeCarDetails
};