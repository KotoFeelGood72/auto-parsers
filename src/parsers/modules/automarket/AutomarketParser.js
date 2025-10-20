const { BaseParser } = require('../../BaseParser');
const { saveData } = require('../../../utils/saveData');

/**
 * Парсер для сайта Dubizzle.com (automarket)
 * Индивидуальная реализация без использования ConfigParser
 */
class AutomarketParser extends BaseParser {
    constructor(config = {}) {
        super('Automarket', {
            baseUrl: 'https://uae.dubizzle.com',
            listingsUrl: 'https://uae.dubizzle.com/motors/used-cars/',
            maxPages: 50,
            timeout: 90000,
            delayBetweenRequests: 1000,
            maxRetries: 3,
            enableImageLoading: false,
            ...config
        });
    }

    /**
     * Получение списка объявлений
     */
    async* getListings() {
        let attempt = 0;

        while (attempt < this.config.maxRetries) {
            const page = await this.createPage();

            try {
                console.log("🔍 Открываем каталог Dubizzle...");

                await page.setExtraHTTPHeaders({
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                });

                await page.goto(this.config.listingsUrl, {
                    waitUntil: "domcontentloaded",
                    timeout: this.config.timeout,
                });

                console.log("📄 Собираем ссылки на бренды...");
                await page.waitForSelector(".tagList a", { timeout: 30000 });

                const brandLinks = await page.$$eval(".tagList a", (elements) =>
                    elements.map((el) => el.getAttribute("href")).filter((href) => href !== null)
                );

                console.log(`✅ Найдено ${brandLinks.length} брендов. Начинаем парсинг...`);

                for (const brandLink of brandLinks) {
                    const fullBrandUrl = `${this.config.baseUrl}${brandLink}`;
                    console.log(`🚗 Переход в бренд: ${fullBrandUrl}`);
                    await page.goto(fullBrandUrl, { waitUntil: "domcontentloaded", timeout: this.config.timeout });

                    let currentPage = 1;
                    while (currentPage <= this.config.maxPages) {
                        console.log(`📄 Загружаем страницу ${currentPage} для бренда ${fullBrandUrl}...`);
                        await page.waitForSelector('[data-testid^="listing-"]', { timeout: 30000 });

                        const links = await page.$$eval("[data-testid^='listing-']", (elements) =>
                            elements.map((el) => el.getAttribute("href")).filter((href) => href !== null)
                        );

                        for (const link of links) {
                            yield `${this.config.baseUrl}${link}`;
                        }

                        console.log(`✅ Страница ${currentPage}: найдено ${links.length} объявлений`);

                        const nextButton = await page.$('[data-testid="page-next"]');
                        if (!nextButton) {
                            console.log("🏁 Достигнута последняя страница бренда. Возвращаемся к списку брендов.");
                            break;
                        }

                        const nextPageNumber = await page.$eval('[data-testid="page-next"]', (el) => {
                            const href = el.getAttribute("href");
                            const match = href.match(/page=(\d+)/);
                            return match ? parseInt(match[1], 10) : null;
                        });

                        if (!nextPageNumber || nextPageNumber <= currentPage) {
                            console.log("🏁 Больше страниц нет. Возвращаемся к списку брендов.");
                            break;
                        }

                        console.log(`➡️ Переход на страницу ${nextPageNumber} для бренда ${fullBrandUrl}...`);
                        await page.goto(`${fullBrandUrl}?page=${nextPageNumber}`, { waitUntil: "domcontentloaded", timeout: this.config.timeout });
                        currentPage = nextPageNumber;
                        
                        // Небольшая задержка между страницами
                        await this.delay(this.config.delayBetweenRequests);
                    }
                }

                return; // Успешное завершение

            } catch (error) {
                console.error(`❌ Ошибка при парсинге (попытка ${attempt + 1}):`, error);
                attempt++;
                
                if (attempt < this.config.maxRetries) {
                    console.log("🔄 Перезапуск браузера...");
                    await this.restartBrowser();
                }
            } finally {
                await page.close();
            }
        }

        console.error("🚨 Все попытки исчерпаны! Парсер остановлен.");
        throw new Error('Не удалось получить список объявлений после всех попыток');
    }

    /**
     * Парсинг детальной информации об объявлении
     */
    async parseListing(url) {
        const page = await this.createPage();
        
        try {
            console.log(`🚗 Переходим к ${url}`);

            await page.setExtraHTTPHeaders({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            });

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: this.config.timeout,
            });

            console.log("📄 Загружаем данные...");

            await page.waitForFunction(() => {
                const elem = document.querySelector('[data-testid="listing-price"]');
                return elem && elem.innerText.trim().length > 0;
            }, { timeout: 5000 });

            // Вспомогательная функция для безопасного извлечения данных
            const safeEval = async (selector, callback) => {
                try {
                    return await page.$eval(selector, callback);
                } catch (error) {
                    return null;
                }
            };

            // Извлечение основных данных
            const title = await safeEval('[data-testid="listing-sub-heading"]', el => el.innerText.trim());
            const make = await safeEval('[data-testid="listing-sub-heading"]', el => el.innerText.split(" ")[0].trim());
            const model = await safeEval('[data-testid="listing-sub-heading"]', el => el.innerText.split(" ")[1].trim());
            const year = await safeEval('[data-testid="listing-year-value"]', el => el.innerText.trim());
            const bodyType = await safeEval('[data-testid="overview-body_type-value"]', el => el.innerText.trim());
            const horsepower = await safeEval('[data-testid="overview-horsepower-value"]', el => el.innerText.trim());
            const fuelType = await safeEval('[data-testid="overview-fuel_type-value"]', el => el.innerText.trim());
            const motorsTrim = await safeEval('[data-testid="overview-transmission_type-value"]', el => el.innerText.trim());
            const kilometers = await safeEval('[data-testid="listing-kilometers-value"]', el => el.innerText.trim().replace(/\D/g, ""));
            const exteriorColor = await safeEval('[data-testid="overview-exterior_color-value"]', el => el.innerText.trim());
            const location = await safeEval('[data-testid="listing-location-map"]', el => el.innerText.trim());

            // Обработка цены
            const priceFormatted = await safeEval('[data-testid="listing-price"] span', el => el.innerText.trim().replace("AED", "").trim());
            const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
            const currency = "AED";

            // Парсим информацию о продавце
            let sellerName = "Не указан";
            let sellerType = "Частное лицо";
            let sellerLogo = null;
            let sellerProfileLink = null;

            try {
                console.log("⌛ Ожидаем загрузку блока продавца...");
                await page.waitForSelector('[data-testid="name"]', { timeout: 5000 });

                sellerName = await safeEval('[data-testid="name"]', el => el.innerText.trim());
                sellerType = await safeEval('[data-testid="type"]', el => el.innerText.trim());
                sellerLogo = await safeEval('[data-testid="logo"] img', el => el.src);

                const sellerProfileElement = await page.$('[data-testid="view-all-cars"]');
                if (sellerProfileElement) {
                    sellerProfileLink = await safeEval('[data-testid="view-all-cars"]', el => el.href);
                }

                console.log(`🏢 Продавец: ${sellerName} (${sellerType})`);
            } catch (error) {
                console.warn("⚠️ Ошибка при получении данных о продавце:", error);
            }

            // Получение номера телефона
            let phoneNumber = null;
            try {
                const callButton = page.locator('[data-testid="call-cta-button"]').first();
                const callButtonCount = await callButton.count();

                if (callButtonCount > 0) {
                    console.log(`📞 Найдено ${callButtonCount} кнопок вызова. Кликаем по первой...`);

                    let clicked = false;
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            console.log(`🔄 Попытка ${attempt}...`);
                            await callButton.scrollIntoViewIfNeeded();
                            await page.waitForTimeout(2000);
                            await callButton.click();
                            clicked = true;
                            console.log("✅ Успешно кликнули по кнопке 'Call'");
                            break;
                        } catch (error) {
                            console.warn(`⚠️ Попытка ${attempt} не удалась. Ошибка:`, error);
                            await page.waitForTimeout(2000);
                        }
                    }

                    if (clicked) {
                        console.log("⌛ Ждем появления модального окна...");
                        const modal = page.locator(".MuiDialog-container");
                        await modal.waitFor({ state: "visible", timeout: 10000 });
                        console.log("✅ Модальное окно найдено!");

                        const phoneNumberLocator = modal.locator('[data-testid="phone-number"] p');
                        await phoneNumberLocator.waitFor({ state: "visible", timeout: 5000 });
                        phoneNumber = await phoneNumberLocator.innerText();
                        console.log(`📞 Получен номер телефона: ${phoneNumber}`);

                        const closeButton = modal.locator('[data-testid="close-button"]');
                        if ((await closeButton.count()) > 0) {
                            await closeButton.click();
                            await page.waitForTimeout(5000);
                            console.log("✅ Модальное окно закрыто.");
                        }
                    }
                } else {
                    console.warn("⚠️ Кнопка вызова не найдена, пропускаем...");
                }
            } catch (error) {
                console.warn("⚠️ Ошибка при получении номера телефона:", error);
            }

            // Получение фотографий
            let photos = [];
            try {
                const mainImageSelector = ".MuiImageListItem-standard";
                await page.waitForSelector(mainImageSelector, { timeout: 10000 });

                let clicked = false;
                for (let attempt = 0; attempt < 3; attempt++) {
                    console.log(`📸 Попытка клика #${attempt + 1}...`);

                    const mainImage = await page.$(mainImageSelector);
                    if (!mainImage) {
                        console.warn("⚠️ Главное изображение исчезло, пробуем заново...");
                        await page.waitForTimeout(1000);
                        continue;
                    }

                    try {
                        await mainImage.hover();
                        await page.waitForTimeout(500);
                        await mainImage.click({ delay: 200 });
                        clicked = true;
                        break;
                    } catch (error) {
                        console.warn("⚠️ Элемент изменился, пробуем снова...");
                        await page.waitForTimeout(1000);
                    }
                }

                if (clicked) {
                    console.log("📸 Кликнули, ждем загрузки модалки...");
                    await page.waitForSelector(".MuiModal-root", { timeout: 5000 });

                    await page.waitForFunction(() => {
                        const modal = document.querySelector(".MuiModal-root");
                        return modal && modal.querySelectorAll(".MuiImageList-root img").length > 0;
                    }, { timeout: 5000 });

                    photos = await page.evaluate(() => {
                        return Array.from(document.querySelectorAll(".MuiModal-root .MuiImageList-root img"))
                            .map((img) => img.src)
                            .filter((src) => src.includes(".jpeg") || src.includes(".jpg") || src.includes(".png"));
                    });

                    console.log(`📸 Собрано изображений: ${photos.length}`);
                }
            } catch (error) {
                console.warn("⚠️ Ошибка при получении фотографий:", error);
            }

            // Главное изображение (первое фото)
            const mainImage = photos && photos.length > 0 ? photos[0] : null;

            // Формирование объекта с данными
            const carDetails = {
                short_url: url,
                title: title || "Неизвестно",
                photos: photos || [],
                main_image: mainImage,
                make: make || "Неизвестно",
                model: model || "Неизвестно",
                year: year || "Неизвестно",
                body_type: bodyType || "Неизвестно",
                horsepower: horsepower || "Неизвестно",
                fuel_type: fuelType || "Неизвестно",
                motors_trim: motorsTrim || "Неизвестно",
                kilometers: parseInt(kilometers, 10) || 0,
                // Плоская структура для цен
                price_formatted: priceFormatted || "0",
                price_raw: priceRaw || 0,
                currency: currency,
                exterior_color: exteriorColor || "Неизвестно",
                location: location || "Неизвестно",
                // Плоская структура для контактов
                phone: phoneNumber || "Не указан",
                // Плоская структура для продавца
                seller_name: sellerName || "Не указан",
                seller_type: sellerType || "Частное лицо",
                seller_logo: sellerLogo || null,
                seller_profile_link: sellerProfileLink || null,
            };

            console.log(`✅ Данные извлечены для: ${title}`);
            return carDetails;

        } catch (error) {
            console.error(`❌ Ошибка при загрузке данных с ${url}:`, error);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * Запуск полного цикла парсинга
     */
    async run() {
        const results = [];
        
        try {
            console.log(`🚀 Запускаем парсер ${this.name}...`);
            
            // Получаем список объявлений и парсим каждое
            for await (const listingUrl of this.getListings()) {
                console.log(`🚗 Обрабатываем ${listingUrl}`);
                
                try {
                    const carDetails = await this.parseListing(listingUrl);
                    if (carDetails) {
                        results.push(carDetails);
                        
                        // Сохраняем данные в базу
                        await this.saveData(carDetails);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при обработке ${listingUrl}:`, error);
                }
            }
            
            console.log(`✅ Парсер ${this.name} завершен. Обработано: ${results.length} объявлений`);
            return results;
            
        } catch (error) {
            console.error(`❌ Ошибка в парсере ${this.name}:`, error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Нормализация данных для сохранения в БД
     * Переопределяем метод BaseParser для правильного маппинга полей Automarket
     */
    normalizeData(rawData) {
        return {
            short_url: rawData.short_url || null,
            title: rawData.title || "Неизвестно",
            make: rawData.make || "Неизвестно",
            model: rawData.model || "Неизвестно",
            year: rawData.year || "Неизвестно",
            body_type: rawData.body_type || "Неизвестно",
            horsepower: rawData.horsepower || "Неизвестно",
            fuel_type: rawData.fuel_type || "Неизвестно",
            motors_trim: rawData.motors_trim || "Неизвестно",
            kilometers: parseInt(rawData.kilometers, 10) || 0,
            // Правильный маппинг для цен - сначала проверяем прямые поля, затем вложенные
            price_formatted: rawData.price_formatted || rawData.price?.formatted || "0",
            price_raw: rawData.price_raw || rawData.price?.raw || 0,
            currency: rawData.currency || rawData.price?.currency || "Неизвестно",
            exterior_color: rawData.exterior_color || "Неизвестно",
            location: rawData.location || "Неизвестно",
            // Правильный маппинг для контактов - сначала проверяем прямые поля, затем вложенные
            phone: rawData.phone || rawData.contact?.phone || "Не указан",
            // Правильный маппинг для продавца - сначала проверяем прямые поля, затем вложенные
            seller_name: rawData.seller_name || rawData.sellers?.sellerName || "Неизвестен",
            seller_type: rawData.seller_type || rawData.sellers?.sellerType || "Неизвестен",
            seller_logo: rawData.seller_logo || rawData.sellers?.sellerLogo || null,
            seller_profile_link: rawData.seller_profile_link || rawData.sellers?.sellerProfileLink || null,
            main_image: rawData.main_image || null,
            photos: rawData.photos || []
        };
    }

    /**
     * Сохранение данных в базу
     */
    async saveData(carDetails) {
        try {
            // Данные уже нормализованы в парсере, передаем их напрямую
            await saveData(carDetails);
        } catch (error) {
            console.error(`❌ Ошибка сохранения данных:`, error.message);
        }
    }

    /**
     * Получение информации о парсере
     */
    getInfo() {
        return {
            name: this.name,
            baseUrl: this.config.baseUrl,
            listingsUrl: this.config.listingsUrl,
            maxPages: this.config.maxPages,
            timeout: this.config.timeout
        };
    }
}

module.exports = { AutomarketParser };
