/**
 * Парсинг детальной информации для Dubizzle.com
 */

class DubizzleDetailParser {
    constructor(config) {
        this.config = config;
        
        // Селекторы для детальной страницы Dubizzle
        // Используем более общие селекторы, так как data-testid может отсутствовать
        this.selectors = {
            // Основные данные
            title: 'h1, [class*="title"], [class*="ad-title"]',
            price: '[class*="price"], [class*="amount"]',
            location: '[class*="location"], [class*="address"]',
            
            // Детали автомобиля - ищем в таблице или списке спецификаций
            specsContainer: '[class*="spec"], [class*="details"], [class*="attributes"]',
            
            // Продавец
            sellerInfo: '[class*="seller"], [class*="dealer"]',
            
            // Изображения
            images: 'img[class*="car"], img[class*="photo"]',
            mainImage: 'img[class*="main"], [class*="main-image"] img'
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
            await page.waitForTimeout(3000);
            
            // Попытка получить номер телефона через клик на кнопку
            let phoneNumber = "Не указан";
            try {
                // Метод 1: Ищем кнопку "Call" или "Show Phone"
                let callButton = await page.$('[data-testid="call-cta-button"]');
                
                // Если не нашли, ищем кнопки по тексту
                if (!callButton) {
                    const buttons = await page.$$('button');
                    for (const button of buttons) {
                        const text = await button.textContent();
                        if (text && (text.includes('Call') || text.includes('Show') || text.includes('Phone'))) {
                            callButton = button;
                            break;
                        }
                    }
                }
                
                if (callButton) {
                    console.log("🔍 Найдена кнопка Call, кликаем...");
                    await callButton.click();
                    await page.waitForTimeout(1000);
                    
                    // Ищем номер в модальном окне или на странице
                    const phoneText = await page.evaluate(() => {
                        // Ищем в различных местах
                        let phone = null;
                        
                        // Ищем по data-testid
                        const phoneEl = document.querySelector('[data-testid="phone-number"]');
                        if (phoneEl) {
                            const pTag = phoneEl.querySelector('p');
                            if (pTag) {
                                phone = pTag.textContent?.trim();
                            } else {
                                phone = phoneEl.textContent?.trim();
                            }
                        }
                        
                        // Ищем по классу
                        if (!phone) {
                            const phoneByClass = document.querySelector('.phone-number, [class*="phone"], [class*="Phone"]');
                            if (phoneByClass) {
                                phone = phoneByClass.textContent?.trim();
                            }
                        }
                        
                        // Ищем в aria-label
                        if (!phone) {
                            const phoneByAria = document.querySelector('[aria-label*="phone" i], [aria-label*="Phone" i]');
                            if (phoneByAria) {
                                phone = phoneByAria.textContent?.trim();
                            }
                        }
                        
                        // Ищем любой текст с цифрами в формате телефона
                        if (!phone) {
                            const allText = document.body.textContent;
                            const phoneRegex = /(\+971|971|0)?\s*\d{3}\s*\d{3}\s*\d{4}/g;
                            const matches = allText.match(phoneRegex);
                            if (matches && matches.length > 0) {
                                phone = matches[0].replace(/\s+/g, '');
                            }
                        }
                        
                        return phone;
                    });
                    
                    if (phoneText && phoneText !== '') {
                        // Очищаем номер от лишних пробелов и символов
                        const cleanPhone = phoneText.replace(/[^\d+]/g, '').trim();
                        if (cleanPhone) {
                            phoneNumber = cleanPhone;
                            console.log("✅ Номер телефона найден:", phoneNumber);
                        }
                    }
                    
                    // Закрываем модалку если нужно
                    try {
                        const closeButton = await page.$('[data-testid="close-button"], button[aria-label="Close"], .close-button, [class*="close"]');
                        if (closeButton) {
                            await closeButton.click();
                            await page.waitForTimeout(300);
                        }
                    } catch (e) {
                        // Игнорируем ошибку закрытия
                    }
                }
                
                // Метод 2: Если первый метод не сработал, ищем напрямую на странице
                if (phoneNumber === "Не указан") {
                    console.log("🔍 Пробуем найти номер телефона напрямую на странице...");
                    const directPhone = await page.evaluate(() => {
                        // Ищем ссылки с tel:
                        const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
                        if (telLinks.length > 0) {
                            const href = telLinks[0].getAttribute('href');
                            return href.replace('tel:', '').replace(/[^\d+]/g, '');
                        }
                        
                        // Ищем в кнопках или тексте
                        const phoneRegex = /(\+971|971|0)?\s*(\d{3})\s*(\d{3})\s*(\d{4})/;
                        const bodyText = document.body.textContent;
                        const match = bodyText.match(phoneRegex);
                        if (match) {
                            return match[0].replace(/\s+/g, '');
                        }
                        
                        return null;
                    });
                    
                    if (directPhone) {
                        phoneNumber = directPhone;
                        console.log("✅ Номер телефона найден (метод 2):", phoneNumber);
                    }
                }
                
                // Метод 3: Ищем в информации о продавце
                if (phoneNumber === "Не указан") {
                    console.log("🔍 Проверяем секцию продавца...");
                    try {
                        const sellerSection = await page.$('[data-testid="seller-info"], [class*="seller"]');
                        if (sellerSection) {
                            const sellerPhone = await sellerSection.evaluate((el) => {
                                const phoneRegex = /(\+971|971|0)?\s*(\d{3})\s*(\d{3})\s*(\d{4})/;
                                const match = el.textContent.match(phoneRegex);
                                return match ? match[0].replace(/\s+/g, '') : null;
                            });
                            
                            if (sellerPhone) {
                                phoneNumber = sellerPhone;
                                console.log("✅ Номер телефона найден в секции продавца:", phoneNumber);
                            }
                        }
                    } catch (e) {
                        // Игнорируем ошибку
                    }
                }
                
            } catch (error) {
                console.log("⚠️ Не удалось извлечь номер телефона:", error.message);
            }

            // Извлекаем данные используя правильные селекторы
            const pageData = await page.evaluate(() => {
                const data = {};
                
                // Извлекаем title - используем listing-name
                const titleEl = document.querySelector('[data-testid="listing-name"]');
                data.title = titleEl?.textContent?.trim() || '';
                
                // Извлекаем цену - используем listing-price
                const priceEl = document.querySelector('[data-testid="listing-price"]');
                data.price = priceEl?.textContent?.trim() || '';
                
                // Извлекаем модель из listing-sub-heading
                const modelEl = document.querySelector('[data-testid="listing-sub-heading"]');
                data.model = modelEl?.textContent?.trim() || '';
                
                // Извлекаем локацию
                const locationEl = document.querySelector('[data-testid="listing-location-map"]');
                data.location = locationEl?.textContent?.trim() || '';
                
                // Извлекаем год
                const yearEl = document.querySelector('[data-testid="listing-year-value"]');
                data.year = yearEl?.textContent?.trim() || '';
                
                // Извлекаем пробег
                const kmEl = document.querySelector('[data-testid="listing-kilometers-value"]');
                data.kilometers = kmEl?.textContent?.trim() || '';
                
                // Извлекаем все спецификации из overview
                data.specs = {};
                const overviewLabels = document.querySelectorAll('[data-testid^="overview-"][data-testid$="-label"]');
                overviewLabels.forEach(label => {
                    const testid = label.getAttribute('data-testid');
                    const fieldName = testid.replace('overview-', '').replace('-label', '');
                    const valueEl = document.querySelector(`[data-testid="overview-${fieldName}-value"]`);
                    if (valueEl) {
                        data.specs[fieldName] = valueEl.textContent?.trim() || '';
                    }
                });
                
                // Попробуем извлечь из URL
                const urlMatch = window.location.href.match(/\/motors\/used-cars\/([^\/]+)\/([^\/]+)/);
                if (urlMatch) {
                    data.urlMake = urlMatch[1];
                    data.urlModel = urlMatch[2];
                }
                
                // Год из URL тоже
                const urlYearMatch = window.location.href.match(/\/\d{4}\//);
                if (urlYearMatch) {
                    data.urlYear = urlYearMatch[0].replace(/\//g, '');
                }
                
                // Фотографии
                const images = Array.from(document.querySelectorAll('img[data-testid*="image"]'));
                data.photos = images
                    .map(img => img.src || img.getAttribute('src'))
                    .filter(src => src && (src.includes('dubizzle.com') || src.includes('cloudfront.net') || src.includes('dbz-images')))
                    .slice(0, 20);
                
                // Информация о продавце
                const sellerNameEl = document.querySelector('[data-testid="name"]');
                data.sellerName = sellerNameEl?.textContent?.trim() || '';
                
                const sellerTypeEl = document.querySelector('[data-testid="type"]');
                data.sellerType = sellerTypeEl?.textContent?.trim() || '';
                
                const sellerLogoEl = document.querySelector('[data-testid="logo"] img');
                data.sellerLogo = sellerLogoEl?.src || sellerLogoEl?.getAttribute('src') || null;
                
                // Ищем ссылку на профиль - используем правильный data-testid
                const sellerProfileLinkEl = document.querySelector('[data-testid="view-all-cars"]');
                if (sellerProfileLinkEl) {
                    const relativePath = sellerProfileLinkEl.getAttribute('href');
                    data.sellerProfileLink = relativePath ? new URL(relativePath, window.location.origin).href : null;
                } else {
                    data.sellerProfileLink = null;
                }
                
                return data;
            });
            
            // Парсим полученные данные
            const title = pageData.title || "Не указано";
            
            // Извлекаем цену из текста
            const priceText = pageData.price || "";
            const priceFormatted = priceText.replace(/[^\d,]/g, "").trim();
            const priceRaw = priceFormatted ?
                parseFloat(priceFormatted.replace(/,/g, "").replace(/\s+/g, "")) :
                0;
            
            // Извлекаем данные из URL
            const make = pageData.urlMake || "Не указано";
            const modelFromUrl = pageData.urlModel || "";
            const model = pageData.model || modelFromUrl || "Не указано";
            
            // Извлекаем год
            const year = pageData.year || pageData.urlYear || "Неизвестно";
            
            // Пробег не форматируем - оставляем как есть на странице
            const kilometers = pageData.kilometers || "0";
            
            const location = pageData.location || "Не указано";
            
            // Извлекаем спецификации
            const bodyType = pageData.specs['body_type'] || pageData.specs['body type'] || "Не указано";
            const fuelType = pageData.specs['fuel_type'] || pageData.specs['fuel type'] || "Не указано";
            const transmission = pageData.specs['transmission_type'] || pageData.specs['transmission type'] || pageData.specs['transmission'] || "Не указано";
            const motorsTrim = pageData.specs['motors_trim'] || "Не указано";
            const exteriorColor = pageData.specs['exterior_color'] || pageData.specs['exterior color'] || pageData.specs['color'] || "Не указано";
            const horsepower = pageData.specs['horsepower'] || "Не указано";
            
            // Данные о продавце
            const sellerName = pageData.sellerName || "Не указано";
            const sellerType = pageData.sellerType || "Частное лицо";
            const sellerLogo = pageData.sellerLogo || null;
            const sellerProfileLink = pageData.sellerProfileLink || null;
            // phoneNumber извлекается через клик на кнопку выше

            // Получаем фотографии из pageData
            const photos = pageData.photos || [];
            const mainImage = photos.length > 0 ? photos[0] : null;

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
                horsepower,
                fuel_type: fuelType,
                motors_trim: motorsTrim,
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

    /**
     * Извлечение спецификации из pageData
     */
    extractSpec(pageData, keywords) {
        if (!pageData.specs) return null;
        
        for (const keyword of keywords) {
            for (const [key, value] of Object.entries(pageData.specs)) {
                if (key.includes(keyword) && value) {
                    return value;
                }
            }
        }
        return null;
    }

    /**
     * Извлечение make/model/year
     */
    extractMakeModelYear(pageData, type) {
        if (!pageData.specs) return null;
        
        const keywords = {
            make: ['make', 'марка', 'brand'],
            model: ['model', 'модель'],
            year: ['year', 'год', 'года']
        };
        
        return this.extractSpec(pageData, keywords[type] || []);
    }
}

module.exports = { DubizzleDetailParser };
