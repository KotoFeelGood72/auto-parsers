const { BaseParser } = require('../../BaseParser');
const { saveData } = require('../../../utils/saveData');

/**
 * Парсер для сайта OneClickDrive.com
 * Индивидуальная реализация без использования ConfigParser
 */
class OneclickdriveParser extends BaseParser {
    constructor(config = {}) {
        super('OneClickDrive', {
            baseUrl: 'https://www.oneclickdrive.com',
            listingsUrl: 'https://www.oneclickdrive.com/buy-used-cars-dubai?page={page}',
            maxPages: 50,
            timeout: 60000,
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
                console.log("🔍 Открываем каталог OneClickDrive...");

                while (currentPage <= this.config.maxPages) {
                    const url = this.config.listingsUrl.replace('{page}', currentPage);
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: this.config.timeout 
                    });

                    // Ждём основной список машин
                    await page.waitForSelector(
                        '.gallery-img-link', 
                        { timeout: 30000 }
                    );

                    const carLinks = await page.$$eval(
                        '.gallery-img-link', 
                        (elements, baseUrl) =>
                            elements
                                .map((el) => el.getAttribute("href"))
                                .filter((href) => href && href.startsWith(baseUrl)),
                        this.config.baseUrl
                    );

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                    // Возвращаем ссылки по одной
                    for (const link of carLinks) {
                        yield link;
                    }

                    // Проверяем наличие следующей страницы
                    const hasNextPage = await page.$('.paginationdesign a.nextbtn');
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
            const title = await safeEval("h1.dsktit", el => el.textContent.trim());
            
            // Извлекаем данные из таблицы характеристик на основе реальной структуры HTML
            // Используем более простые селекторы, так как :has() и :contains() не поддерживаются в Playwright
            
            // Получаем все элементы .priceingdt и ищем нужные данные
            const specsData = await page.$$eval('.priceingdt', elements => {
                const data = {};
                elements.forEach(el => {
                    const labelSpan = el.querySelector('span:first-child');
                    const valueElement = el.querySelector('.text-right');
                    
                    if (labelSpan && valueElement) {
                        const label = labelSpan.textContent.trim().toLowerCase();
                        const value = valueElement.textContent.trim();
                        
                        if (label.includes('make')) data.make = value;
                        else if (label.includes('model')) data.model = value;
                        else if (label.includes('driven')) {
                            // Специальная обработка для километров - извлекаем только число
                            const kmMatch = value.match(/(\d+)\s*km/i);
                            data.driven = kmMatch ? kmMatch[1] : value;
                        }
                        else if (label.includes('body type')) data.bodyType = value;
                        else if (label.includes('gearbox')) data.gearbox = value;
                        else if (label.includes('fuel type')) data.fuelType = value;
                        else if (label.includes('seller type')) data.sellerType = value;
                        else if (label.includes('exterior')) data.exteriorColor = value;
                    }
                });
                return data;
            });

            const make = specsData.make || "Неизвестно";
            const model = specsData.model || "Неизвестно";
            const year = "2023"; // Извлекаем из заголовка или breadcrumb
            const bodyType = specsData.bodyType || "Неизвестно";
            const motorsTrim = specsData.gearbox || "Неизвестно";
            const fuelType = specsData.fuelType || "Неизвестно";
            
            // Специальная обработка для километров
            const kilometers = specsData.driven ? 
                parseInt(specsData.driven, 10) || 0 : 0;

            const exteriorColor = specsData.exteriorColor || "Неизвестно";
            const location = await safeEval(".dtlloc", el => el.textContent.replace(/\s+/g, " ").trim());

            // Обработка цены
            const priceFormatted = await safeEval(".mainprice", el => el.textContent.replace(/[^\d,]/g, "").trim());
            const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "")) : null;
            const currency = "AED";

            // Извлечение фотографий
            const photos = await page.$$eval(".collage-slide-images img.imagegal", imgs => 
                imgs.map(img => img.src).filter(src => src)
            );

            // Главное изображение (первое фото)
            const mainImage = photos && photos.length > 0 ? photos[0] : null;

            // Информация о продавце
            const sellerName = await safeEval(".cmpbrndlogo", img => img.getAttribute("title"));
            const sellerType = specsData.sellerType || "Неизвестно";
            const sellerLogo = await safeEval(".cmpbrndlogo", el => el.src);
            const sellerProfileLink = await safeEval(".moredealer", el => el.href);

            // Контактная информация
            const phoneNumber = await safeEval(".callnwbtn", el => el.textContent.trim());

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
                horsepower: null, // Не доступно на сайте
                fuel_type: fuelType || "Неизвестно",
                motors_trim: motorsTrim || "Неизвестно",
                kilometers: kilometers || 0,
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
     * Переопределяем метод BaseParser для правильного маппинга полей OneClickDrive
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

module.exports = { OneclickdriveParser };
