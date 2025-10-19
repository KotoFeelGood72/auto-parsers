const { BaseParser } = require('./BaseParser');

/**
 * Парсер для сайта Dubizzle.com (пример)
 * Показывает как легко добавить новый парсер
 */
class DubizzleParser extends BaseParser {
    constructor(config = {}) {
        super('Dubizzle', {
            baseUrl: 'https://www.dubizzle.com',
            listingsUrl: 'https://www.dubizzle.com/dubai/cars',
            maxPages: 30,
            ...config
        });
    }

    /**
     * Получение списка объявлений для Dubizzle
     */
    async* getListings() {
        let attempt = 0;
        let currentPage = 1;

        while (attempt < this.config.maxRetries) {
            const page = await this.createPage();

            try {
                console.log("🔍 Открываем каталог Dubizzle...");

                while (currentPage <= this.config.maxPages) {
                    const url = `${this.config.listingsUrl}?page=${currentPage}`;
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: this.config.timeout 
                    });

                    // Ждём основной список машин (селекторы для Dubizzle)
                    await page.waitForSelector(
                        '.listing-item a[href*="/dubai/cars/"]', 
                        { timeout: 30000 }
                    );

                    const carLinks = await this.safeEvalAll(
                        page, 
                        '.listing-item a[href*="/dubai/cars/"]', 
                        (elements) =>
                            elements
                                .map((el) => el.getAttribute("href"))
                                .filter((href) => href && href.startsWith(this.config.baseUrl))
                    );

                    if (carLinks.length === 0) {
                        console.log(`🏁 На странице ${currentPage} нет объявлений. Завершаем.`);
                        break;
                    }

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                    for (const link of carLinks) {
                        yield link;
                        await this.delay();
                    }

                    console.log(`➡️ Переход к следующей странице: ${currentPage + 1}`);
                    currentPage++;
                }

                return;

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
     * Парсинг детальной информации об объявлении для Dubizzle
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
            await page.waitForSelector(".ad-title", { timeout: 15000 });

            console.log("📄 Парсим данные...");

            // Парсинг для Dubizzle (примерные селекторы)
            const title = await this.safeEval(page, ".ad-title", el => el.textContent.trim());

            const priceFormatted = await this.safeEval(
                page, 
                ".price", 
                el => el.textContent.replace(/[^\d,]/g, "").trim()
            );
            const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "").replace(/\s/g, "")) : null;
            const currency = "AED"; // Dubizzle использует AED

            // Парсинг характеристик (примерные селекторы)
            const year = await this.safeEval(
                page, 
                '.ad-attributes .attr-item:contains("Year") .attr-value', 
                el => el.textContent.trim()
            );

            const kilometers = await this.safeEval(
                page, 
                '.ad-attributes .attr-item:contains("Kilometers") .attr-value', 
                el => el.textContent.trim()
            );

            const make = await this.safeEval(
                page, 
                '.ad-attributes .attr-item:contains("Make") .attr-value', 
                el => el.textContent.trim()
            );

            const model = await this.safeEval(
                page, 
                '.ad-attributes .attr-item:contains("Model") .attr-value', 
                el => el.textContent.trim()
            );

            // Парсинг фотографий
            const photos = await this.safeEvalAll(
                page, 
                '.ad-images img', 
                imgs => imgs.map(img => img.src.startsWith('//') ? 'https:' + img.src : img.src)
            );

            // Парсинг информации о продавце
            const sellerName = await this.safeEval(
                page, 
                ".seller-name", 
                el => el.textContent.trim()
            );

            const phone = await this.safeEval(
                page, 
                ".phone-number", 
                el => el.textContent.trim()
            );

            // Формирование объекта данных
            const rawData = {
                short_url: url,
                title,
                photos,
                make: make || null,
                model: model || null,
                year,
                body_type: null,
                horsepower: null,
                fuel_type: null,
                motors_trim: null,
                kilometers,
                sellers: {
                    sellerName: sellerName || "Не указан",
                    sellerType: "Private", // Dubizzle обычно частные продавцы
                    sellerLogo: null,
                    sellerProfileLink: null,
                },
                price: {
                    formatted: priceFormatted,
                    raw: priceRaw,
                    currency,
                },
                exterior_color: null,
                location: "Dubai",
                contact: {
                    phone: phone || "Не указан",
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
     * Валидация данных для Dubizzle
     */
    validateData(data) {
        return super.validateData(data) && 
               data.title && 
               data.title !== "Неизвестно";
    }
}

module.exports = { DubizzleParser };
