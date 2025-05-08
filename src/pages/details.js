const {
    exec
} = require("child_process");

async function killChromium() {
    console.log("🛑 Принудительное завершение Chromium...");
    exec("pkill -9 -f chromium", (error) => {
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
            timeout: 20000,
        });

        async function safeEval(page, selector, callback) {
            try {
                return await page.$eval(selector, callback);
            } catch (error) {
                return null;
            }
        }

        console.log("📄 Загружаем данные...");

        const title = await safeEval(page, ".title h1", el => el.textContent.trim());
        const make = await safeEval(page, ".car-det-list span:has(i.fa-car) + span.txt", el => el.textContent.trim());
        const model = await safeEval(page, ".car-det-list span:has(i.fa-car-side) + span.txt", el => el.textContent.trim());
        const year = await safeEval(page, ".car-det-list span:has(i.far.fa-calendar-alt) + span.txt", el => el.textContent.trim());
        const kilometers = await safeEval(page, ".car-det-list span:has(i.fa-tachometer-alt) + span.txt", el => el.textContent.replace(/\D/g, "").trim());
        const bodyType = await safeEval(page, ".car-det-list span:has(i.fa-truck-pickup) + span", el => el.textContent.trim());
        const fuelType = await safeEval(page, ".car-det-list span:has(i.fa-gas-pump) + span", el => el.textContent.trim());
        const exteriorColor = await safeEval(page, ".car-det-list .d-flex:nth-child(4) .detail-col:last-child span:nth-child(2)", el => el.textContent.trim());

        const priceFormatted = await safeEval(page, ".price", el => el.textContent.replace(/[^\d,]/g, "").trim());
        const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
        const currency = "AED";

        const photos = await page.$$eval("#gallery .lightgallery.item", imgs => imgs.map(img => img.href));

        const sellerName = await safeEval(page, ".side-right .dpname", el => el.textContent.trim());
        const sellerType = "Dealer"; // На AutoTraders у всех опубликованных объявлений тип "Dealer"
        const sellerLogo = await safeEval(page, ".side-right .logo img", img => img.src);
        const sellerProfileLink = await safeEval(page, ".side-right .logo a", a => a.href);

        const phoneNumber = await safeEval(page, ".user-contact a[href^='tel:']", el => el.href.replace("tel:", "").trim());

        const location = await safeEval(page, ".side-right .dcname", el => el.textContent.trim());
        const horsepower = await safeEval(page, ".car-det-list .d-flex:nth-child(6) .detail-col:first-child span:nth-child(2)", el => el.textContent.trim());

        const shortUrl = url;

        const carDetails = {
            short_url: shortUrl,
            title,
            photos,
            make,
            model,
            year,
            body_type: bodyType,
            horsepower: horsepower,
            fuel_type: fuelType,
            motors_trim: null,
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