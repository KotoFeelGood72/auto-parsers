const { BaseParser } = require('../../BaseParser');
const { saveData } = require('../../../utils/saveData');

/**
 * Парсер для сайта AutoTraders.ae
 * Индивидуальная реализация без использования ConfigParser
 */
class AutotradersParser extends BaseParser {
    constructor(config = {}) {
        super('AutoTraders', {
            baseUrl: 'https://www.autotraders.ae',
            listingsUrl: 'https://www.autotraders.ae/used-cars/?page={page}',
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
        let currentPage = 1;

        while (attempt < this.config.maxRetries) {
            const page = await this.createPage();

            try {
                console.log("🔍 Открываем каталог AutoTraders...");

                await page.setExtraHTTPHeaders({
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                });

                while (true) {
                    const url = this.config.listingsUrl.replace('{page}', currentPage);
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: this.config.timeout 
                    });

                    // Ждём основной список машин
                    await page.waitForSelector("div.row.cars-cont div.col-md-3 > a", { timeout: 30000 });

                    const carLinks = await page.$$eval("div.row.cars-cont div.col-md-3 > a", (elements) =>
                        elements
                            .map((el) => el.getAttribute("href"))
                            .filter((href) => href && href.includes("/used-cars/"))
                    );

                    if (carLinks.length === 0) {
                        console.log(`🏁 На странице ${currentPage} нет объявлений. Завершаем.`);
                        break;
                    }

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                    // Возвращаем ссылки по одной
                    for (const link of carLinks) {
                        const fullUrl = link.startsWith("http") ? link : `${this.config.baseUrl}${link}`;
                        yield fullUrl;
                    }

                    // Проверяем наличие следующей страницы
                    const hasNextPage = await page.$('.pagination a[rel="next"]');
                    if (!hasNextPage) {
                        console.log("🏁 Последняя страница достигнута. Завершаем парсинг.");
                        break;
                    }

                    currentPage++;
                    
                    // Небольшая задержка между страницами
                    await this.delay(this.config.delayBetweenRequests);
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

            // Вспомогательная функция для безопасного извлечения данных
            const safeEval = async (selector, callback) => {
                try {
                    return await page.$eval(selector, callback);
                } catch (error) {
                    return null;
                }
            };

            console.log("📄 Загружаем данные...");

            // Извлечение основных данных
            const title = await safeEval(".title h2", el => el.textContent.trim());
            const make = await safeEval(".car-det-list span:has(i.fa-car) + span.txt", el => el.textContent.trim());
            const model = await safeEval(".car-det-list span:has(i.fa-car-side) + span.txt", el => el.textContent.trim());
            const year = await safeEval(".car-det-list span:has(i.far.fa-calendar-alt) + span.txt", el => el.textContent.trim());
            const kilometers = await safeEval(".car-det-list span:has(i.fa-tachometer-alt) + span.txt", el => el.textContent.replace(/\D/g, "").trim());
            const bodyType = await safeEval(".car-det-list span:has(i.fa-truck-pickup) + span", el => el.textContent.trim());
            const fuelType = await safeEval(".car-det-list span:has(i.fa-gas-pump) + span", el => el.textContent.trim());
            const exteriorColor = await safeEval(".car-det-list .d-flex:nth-child(4) .detail-col:last-child span:nth-child(2)", el => el.textContent.trim());

            // Обработка цены
            const priceFormatted = await safeEval(".price", el => el.textContent.replace(/[^\d,]/g, "").trim());
            const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
            const currency = "AED";

            // Извлечение фотографий
            const photos = await page.$$eval("#gallery .lightgallery.item", imgs => 
                imgs.map(img => img.href).filter(href => href)
            );

            // Главное изображение (первое фото)
            const mainImage = photos && photos.length > 0 ? photos[0] : null;

            // Информация о продавце
            const sellerName = await safeEval(".side-right .dpname", el => el.textContent.trim());
            const sellerType = "Dealer"; // На AutoTraders у всех опубликованных объявлений тип "Dealer"
            const sellerLogo = await safeEval(".side-right .logo img", img => img.src);
            const sellerProfileLink = await safeEval(".side-right .logo a", a => a.href);

            // Контактная информация
            const phoneNumber = await safeEval(".user-contact a[href^='tel:']", el => el.href.replace("tel:", "").trim());

            const location = await safeEval(".side-right .dcname", el => el.textContent.trim());
            const horsepower = await safeEval(".car-det-list .d-flex:nth-child(6) .detail-col:first-child span:nth-child(2)", el => el.textContent.trim());

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
                motors_trim: null, // Не доступно на сайте
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
     * Переопределяем метод BaseParser для правильного маппинга полей AutoTraders
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
            timeout: this.config.timeout
        };
    }
}

module.exports = { AutotradersParser };
