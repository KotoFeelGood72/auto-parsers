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
                        timeout: this.config.timeout 
                    });

                    // Ждём основной список объявлений
                    const listingsSelector = this.parsingConfig.selectors.listings?.container;
                    if (listingsSelector) {
                        console.log(`🔍 Ждем селектор: ${listingsSelector}`);
                        await page.waitForSelector(listingsSelector, { timeout: 30000 });
                        // Даем странице немного времени дорендерить элементы
                        await new Promise(r => setTimeout(r, 500));
                    }

                    // Получаем ссылки на объявления
                    const carLinks = await this.extractListings(page);
                    console.log(`🔍 Найдено ссылок: ${carLinks.length}`);

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
            return await page.$$eval(container, (elements, params) => {
                const { linkSelector, baseUrl } = params;
                return elements
                    .map(el => {
                        const linkEl = el.querySelector(linkSelector);
                        if (!linkEl) return null;
                        
                        const href = linkEl.getAttribute("href");
                        if (!href) return null;
                        
                        // Если ссылка относительная, делаем её абсолютной
                        if (href.startsWith('/')) {
                            return baseUrl + href;
                        } else if (href.startsWith('http')) {
                            return href;
                        } else {
                            return baseUrl + '/' + href;
                        }
                    })
                    .filter(href => href);
            }, { linkSelector: link, baseUrl: this.parsingConfig.baseUrl });
        } catch (error) {
            console.warn("⚠️ Ошибка при извлечении списка объявлений:", error.message);
            return [];
        }
    }

    /**
     * Извлечение данных объявления со страницы
     */
    async extractListingData(page, url) {
        const { selectors, fieldMapping } = this.parsingConfig;
        const details = selectors.details || {};

        // Инициализируем данные с фиксированными полями базы данных
        const rawData = {
            short_url: url,
            title: "Неизвестно",
            make: "Неизвестно",
            model: "Неизвестно", 
            year: "Неизвестно",
            body_type: "Неизвестно",
            horsepower: "Неизвестно",
            fuel_type: "Неизвестно",
            motors_trim: "Неизвестно",
            kilometers: 0,
            price_formatted: "0",
            price_raw: 0,
            exterior_color: "Неизвестно",
            location: "Неизвестно",
            phone: "Не указан",
            seller_name: "Неизвестен",
            seller_type: "Неизвестен",
            seller_logo: null,
            seller_profile_link: null,
            photos: []
        };

        // Парсим все поля из конфигурации
        for (const [field, selector] of Object.entries(details)) {
            if (field === 'photos') {
                // Специальная обработка для фотографий
                rawData[field] = await this.extractPhotos(page, selector);
            } else if (field === 'price') {
                // Специальная обработка для цены - разделяем на formatted и raw
                const priceValue = await this.extractPrice(page, selector);
                rawData.price_formatted = priceValue;
                
                // Извлекаем числовое значение цены
                const priceMatch = priceValue.match(/(\d+[\d,]*)/);
                if (priceMatch) {
                    rawData.price_raw = parseFloat(priceMatch[1].replace(/,/g, ''));
                } else {
                    rawData.price_raw = 0;
                }
            } else if (field === 'specs' && selector && typeof selector === 'object') {
                // Специальная обработка для specs - извлекаем значения характеристик
                console.log("🔍 Обрабатываем specs:", Object.keys(selector));
                for (const [specField, specConfig] of Object.entries(selector)) {
                    if (typeof specConfig === 'string') {
                        // Простая строка - ищем по лейблу в списке спецификаций
                        rawData[specField] = await this.extractSpecByLabel(page, specConfig);
                    } else if (typeof specConfig === 'object') {
                        // Объект с селектором - проверяем есть ли label для extractSpecByLabel
                        if (specConfig.label) {
                            console.log(`🔍 Извлекаем ${specField} по лейблу "${specConfig.label}"`);
                            rawData[specField] = await this.extractSpecByLabel(page, specConfig.label, specConfig.selector);
                        } else {
                            // Используем универсальный извлекатель
                            rawData[specField] = await this.extractField(page, specConfig);
                        }
                        
                        // Специальная обработка для числовых полей
                        if (specConfig.type === 'number' && rawData[specField]) {
                            const numValue = parseFloat(String(rawData[specField]).replace(/[^\d.,-]/g, '').replace(/,/g, ''));
                            if (!isNaN(numValue)) {
                                rawData[specField] = numValue;
                            }
                        }
                        
                        console.log(`✅ ${specField}: ${rawData[specField]}`);
                    }
                }
            } else if (field === 'kilometers') {
                // Специальная обработка для пробега (число)
                const kmValue = await this.extractField(page, selector);
                if (kmValue && !isNaN(parseFloat(kmValue))) {
                    rawData[field] = parseInt(kmValue) || 0;
                }
            } else if (field === 'horsepower') {
                // Специальная обработка для мощности (число)
                const hpValue = await this.extractField(page, selector);
                if (hpValue && !isNaN(parseFloat(hpValue))) {
                    rawData[field] = parseInt(hpValue) || "Неизвестно";
                } else {
                    rawData[field] = hpValue || "Неизвестно";
                }
            } else {
                // Обычные поля с расширенной поддержкой селекторов
                const value = await this.extractField(page, selector);
                if (value !== null && value !== undefined) {
                    rawData[field] = value;
                }
            }
        }

        // Применяем маппинг полей если он настроен
        if (fieldMapping) {
            return this.applyFieldMapping(rawData, fieldMapping);
        }

        return rawData;
    }

    /**
     * Универсальный извлекатель строки по селектору
     */
    async extractString(page, selector, options = {}) {
        const {
            attr = null, // null означает textContent
            index = 0,
            fallback = null,
            regex = null
        } = options;

        if (!selector) {
            return fallback;
        }

        try {
            const result = await page.$$eval(selector, (elements, params) => {
                const { attr, index, regex } = params;
                
                if (!elements || elements.length === 0) {
                    return null;
                }

                const element = elements[index] || elements[0];
                if (!element) {
                    return null;
                }

                // Извлекаем значение
                let value = attr ? 
                    (element.getAttribute(attr) || '') : 
                    (element.textContent || '');

                value = value.trim();

                // Применяем регулярное выражение если указано
                if (regex && value) {
                    const match = value.match(regex);
                    if (match) {
                        value = match[1] || match[0];
                    }
                }

                return value || null;
            }, { attr, index, regex });

            return result || fallback;
        } catch (error) {
            console.warn(`⚠️ Ошибка при извлечении строки по селектору "${selector}":`, error.message);
            return fallback;
        }
    }

    /**
     * Универсальный извлекатель поля
     */
    async extractField(page, spec) {
        // Фоллбэки: массив спецификаций
        if (Array.isArray(spec)) {
            for (const s of spec) {
                const val = await this.extractField(page, s);
                if (val !== null && val !== undefined && String(val).trim() !== '') return val;
            }
            return null;
        }

        // Простой селектор строки
        if (typeof spec === 'string') {
            return await this.extractString(page, spec);
        }

        // Объектная форма
        if (spec && typeof spec === 'object') {
            const selector = spec.selector || spec.sel;
            const attr = spec.attr;
            const index = Number.isInteger(spec.index) ? spec.index : 0;
            const type = spec.type;
            const regex = spec.regex ? new RegExp(spec.regex, spec.regexFlags || 'g') : null;
            const fallback = spec.fallback;
            const transform = spec.transform;

            if (!selector) return fallback || null;

            // Для простых случаев используем extractString
            if (type !== 'html' && !transform) {
                const value = await this.extractString(page, selector, {
                    attr,
                    index,
                    regex,
                    fallback
                });
                
                if (type === 'number' && value) {
                    const n = parseFloat(String(value).replace(/[^\d.,-]/g, '').replace(/,/g, ''));
                    return Number.isFinite(n) ? n : (fallback || null);
                }
                
                return value;
            }

            // Для сложных случаев используем старую логику
            try {
                const value = await page.$$eval(selector, (els, params) => {
                    const { attr, index, regex } = params;
                    const getVal = el => {
                        let v = attr ? (el.getAttribute(attr) || '') : (el.textContent || '');
                        v = v.trim();
                        if (regex) {
                            const m = v.match(regex);
                            if (m && m.length > 0) {
                                v = m[1] || m[0];
                            }
                        }
                        return v;
                    };

                    if (!els || els.length === 0) return null;
                    if (Number.isInteger(index)) {
                        const el = els[index];
                        return el ? getVal(el) : null;
                    }
                    // берем первый непустой
                    for (const el of els) {
                        const v = getVal(el);
                        if (v) return v;
                    }
                    return null;
                }, { attr, index, regex: spec.regex ? spec.regex : null, regexFlags: spec.regexFlags });

                if (value == null) return fallback || null;

                let result = value;

                if (type === 'number') {
                    const n = parseFloat(String(value).replace(/[^\d.,-]/g, '').replace(/,/g, ''));
                    result = Number.isFinite(n) ? n : (fallback || null);
                } else if (type === 'html') {
                    try {
                        result = await page.$eval(selector, el => el.innerHTML);
                    } catch (_) {
                        result = fallback || null;
                    }
                }

                // Применяем трансформацию если есть
                if (transform && typeof transform === 'function') {
                    try {
                        result = transform(result);
                    } catch (_) {
                        result = fallback || null;
                    }
                }

                return result;
            } catch (_) {
                return fallback || null;
            }
        }

        return null;
    }

    /**
     * Извлечение значения характеристики по тексту лейбла
     */
    async extractSpecByLabel(page, labelText, customSelector = null) {
        try {
            const selectors = customSelector 
                ? [customSelector]
                : [
                    '#specifications-container ul li',
                    '#item-specifications ul li',
                    '.specifications ul li',
                    '.specs ul li',
                    '.faq_data li',
                    '.spec-list li',
                    'ul li',
                    'li'
                ];

            console.log(`🔍 Ищем "${labelText}" в селекторах:`, selectors);

            for (const selector of selectors) {
                try {
                    const result = await page.$$eval(selector, (items, label) => {
                        const searchLabel = String(label).toLowerCase();
                        
                        const item = items.find(el => {
                            const text = (el.innerText || '').toLowerCase();
                            return text.includes(searchLabel);
                        });
                        
                        if (!item) return null;
                        
                        const text = item.innerText || '';
                        const colonIndex = text.indexOf(':');
                        if (colonIndex > -1) {
                            return text.substring(colonIndex + 1).trim();
                        }
                        
                        const spans = Array.from(item.querySelectorAll('span'));
                        if (spans.length > 1) {
                            const valueEl = spans[spans.length - 1];
                            return valueEl ? valueEl.textContent.trim() : null;
                        }
                        
                        const divs = Array.from(item.querySelectorAll('div'));
                        if (divs.length > 1) {
                            const valueEl = divs[divs.length - 1];
                            return valueEl ? valueEl.textContent.trim() : null;
                        }
                        
                        return text.trim();
                    }, labelText);
                    
                    if (result && result.trim() !== '') {
                        console.log(`✅ Найдено значение для "${labelText}": "${result}"`);
                        return result;
                    }
                } catch (error) {
                    console.log(`❌ Ошибка с селектором ${selector}:`, error.message);
                    continue;
                }
            }
            
            console.log(`❌ Лейбл "${labelText}" не найден ни в одном селекторе`);
            return null;
        } catch (error) {
            console.log(`❌ Ошибка в extractSpecByLabel:`, error.message);
            return null;
        }
    }

    /**
     * Извлечение фотографий
     */
    async extractPhotos(page, photoConfig) {
        if (!photoConfig || !photoConfig.selector) return [];

        try {
            return await page.$$eval(photoConfig.selector, (imgs, params) => {
                const { attr } = params;
                return imgs.map(img => {
                    const src = attr ? img.getAttribute(attr) : img.src;
                    return src && src.startsWith('//') ? 'https:' + src : src;
                }).filter(src => src);
            }, { attr: photoConfig.attr });
        } catch (error) {
            console.warn("⚠️ Ошибка при извлечении фотографий:", error.message);
            return [];
        }
    }

    /**
     * Извлечение цены как простого поля
     */
    async extractPrice(page, priceConfig) {
        if (!priceConfig) return "0";

        console.log("🔍 Извлекаем цену с конфигурацией:", priceConfig);

        // Если это массив селекторов, пробуем каждый по очереди
        if (Array.isArray(priceConfig)) {
            for (const selector of priceConfig) {
                try {
                    console.log(`🔍 Пробуем селектор: ${selector}`);
                    const priceValue = await this.extractString(page, selector);
                    if (priceValue && priceValue.trim() !== "" && priceValue !== "0") {
                        console.log(`✅ Найдена цена: ${priceValue}`);
                        return priceValue.trim();
                    }
                } catch (error) {
                    console.log(`❌ Ошибка с селектором ${selector}:`, error.message);
                }
            }
        } else if (typeof priceConfig === 'object' && priceConfig.selector) {
            // Объектная конфигурация с селектором
            try {
                console.log(`🔍 Пробуем селектор из объекта: ${priceConfig.selector}`);
                const priceValue = await this.extractString(page, priceConfig.selector);
                if (priceValue && priceValue.trim() !== "" && priceValue !== "0") {
                    console.log(`✅ Найдена цена: ${priceValue}`);
                    return priceValue.trim();
                }
            } catch (error) {
                console.log(`❌ Ошибка с селектором ${priceConfig.selector}:`, error.message);
            }
        } else if (typeof priceConfig === 'string') {
            // Одиночный селектор
            try {
                console.log(`🔍 Пробуем селектор: ${priceConfig}`);
                const priceValue = await this.extractString(page, priceConfig);
                if (priceValue && priceValue.trim() !== "" && priceValue !== "0") {
                    console.log(`✅ Найдена цена: ${priceValue}`);
                    return priceValue.trim();
                }
            } catch (error) {
                console.log(`❌ Ошибка с селектором ${priceConfig}:`, error.message);
            }
        }

        // Отладочная информация для цены
        console.log("🔍 Отладка цены - ищем элементы на странице:");
        try {
            const allElements = await page.$$eval('*', elements => elements.length);
            console.log(`📊 Всего элементов на странице: ${allElements}`);
            
            const priceElements = await page.$$eval('*', elements => {
                return elements
                    .filter(el => {
                        const text = el.textContent || '';
                        const hasPrice = /(USD|AED|\$|€|£)\s*[\d,]+|[\d,]+.*(USD|AED|\$|€|£)/i.test(text);
                        return hasPrice && text.length < 200 && text.length > 3;
                    })
                    .map(el => ({
                        tag: el.tagName,
                        class: el.className,
                        id: el.id,
                        text: el.textContent.trim().substring(0, 100)
                    }))
                    .slice(0, 15);
            });
            console.log("Найденные элементы с ценой:", priceElements);
            
            if (priceElements && priceElements.length > 0) {
                for (const element of priceElements) {
                    const priceMatch = element.text.match(/(\d+[\d,]*)\s*(USD|AED|\$|€|£)/i);
                    if (priceMatch) {
                        console.log(`✅ Найдена цена в тексте: ${priceMatch[0]}`);
                        return priceMatch[0].trim();
                    }
                }
            }
            
            const numberElements = await page.$$eval('*', elements => {
                return elements
                    .filter(el => {
                        const text = el.textContent || '';
                        const hasNumbers = /\d+[\d,]*/.test(text);
                        return hasNumbers && text.length < 100 && text.length > 2;
                    })
                    .map(el => ({
                        tag: el.tagName,
                        class: el.className,
                        id: el.id,
                        text: el.textContent.trim().substring(0, 50)
                    }))
                    .slice(0, 10);
            });
            console.log("Элементы с цифрами:", numberElements);
            
            if (numberElements && numberElements.length > 0) {
                console.log("🔍 Ищем большие числа как возможные цены...");
                for (const element of numberElements) {
                    const numbers = element.text.match(/\d+[\d,]*/g);
                    if (numbers) {
                        for (const num of numbers) {
                            const numValue = parseInt(num.replace(/,/g, ''));
                            if (numValue > 1000) {
                                console.log(`🔍 Найдено большое число: ${num} в элементе ${element.tag}.${element.class}`);
                                const currencyMatch = element.text.match(/(USD|AED|\$|€|£)/i);
                                if (currencyMatch) {
                                    console.log(`✅ Найдена цена: ${num} ${currencyMatch[1]}`);
                                    return `${num} ${currencyMatch[1]}`;
                                } else {
                                    console.log(`🔍 Найдено число без валюты: ${num}`);
                                    return num;
                                }
                            }
                        }
                    }
                }
            }
            
            let selectors = [];
            if (Array.isArray(priceConfig)) {
                selectors = priceConfig;
            } else if (typeof priceConfig === 'object' && priceConfig.selector) {
                selectors = [priceConfig.selector];
            } else if (typeof priceConfig === 'string') {
                selectors = [priceConfig];
            }
            
            for (const selector of selectors) {
                try {
                    const found = await page.$(selector);
                    if (found) {
                        const text = await found.textContent();
                        console.log(`✅ Найден элемент ${selector}: "${text}"`);
                    } else {
                        console.log(`❌ Элемент ${selector} не найден`);
                    }
                } catch (e) {
                    console.log(`❌ Ошибка с селектором ${selector}:`, e.message);
                }
            }
        } catch (e) {
            console.log("Ошибка при отладке цены:", e.message);
        }

        // Последняя попытка - поиск по всему тексту страницы
        try {
            console.log("🔍 Последняя попытка - поиск цены по всему тексту страницы...");
            const pageText = await page.textContent('body');
            const priceMatches = pageText.match(/(\d+[\d,]*)\s*(USD|AED|\$|€|£)/gi);
            if (priceMatches && priceMatches.length > 0) {
                console.log(`✅ Найдены цены в тексте страницы:`, priceMatches);
                return priceMatches[0].trim();
            }
            
            const numberMatches = pageText.match(/\d+[\d,]*/g);
            if (numberMatches) {
                for (const num of numberMatches) {
                    const numValue = parseInt(num.replace(/,/g, ''));
                    if (numValue > 1000 && numValue < 10000000) {
                        console.log(`✅ Найдено число как возможная цена: ${num}`);
                        return num;
                    }
                }
            }
        } catch (e) {
            console.log("Ошибка при поиске цены в тексте:", e.message);
        }

        return "0";
    }

    /**
     * Применение маппинга полей
     */
    applyFieldMapping(rawData, fieldMapping) {
        if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
            return rawData;
        }

        const mappedData = { ...rawData };

        for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
            if (rawData[sourceField] !== undefined) {
                mappedData[targetField] = rawData[sourceField];
            }
        }

        return mappedData;
    }

    /**
     * Применение маппинга данных (для обратной совместимости)
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
        if (validation.minPrice && data.price_raw && data.price_raw < validation.minPrice) {
            return false;
        }

        return true;
    }
}

module.exports = { ConfigParser };
