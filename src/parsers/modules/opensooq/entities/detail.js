/**
 * Парсинг детальной информации для OpenSooq.com
 */

class OpenSooqDetailParser {
    constructor(config) {
        this.config = config;
        
        // Селекторы для детальной страницы OpenSooq
        this.selectors = {
            // Основные данные
            title: 'h1[data-id="postViewTitle"]',
            price: '[data-id="post_price"]',
            location: 'a[data-id="location"]',
            
            // Детали автомобиля
            make: 'li[data-id*="singeInfoField_0"] a, li[data-id*="singeInfoField"]:has(p:contains("Make")) a',
            model: 'li[data-id*="singeInfoField_2"] a, li[data-id*="singeInfoField"]:has(p:contains("Model")) a',
            year: 'li[data-id*="singeInfoField_3"] a, li[data-id*="singeInfoField"]:has(p:contains("Year")) a',
            bodyType: 'li[data-id*="singeInfoField"]:has(p:contains("Body")) a',
            fuelType: 'li[data-id*="singeInfoField"]:has(p:contains("Fuel")) a',
            transmission: 'li[data-id*="singeInfoField"]:has(p:contains("Transmission")) a, li[data-id*="singeInfoField"]:has(p:contains("Gear")) a',
            mileage: 'li[data-id*="singeInfoField"]:has(p:contains("Mileage")) a, li[data-id*="singeInfoField"]:has(p:contains("KM")) a',
            color: 'li[data-id*="singeInfoField"]:has(p:contains("Color")) a',
            
            // Продавец
            sellerSection: '#PostViewOwnerCard',
            sellerName: 'h3[data-id="member_name"]',
            sellerType: '#PostViewOwnerCard h3', // Title "Listing Owner"
            phone: 'button[data-id="call_btn"] span,',
            
            // Изображения
            images: 'button.image-gallery-thumbnail img.image-gallery-thumbnail-image',
            mainImage: 'button.image-gallery-thumbnail img.image-gallery-thumbnail-image'
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

            // Извлекаем детали автомобиля из li элементов с data-id
            const carDetailsData = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('li[data-id*="singeInfoField"]'));
                const result = {};
                
                items.forEach(item => {
                    const label = item.querySelector('p.noWrap')?.textContent?.trim();
                    // Пробуем сначала a, потом span
                    let value = item.querySelector('a')?.textContent?.trim();
                    if (!value) {
                        value = item.querySelector('span')?.textContent?.trim();
                    }
                    
                    if (label && value) {
                        // Сохраняем все поля как есть
                        result[label] = value;
                        
                        // Дополнительно сохраняем специальные поля для совместимости
                        if (label === 'Car Make') result.make = value;
                        if (label === 'Model') result.model = value;
                        if (label === 'Year') result.year = value;
                        if (label === 'Trim') result.trim = value;
                        if (label === 'Kilometers') result.mileage = value;
                        if (label === 'Body Type') result.bodyType = value;
                        if (label === 'Fuel') result.fuelType = value;
                        if (label === 'Transmission') result.transmission = value;
                        if (label === 'Exterior Color') result.exteriorColor = value;
                        if (label === 'Interior Color') result.interiorColor = value;
                        if (label === 'Engine Size (cc)') result.engineSize = value;
                        if (label === 'Number of Seats') result.seats = value;
                    }
                });
                
                return result;
            });
            
            const make = carDetailsData['Car Make'] || carDetailsData.make || "Не указано";
            const model = carDetailsData['Model'] || carDetailsData.model || "Не указано";
            const trim = carDetailsData['Trim'] || carDetailsData.trim || "Не указано";
            const yearText = carDetailsData['Year'] || carDetailsData.year || "";
            const year = yearText ? yearText.replace(/\D/g, "") : null;
            
            // Извлекаем пробег из диапазона "60,000 - 69,999"
            let kilometersText = carDetailsData['Kilometers'] || carDetailsData.mileage || "";
            let kilometers = "0";
            if (kilometersText) {
                // Берем первое число из диапазона или единственное число
                const match = kilometersText.match(/(\d+)/);
                if (match) {
                    kilometers = match[1].replace(/,/g, "");
                }
            }
            
            const bodyType = carDetailsData['Body Type'] || carDetailsData.bodyType || "Не указано";
            const fuelType = carDetailsData['Fuel'] || carDetailsData.fuelType || "Не указано";
            const transmission = carDetailsData['Transmission'] || carDetailsData.transmission || "Не указано";
            const exteriorColor = carDetailsData['Exterior Color'] || carDetailsData.exteriorColor || "Не указано";

            // Данные о продавце
            const sellerData = await page.evaluate(() => {
                const section = document.querySelector('#PostViewOwnerCard');
                if (!section) return null;
                
                const name = section.querySelector('h3[data-id="member_name"]')?.textContent?.trim();
                const title = section.querySelector('h3.font-22')?.textContent?.trim(); // "Listing Owner"
                const logo = section.querySelector('img')?.src;
                const profileLink = section.querySelector('a[href*="/shops/"], a[href*="/member/"]')?.href;
                
                // Определяем тип продавца по наличию ссылки на магазин
                let sellerType = "Частное лицо";
                if (profileLink && profileLink.includes('/shops/')) {
                    sellerType = "Профессиональный продавец";
                }
                
                return { name, sellerType, logo, profileLink };
            });
            
            const sellerName = sellerData?.name || "Не указано";
            const sellerType = sellerData?.sellerType || "Частное лицо";
            
            // Извлекаем номер телефона из кнопки звонка
            // Ждем появления кнопки, так как она может загружаться позже
            let phoneNumber = "Не указан";
            
            try {
                // Пробуем найти кнопку с несколькими попытками
                for (let i = 0; i < 3; i++) {
                    const phoneData = await page.evaluate(() => {
                        // Ищем все возможные варианты
                        const callButton = document.querySelector('button[data-id="call_btn"]') || 
                                          document.querySelector('button[data-id="sticky_call_btn"]');
                        
                        if (callButton) {
                            // Ищем span с классом ltr или inline внутри кнопки
                            const phoneSpan = callButton.querySelector('span.ltr, span.inline');
                            if (phoneSpan) {
                                return phoneSpan.textContent?.trim();
                            }
                            // Если span не найден, берем весь текст кнопки и убираем SVG
                            const fullText = callButton.textContent?.trim();
                            // Убираем лишние символы, оставляем только цифры и пробелы
                            return fullText ? fullText.replace(/\D+/g, ' ') : null;
                        }
                        
                        // Альтернативный поиск по всем кнопкам со span.ltr
                        const phoneElements = document.querySelectorAll('button span.ltr, button span.inline');
                        for (let elem of phoneElements) {
                            const text = elem.textContent?.trim();
                            // Проверяем, что это похоже на номер телефона (содержит цифры)
                            if (text && /\d/.test(text)) {
                                return text;
                            }
                        }
                        
                        return null;
                    });
                    
                    if (phoneData) {
                        phoneNumber = phoneData;
                        break;
                    }
                    
                    // Ждем перед следующей попыткой
                    await page.waitForTimeout(1000);
                }
            } catch (error) {
                console.log("⚠️ Не удалось извлечь номер телефона:", error.message);
            }

            // Получаем фотографии
            const photos = await page.evaluate((selector) => {
                const images = Array.from(document.querySelectorAll(selector));
                return images
                    .map(img => img.getAttribute("src") || img.src)
                    .filter(src => src && src.trim().length > 0)
                    .filter((value, index, self) => self.indexOf(value) === index); // Убираем дубликаты
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
                trim,
                year,
                body_type: bodyType,
                horsepower: carDetailsData['Engine Size (cc)'] || "Не указано",
                fuel_type: fuelType,
                motors_trim: transmission,
                kilometers,
                engine_size: carDetailsData['Engine Size (cc)'] || "Не указано",
                seats: carDetailsData['Number of Seats'] || "Не указано",
                interior_color: carDetailsData['Interior Color'] || "Не указано",
                sellers: {
                    sellerName,
                    sellerType,
                    sellerLogo: sellerData?.logo || null,
                    sellerProfileLink: sellerData?.profileLink || null,
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

module.exports = { OpenSooqDetailParser };
