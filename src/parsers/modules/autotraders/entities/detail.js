/**
 * Парсинг детальной информации для Autotraders.com
 */

class AutotradersDetailParser {
    constructor(config) {
        this.config = config;
        
        // Селекторы для детальной страницы Autotraders
        this.selectors = {
            // Основные данные
            title: '.vehicle-title',
            price: '.vehicle-price',
            location: '.vehicle-location',
            
            // Детали автомобиля
            make: '.vehicle-make',
            model: '.vehicle-model',
            year: '.vehicle-year',
            bodyType: '.vehicle-body-type',
            fuelType: '.vehicle-fuel-type',
            transmission: '.vehicle-transmission',
            mileage: '.vehicle-mileage',
            color: '.vehicle-color',
            
            // Продавец
            sellerName: '.seller-name',
            sellerType: '.seller-type',
            phone: '.seller-phone',
            
            // Изображения
            images: '.vehicle-images img',
            mainImage: '.vehicle-main-image'
        };
        
        // Поля для извлечения данных
        this.dataFields = {
            make: ['Make', 'Марка', 'Brand', 'brand'],
            model: ['Model', 'Модель', 'Car Model', 'car model'],
            bodyType: ['Body type', 'Body Type', 'Тип кузова', 'body type', 'Body', 'body'],
            fuelType: ['Fuel Type', 'Тип топлива', 'Fuel', 'fuel', 'Fuel type', 'fuel type'],
            transmission: ['Transmission', 'Коробка передач', 'Gear', 'gear'],
            color: ['Color', 'Цвет', 'Exterior Color', 'exterior color']
        };
    }

    /**
     * Парсинг детальной страницы автомобиля
     */
    async parseCarDetails(url, context) {
        const page = await context.newPage();

        try {
            console.log(`🚗 Переходим к ${url}`);
            
            await page.setExtraHTTPHeaders({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            });

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 15000
            });

            console.log("📄 Загружаем данные...");

            // Ждем загрузки основных элементов
            await page.waitForTimeout(2000);

            // Извлекаем основные поля
            const title = await this.safeEval(page, this.selectors.title, el => el.textContent.trim()) || "Не указано";
            const priceText = await this.safeEval(page, this.selectors.price, el => el.textContent.trim()) || "";
            const location = await this.safeEval(page, this.selectors.location, el => el.textContent.trim()) || "Не указано";

            // Парсим цену
            const priceFormatted = priceText.replace(/[^\d,]/g, "").trim();
            const priceRaw = priceFormatted ?
                parseFloat(priceFormatted.replace(/,/g, "")) :
                null;

            // Извлекаем детали автомобиля
            const make = await this.safeEval(page, this.selectors.make, el => el.textContent.trim()) || "Не указано";
            const model = await this.safeEval(page, this.selectors.model, el => el.textContent.trim()) || "Не указано";
            const yearText = await this.safeEval(page, this.selectors.year, el => el.textContent.trim()) || "";
            const year = yearText ? yearText.replace(/\D/g, "") : null;
            
            const bodyType = await this.safeEval(page, this.selectors.bodyType, el => el.textContent.trim()) || "Не указано";
            const fuelType = await this.safeEval(page, this.selectors.fuelType, el => el.textContent.trim()) || "Не указано";
            const transmission = await this.safeEval(page, this.selectors.transmission, el => el.textContent.trim()) || "Не указано";
            
            const mileageText = await this.safeEval(page, this.selectors.mileage, el => el.textContent.trim()) || "";
            const kilometers = mileageText ? mileageText.replace(/\D/g, "") : "0";
            
            const exteriorColor = await this.safeEval(page, this.selectors.color, el => el.textContent.trim()) || "Не указано";

            // Данные о продавце
            const sellerName = await this.safeEval(page, this.selectors.sellerName, el => el.textContent.trim()) || "Не указано";
            const sellerType = await this.safeEval(page, this.selectors.sellerType, el => el.textContent.trim()) || "Частное лицо";
            const phoneNumber = await this.safeEval(page, this.selectors.phone, el => el.textContent.trim()) || "Не указан";

            // Получаем фотографии
            const photos = await page.evaluate((selector) => {
                const images = Array.from(document.querySelectorAll(selector));
                return Array.from(
                    new Set(
                        images
                            .map(img => img.getAttribute("src") || img.src)
                            .map(src => src.startsWith("//") ? "https:" + src : src)
                            .filter(src => src && (src.includes("autotraders.com") || src.includes("cloudfront.net")))
                    )
                );
            }, this.selectors.images) || [];

            const mainImage = await this.safeEval(page, this.selectors.mainImage, el => el.src) || (photos.length > 0 ? photos[0] : null);

            // Составляем итоговый объект
            const carDetails = {
                short_url: url,
                title,
                photos,
                main_image: mainImage,
                make,
                model,
                year,
                body_type: bodyType,
                horsepower: "Не указано", // Autotraders обычно не показывает мощность
                fuel_type: fuelType,
                motors_trim: transmission,
                kilometers,
                sellers: {
                    sellerName,
                    sellerType,
                    sellerLogo: null,
                    sellerProfileLink: null,
                },
                price: {
                    formatted: priceFormatted,
                    raw: priceRaw,
                    currency: "AED",
                },
                exterior_color: exteriorColor,
                location,
                contact: {
                    phone: phoneNumber,
                },
            };

            console.log("✅ Данные автомобиля успешно извлечены");
            return carDetails;

        } catch (error) {
            console.error(`❌ Ошибка при загрузке данных с ${url}:`, error);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * Безопасное выполнение eval на странице
     */
    async safeEval(page, selector, fn) {
        try {
            return await page.$eval(selector, fn);
        } catch {
            return null;
        }
    }

    /**
     * Выбор первого непустого значения из объекта
     */
    pick(map, keys, def = null) {
        for (const k of keys) {
            if (map[k] != null) return map[k];
        }
        return def;
    }
}

module.exports = { AutotradersDetailParser };
