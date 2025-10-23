const { BaseParser } = require('../../BaseParser');
const { saveData } = require('../../../utils/saveData');

/**
 * Парсер для сайта OpenSooq.com
 * Основан на коде из ветки opensooq
 */
class OpenSooqParser extends BaseParser {
    constructor(config) {
        super('OpenSooq', {
            baseUrl: 'https://ae.opensooq.com',
            listingsUrl: 'https://ae.opensooq.com/en/cars/cars-for-sale',
            timeout: 90000,
            delayBetweenRequests: 2000,
            maxRetries: 3,
            retryDelay: 5000,
            enableImageLoading: false,
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
                console.log("🔍 Открываем каталог OpenSooq...");

                while (true) {
                    const url = `${this.config.listingsUrl}/?page=${currentPage}`;
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: 90000 
                    });

                    // Ждем загрузки страницы
                    await page.waitForTimeout(5000);
                    
                    // Пробуем прокрутить страницу для загрузки контента
                    await page.evaluate(() => {
                        window.scrollTo(0, document.body.scrollHeight);
                    });
                    await page.waitForTimeout(3000);
                    
                    // Пробуем прокрутить обратно
                    await page.evaluate(() => {
                        window.scrollTo(0, 0);
                    });
                    await page.waitForTimeout(2000);

                    // Ждем появления контейнера с объявлениями
                    try {
                        await page.waitForSelector('#serpMainContent', { timeout: 30000 });
                        console.log("✅ Контейнер #serpMainContent найден");
                    } catch (error) {
                        console.warn(`⚠️ Контейнер #serpMainContent не найден на странице ${currentPage}`);
                        break;
                    }

                    // Ждем появления объявлений
                    try {
                        await page.waitForSelector('.postListItemData', { timeout: 30000 });
                        console.log("✅ Элементы .postListItemData найдены");
                    } catch (error) {
                        console.warn(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        break;
                    }

                    // Извлекаем ссылки из объявлений
                    const carLinks = await page.$$eval('.postListItemData', (elements) =>
                        elements
                            .map((el) => {
                                // Проверяем, является ли сам элемент ссылкой
                                if (el.tagName === 'A') {
                                    return el.getAttribute("href");
                                }
                                // Иначе ищем ссылку внутри элемента
                                const link = el.querySelector('a');
                                return link ? link.getAttribute("href") : null;
                            })
                            .filter((href) => href && (
                                href.startsWith("/en/search/") ||
                                href.startsWith("/post/") ||
                                href.includes("/cars/") ||
                                href.includes("/search/")
                            ))
                    );

                    // Отладочная информация
                    const debugInfo = await page.$$eval('.postListItemData', (elements) => {
                        return elements.slice(0, 3).map((el, index) => ({
                            index,
                            tagName: el.tagName,
                            className: el.className,
                            href: el.getAttribute("href"),
                            innerHTML: el.innerHTML.substring(0, 200),
                            links: Array.from(el.querySelectorAll('a')).map(a => ({
                                href: a.href,
                                text: a.textContent?.substring(0, 50)
                            }))
                        }));
                    });

                    console.log("🔍 Отладочная информация о первых 3 элементах .postListItemData:", debugInfo);

                    if (carLinks.length === 0) {
                        console.warn(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        break;
                    }

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                    for (const link of carLinks) {
                        yield `${this.config.baseUrl}${link}`;
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
                await this.sleep(this.config.retryDelay || 5000);
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
                timeout: 30000
            });

            console.log("📄 Загружаем данные...");

            // Извлекаем основные поля
            const title = await this.safeEval(page, "h1", el => el.textContent.trim()) || "Не указано";

            const priceFormatted = await this.safeEval(page, "[data-id='post_price']", el => el.textContent.replace(/[^\d,]/g, "").trim()) || "";
            const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
            const currency = "AED";

            const location = await this.safeEval(page, "a[data-id='location']", el => el.textContent.trim()) || "Не указано";

            // Получаем фотографии
            const photos = await page.$$eval(".image-gallery-slide img.image-gallery-image", imgs =>
                imgs.map(img => img.src).filter(src => src)
            ) || [];

            const sellerName = await this.safeEval(page, "[data-id='member_name']", el => el.textContent.trim()) || "Не указан";
            const sellerLogo = await this.safeEval(page, "#PostViewOwnerCard img", img => img.src) || null;
            const sellerProfileLink = await this.safeEval(page, "#PostViewOwnerCard a", a => a.href) || null;

            const phoneNumber = await this.safeEval(page, "[data-id='call_btn'] span", el => el.textContent.trim()) || "Не указан";
            const motors_trim = await this.safeEval(page, "[data-id='singeInfoField_3'] a", el => el.textContent.trim()) || "Не указано";
            const bodyType = await this.safeEval(page, "[data-id='singeInfoField_6'] span", el => el.textContent.trim()) || "Не указано";
            const fuelType = await this.safeEval(page, "[data-id='singeInfoField_8'] span", el => el.textContent.trim()) || "Не указано";
            const kilometers = await this.safeEval(page, "[data-id='singeInfoField_5'] span", el => el.textContent.trim()) || "0";
            const make = await this.safeEval(page, "[data-id='singeInfoField_1'] a", el => el.textContent.trim()) || "Не указано";
            const exteriorColor = await this.safeEval(page, "[data-id='singeInfoField_11'] a", el => el.textContent.trim()) || "Не указано";
            const year = await this.safeEval(page, "[data-id='singeInfoField_4'] a", el => el.textContent.trim()) || "0";
            const model = await this.safeEval(page, "[data-id='singeInfoField_2'] a", el => el.textContent.trim()) || "Не указано";
            const horsepower = await this.safeEval(page, "[data-id='singeInfoField_10'] span", el => el.textContent.trim()) || null;

            // Составляем итоговый объект
            const carDetails = {
                short_url: url,
                title,
                photos,
                main_image: photos.length > 0 ? photos[0] : null,
                make: make,
                model: model,
                year: year,
                body_type: bodyType,
                horsepower: horsepower,
                fuel_type: fuelType,
                motors_trim: motors_trim,
                kilometers: kilometers,
                sellers: {
                    sellerName: sellerName,
                    sellerType: "Дилер",
                    sellerLogo: sellerLogo,
                    sellerProfileLink: sellerProfileLink,
                },
                price: {
                    formatted: priceFormatted,
                    raw: priceRaw,
                    currency: currency,
                },
                exterior_color: exteriorColor,
                location: location,
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

module.exports = { OpenSooqParser };
