/**
 * Парсинг детальной информации для Carswitch.com
 */

class CarswitchDetailParser {
    constructor(config) {
        this.config = config;
        
        // Селекторы для детальной страницы
        this.selectors = {
            // Селекторы для кнопок открытия модального окна
            modalButtons: [
                '.font-bold.rtl\\:-ml-12.text-primary-500.cursor-pointer',
                '.font-bold.text-primary-500.cursor-pointer',
                '.text-primary-500.cursor-pointer',
                '.font-bold.cursor-pointer',
                'button[class*="cursor-pointer"]',
                'div[class*="cursor-pointer"]',
                'span[class*="cursor-pointer"]',
                '[class*="text-primary-500"]',
                'button',
                'div[role="button"]'
            ],
            // Селекторы для модального окна
            modal: '.flex-1.px-8.py-28.sm\\:px-24.sm\\:py-24.overflow-y-auto.flex.\\!py-4.w-full.h-full',
            modalRows: '.flex.w-full.justify-between.py-3.border-b.border-gray-100',
            // Селекторы для основных данных
            title: 'h2.text-base.md\\:text-2xl.font-medium.text-label-black',
            price: '.md\\:text-2xl.text-base.font-bold.text-black',
            // Селекторы для Car Overview
            overviewContainer: '.md\\:flex.md\\:flex-row.flex-col.md\\:items-start.items-stretch.md\\:gap-1.gap-4.w-full .md\\:flex-1.bg-white.p-4',
            overviewKey: 'h3.font-medium',
            overviewValue: 'p.text-sm.text-label-black',
            // Селекторы для Car Details
            detailContainer: '.mt-2.md\\:text-base.text-sm.leading-5',
            // Селекторы для кнопки закрытия модального окна
            closeButton: '.rounded-full.w-6.h-6.flex.items-center.border.border-\\[\\#0F1B41\\].justify-center.hover\\:bg-gray-100.cursor-pointer.transition-colors',
            // Селекторы для изображений с атрибутами
            images: 'img'
        };
        
        // Атрибуты для поиска изображений
        this.imageAttributes = {
            year: ['Year', 'Год'],
            mileage: ['Mileage', 'Пробег'],
            location: ['Location', 'Локация'],
            carImage: 'Car image'
        };
        
        // Поля для извлечения данных
        this.dataFields = {
            make: ['Make', 'Марка', 'Brand', 'brand'],
            model: ['Model', 'Модель', 'Car Model', 'car model'],
            bodyType: ['Body type', 'Body Type', 'Тип кузова', 'body type', 'Body', 'body', 'Vehicle Type', 'vehicle type'],
            horsepower: ['Engine Size', 'Мощность', 'Engine', 'engine', 'Displacement', 'displacement'],
            fuelType: ['Fuel Type', 'Тип топлива', 'Fuel', 'fuel', 'Fuel type', 'fuel type', 'Gas', 'gas', 'Petrol', 'petrol'],
            motorsTrim: ['Specs', 'Комплектация', 'Spec', 'spec', 'Specification', 'specification', 'Trim', 'trim', 'Variant', 'variant'],
            exteriorColor: ['Color', 'Цвет', 'Exterior Color', 'exterior color', 'Paint', 'paint', 'Exterior', 'exterior', 'Body Color', 'body color']
        };
    }

    /**
     * Парсинг детальной страницы автомобиля
     */
    async parseCarDetails(url, context) {
        const page = await context.newPage();

        try {
            console.log(`🚗 Переходим к ${url}`);
            
            await page.setExtraHTTPHeaders({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            });

            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: 15000
            });

            console.log("📄 Загружаем данные...");

            // Кликаем на кнопку для открытия модального окна с детальными параметрами
            try {
                let detailsButton = null;
                for (const selector of this.selectors.modalButtons) {
                    detailsButton = await page.$(selector);
                    if (detailsButton) {
                        console.log("🔍 Кнопка найдена с селектором:", selector);
                        break;
                    }
                }
                
                if (detailsButton) {
                    console.log("🔍 Открываем модальное окно с детальными параметрами...");
                    await detailsButton.click();
                    await page.waitForTimeout(3000); // Увеличиваем время ожидания
                    
                    // Проверяем, открылось ли модальное окно
                    const modal = await page.$(this.selectors.modal);
                    console.log("🔍 Модальное окно открыто:", !!modal);
                } else {
                    console.log("⚠️ Кнопка для открытия модального окна не найдена ни с одним селектором");
                    
                    // Попробуем найти все элементы с cursor-pointer
                    const allClickableElements = await page.$$eval('[class*="cursor-pointer"]', elements => 
                        elements.map(el => ({
                            tagName: el.tagName,
                            className: el.className,
                            textContent: el.textContent?.trim().substring(0, 50)
                        }))
                    );
                    console.log("🔍 Все кликабельные элементы:", allClickableElements);
                }
            } catch (error) {
                console.log("⚠️ Не удалось открыть модальное окно:", error.message);
            }

            // Получаем сырой набор фич из Car Overview (новая структура)
            const overviewFeatures = await page.$$eval(
                this.selectors.overviewContainer,
                (items, selectors) => {
                    const map = {};
                    items.forEach(item => {
                        const key = item.querySelector(selectors.key)?.textContent.trim();
                        const val = item.querySelector(selectors.value)?.textContent.trim();
                        if (key) map[key] = val;
                    });
                    return map;
                },
                {
                    key: this.selectors.overviewKey,
                    value: this.selectors.overviewValue
                }
            );

            // Получаем сырой набор фич из Car details (новая структура)
            const detailFeatures = await page.$$eval(
                this.selectors.detailContainer,
                items => {
                    const map = {};
                    const text = items?.textContent?.trim();
                    if (text) {
                        // Парсим текст вида "First owner: No • Specs: GCC specs • More"
                        const parts = text.split('•');
                        parts.forEach(part => {
                            const [key, val] = part.split(':');
                            if (key && val) {
                                map[key.trim()] = val.trim();
                            }
                        });
                    }
                    return map;
                }
            );

            // Получаем параметры из модального окна
            const modalFeatures = await page.evaluate((selectors) => {
                const modal = document.querySelector(selectors.modal);
                console.log('Modal found:', !!modal);
                if (!modal) return {};

                const map = {};
                
                // Ищем все строки с параметрами в модальном окне
                const rows = modal.querySelectorAll(selectors.rows);
                console.log('Rows found:', rows.length);
                rows.forEach(row => {
                    const spans = row.querySelectorAll('span');
                    if (spans.length >= 2) {
                        const key = spans[0]?.textContent?.trim();
                        const value = spans[1]?.textContent?.trim();
                        console.log('Found param:', key, '=', value);
                        if (key && value) {
                            map[key] = value;
                        }
                    }
                });

                return map;
            }, {
                modal: this.selectors.modal,
                rows: this.selectors.modalRows
            });

            // Объединяем их в одну карту
            const rawFeatures = {
                ...overviewFeatures,
                ...detailFeatures,
                ...modalFeatures
            };

            // Отладочная информация
            console.log("🔍 Извлеченные параметры:", rawFeatures);
            console.log("🔍 Параметры из модального окна:", modalFeatures);

            // Извлекаем основные поля
            const title = await this.safeEval(page, this.selectors.title, el => el.textContent.trim()) || "Не указано";

            // Отладочная информация для заголовка
            console.log("🔍 Извлеченный заголовок:", title);

            // Извлекаем год - ищем span после изображения с alt="Year"
            const yearText = await page.evaluate((yearAttrs) => {
                const yearImg = Array.from(document.querySelectorAll('img')).find(img => 
                    yearAttrs.includes(img.getAttribute('alt'))
                );
                if (yearImg) {
                    const nextSpan = yearImg.parentElement?.querySelector('span');
                    return nextSpan?.textContent?.trim() || null;
                }
                return null;
            }, this.imageAttributes.year) 
            const year = yearText ? yearText.replace(/\D/g, "") : null;

            // Извлекаем пробег - ищем span после изображения с alt="Mileage"
            const kmText = await page.evaluate((mileageAttrs) => {
                const mileageImg = Array.from(document.querySelectorAll('img')).find(img => 
                    mileageAttrs.includes(img.getAttribute('alt'))
                );
                if (mileageImg) {
                    const nextSpan = mileageImg.parentElement?.querySelector('span');
                    return nextSpan?.textContent?.trim() || null;
                }
                return null;
            }, this.imageAttributes.mileage) 
            const kilometers = kmText ? kmText.replace(/\D/g, "") : "0";

            // Извлекаем цену
            const priceText = await this.safeEval(page, this.selectors.price, el => el.textContent) || "";
            const priceFormatted = priceText.replace(/[^\d,]/g, "").trim();
            const priceRaw = priceFormatted ?
                parseFloat(priceFormatted.replace(/,/g, "")) :
                null;

            // Получаем фотографии - ищем изображения с alt, начинающимся с "Car image"
            const photos = await page.evaluate((carImageAttr) => {
                const carImages = Array.from(document.querySelectorAll('img')).filter(img => 
                    img.getAttribute('alt') && img.getAttribute('alt').startsWith(carImageAttr)
                );
                
                return Array.from(
                    new Set(
                        carImages
                            .map(img => img.getAttribute("src") || img.src)
                            .map(src => src.startsWith("//") ? "https:" + src : src)
                            .filter(src => src && (src.includes("carswitch.com") || src.includes("cloudfront.net")))
                    )
                );
            }, this.imageAttributes.carImage) || [];

            // Извлекаем локацию - ищем span после изображения с alt="Location"
            const location = await page.evaluate((locationAttrs) => {
                const locationImg = Array.from(document.querySelectorAll('img')).find(img => 
                    locationAttrs.includes(img.getAttribute('alt'))
                );
                if (locationImg) {
                    const nextSpan = locationImg.parentElement?.querySelector('span');
                    return nextSpan?.textContent?.trim() || null;
                }
                return null;
            }, this.imageAttributes.location) || "Не указано";

            // Данные о продавце (пока используем значения по умолчанию, так как структура изменилась)
            const sellerName = "CarSwitch";
            const sellerType = "Дилер";
            const sellerLogo = null;
            const sellerProfileLink = null;
            const phoneNumber = "Не указан";

            // Составляем итоговый объект
            const carDetails = {
                short_url: url,
                title,
                photos,
                main_image: photos.length > 0 ? photos[0] : null,
                make: this.pick(rawFeatures, this.dataFields.make, title && title !== "Не указано" ? title.split(" ")[0] : "Не указано"),
                model: this.pick(rawFeatures, this.dataFields.model, title && title !== "Не указано" ? title.replace(/^\S+\s*/, "") : "Не указано"),
                year,
                body_type: this.pick(rawFeatures, this.dataFields.bodyType, "Не указано"),
                horsepower: this.pick(rawFeatures, this.dataFields.horsepower, null),
                fuel_type: this.pick(rawFeatures, this.dataFields.fuelType, "Не указано"),
                motors_trim: this.pick(rawFeatures, this.dataFields.motorsTrim, "Не указано"),
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
                exterior_color: this.pick(rawFeatures, this.dataFields.exteriorColor, "Не указано"),
                location,
                contact: {
                    phone: phoneNumber,
                },
            };

            // Закрываем модальное окно если оно открыто
            try {
                const closeButton = await page.$(this.selectors.closeButton);
                if (closeButton) {
                    await closeButton.click();
                    await page.waitForTimeout(500);
                }
            } catch (error) {
                // Игнорируем ошибки закрытия модального окна
            }

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
}

module.exports = { CarswitchDetailParser };
