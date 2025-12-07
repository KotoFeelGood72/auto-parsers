/**
 * Парсинг списка объявлений для Dubicars.com
 */

class DubicarsListingParser {
    constructor(config) {
        this.config = config;
        
        // Основные селекторы для Dubicars
        this.listingSelector = 'section#serp-list li.serp-list-item a.image-container';
        
        // Селекторы для скролла
        this.scrollContainers = [
            'section#serp-list',
            'main',
            'body'
        ];
    }

    /**
     * Создание новой страницы с настройками
     */
    async createPage(context) {
        const page = await context.newPage();
        
        // Настройка заголовков
        await page.setExtraHTTPHeaders({
            "User-Agent": this.config.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        });

        // Оптимизация: блокируем все ненужные ресурсы для ускорения
        await page.route('**/*', (route) => {
            const resourceType = route.request().resourceType();
            const url = route.request().url();
            
            // Блокируем изображения
            if (resourceType === 'image' && !this.config.enableImageLoading) {
                route.abort();
                return;
            }
            
            // Блокируем ненужные ресурсы
            if (resourceType === 'stylesheet' || 
                resourceType === 'font' ||
                resourceType === 'media' ||
                resourceType === 'websocket' ||
                url.includes('analytics') ||
                url.includes('tracking') ||
                url.includes('advertisement')) {
                route.abort();
                return;
            }
            
            route.continue();
        });

        return page;
    }

    /**
     * Получение списка объявлений
     */
    async* getListings(context) {
        let attempt = 0;
        let currentPage = 1;
        const maxPages = 1000; // Защита от бесконечного цикла
        const timeout = this.config.timeout || 60000; // Используем timeout из конфигурации

        while (attempt < this.config.maxRetries) {
            const page = await this.createPage(context);

            try {
                console.log("🔍 Открываем каталог Dubicars...");

                while (currentPage <= maxPages) {
                    const url = this.config.listingsUrl.replace('{page}', currentPage);
                    console.log(`📄 Загружаем страницу ${currentPage}: ${url}`);

                    try {
                        await page.goto(url, { 
                            waitUntil: "domcontentloaded", 
                            timeout: timeout 
                        });
                    } catch (navigationError) {
                        // Обработка ошибок загрузки страницы
                        if (navigationError.name === 'TimeoutError') {
                            console.warn(`⏱️ Таймаут загрузки страницы ${currentPage} (${timeout}ms), пропускаем и переходим к следующей...`);
                            currentPage++;
                            continue;
                        }
                        // Для других ошибок навигации также пропускаем страницу
                        console.warn(`⚠️ Ошибка загрузки страницы ${currentPage}: ${navigationError.message}, пропускаем...`);
                        currentPage++;
                        continue;
                    }

                    // Ждём основной список машин с обработкой таймаута
                    try {
                        await page.waitForSelector(this.listingSelector, { timeout: 15000 });
                    } catch (selectorError) {
                        if (selectorError.name === 'TimeoutError') {
                            console.warn(`⏱️ Селектор не найден на странице ${currentPage}, пропускаем...`);
                            currentPage++;
                            continue;
                        }
                        throw selectorError;
                    }

                    // Скроллим страницу для подгрузки всех карточек
                    await this.autoScroll(page);
                    await page.waitForTimeout(500); // Уменьшаем задержку

                    // Ищем объявления с основным селектором
                    let carLinks = [];
                    
                    try {
                        carLinks = await page.$$eval(
                            this.listingSelector,
                            (elements, baseUrl) =>
                                elements
                                    .map((el) => el.getAttribute("href"))
                                    .filter((href) => href && href.startsWith(baseUrl)),
                            this.config.baseUrl
                        );
                        
                        if (carLinks.length > 0) {
                            console.log(`✅ Найдено ${carLinks.length} объявлений с основным селектором`);
                        }
                    } catch (error) {
                        console.log("⚠️ Ошибка при поиске объявлений:", error.message);
                    }

                    if (carLinks.length === 0) {
                        console.warn(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        
                        // Проверяем, есть ли вообще контент на странице
                        try {
                            const pageContent = await page.evaluate(() => document.body.textContent);
                            if (pageContent && pageContent.length < 1000) {
                                console.warn(`⚠️ Страница ${currentPage} выглядит пустой, возможно сайт недоступен`);
                                break;
                            }
                        } catch (evalError) {
                            console.warn(`⚠️ Не удалось проверить контент страницы ${currentPage}, пропускаем...`);
                        }
                        
                        // Если страница не пустая, но объявления не найдены, попробуем следующую страницу
                        console.log(`🔄 Переходим к странице ${currentPage + 1}...`);
                        currentPage++;
                        continue;
                    }

                    console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);
                    
                    // Логируем первые несколько ссылок для отладки
                    if (carLinks.length > 0) {
                        console.log(`🔗 Первые 3 ссылки на странице ${currentPage}:`);
                        carLinks.slice(0, 3).forEach((link, index) => {
                            console.log(`   ${index + 1}. ${link}`);
                        });
                    }

                    for (const link of carLinks) {
                        yield link;
                    }
                    currentPage++;
                }

                break; // Успешно завершили парсинг
            } catch (error) {
                console.error(`❌ Критическая ошибка при парсинге страницы ${currentPage}:`, error);
                attempt++;
                
                if (attempt >= this.config.maxRetries) {
                    console.error(`❌ Достигнут лимит повторных попыток (${this.config.maxRetries}), прекращаем парсинг`);
                    throw error;
                }
                
                console.log(`🔄 Повторная попытка ${attempt}/${this.config.maxRetries}...`);
                await this.sleep(this.config.retryDelay || 5000);
            } finally {
                try {
                    await page.close();
                } catch (closeError) {
                    console.warn(`⚠️ Ошибка при закрытии страницы: ${closeError.message}`);
                }
            }
        }
    }

    /**
     * Автоматический скролл для подгрузки контента
     */
    async autoScroll(page) {
        await page.evaluate(async (scrollContainers) => {
            const container = scrollContainers.find(c => document.querySelector(c) !== null);
            if (!container) return;

            const scrollElement = document.querySelector(container);
            if (!scrollElement) return;

            await new Promise((resolve) => {
                let lastScrollHeight = 0;
                let attemptsWithoutChange = 0;

                const interval = setInterval(() => {
                    scrollElement.scrollBy(0, 500); // Увеличили шаг скролла

                    const currentHeight = scrollElement.scrollHeight;
                    if (currentHeight !== lastScrollHeight) {
                        attemptsWithoutChange = 0;
                        lastScrollHeight = currentHeight;
                    } else {
                        attemptsWithoutChange++;
                    }

                    // остановка после 2 "пустых" скроллов (быстрее)
                    if (attemptsWithoutChange >= 2) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 200); // Уменьшили интервал
            });
        }, this.scrollContainers);
    }

    /**
     * Утилита для паузы
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { DubicarsListingParser };
