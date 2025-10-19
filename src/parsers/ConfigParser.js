const { BaseParser } = require('./BaseParser');

/**
 * Универсальный парсер на основе конфигурации
 * Позволяет создавать парсеры просто указав сайт и селекторы
 */
class ConfigParser extends BaseParser {
    constructor(config = {}) {
        // Извлекаем конфигурацию парсинга из основного конфига
        const { 
            name,
            baseUrl,
            listingsUrl,
            selectors,
            dataMapping,
            ...baseConfig 
        } = config;

        super(name, baseConfig);

        // Сохраняем конфигурацию парсинга
        this.parsingConfig = {
            baseUrl: baseUrl || '',
            listingsUrl: listingsUrl || '',
            selectors: selectors || {},
            dataMapping: dataMapping || {}
        };
    }

    /**
     * Получение списка объявлений на основе конфигурации
     */
    async* getListings() {
        let attempt = 0;
        let currentPage = 1;
        const maxPages = this.config.maxPages || 50;

        while (attempt < this.config.maxRetries) {
            const page = await this.createPage();

            try {
                console.log(`🔍 Открываем каталог ${this.name}...`);

                while (currentPage <= maxPages) {
                    const url = this.buildListingsUrl(currentPage);
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: this.config.timeout 
                    });

                    // Ждём основной список объявлений
                    const listingsSelector = this.parsingConfig.selectors.listings?.container;
                    if (listingsSelector) {
                        await page.waitForSelector(listingsSelector, { timeout: 30000 });
                    }

                    // Получаем ссылки на объявления
                    const carLinks = await this.extractListings(page);

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
     * Парсинг детальной информации об объявлении на основе конфигурации
     */
    async parseListing(url) {
        const page = await this.createPage();

        try {
            console.log(`🚗 Переходим к ${url}`);

            await page.goto(url, { 
                waitUntil: "domcontentloaded", 
                timeout: this.config.timeout 
            });

            // Ждем загрузку основного контента
            const titleSelector = this.parsingConfig.selectors.details?.title;
            if (titleSelector) {
                console.log("⏳ Ждем загрузку страницы...");
                await page.waitForSelector(titleSelector, { timeout: 15000 });
            }

            console.log("📄 Парсим данные...");

            // Парсим данные согласно конфигурации
            const rawData = await this.extractListingData(page, url);

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
     * Построение URL для списка объявлений
     */
    buildListingsUrl(page) {
        const { listingsUrl } = this.parsingConfig;
        if (listingsUrl.includes('{page}')) {
            return listingsUrl.replace('{page}', page);
        }
        return `${listingsUrl}?page=${page}`;
    }

    /**
     * Извлечение списка объявлений со страницы
     */
    async extractListings(page) {
        const { selectors } = this.parsingConfig;
        const { container, link } = selectors.listings || {};

        if (!container || !link) {
            console.warn("⚠️ Селекторы для списка объявлений не настроены");
            return [];
        }

        try {
            return await page.$$eval(container, (elements, linkSelector) => {
                return elements
                    .map(el => {
                        const linkEl = el.querySelector(linkSelector);
                        return linkEl ? linkEl.getAttribute("href") : null;
                    })
                    .filter(href => href && href.startsWith('http'));
            }, link);
        } catch (error) {
            console.warn("⚠️ Ошибка при извлечении списка объявлений:", error.message);
            return [];
        }
    }

    /**
     * Извлечение данных объявления со страницы
     */
    async extractListingData(page, url) {
        const { selectors, dataMapping } = this.parsingConfig;
        const details = selectors.details || {};

        const rawData = {
            short_url: url,
            photos: [],
            sellers: {},
            price: {},
            contact: {}
        };

        // Парсим основные поля
        for (const [field, selector] of Object.entries(details)) {
            if (field === 'photos') {
                // Специальная обработка для фотографий
                rawData[field] = await this.extractPhotos(page, selector);
            } else if (field === 'price') {
                // Специальная обработка для цены
                rawData[field] = await this.extractPrice(page, selector);
            } else if (field === 'sellers') {
                // Специальная обработка для продавца
                rawData[field] = await this.extractSeller(page, selector);
            } else if (field === 'contact') {
                // Специальная обработка для контактов
                rawData[field] = await this.extractContact(page, selector);
            } else {
                // Обычные поля
                rawData[field] = await this.safeEval(page, selector, el => el.textContent.trim());
            }
        }

        // Применяем маппинг данных если он настроен
        return this.applyDataMapping(rawData);
    }

    /**
     * Извлечение фотографий
     */
    async extractPhotos(page, photoConfig) {
        if (!photoConfig || !photoConfig.selector) return [];

        try {
            return await this.safeEvalAll(
                page, 
                photoConfig.selector, 
                imgs => imgs.map(img => {
                    const src = img.src || img.getAttribute('data-src');
                    return src && src.startsWith('//') ? 'https:' + src : src;
                }).filter(src => src)
            );
        } catch (error) {
            console.warn("⚠️ Ошибка при извлечении фотографий:", error.message);
            return [];
        }
    }

    /**
     * Извлечение цены
     */
    async extractPrice(page, priceConfig) {
        if (!priceConfig) return { formatted: "0", raw: 0, currency: "Unknown" };

        const { formatted, raw, currency } = priceConfig;
        const result = { formatted: "0", raw: 0, currency: "Unknown" };

        if (formatted) {
            result.formatted = await this.safeEval(page, formatted, el => el.textContent.trim()) || "0";
        }

        if (raw) {
            const rawValue = await this.safeEval(page, raw, el => {
                const text = el.textContent.replace(/[^\d,]/g, "").trim();
                return parseFloat(text.replace(/,/g, "").replace(/\s/g, "")) || 0;
            });
            result.raw = rawValue || 0;
        }

        if (currency) {
            result.currency = await this.safeEval(page, currency, el => el.textContent.trim()) || "Unknown";
        }

        return result;
    }

    /**
     * Извлечение информации о продавце
     */
    async extractSeller(page, sellerConfig) {
        if (!sellerConfig) return { sellerName: "Неизвестен", sellerType: "Unknown" };

        const result = { sellerName: "Неизвестен", sellerType: "Unknown" };

        for (const [field, selector] of Object.entries(sellerConfig)) {
            if (selector) {
                result[field] = await this.safeEval(page, selector, el => el.textContent.trim()) || result[field];
            }
        }

        return result;
    }

    /**
     * Извлечение контактной информации
     */
    async extractContact(page, contactConfig) {
        if (!contactConfig) return { phone: "Не указан" };

        const result = { phone: "Не указан" };

        for (const [field, selector] of Object.entries(contactConfig)) {
            if (selector) {
                result[field] = await this.safeEval(page, selector, el => el.textContent.trim()) || result[field];
            }
        }

        return result;
    }

    /**
     * Применение маппинга данных
     */
    applyDataMapping(rawData) {
        const { dataMapping } = this.parsingConfig;
        
        if (!dataMapping || Object.keys(dataMapping).length === 0) {
            return rawData;
        }

        const mappedData = { ...rawData };

        for (const [targetField, sourceField] of Object.entries(dataMapping)) {
            if (rawData[sourceField] !== undefined) {
                mappedData[targetField] = rawData[sourceField];
            }
        }

        return mappedData;
    }

    /**
     * Валидация данных на основе конфигурации
     */
    validateData(data) {
        const { validation } = this.parsingConfig;
        
        if (!validation) {
            return super.validateData(data);
        }

        // Проверяем обязательные поля
        if (validation.required) {
            for (const field of validation.required) {
                if (!data[field] || data[field] === "Неизвестно") {
                    return false;
                }
            }
        }

        // Проверяем минимальную цену
        if (validation.minPrice && data.price && data.price.raw < validation.minPrice) {
            return false;
        }

        return true;
    }
}

module.exports = { ConfigParser };
