const { BaseParser } = require('../../BaseParser');

/**
 * Парсер для сайта Dubicars.com
 * Индивидуальная реализация без использования ConfigParser
 */
class DubicarsParser extends BaseParser {
    constructor(config) {
        super('Dubicars', {
            baseUrl: 'https://www.dubicars.com',
            listingsUrl: 'https://www.dubicars.com/dubai/used',
            ...config
        });
    }

    /**
     * Получение списка объявлений
     */
    async* getListings() {
        let attempt = 0;
        let currentPage = 1;

        while (attempt < this.config.maxRetries) {
            const page = await this.createPage();

            try {
                console.log("🔍 Открываем каталог Dubicars...");

                while (true) {
                    const url = this.config.listingsUrl.replace('{page}', currentPage);
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: this.config.timeout 
                    });

                    // Ждём основной список машин
                    await page.waitForSelector(
                        'section#serp-list li.serp-list-item a.image-container', 
                        { timeout: 30000 }
                    );

                    const carLinks = await page.$$eval(
                        'section#serp-list li.serp-list-item a.image-container', 
                        (elements, baseUrl) =>
                            elements
                                .map((el) => el.getAttribute("href"))
                                .filter((href) => href && href.startsWith(baseUrl)),
                        this.config.baseUrl
                    );

                    if (carLinks.length === 0) {
                        console.log(`🏁 На странице ${currentPage} нет объявлений. Завершаем.`);
                        break;
                    }

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                    for (const link of carLinks) {
                        yield link;
                        await this.delay(); // Задержка между объявлениями
                    }

                    console.log(`➡️ Переход к следующей странице: ${currentPage + 1}`);
                    currentPage++;
                }

                return; // Успешное завершение

            } catch (error) {
                console.error(`❌ Ошибка при парсинге (попытка ${attempt + 1}):`, error);
                attempt++;
                console.log("🔄 Перезапуск страницы...");
            } finally {
                await page.close();
                console.log("🛑 Страница закрыта.");
            }
        }

        console.error("🚨 Все попытки исчерпаны! Парсер остановлен.");
    }

    /**
     * Парсинг детальной информации об объявлении
     */
    async parseListing(url) {
        const page = await this.createPage();

        try {
            console.log(`🚗 Переходим к ${url}`);

            await page.goto(url, { 
                waitUntil: "domcontentloaded", 
                timeout: this.config.timeout 
            });

            console.log("⏳ Ждем загрузку страницы...");
            // Ждем любой из возможных заголовков (mobile или laptop версия)
            await page.waitForSelector("h1.text-dark, .car-title", { timeout: 15000 });

            console.log("📄 Парсим данные...");

            // Парсинг основных данных - пробуем разные селекторы
            const title = await this.safeEval(page, "h1.text-dark", el => el.textContent.trim()) ||
                         await this.safeEval(page, ".car-title", el => el.textContent.trim());

            // Извлекаем год из заголовка, если он там есть
            const yearFromTitle = title ? title.match(/\b(202[0-9]|203[0-9])\b/) : null;

            // Парсинг цены - пробуем разные селекторы
            const priceFormatted = await this.safeEval(
                page, 
                "div.price.fs-24.fw-600.text-dark.currency-price-field", 
                el => el.textContent.trim()
            ) || await this.safeEval(
                page, 
                "div.price.currency-price-field", 
                el => el.textContent.trim()
            ) || await this.safeEval(
                page, 
                ".price", 
                el => el.textContent.trim()
            );

            // Извлекаем валюту и сумму из строки типа "USD 734,200"
            let priceRaw = null;
            let currency = "USD";
            
            if (priceFormatted) {
                const priceMatch = priceFormatted.match(/([A-Z]{3})\s*([\d,]+)/);
                if (priceMatch) {
                    currency = priceMatch[1];
                    priceRaw = parseFloat(priceMatch[2].replace(/,/g, ""));
                }
            }

            // Парсинг характеристик - универсальный подход для mobile и laptop версий
            const specifications = await page.evaluate(() => {
                const specs = {};
                const motorParts = []; // Массив для сбора данных о двигателе

                // Ищем все элементы спецификаций (и mobile, и laptop)
                const specElements = document.querySelectorAll('#item-specifications ul li');

                specElements.forEach(el => {
                    const spans = el.querySelectorAll('span');
                    if (spans.length >= 2) {
                        const key = spans[0].textContent.trim().toLowerCase();
                        const value = spans[spans.length - 1].textContent.trim();

                        // Маппинг ключей
                        if (key.includes('make')) specs.make = value;
                        else if (key.includes('model')) specs.model = value;
                        else if (key.includes('year') || key.includes('model year')) {
                            // Извлекаем год из значения, если это число
                            const yearMatch = value.match(/(\d{4})/);
                            specs.year = yearMatch ? yearMatch[1] : value;
                        }
                        else if (key.includes('Kilometers') || key.includes('mileage')) specs.kilometers = value;
                        else if (key.includes('color') && !key.includes('interior')) specs.exterior_color = value;
                        else if (key.includes('interior color')) specs.interior_color = value;
                        else if (key.includes('transmission')) specs.transmission = value;
                        else if (key.includes('vehicle type')) specs.body_type = value;
                        else if (key.includes('drive type')) specs.drive_type = value;
                        else if (key.includes('seating capacity')) specs.seating_capacity = value;
                        else if (key.includes('number of doors')) specs.doors = value;
                        else if (key.includes('wheel size')) specs.wheel_size = value;
                        
                        // Собираем данные о двигателе
                        else if (key.includes('fuel type')) motorParts.push(`Fuel: ${value}`);
                        else if (key.includes('horsepower') || key.includes('power')) {
                            // Записываем мощность в отдельное поле
                            specs.horsepower = value;
                            motorParts.push(`Power: ${value}`);
                        }
                        else if (key.includes('engine capacity')) motorParts.push(`Engine: ${value}`);
                        else if (key.includes('cylinders')) motorParts.push(`Cylinders: ${value}`);
                    }
                });

                // Объединяем данные о двигателе в одно поле
                if (motorParts.length > 0) {
                    specs.motors_trim = motorParts.join(', ');
                }

                return specs;
            });

            // Всегда пробуем парсить из highlights секции для дополнительных данных
            console.log("🔍 Парсим highlights секцию для дополнительных данных...");
            
            const highlights = await page.evaluate(() => {
                const highlights = {};
                const motorParts = []; // Массив для сбора данных о двигателе
                
                // Парсим mobile версию highlights
                const mobileHighlights = document.querySelectorAll('#highlights .mobile-only li');
                mobileHighlights.forEach(el => {
                    const text = el.textContent.trim();
                    
                    // Парсим километры
                    if (text.includes('Km')) {
                        highlights.kilometers = text.match(/(\d+\s*Km)/)?.[1] || null;
                    }
                    
                    // Парсим год - ищем в ссылках и тексте
                    const yearLink = el.querySelector('a[title]');
                    if (yearLink && yearLink.getAttribute('title').match(/\d{4}/)) {
                        highlights.year = yearLink.getAttribute('title').match(/(\d{4})/)?.[1] || null;
                    } else if (text.match(/\b(202[0-9]|203[0-9])\b/)) {
                        highlights.year = text.match(/\b(202[0-9]|203[0-9])\b/)?.[1] || null;
                    }
                    
                    // Собираем данные о двигателе
                    const fuelLink = el.querySelector('a[title*="Petrol"], a[title*="Diesel"], a[title*="Electric"]');
                    if (fuelLink) {
                        motorParts.push(`Fuel: ${fuelLink.getAttribute('title')}`);
                    } else if (text.includes('Petrol') || text.includes('Diesel') || text.includes('Electric')) {
                        const fuelType = text.match(/(Petrol|Diesel|Electric|Hybrid)/)?.[1];
                        if (fuelType) motorParts.push(`Fuel: ${fuelType}`);
                    }
                    
                    if (text.includes('HP')) {
                        const power = text.match(/(\d+\s*HP)/)?.[1];
                        if (power) {
                            highlights.horsepower = power;
                            motorParts.push(`Power: ${power}`);
                        }
                    }
                    
                    // Также ищем мощность в других форматах
                    if (text.match(/\d+\s*(HP|hp|Horsepower|horsepower)/)) {
                        const powerMatch = text.match(/(\d+\s*(?:HP|hp|Horsepower|horsepower))/i);
                        if (powerMatch) {
                            highlights.horsepower = powerMatch[1];
                            motorParts.push(`Power: ${powerMatch[1]}`);
                        }
                    }
                    
                    if (text.includes('L')) {
                        const engine = text.match(/(\d+\.?\d*\s*L)/)?.[1];
                        if (engine) motorParts.push(`Engine: ${engine}`);
                    }
                });
                
                // Парсим laptop версию highlights
                const laptopHighlights = document.querySelectorAll('#highlights .laptop-only li');
                laptopHighlights.forEach(el => {
                    const text = el.textContent.trim();
                    
                    // Парсим год модели
                    if (text.includes('Model year')) {
                        const yearMatch = text.match(/(\d{4})/);
                        if (yearMatch) {
                            highlights.year = yearMatch[1];
                        }
                    }
                    
                    // Парсим километры
                    if (text.includes('Kilometers')) {
                        const kmMatch = text.match(/(\d+\s*Km)/);
                        if (kmMatch) {
                            highlights.kilometers = kmMatch[1];
                        }
                    }
                    
                    // Собираем данные о двигателе из laptop версии
                    if (text.includes('Engine capacity')) {
                        const engineMatch = text.match(/(\d+\.?\d*\s*L)/);
                        if (engineMatch) {
                            motorParts.push(`Engine: ${engineMatch[1]}`);
                        }
                    }
                    
                    if (text.includes('Fuel Type') || text.includes('Fuel')) {
                        const fuelMatch = text.match(/(Petrol|Diesel|Electric|Hybrid)/);
                        if (fuelMatch) {
                            motorParts.push(`Fuel: ${fuelMatch[1]}`);
                        }
                    }
                    
                    // Ищем мощность в laptop версии
                    if (text.includes('HP') || text.match(/\d+\s*(HP|hp|Horsepower|horsepower)/)) {
                        const powerMatch = text.match(/(\d+\s*(?:HP|hp|Horsepower|horsepower))/i);
                        if (powerMatch) {
                            highlights.horsepower = powerMatch[1];
                            motorParts.push(`Power: ${powerMatch[1]}`);
                        }
                    }
                });
                
                // Объединяем данные о двигателе в одно поле
                if (motorParts.length > 0) {
                    highlights.motors_trim = motorParts.join(', ');
                }
                
                return highlights;
            });
            
            console.log("📊 Найденные данные в highlights:", highlights);
            
            // Объединяем данные из highlights с основными спецификациями
            // Особо обрабатываем motors_trim - объединяем данные о двигателе
            if (specifications.motors_trim && highlights.motors_trim) {
                // Если есть данные о двигателе в обеих секциях, объединяем их
                const existingMotorParts = specifications.motors_trim.split(', ');
                const newMotorParts = highlights.motors_trim.split(', ');
                
                // Создаем Map для избежания дублирования
                const motorMap = new Map();
                
                // Добавляем существующие части
                existingMotorParts.forEach(part => {
                    const [key] = part.split(': ');
                    motorMap.set(key, part);
                });
                
                // Добавляем новые части (перезаписывают существующие)
                newMotorParts.forEach(part => {
                    const [key] = part.split(': ');
                    motorMap.set(key, part);
                });
                
                specifications.motors_trim = Array.from(motorMap.values()).join(', ');
            } else if (highlights.motors_trim) {
                // Если есть только в highlights, используем их
                specifications.motors_trim = highlights.motors_trim;
            }
            
            // Объединяем остальные данные
            Object.assign(specifications, highlights);
            
            // Если в основных спецификациях есть данные о двигателе, но их нет в highlights, добавляем их
            if (specifications.motors_trim && !highlights.motors_trim) {
                // Данные уже есть в specifications.motors_trim
            } else if (!specifications.motors_trim && highlights.motors_trim) {
                // Данные уже есть в highlights.motors_trim
            } else if (!specifications.motors_trim && !highlights.motors_trim) {
                // Пробуем собрать данные о двигателе из основных спецификаций
                const motorParts = [];
                
                // Проверяем, есть ли данные о двигателе в основных спецификациях
                if (specifications.fuel_type) motorParts.push(`Fuel: ${specifications.fuel_type}`);
                if (specifications.horsepower) motorParts.push(`Power: ${specifications.horsepower}`);
                if (specifications.engine_capacity) motorParts.push(`Engine: ${specifications.engine_capacity}`);
                if (specifications.cylinders) motorParts.push(`Cylinders: ${specifications.cylinders}`);
                
                if (motorParts.length > 0) {
                    specifications.motors_trim = motorParts.join(', ');
                }
            }

            // Если год не найден в спецификациях, используем год из заголовка
            if (!specifications.year && yearFromTitle) {
                specifications.year = yearFromTitle[1];
            }

            const {
                make,
                model,
                year,
                kilometers,
                fuel_type,
                horsepower,
                exterior_color,
                interior_color,
                engine_capacity,
                transmission,
                body_type,
                cylinders,
                drive_type,
                seating_capacity,
                doors,
                wheel_size
            } = specifications;

            // Парсинг фотографий из слайдера - более надежный подход
            const photos = await page.evaluate(() => {
                const images = [];
                
                // Ищем все изображения в слайдере
                const sliderImages = document.querySelectorAll('#car-images-slider img');
                
                sliderImages.forEach(img => {
                    if (img.src && !img.src.includes('data:')) {
                        // Преобразуем относительные URL в абсолютные
                        const fullUrl = img.src.startsWith('//') ? 'https:' + img.src : img.src;
                        if (!images.includes(fullUrl)) {
                            images.push(fullUrl);
                        }
                    }
                });
                
                // Если в слайдере нет изображений, пробуем другие селекторы
                if (images.length === 0) {
                    const altImages = document.querySelectorAll('img[alt*="Rolls-Royce"], img[alt*="Cullinan"], .car-image img, .image-container img');
                    altImages.forEach(img => {
                        if (img.src && !img.src.includes('data:')) {
                            const fullUrl = img.src.startsWith('//') ? 'https:' + img.src : img.src;
                            if (!images.includes(fullUrl)) {
                                images.push(fullUrl);
                            }
                        }
                    });
                }
                
                return images;
            });

            // Извлекаем главное изображение (первая фотография)
            const main_image = photos.length > 0 ? photos[0] : null;

            // Парсинг информации о продавце
            const sellerName = await this.safeEval(
                page, 
                "#seller-info .seller-intro strong", 
                el => el.textContent.trim()
            );

            const sellerLogo = await this.safeEval(
                page, 
                "#seller-info .seller-intro img", 
                img => img.src.startsWith('//') ? 'https:' + img.src : img.src
            );

            const sellerProfileLink = await this.safeEval(
                page, 
                "#seller-info .actions li a", 
                a => a.href
            );

            // Парсинг телефона
            const whatsappHref = await this.safeEval(page, 'a.whatsapp-link', a => a.href);
            const phoneMatch = whatsappHref ? whatsappHref.match(/phone=(\d+)/) : null;
            const phone = phoneMatch ? `+${phoneMatch[1]}` : "Не указан";

            // Извлекаем отдельные поля двигателя из motors_trim для сохранения в БД
            let extractedHorsepower = specifications.horsepower || highlights.horsepower || null;
            let extractedFuelType = null;
            
            if (specifications.motors_trim) {
                const motorParts = specifications.motors_trim.split(', ');
                motorParts.forEach(part => {
                    if (part.startsWith('Fuel:')) {
                        extractedFuelType = part.replace('Fuel: ', '');
                    }
                });
            }
            
            // Если мощность не найдена, пробуем извлечь из заголовка
            if (!extractedHorsepower) {
                const titlePowerMatch = title.match(/(\d+(?:\.\d+)?\s*(?:HP|hp|Horsepower|horsepower|BHP|bhp))/i);
                if (titlePowerMatch) {
                    extractedHorsepower = titlePowerMatch[1];
                }
            }
            
            // Если мощность все еще не найдена, пробуем поискать на всей странице
            if (!extractedHorsepower) {
                const pagePower = await page.evaluate(() => {
                    // Ищем мощность в различных элементах страницы
                    const powerSelectors = [
                        '[class*="power"]',
                        '[class*="horsepower"]',
                        '[class*="hp"]',
                        '.spec-value',
                        '.spec-item',
                        '.car-specs li',
                        '.specifications li'
                    ];
                    
                    for (const selector of powerSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const el of elements) {
                            const text = el.textContent.trim();
                            const powerMatch = text.match(/(\d+(?:\.\d+)?\s*(?:HP|hp|Horsepower|horsepower|BHP|bhp))/i);
                            if (powerMatch) {
                                return powerMatch[1];
                            }
                        }
                    }
                    return null;
                });
                
                if (pagePower) {
                    extractedHorsepower = pagePower;
                }
            }

            // Формирование объекта данных
            const rawData = {
                short_url: url,
                title,
                photos,
                main_image: main_image,
                make: specifications.make || null,
                model: specifications.model || null,
                year: specifications.year || null,
                body_type: specifications.body_type || null,
                horsepower: extractedHorsepower || null,
                fuel_type: extractedFuelType || null,
                motors_trim: specifications.motors_trim || null,
                kilometers: specifications.kilometers || null,
                exterior_color: specifications.exterior_color || null,
                interior_color: specifications.interior_color || null,
                transmission: specifications.transmission || null,
                drive_type: specifications.drive_type || null,
                seating_capacity: specifications.seating_capacity || null,
                doors: specifications.doors || null,
                wheel_size: specifications.wheel_size || null,
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
                location: "Dubai",
                contact: {
                    phone,
                },
            };

            console.log(rawData);
            return rawData;

        } catch (error) {
            console.error(`❌ Ошибка при загрузке ${url}:`, error);
            return null;
        } finally {
            await page.close();
            console.log("🛑 Страница закрыта.");
        }
    }

    /**
     * Валидация данных для Dubicars
     */
    validateData(data) {
        return super.validateData(data) && 
               data.title && 
               data.title !== "Неизвестно" &&
               data.price && 
               data.price.raw > 0;
    }
}

module.exports = { DubicarsParser };
