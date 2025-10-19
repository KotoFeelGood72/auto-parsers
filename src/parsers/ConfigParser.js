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
            fieldMapping,
            dataMapping,
            ...baseConfig 
        } = config;

        super(name, baseConfig);

        // Сохраняем конфигурацию парсинга
        this.parsingConfig = {
            baseUrl: baseUrl || '',
            listingsUrl: listingsUrl || '',
            selectors: selectors || {},
            fieldMapping: config.fieldMapping || {},
            dataMapping: dataMapping || {}
        };
    }

    /**
     * Создание новой страницы
     */
    async createPage() {
        if (!this.context) {
            throw new Error('Контекст браузера не инициализирован');
        }
        return await this.context.newPage();
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
                        timeout: this.config.timeout || 60000 
                    });

                    // Ждем загрузки списка объявлений
                    const listingSelector = this.parsingConfig.selectors.listing || 'a[href*="/"]';
                    console.log(`🔍 Ждем селектор: ${listingSelector}`);
                    
                    await page.waitForSelector(listingSelector, { timeout: 10000 });

                    // Извлекаем ссылки на объявления
                    const links = await page.$$eval(listingSelector, elements => 
                        elements.map(el => el.href).filter(href => href && href.includes('/'))
                    );

                    console.log(`🔍 Найдено ссылок: ${links.length}`);

                    if (links.length === 0) {
                        console.log(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        break;
                    }

                    console.log(`✅ Найдено ${links.length} объявлений на странице ${currentPage}`);

                    // Возвращаем ссылки
                    for (const link of links) {
                        yield link;
                    }

                    currentPage++;
                    await this.delay();
                }

                break; // Успешно завершили парсинг

            } catch (error) {
                console.error(`❌ Ошибка на странице ${currentPage}:`, error.message);
                attempt++;
                
                if (attempt < this.config.maxRetries) {
                    console.log(`🔄 Повторная попытка ${attempt}/${this.config.maxRetries}...`);
                    await this.delay(5000);
                }
            } finally {
                await page.close();
            }
        }

        if (attempt >= this.config.maxRetries) {
            throw new Error(`Не удалось получить список объявлений после ${this.config.maxRetries} попыток`);
        }
    }

    /**
     * Построение URL для страницы каталога
     */
    buildListingsUrl(page) {
        const urlTemplate = this.parsingConfig.listingsUrl;
        return urlTemplate.replace('{page}', page);
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
                timeout: this.config.timeout || 60000 
            });

            console.log(`⏳ Ждем загрузку страницы...`);
            await page.waitForTimeout(2000);

            console.log(`📄 Парсим данные...`);
            const rawData = await this.extractListingData(page, url);
            
            console.log(`🛑 Страница закрыта.`);
            return rawData;

        } catch (error) {
            console.error(`❌ Ошибка при парсинге ${url}:`, error.message);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * Извлечение данных объявления
     */
    async extractListingData(page, url) {
        const rawData = {
            short_url: url,
            title: null,
            make: null,
            model: null,
            year: null,
            body_type: null,
            horsepower: null,
            fuel_type: null,
            motors_trim: null,
            kilometers: null,
            price_formatted: null,
            price_raw: null,
            exterior_color: null,
            location: null,
            phone: null,
            seller_name: null,
            seller_type: null,
            seller_logo: null,
            seller_profile_link: null,
            photos: []
        };

        const selectors = this.parsingConfig.selectors;

        // Извлекаем основные поля
        for (const [field, selector] of Object.entries(selectors)) {
            if (field === 'listing' || field === 'specs' || field === 'price') continue;
            
            try {
                const value = await this.extractField(page, selector);
                rawData[field] = value;
            } catch (error) {
                console.warn(`⚠️ Не удалось извлечь ${field}:`, error.message);
            }
        }

        // Специальная обработка цены
        if (selectors.price) {
            try {
                const priceResult = await this.extractPrice(page, selectors.price);
                rawData.price_formatted = priceResult;
                rawData.price_raw = this.parsePriceToNumber(priceResult);
            } catch (error) {
                console.warn(`⚠️ Не удалось извлечь цену:`, error.message);
            }
        }

        // Специальная обработка specs
        if (selectors.specs) {
            try {
                const specsData = await this.extractSpecs(page, selectors.specs);
                Object.assign(rawData, specsData);
            } catch (error) {
                console.warn(`⚠️ Не удалось извлечь характеристики:`, error.message);
            }
        }

        return rawData;
    }

    /**
     * Универсальное извлечение строки
     */
    async extractString(page, selector, options = {}) {
        const {
            attribute = null,
            index = 0,
            fallback = null,
            regex = null
        } = options;

        try {
            if (Array.isArray(selector)) {
                // Если селектор - массив, пробуем каждый
                for (const sel of selector) {
                    const result = await this.extractString(page, sel, options);
                    if (result) return result;
                }
                return fallback;
            }

            if (typeof selector === 'object') {
                // Если селектор - объект, используем его свойства
                const { selector: sel, attribute: attr, index: idx, fallback: fb } = selector;
                return await this.extractString(page, sel, { attribute: attr, index: idx, fallback: fb });
            }

            // Обычный селектор
            const elements = await page.$$(selector);
            if (elements.length === 0) return fallback;

            const element = elements[index] || elements[0];
            let value;

            if (attribute) {
                value = await element.getAttribute(attribute);
            } else {
                value = await element.textContent();
            }

            if (!value) return fallback;

            // Применяем regex если указан
            if (regex) {
                const match = value.match(regex);
                return match ? match[1] || match[0] : fallback;
            }

            return value.trim();

        } catch (error) {
            console.warn(`⚠️ Ошибка извлечения строки с селектором ${selector}:`, error.message);
            return fallback;
        }
    }

    /**
     * Извлечение поля
     */
    async extractField(page, spec) {
        if (typeof spec === 'string') {
            return await this.extractString(page, spec);
        }

        if (Array.isArray(spec)) {
            // Массив селекторов - пробуем каждый
            for (const selector of spec) {
                const result = await this.extractString(page, selector);
                if (result) return result;
            }
            return null;
        }

        if (typeof spec === 'object') {
            // Объект с настройками
            const { selector, attribute, index, fallback, regex } = spec;
            return await this.extractString(page, selector, { attribute, index, fallback, regex });
        }

        return null;
    }

    /**
     * Извлечение цены
     */
    async extractPrice(page, priceConfig) {
        console.log(`🔍 Извлекаем цену с конфигурацией:`, JSON.stringify(priceConfig, null, 2));

        if (Array.isArray(priceConfig)) {
            // Массив селекторов для цены
            for (const selector of priceConfig) {
                try {
                    console.log(`🔍 Пробуем селектор: ${selector}`);
                    const price = await this.extractString(page, selector);
                    if (price && price !== '0' && price !== '$0') {
                        console.log(`✅ Найдена цена: ${price}`);
                        return price;
                    }
                } catch (error) {
                    console.warn(`⚠️ Селектор ${selector} не сработал:`, error.message);
                }
            }
        } else if (typeof priceConfig === 'string') {
            // Простой селектор
            const price = await this.extractString(page, priceConfig);
            if (price && price !== '0' && price !== '$0') {
                console.log(`✅ Найдена цена: ${price}`);
                return price;
            }
        } else if (typeof priceConfig === 'object') {
            // Объект с настройками
            const { selector, attribute, fallback } = priceConfig;
            const price = await this.extractString(page, selector, { attribute, fallback });
            if (price && price !== '0' && price !== '$0') {
                console.log(`✅ Найдена цена: ${price}`);
                return price;
            }
        }

        // Если ничего не найдено, пробуем агрессивный поиск
        console.log(`🔍 Агрессивный поиск цены...`);
        
        // Ищем элементы с валютой
        const currencySelectors = [
            '[class*="price"]',
            '[class*="cost"]',
            '[class*="amount"]',
            '.price',
            '.cost',
            '.amount',
            '[data-price]'
        ];

        for (const selector of currencySelectors) {
            try {
                const elements = await page.$$(selector);
                for (const element of elements) {
                    const text = await element.textContent();
                    if (text && /[\d,]+/.test(text) && (text.includes('$') || text.includes('AED') || text.includes('USD'))) {
                        console.log(`✅ Найдена цена агрессивным поиском: ${text}`);
                        return text.trim();
                    }
                }
            } catch (error) {
                // Игнорируем ошибки
            }
        }

        // Последняя попытка - поиск по всему тексту страницы
        try {
            const pageText = await page.textContent('body');
            const priceMatch = pageText.match(/(\$[\d,]+|AED\s*[\d,]+|USD\s*[\d,]+)/);
            if (priceMatch) {
                console.log(`✅ Найдена цена в тексте страницы: ${priceMatch[0]}`);
                return priceMatch[0];
            }
        } catch (error) {
            // Игнорируем ошибки
        }

        console.log(`❌ Цена не найдена`);
        return null;
    }

    /**
     * Парсинг цены в число
     */
    parsePriceToNumber(priceString) {
        if (!priceString) return 0;
        
        // Убираем все кроме цифр и запятых
        const cleanPrice = priceString.replace(/[^\d,]/g, '');
        
        // Заменяем запятые на пустую строку (для тысяч)
        const numericPrice = cleanPrice.replace(/,/g, '');
        
        return parseInt(numericPrice) || 0;
    }

    /**
     * Извлечение характеристик
     */
    async extractSpecs(page, specsConfig) {
        console.log(`🔍 Обрабатываем specs:`, Object.keys(specsConfig));
        
        const specsData = {};

        for (const [field, config] of Object.entries(specsConfig)) {
            try {
                if (config.label) {
                    // Извлечение по лейблу
                    const value = await this.extractSpecByLabel(page, config.label, config.selector);
                    specsData[field] = config.type === 'number' ? this.parseNumber(value) : value;
                    console.log(`✅ ${field}: ${specsData[field]}`);
                } else {
                    // Обычное извлечение поля
                    const value = await this.extractField(page, config);
                    specsData[field] = config.type === 'number' ? this.parseNumber(value) : value;
                    console.log(`✅ ${field}: ${specsData[field]}`);
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось извлечь ${field}:`, error.message);
                specsData[field] = null;
            }
        }

        return specsData;
    }

    /**
     * Извлечение значения по лейблу
     */
    async extractSpecByLabel(page, labelText, customSelector = null) {
        console.log(`🔍 Извлекаем ${labelText} по лейблу`);
        
        const selectors = customSelector ? [customSelector] : [
            '#specifications-container ul li',
            '.specs ul li',
            '.specifications ul li',
            '.details ul li',
            'ul li',
            'li'
        ];

        console.log(`🔍 Ищем "${labelText}" в селекторах:`, selectors);

        for (const selector of selectors) {
            try {
                const elements = await page.$$(selector);
                
                for (const element of elements) {
                    const text = await element.textContent();
                    if (text && text.toLowerCase().includes(labelText.toLowerCase())) {
                        // Извлекаем значение после лейбла
                        const parts = text.split(':');
                        if (parts.length > 1) {
                            const value = parts[1].trim();
                            console.log(`✅ Найдено значение для "${labelText}": "${value}"`);
                            return value;
                        }
                        
                        // Альтернативный способ - ищем текст после лейбла
                        const match = text.match(new RegExp(`${labelText}[\\s:]*([^\\n]+)`, 'i'));
                        if (match) {
                            const value = match[1].trim();
                            console.log(`✅ Найдено значение для "${labelText}": "${value}"`);
                            return value;
                        }
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Ошибка в селекторе ${selector}:`, error.message);
            }
        }

        console.log(`❌ Лейбл "${labelText}" не найден ни в одном селекторе`);
        return null;
    }

    /**
     * Парсинг числа
     */
    parseNumber(value) {
        if (!value) return null;
        
        // Извлекаем только цифры
        const numericValue = value.toString().replace(/[^\d]/g, '');
        return numericValue ? parseInt(numericValue) : null;
    }

    /**
     * Применение маппинга полей
     */
    applyFieldMapping(rawData, fieldMapping) {
        const mappedData = { ...rawData };
        
        for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
            if (rawData[sourceField] !== undefined) {
                mappedData[targetField] = rawData[sourceField];
                delete mappedData[sourceField];
            }
        }
        
        return mappedData;
    }

    /**
     * Валидация данных
     */
    validateData(data) {
        return data && data.short_url && data.title;
    }

    /**
     * Нормализация данных
     */
    normalizeData(rawData) {
        // Применяем маппинг полей если есть
        const mappedData = this.parsingConfig.fieldMapping ? 
            this.applyFieldMapping(rawData, this.parsingConfig.fieldMapping) : 
            rawData;

        return {
            short_url: mappedData.short_url || null,
            title: mappedData.title || "Неизвестно",
            make: mappedData.make || "Неизвестно",
            model: mappedData.model || "Неизвестно",
            year: mappedData.year || "Неизвестно",
            body_type: mappedData.body_type || "Неизвестно",
            horsepower: mappedData.horsepower || "Неизвестно",
            fuel_type: mappedData.fuel_type || "Неизвестно",
            motors_trim: mappedData.motors_trim || "Неизвестно",
            kilometers: parseInt(mappedData.kilometers, 10) || 0,
            price_formatted: mappedData.price_formatted || "0",
            price_raw: mappedData.price_raw || 0,
            currency: mappedData.currency || "Неизвестно",
            exterior_color: mappedData.exterior_color || "Неизвестно",
            location: mappedData.location || "Неизвестно",
            phone: mappedData.phone || "Не указан",
            seller_name: mappedData.seller_name || "Неизвестен",
            seller_type: mappedData.seller_type || "Неизвестен",
            seller_logo: mappedData.seller_logo || null,
            seller_profile_link: mappedData.seller_profile_link || null,
            photos: mappedData.photos || []
        };
    }
}

module.exports = { ConfigParser };