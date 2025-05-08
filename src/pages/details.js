async function scrapeCarDetails(url, browser) {
    const page = await browser.newPage();
    try {
        console.log(`🚗 Переходим к ${url}`);

        await page.setExtraHTTPHeaders({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        });

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        async function safeEval(page, selector, callback) {
            try {
                return await page.$eval(selector, callback);
            } catch (error) {
                return null;
            }
        }

        console.log("📄 Загружаем данные...");

        const title = await safeEval(page, "h1", el => el.textContent.trim());

        const priceFormatted = await safeEval(page, "[data-id='post_price']", el => el.textContent.replace(/[^\d,]/g, "").trim());
        const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
        const currency = "AED";


        const location = await safeEval(page, "a[data-id='location']", el => el.textContent.trim());

        const photos = await page.$$eval(".image-gallery-slide img.image-gallery-image", imgs =>
            imgs.map(img => img.src).filter(src => src)
        );

        const sellerName = await safeEval(page, "[data-id='member_name']", el => el.textContent.trim());
        const sellerLogo = await safeEval(page, "#PostViewOwnerCard img", img => img.src);
        const sellerProfileLink = await safeEval(page, "#PostViewOwnerCard a", a => a.href);

        const phoneNumber = await safeEval(page, "[data-id='call_btn'] span", el => el.textContent.trim());
        const motors_trim = await safeEval(page, "[data-id='singeInfoField_3'] a", el => el.textContent.trim());
        const bodyType = await safeEval(page, "[data-id='singeInfoField_6'] span", el => el.textContent.trim());
        const fuelType = await safeEval(page, "[data-id='singeInfoField_8'] span", el => el.textContent.trim());
        const kilometers = await safeEval(page, "[data-id='singeInfoField_5'] span", el => el.textContent.trim());
        const make = await safeEval(page, "[data-id='singeInfoField_1'] a", el => el.textContent.trim());
        const exteriorColor = await safeEval(page, "[data-id='singeInfoField_11'] a", el => el.textContent.trim());
        const year = await safeEval(page, "[data-id='singeInfoField_4'] a", el => el.textContent.trim());
        const model = await safeEval(page, "[data-id='singeInfoField_2'] a", el => el.textContent.trim());
        const horsepower = await safeEval(page, "[data-id='singeInfoField_10'] span", el => el.textContent.trim());

        const shortUrl = url;

        const carDetails = {
            short_url: shortUrl,
            title,
            photos,
            make: make,
            model: model,
            year: year,
            body_type: bodyType,
            horsepower: horsepower,
            fuel_type: fuelType,
            motors_trim: motors_trim,
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