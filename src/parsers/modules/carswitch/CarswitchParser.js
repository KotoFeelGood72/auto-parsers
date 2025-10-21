const { BaseParser } = require('../../BaseParser');
const { saveData } = require('../../../utils/saveData');

/**
 * Парсер для сайта Carswitch.com
 * Основан на коде из ветки carswitch
 */
class CarswitchParser extends BaseParser {
    constructor(config) {
        super('Carswitch', {
            baseUrl: 'https://carswitch.com',
            listingsUrl: 'https://carswitch.com/uae/used-cars/search',
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
                console.log("🔍 Открываем каталог Carswitch...");

                while (true) {
                    const url = `${this.config.listingsUrl}?page=${currentPage}`;
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: 60000 
                    });

                    // Ждем загрузки страницы
                    await page.waitForTimeout(3000);

                    // Скроллим страницу для подгрузки всех карточек
                    await this.autoScroll(page);
                    await page.waitForTimeout(2000);

                    // Пробуем разные селекторы для поиска карточек
                    let carLinks = [];
                    const possibleSelectors = [
                        ".car-cards-container a.block.touch-manipulation",
                        ".car-cards-container a[href*='/used-car/']",
                        ".car-cards-container a[href*='/dubai/used-car/']",
                        "a[href*='/used-car/']",
                        "a[href*='/dubai/used-car/']",
                        "#main-listing-div .pro-item a.image-wrapper",
                        "#main-listing-div .pro-item a",
                        ".pro-item a.image-wrapper",
                        ".pro-item a",
                        "a[href*='/car/']",
                        "a[href*='/used-cars/']"
                    ];

                    for (const selector of possibleSelectors) {
                        try {
                            await page.waitForSelector(selector, { timeout: 10000 });
                            carLinks = await page.$$eval(
                                selector,
                                (anchors) => anchors.map((a) => a.href).filter(Boolean)
                            );
                            
                            if (carLinks.length > 0) {
                                console.log(`✅ Найдено ${carLinks.length} объявлений`);
                                break;
                            }
                        } catch (error) {
                            continue;
                        }
                    }

                    if (carLinks.length === 0) {
                        console.warn(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        break;
                    }

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                    for (const link of carLinks) {
                        yield link;
                    }
                    currentPage++;
                }

                break; // Успешно завершили парсинг
            } catch (error) {
                console.error(`❌ Ошибка при парсинге страницы ${currentPage}:`, error);
                attempt++;
                
                if (attempt >= this.config.maxRetries) {
                    throw error;
                }
                
                console.log(`🔄 Повторная попытка ${attempt}/${this.config.maxRetries}...`);
                await this.sleep(this.config.retryDelay);
            } finally {
                await page.close();
            }
        }
    }

    /**
     * Парсинг детальной информации об объявлении
     */
    async parseListing(url) {
        return await this.parseCarDetails(url);
    }

    /**
     * Запуск полного цикла парсинга
     */
    async run() {
        const results = [];
        
        try {
            console.log(`🚀 Запуск парсера ${this.name}...`);
            
            for await (const listingUrl of this.getListings()) {
                console.log(`🚗 Обрабатываем ${listingUrl}`);
                
                const data = await this.parseListing(listingUrl);
                if (data && this.validateData(data)) {
                    const normalizedData = this.normalizeData(data);
                    results.push(normalizedData);
                    
                    // Сохраняем данные в базу
                    await this.saveData(normalizedData);
                    
                    console.log(`✅ Обработано объявление: ${data.title}`);
                } else {
                    console.log(`⚠️ Пропущено объявление (невалидные данные): ${listingUrl}`);
                }
                
                // Пауза между запросами
                await this.sleep(this.config.delayBetweenRequests);
            }
            
            console.log(`✅ Парсер ${this.name} завершен. Обработано: ${results.length} объявлений`);
            return results;
            
        } catch (error) {
            console.error(`❌ Ошибка в парсере ${this.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Парсинг детальной страницы автомобиля
     */
    async parseCarDetails(url) {
        const page = await this.createPage();

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

            // Кликаем на кнопку для открытия модального окна с детальными параметрами
            try {
                // Пробуем разные селекторы для поиска кнопки
                const possibleSelectors = [
                    '.font-bold.rtl\\:-ml-12.text-primary-500.cursor-pointer',
                    '.font-bold.text-primary-500.cursor-pointer',
                    '.text-primary-500.cursor-pointer',
                    '.font-bold.cursor-pointer',
                    'button[class*="cursor-pointer"]',
                    'div[class*="cursor-pointer"]',
                    'span[class*="cursor-pointer"]',
                    '[class*="text-primary-500"]',
                    'button',
                    'div[role="button"]'
                ];
                
                let detailsButton = null;
                for (const selector of possibleSelectors) {
                    detailsButton = await page.$(selector);
                    if (detailsButton) {
                        console.log("🔍 Кнопка найдена с селектором:", selector);
                        break;
                    }
                }
                
                if (detailsButton) {
                    console.log("🔍 Открываем модальное окно с детальными параметрами...");
                    await detailsButton.click();
                    await page.waitForTimeout(3000); // Увеличиваем время ожидания
                    
                    // Проверяем, открылось ли модальное окно
                    const modal = await page.$('.flex-1.px-8.py-28.sm\\:px-24.sm\\:py-24.overflow-y-auto.flex.\\!py-4.w-full.h-full');
                    console.log("🔍 Модальное окно открыто:", !!modal);
                } else {
                    console.log("⚠️ Кнопка для открытия модального окна не найдена ни с одним селектором");
                    
                    // Попробуем найти все элементы с cursor-pointer
                    const allClickableElements = await page.$$eval('[class*="cursor-pointer"]', elements => 
                        elements.map(el => ({
                            tagName: el.tagName,
                            className: el.className,
                            textContent: el.textContent?.trim().substring(0, 50)
                        }))
                    );
                    console.log("🔍 Все кликабельные элементы:", allClickableElements);
                }
            } catch (error) {
                console.log("⚠️ Не удалось открыть модальное окно:", error.message);
            }

            // Получаем сырой набор фич из Car Overview (новая структура)
            const overviewFeatures = await page.$$eval(
                ".md\\:flex.md\\:flex-row.flex-col.md\\:items-start.items-stretch.md\\:gap-1.gap-4.w-full .md\\:flex-1.bg-white.p-4",
                items => {
                    const map = {};
                    items.forEach(item => {
                        const key = item.querySelector("h3.font-medium")?.textContent.trim();
                        const val = item.querySelector("p.text-sm.text-label-black")?.textContent.trim();
                        if (key) map[key] = val;
                    });
                    return map;
                }
            );

            // Получаем сырой набор фич из Car details (новая структура)
            const detailFeatures = await page.$$eval(
                ".mt-2.md\\:text-base.text-sm.leading-5",
                items => {
                    const map = {};
                    const text = items?.textContent?.trim();
                    if (text) {
                        // Парсим текст вида "First owner: No • Specs: GCC specs • More"
                        const parts = text.split('•');
                        parts.forEach(part => {
                            const [key, val] = part.split(':');
                            if (key && val) {
                                map[key.trim()] = val.trim();
                            }
                        });
                    }
                    return map;
                }
            );

            // Получаем параметры из модального окна
            const modalFeatures = await page.evaluate(() => {
                const modal = document.querySelector('.flex-1.px-8.py-28.sm\\:px-24.sm\\:py-24.overflow-y-auto.flex.\\!py-4.w-full.h-full');
                console.log('Modal found:', !!modal);
                if (!modal) return {};

                const map = {};
                
                // Ищем все строки с параметрами в модальном окне
                const rows = modal.querySelectorAll('.flex.w-full.justify-between.py-3.border-b.border-gray-100');
                console.log('Rows found:', rows.length);
                rows.forEach(row => {
                    const spans = row.querySelectorAll('span');
                    if (spans.length >= 2) {
                        const key = spans[0]?.textContent?.trim();
                        const value = spans[1]?.textContent?.trim();
                        console.log('Found param:', key, '=', value);
                        if (key && value) {
                            map[key] = value;
                        }
                    }
                });

                return map;
            });

            // Объединяем их в одну карту
            const rawFeatures = {
                ...overviewFeatures,
                ...detailFeatures,
                ...modalFeatures
            };

            // Отладочная информация
            console.log("🔍 Извлеченные параметры:", rawFeatures);
            console.log("🔍 Параметры из модального окна:", modalFeatures);

            // Извлекаем основные поля
            const title = await this.safeEval(page, "h2.text-base.md\\:text-2xl.font-medium.text-label-black", el => el.textContent.trim()) || "Не указано";

            // Отладочная информация для заголовка
            console.log("🔍 Извлеченный заголовок:", title);

            // Извлекаем год - ищем span после изображения с alt="Year"
            const yearText = await page.evaluate(() => {
                const yearImg = Array.from(document.querySelectorAll('img')).find(img => 
                    img.getAttribute('alt') === 'Year' || img.getAttribute('alt') === 'Год'
                );
                if (yearImg) {
                    const nextSpan = yearImg.parentElement?.querySelector('span');
                    return nextSpan?.textContent?.trim() || null;
                }
                return null;
            }) 
            const year = yearText ? yearText.replace(/\D/g, "") : null;

            // Извлекаем пробег - ищем span после изображения с alt="Mileage"
            const kmText = await page.evaluate(() => {
                const mileageImg = Array.from(document.querySelectorAll('img')).find(img => 
                    img.getAttribute('alt') === 'Mileage' || img.getAttribute('alt') === 'Пробег'
                );
                if (mileageImg) {
                    const nextSpan = mileageImg.parentElement?.querySelector('span');
                    return nextSpan?.textContent?.trim() || null;
                }
                return null;
            }) 
            const kilometers = kmText.replace(/\D/g, "") || "0";

            // Извлекаем цену
            const priceText = await this.safeEval(page, ".md\\:text-2xl.text-base.font-bold.text-black", el => el.textContent) || "";
            const priceFormatted = priceText.replace(/[^\d,]/g, "").trim();
            const priceRaw = priceFormatted ?
                parseFloat(priceFormatted.replace(/,/g, "")) :
                null;

            // Получаем фотографии - ищем изображения с alt, начинающимся с "Car image"
            const photos = await page.evaluate(() => {
                const carImages = Array.from(document.querySelectorAll('img')).filter(img => 
                    img.getAttribute('alt') && img.getAttribute('alt').startsWith('Car image')
                );
                
                return Array.from(
                    new Set(
                        carImages
                            .map(img => img.getAttribute("src") || img.src)
                            .map(src => src.startsWith("//") ? "https:" + src : src)
                            .filter(src => src && (src.includes("carswitch.com") || src.includes("cloudfront.net")))
                    )
                );
            }) || [];

            // Извлекаем локацию - ищем span после изображения с alt="Location"
            const location = await page.evaluate(() => {
                const locationImg = Array.from(document.querySelectorAll('img')).find(img => 
                    img.getAttribute('alt') === 'Location' || img.getAttribute('alt') === 'Локация'
                );
                if (locationImg) {
                    const nextSpan = locationImg.parentElement?.querySelector('span');
                    return nextSpan?.textContent?.trim() || null;
                }
                return null;
            }) || "Не указано";

            // Данные о продавце (пока используем значения по умолчанию, так как структура изменилась)
            const sellerName = "CarSwitch";
            const sellerType = "Дилер";
            const sellerLogo = null;
            const sellerProfileLink = null;
            const phoneNumber = "Не указан";

            // Составляем итоговый объект
            const carDetails = {
                short_url: url,
                title,
                photos,
                main_image: photos.length > 0 ? photos[0] : null,
                make: this.pick(rawFeatures, ["Make", "Марка", "Brand", "brand"], title && title !== "Не указано" ? title.split(" ")[0] : "Не указано"),
                model: this.pick(rawFeatures, ["Model", "Модель", "Car Model", "car model"], title && title !== "Не указано" ? title.replace(/^\S+\s*/, "") : "Не указано"),
                year,
                body_type: this.pick(rawFeatures, ["Body type", "Body Type", "Тип кузова", "body type", "Body", "body", "Vehicle Type", "vehicle type"], "Не указано"),
                horsepower: this.pick(rawFeatures, ["Engine Size", "Мощность", "Engine", "engine", "Displacement", "displacement"], null),
                fuel_type: this.pick(rawFeatures, ["Fuel Type", "Тип топлива", "Fuel", "fuel", "Fuel type", "fuel type", "Gas", "gas", "Petrol", "petrol"], "Не указано"),
                motors_trim: this.pick(rawFeatures, ["Specs", "Комплектация", "Spec", "spec", "Specification", "specification", "Trim", "trim", "Variant", "variant"], "Не указано"),
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
                exterior_color: this.pick(rawFeatures, ["Color", "Цвет", "Exterior Color", "exterior color", "Paint", "paint", "Exterior", "exterior", "Body Color", "body color"], "Не указано"),
                location,
                contact: {
                    phone: phoneNumber,
                },
            };

            // Закрываем модальное окно если оно открыто
            try {
                const closeButton = await page.$('.rounded-full.w-6.h-6.flex.items-center.border.border-\\[\\#0F1B41\\].justify-center.hover\\:bg-gray-100.cursor-pointer.transition-colors');
                if (closeButton) {
                    await closeButton.click();
                    await page.waitForTimeout(500);
                }
            } catch (error) {
                // Игнорируем ошибки закрытия модального окна
            }

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
     * Автоматический скролл для подгрузки контента
     */
    async autoScroll(page) {
        await page.evaluate(async () => {
            // Пробуем разные контейнеры для скролла
            const containers = [
                document.querySelector(".car-cards-container"),
                document.querySelector("#main-listing-div"),
                document.querySelector("main"),
                document.body
            ];

            const container = containers.find(c => c !== null);
            if (!container) return;

            await new Promise((resolve) => {
                let lastScrollHeight = 0;
                let attemptsWithoutChange = 0;

                const interval = setInterval(() => {
                    container.scrollBy(0, 300);

                    const currentHeight = container.scrollHeight;
                    if (currentHeight !== lastScrollHeight) {
                        attemptsWithoutChange = 0;
                        lastScrollHeight = currentHeight;
                    } else {
                        attemptsWithoutChange++;
                    }

                    // остановка после 3 "пустых" скроллов
                    if (attemptsWithoutChange >= 3) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 400);
            });
        });
    }

    /**
     * Сохранение данных в базу
     */
    async saveData(carDetails) {
        try {
            await saveData(carDetails);
        } catch (error) {
            console.error(`❌ Ошибка сохранения данных:`, error.message);
        }
    }

    /**
     * Утилита для паузы
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { CarswitchParser };
