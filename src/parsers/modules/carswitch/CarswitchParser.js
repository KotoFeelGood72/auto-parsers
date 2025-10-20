const { BaseParser } = require('../../BaseParser');

/**
 * Парсер для сайта Carswitch.com
 * Основан на коде из ветки carswitch
 */
class CarswitchParser extends BaseParser {
    constructor(config) {
        super('Carswitch', {
            baseUrl: 'https://carswitch.com',
            listingsUrl: 'https://carswitch.com/uae/used-cars/search',
            maxPages: 50,
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

                while (currentPage <= this.config.maxPages) {
                    const url = `${this.config.listingsUrl}?page=${currentPage}`;
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: this.config.timeout 
                    });

                    // Скроллим страницу для подгрузки всех карточек
                    await this.autoScroll(page);
                    await page.waitForTimeout(1000);

                    // Ждём хотя бы одну видимую карточку
                    await page.waitForSelector(
                        "#main-listing-div .pro-item a.image-wrapper[href]",
                        { timeout: 30000 }
                    );

                    const carLinks = await page.$$eval(
                        "#main-listing-div .pro-item a.image-wrapper",
                        (anchors) => anchors.map((a) => a.href).filter(Boolean)
                    );

                    console.log(`🧪 Найдено карточек на странице ${currentPage}: ${carLinks.length}`);

                    if (carLinks.length === 0) {
                        console.log(`⚠️ Карточки не найдены на странице ${currentPage}. Завершаем парсинг.`);
                        break;
                    }

                    for (const link of carLinks) {
                        yield link;
                    }

                    console.log(`✅ Страница ${currentPage}: обработано ${carLinks.length} объявлений`);
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
                console.log(`🔍 Парсим объявление: ${listingUrl}`);
                
                const data = await this.parseListing(listingUrl);
                if (data && this.validateData(data)) {
                    const normalizedData = this.normalizeData(data);
                    results.push(normalizedData);
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

            console.log("📄 Стягиваем базовые данные…");

            // Получаем сырой набор фич из Car Overview
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

            // Получаем сырой набор фич из Car details
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

            // Объединяем их в одну карту
            const rawFeatures = {
                ...overviewFeatures,
                ...detailFeatures
            };

            // Извлекаем основные поля
            const title = await this.safeEval(page, ".car-info-holder h1.title", el => el.textContent) || "Не указано";

            const yearText = await this.safeEval(
                page,
                ".mileage .item:nth-child(1) .mileage_text",
                el => el.textContent
            ) || "0";
            const year = yearText.replace(/\D/g, "") || null;

            const kmText = await this.safeEval(
                page,
                ".mileage .item:nth-child(2) .mileage_text",
                el => el.textContent
            ) || "0";
            const kilometers = kmText.replace(/\D/g, "") || "0";

            const priceText = await this.safeEval(
                page,
                ".show-old-price",
                el => el.textContent
            ) || "";
            const priceFormatted = priceText.replace(/[^\d,]/g, "").trim();
            const priceRaw = priceFormatted ?
                parseFloat(priceFormatted.replace(/,/g, "")) :
                null;

            // Получаем фотографии
            const photos = await page.$$eval(
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
            ) || [];

            const location = await this.safeEval(
                page,
                ".location_text#location_text",
                el => el.textContent.trim()
            ) || "Не указано";

            // Данные о продавце
            const sellerName = await this.safeEval(
                page,
                ".cmpbrndlogo",
                img => img.getAttribute("title")
            ) || "Не указан";

            const sellerType = await this.safeEval(
                page,
                ".priceingdt:nth-of-type(6) .text-right",
                el => el.textContent.trim()
            ) || "Частное лицо";

            const sellerLogo = await this.safeEval(page, ".cmpbrndlogo", el => el.src) || null;
            const sellerProfileLink = await this.safeEval(page, ".moredealer", a => a.href) || null;
            const phoneNumber = await this.safeEval(
                page,
                ".callnwbtn",
                el => el.textContent.trim()
            ) || "Не указан";

            // Составляем итоговый объект
            const carDetails = {
                short_url: url,
                title,
                photos,
                make: this.pick(rawFeatures, ["Make", "Марка"], title.split(" ")[0]),
                model: this.pick(rawFeatures, ["Model", "Модель"], title.replace(/^\S+\s*/, "")),
                year,
                body_type: this.pick(rawFeatures, ["Body Type", "Тип кузова"], "Не указано"),
                horsepower: this.pick(rawFeatures, ["Engine Size", "Мощность"], null) ?
                    parseInt(
                        this.pick(rawFeatures, ["Engine Size", "Мощность"]).replace(/\D/g, ""),
                        10
                    ) : null,
                fuel_type: this.pick(rawFeatures, ["Fuel Type", "Тип топлива"], "Не указано"),
                motors_trim: this.pick(rawFeatures, ["Specs", "Комплектация"], "Не указано"),
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
                exterior_color: this.pick(rawFeatures, ["Color", "Цвет"], "Не указано"),
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
     * Автоматический скролл для подгрузки контента
     */
    async autoScroll(page) {
        await page.evaluate(async () => {
            const container = document.querySelector("#main-listing-div");
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
     * Утилита для паузы
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { CarswitchParser };
