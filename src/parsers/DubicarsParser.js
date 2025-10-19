const { BaseParser } = require('./BaseParser');

/**
 * Парсер для сайта Dubicars.com
 */
class DubicarsParser extends BaseParser {
    constructor(config = {}) {
        super('Dubicars', {
            baseUrl: 'https://www.dubicars.com',
            listingsUrl: 'https://www.dubicars.com/dubai/used',
            maxPages: 50, // Максимальное количество страниц для парсинга
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

                while (currentPage <= this.config.maxPages) {
                    const url = `${this.config.listingsUrl}?page=${currentPage}`;
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

                    const carLinks = await this.safeEvalAll(
                        page, 
                        'section#serp-list li.serp-list-item a.image-container', 
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
            await page.waitForSelector(".car-title", { timeout: 15000 });

            console.log("📄 Парсим данные...");

            // Парсинг основных данных
            const title = await this.safeEval(page, ".car-title", el => el.textContent.trim());

            // Парсинг цены
            const priceFormatted = await this.safeEval(
                page, 
                "div.price.currency-price-field", 
                el => el.textContent.replace(/[^\d,]/g, "").trim()
            );
            const priceRaw = priceFormatted ? parseFloat(priceFormatted.replace(/,/g, "").replace(/\s/g, "")) : null;
            const currency = "USD";

            // Парсинг характеристик
            const year = await this.safeEval(
                page, 
                '#item-specifications ul li:nth-child(2) span:nth-child(3)', 
                el => el.textContent.trim()
            );

            const kilometers = await this.safeEval(
                page, 
                '#item-specifications ul li:nth-child(3) span:nth-child(3)', 
                el => el.textContent.trim()
            );

            // Парсинг типа топлива
            const fuel_type = await page.$$eval('#item-specifications ul li', (elements) => {
                const el = elements.find(el => el.innerText.includes('Fuel Type'));
                return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
            });

            // Парсинг марки
            const make = await page.$$eval('#item-specifications ul li', (elements) => {
                const el = elements.find(el => el.innerText.includes('Make'));
                return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
            });

            // Парсинг модели
            const model = await page.$$eval('#item-specifications ul li', (elements) => {
                const el = elements.find(el => el.innerText.includes('Model'));
                return el ? el.querySelector('span:last-child')?.textContent.trim() : null;
            });

            // Парсинг фотографий
            const photos = await this.safeEvalAll(
                page, 
                '#car-images-slider img', 
                imgs => imgs.map(img => img.src.startsWith('//') ? 'https:' + img.src : img.src)
            );

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
                "#seller-info .links li a", 
                a => a.href
            );

            // Парсинг телефона
            const whatsappHref = await this.safeEval(page, 'a.whatsapp-link', a => a.href);
            const phoneMatch = whatsappHref ? whatsappHref.match(/phone=(\d+)/) : null;
            const phone = phoneMatch ? `+${phoneMatch[1]}` : "Не указан";

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
                fuel_type,
                motors_trim: null,
                kilometers,
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
                exterior_color: null,
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
