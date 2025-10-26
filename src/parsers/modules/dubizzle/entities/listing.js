/**
 * Парсинг списка объявлений для Dubizzle.com
 */

class DubizzleListingParser {
    constructor(config) {
        this.config = config;
        
        // Основные селекторы для Dubizzle
        // Сам элемент с data-testid ЯВЛЯЕТСЯ ссылкой <a>
        this.listingSelector = '#listings-top a[data-testid^="listing-"]';
        
        // Селекторы для скролла
        this.scrollContainers = [
            'main',
            '[data-testid="search-results"]',
            "body"
        ];
    }

    /**
     * Получение списка объявлений
     */
    async* getListings(context) {
        let attempt = 0;
        let currentPage = 1; // Начинаем с page=1, page=0 не существует

        while (attempt < this.config.maxRetries) {
            let page = null;

            try {
                page = await context.newPage();
                console.log("🔍 Открываем каталог Dubizzle...");

                while (true) {
                    // URL с параметром page, начиная с 0
                    const url = `${this.config.listingsUrl}?page=${currentPage}`;
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: 90000 
                    });

                    // Ждем загрузки данных
                    await page.waitForTimeout(5000);

                    // Извлекаем ссылки используя правильные селекторы
                    let carLinks = [];
                    
                    try {
                        // Ждем появления контейнера с листингами
                        await page.waitForSelector('#listings-top', { timeout: 30000 });
                        
                        // Извлекаем ссылки - элементы с data-testid сами являются ссылками
                        carLinks = await page.$$eval(
                            this.listingSelector,
                            (anchors) => anchors.map((a) => a.href).filter(Boolean)
                        );
                        
                        if (carLinks.length > 0) {
                            console.log(`✅ Найдено ${carLinks.length} объявлений`);
                        } else {
                            // Debug: проверяем что есть на странице
                            const debug = await page.evaluate(() => {
                                const container = document.querySelector('#listings-top');
                                const listings = container ? container.querySelectorAll('[data-testid^="listing-"]') : [];
                                const count = listings.length;
                                let linksInFirst = 0;
                                if (listings.length > 0) {
                                    const firstListing = listings[0];
                                    linksInFirst = firstListing.querySelectorAll('a').length;
                                }
                                return { 
                                    hasContainer: !!container, 
                                    listingsCount: count,
                                    linksInFirstListing: linksInFirst
                                };
                            });
                            console.log(`⚠️ Debug: ${JSON.stringify(debug)}`);
                        }
                    } catch (error) {
                        console.log("⚠️ Ошибка при поиске объявлений:", error.message);
                    }

                    if (carLinks.length === 0) {
                        console.warn(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        
                        // Проверяем, есть ли вообще контент на странице
                        const pageContent = await page.evaluate(() => document.body.textContent);
                        if (pageContent.length < 1000) {
                            console.warn(`⚠️ Страница ${currentPage} выглядит пустой, может быть нет страниц после этого`);
                            break;
                        }
                        
                        // Если страница не пустая, но объявления не найдены, попробуем следующую страницу
                        console.log(`🔄 Переходим к странице ${currentPage + 1}...`);
                        currentPage++;
                        
                        // Ограничим количество страниц
                        if (currentPage >= 50) {
                            console.log("⚠️ Достигнут лимит страниц (50)");
                            break;
                        }
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

                    // Сначала возвращаем все ссылки
                    for (const link of carLinks) {
                        yield link;
                    }
                    
                    currentPage++;
                    
                    // Ограничим количество страниц
                    if (currentPage >= 50) {
                        console.log("⚠️ Достигнут лимит страниц (50)");
                        break;
                    }
                }

                // Закрываем страницу после завершения парсинга
                if (page) {
                    await page.close();
                    page = null;
                }
                break; // Успешно завершили парсинг
            } catch (error) {
                console.error(`❌ Ошибка при парсинге страницы ${currentPage}:`, error);
                
                // Закрываем страницу при ошибке
                if (page) {
                    await page.close();
                    page = null;
                }
                
                attempt++;
                
                if (attempt >= this.config.maxRetries) {
                    throw error;
                }
                
                console.log(`🔄 Повторная попытка ${attempt}/${this.config.maxRetries}...`);
                await this.sleep(this.config.retryDelay || 5000);
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
                    scrollElement.scrollBy(0, 300);

                    const currentHeight = scrollElement.scrollHeight;
                    if (currentHeight !== lastScrollHeight) {
                        attemptsWithoutChange = 0;
                        lastScrollHeight = currentHeight;
                    } else {
                        attemptsWithoutChange++;
                    }

                    // остановка после 3 "пустых" скроллов
                    if (attemptsWithoutChange >= 3) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 400);
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

module.exports = { DubizzleListingParser };
