/**
 * Парсинг детальной информации для Autotraders.com
 */

class AutotradersDetailParser {
    constructor(config) {
        this.config = config;
        
        // Селекторы для детальной страницы Autotraders.ae
        this.selectors = {
            // Основные данные
            title: 'h1, h2.title, .car-title',
            price: '.price h3, .car-price',
            location: '.cincitymn, .location',
            
            // Детали автомобиля
            make: '.cinml a',
            model: '.cinml li:nth-child(3) a',
            year: '.yrkms .fa-calendar-alt',
            bodyType: '.car-specs .spec-body',
            fuelType: '.car-specs .spec-fuel',
            transmission: '.car-specs .spec-transmission',
            mileage: '.yrkms .fa-tachometer-alt',
            color: '.car-specs .spec-color',
            
            // Продавец
            sellerName: '.user-name h4 a, .seller-name',
            sellerType: '.user-name, .seller-type',
            sellerLogo: '.image-user img, .seller-logo img',
            phone: '.phone-number, .contact-phone',
            
            // Изображения
            images: '.car-gallery img, .gallery img',
            mainImage: '.car-main-image img, .image img.img-fluid'
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

            // Извлекаем основные поля из страницы
            const title = await this.extractTitle(page);
            const priceData = await this.extractPrice(page);
            const location = await this.extractLocation(page);

            // Извлекаем детали автомобиля
            const make = await this.extractMake(page);
            const model = await this.extractModel(page);
            const year = await this.extractYear(page);
            
            const bodyType = await this.extractBodyType(page);
            const fuelType = await this.extractFuelType(page);
            const transmission = await this.extractTransmission(page);
            
            const kilometers = await this.extractKilometers(page);
            
            const exteriorColor = await this.extractColor(page);

            // Данные о продавце
            const sellerName = await this.extractSellerName(page);
            const sellerType = await this.extractSellerType(page);
            const sellerLogo = await this.extractSellerLogo(page);
            const phoneNumber = await this.extractPhone(page);

            // Получаем фотографии
            const photos = await this.extractPhotos(page);
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
                horsepower: "Не указано",
                fuel_type: fuelType,
                motors_trim: transmission,
                kilometers,
                sellers: {
                    sellerName,
                    sellerType,
                    sellerLogo,
                    sellerProfileLink: null,
                },
                price: {
                    formatted: priceData.formatted,
                    raw: priceData.raw,
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
     * Извлечение заголовка
     */
    async extractTitle(page) {
        const title = await page.evaluate(() => {
            const h2 = document.querySelector('.title h2');
            return h2 ? h2.textContent.trim() : null;
        });
        return title || "Не указано";
    }

    /**
     * Извлечение цены
     */
    async extractPrice(page) {
        const priceData = await page.evaluate(() => {
            const priceEl = document.querySelector('.price');
            if (!priceEl) return null;
            
            const text = priceEl.textContent.trim();
            // Извлекаем число (формат: "AED 1,295,000")
            const match = text.match(/([\d,]+)/);
            if (match) {
                const numeric = match[1].replace(/,/g, '');
                return {
                    raw: parseInt(numeric, 10),
                    formatted: text
                };
            }
            return { raw: 0, formatted: text };
        });
        return priceData || { raw: 0, formatted: "Не указано" };
    }

    /**
     * Извлечение марки
     */
    async extractMake(page) {
        return await page.evaluate(() => {
            // Сначала пробуем из car-det-list
            const makeEl = document.querySelector('.car-det-list .detail-col .txt');
            if (makeEl) return makeEl.textContent.trim();
            
            // Если нет, пробуем из .cinml
            const makeEl2 = document.querySelector('.cinml li:first-child a');
            return makeEl2 ? makeEl2.textContent.trim() : null;
        }) || "Не указано";
    }

    /**
     * Извлечение модели
     */
    async extractModel(page) {
        return await page.evaluate(() => {
            // Ищем "Model" в car-det-list
            const details = Array.from(document.querySelectorAll('.car-det-list li'));
            for (const detail of details) {
                const cols = detail.querySelectorAll('.detail-col');
                for (const col of cols) {
                    const label = col.querySelector('span:first-child').textContent.trim();
                    const value = col.querySelector('.txt');
                    if (label === 'Model' && value) {
                        return value.textContent.trim();
                    }
                }
            }
            
            // Fallback на .cinml
            const modelEl = document.querySelector('.cinml li:last-child a');
            return modelEl ? modelEl.textContent.trim() : null;
        }) || "Не указано";
    }

    /**
     * Извлечение года
     */
    async extractYear(page) {
        return await page.evaluate(() => {
            // Ищем "Year" в car-det-list
            const details = Array.from(document.querySelectorAll('.car-det-list li'));
            for (const detail of details) {
                const cols = detail.querySelectorAll('.detail-col');
                for (const col of cols) {
                    const label = col.querySelector('span:first-child').textContent.trim();
                    const value = col.querySelector('.txt');
                    if (label === 'Year' && value) {
                        return value.textContent.trim();
                    }
                }
            }
            
            // Fallback на .yrkms
            const yearEl = document.querySelector('.yrkms li:first-child');
            if (yearEl) {
                const text = yearEl.textContent.trim();
                return text.replace(/\D/g, '');
            }
            return null;
        }) || "Не указано";
    }

    /**
     * Извлечение пробега
     */
    async extractKilometers(page) {
        return await page.evaluate(() => {
            // Ищем "Mileage" в car-det-list
            const details = Array.from(document.querySelectorAll('.car-det-list li'));
            for (const detail of details) {
                const cols = detail.querySelectorAll('.detail-col');
                for (const col of cols) {
                    const label = col.querySelector('span:first-child').textContent.trim();
                    const value = col.querySelector('.txt');
                    if (label === 'Mileage' && value) {
                        // Возвращаем исходное значение без парсинга
                        return value.textContent.trim();
                    }
                }
            }
            
            // Fallback на .yrkms
            const kmEl = document.querySelector('.yrkms li:last-child');
            if (kmEl) {
                // Возвращаем исходное значение без парсинга
                return kmEl.textContent.trim();
            }
            return '0';
        }) || '0';
    }

    /**
     * Извлечение местоположения
     */
    async extractLocation(page) {
        return await page.evaluate(() => {
            // Ищем location в user-details
            const locationEl = document.querySelector('.user-details .location .dcname');
            if (locationEl) {
                return locationEl.textContent.trim();
            }
            
            // Fallback на .cincitymn
            const locationEl2 = document.querySelector('.cincitymn a');
            return locationEl2 ? locationEl2.textContent.trim() : null;
        }) || "Не указано";
    }

    /**
     * Извлечение имени продавца
     */
    async extractSellerName(page) {
        return await page.evaluate(() => {
            const sellerEl = document.querySelector('.user-details .name .dpname');
            if (sellerEl) {
                return sellerEl.textContent.trim();
            }
            
            // Fallback на user-name
            const sellerEl2 = document.querySelector('.user-name h4 a');
            return sellerEl2 ? sellerEl2.textContent.trim() : null;
        }) || "Не указано";
    }

    /**
     * Извлечение типа продавца
     */
    async extractSellerType(page) {
        return await page.evaluate(() => {
            // Проверяем, есть ли логотип в user-details - значит дилер
            const hasLogo = document.querySelector('.user-details .logo img') || document.querySelector('.image-user img');
            if (hasLogo) {
                return 'Dealer';
            }
            
            // Проверяем название - если есть "Private" значит частное лицо
            const name = document.querySelector('.user-details .name .dpname');
            if (name && name.textContent.toLowerCase().includes('private')) {
                return 'Private';
            }
            
            return hasLogo ? 'Dealer' : 'Private';
        }) || "Частное лицо";
    }

    /**
     * Извлечение логотипа продавца
     */
    async extractSellerLogo(page) {
        return await page.evaluate(() => {
            const logoEl = document.querySelector('.user-details .logo img');
            if (logoEl && logoEl.src) {
                return logoEl.src;
            }
            
            // Fallback на .image-user img
            const logoEl2 = document.querySelector('.image-user img');
            if (logoEl2 && logoEl2.src) {
                return logoEl2.src;
            }
            return null;
        }) || null;
    }

    /**
     * Извлечение телефона
     */
    async extractPhone(page) {
        return await page.evaluate(() => {
            // Некоторые объявления показывают телефон в WhatsApp сообщении
            const descEl = document.querySelector('.car-desc p');
            if (descEl) {
                const text = descEl.textContent;
                const phoneMatch = text.match(/\+?\d{1,3}[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}/);
                if (phoneMatch) {
                    return phoneMatch[0];
                }
            }
            
            // Пытаемся найти в href ссылки
            const callEl = document.querySelector('.show_number');
            if (callEl && callEl.href) {
                return callEl.href.replace('tel:', '');
            }
            
            return null;
        }) || "Не указан";
    }

    /**
     * Извлечение фото
     */
    async extractPhotos(page) {
        return await page.evaluate(() => {
            // Извлекаем ссылки на изображения из lightgallery
            const galleryImages = Array.from(document.querySelectorAll('.image-gallery.lightgallery a.lightgallery.item'));
            const photos = galleryImages.map(link => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('http')) {
                    return href;
                }
                // Попробуем взять из img внутри
                const img = link.querySelector('img');
                if (img) {
                    const src = img.getAttribute('data-src') || img.src;
                    return src && src.startsWith('http') ? src : null;
                }
                return null;
            }).filter(Boolean);
            
            // Если не нашли в gallery, пробуем взять из thumbnail
            if (photos.length === 0) {
                const thumbImages = Array.from(document.querySelectorAll('.thumbnail img'));
                const thumbPhotos = thumbImages.map(img => {
                    const src = img.getAttribute('src');
                    return src && src.startsWith('http') ? src : null;
                }).filter(Boolean);
                return Array.from(new Set(thumbPhotos));
            }
            
            return Array.from(new Set(photos));
        }) || [];
    }

    /**
     * Вспомогательные методы для типов
     */
    async extractBodyType(page) {
        return await page.evaluate(() => {
            const details = Array.from(document.querySelectorAll('.car-det-list li'));
            for (const detail of details) {
                const cols = detail.querySelectorAll('.detail-col');
                for (const col of cols) {
                    const label = col.querySelector('span:first-child').textContent.trim();
                    if (label === 'Body Type') {
                        const spans = col.querySelectorAll('span');
                        return spans.length > 1 ? spans[1].textContent.trim() : null;
                    }
                }
            }
            return null;
        }) || "Не указано";
    }

    async extractFuelType(page) {
        return await page.evaluate(() => {
            const details = Array.from(document.querySelectorAll('.car-det-list li'));
            for (const detail of details) {
                const cols = detail.querySelectorAll('.detail-col');
                for (const col of cols) {
                    const label = col.querySelector('span:first-child').textContent.trim();
                    if (label === 'Fuel Type') {
                        const spans = col.querySelectorAll('span');
                        return spans.length > 1 ? spans[1].textContent.trim() : null;
                    }
                }
            }
            return null;
        }) || "Не указано";
    }

    async extractTransmission(page) {
        // Autotraders не показывает transmission на детальной странице
        return "Не указано";
    }

    async extractColor(page) {
        return await page.evaluate(() => {
            const details = Array.from(document.querySelectorAll('.car-det-list li'));
            for (const detail of details) {
                const cols = detail.querySelectorAll('.detail-col');
                for (const col of cols) {
                    const label = col.querySelector('span:first-child').textContent.trim();
                    if (label === 'Exterior Color') {
                        const spans = col.querySelectorAll('span');
                        return spans.length > 1 ? spans[1].textContent.trim() : null;
                    }
                }
            }
            return null;
        }) || "Не указано";
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
