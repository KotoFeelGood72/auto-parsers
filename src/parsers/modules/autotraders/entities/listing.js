/**
 * Парсинг списка объявлений для Autotraders.com
 */

class AutotradersListingParser {
    constructor(config) {
        this.config = config;
        
        // Основные селекторы для Autotraders.ae
        this.listingSelector = '.row.cars-cont';
        this.listingStemSelector = '.row.cars-cont a';
        
        // Селекторы для скролла
        this.scrollContainers = [
            'main',
            '.container',
            "body"
        ];
    }

    /**
     * Получение списка объявлений
     */
    async* getListings(context) {
        let attempt = 0;
        let currentPage = 1;

        while (attempt < this.config.maxRetries) {
            const page = await context.newPage();

            try {
                console.log("🔍 Открываем каталог Autotraders...");

                while (true) {
                    // AutoTraders использует параметры в URL для пагинации
                    const url = currentPage === 1 
                        ? this.config.listingsUrl 
                        : `${this.config.listingsUrl}?page=${currentPage}&limit=20`;
                    console.log(`📄 Загружаем страницу: ${url}`);

                    await page.goto(url, { 
                        waitUntil: "domcontentloaded", 
                        timeout: 60000 
                    });

                    // Ждем загрузки страницы
                    await page.waitForTimeout(3000);

                    // Скроллим страницу для подгрузки всех карточек
                    await this.autoScroll(page);
                    await page.waitForTimeout(2000);

                    // Ищем объявления с основным селектором
                    let carLinks = [];
                    
                    try {
                        // Извлекаем ссылки на объявления - берем первую ссылку из каждого блока cars-cont
                        carLinks = await page.evaluate(() => {
                            const listings = Array.from(document.querySelectorAll('.row.cars-cont'));
                            const links = [];
                            const uniqueLinks = new Set();
                            
                            for (const listing of listings) {
                                // Ищем первую ссылку, которая ведет на детальную страницу автомобиля
                                const anchor = listing.querySelector('a[href*="/used-cars/"]');
                                if (anchor && anchor.href && !uniqueLinks.has(anchor.href)) {
                                    uniqueLinks.add(anchor.href);
                                    links.push(anchor.href);
                                }
                            }
                            
                            return links;
                        });
                        
                        if (carLinks.length > 0) {
                            console.log(`✅ Найдено ${carLinks.length} объявлений`);
                        }
                    } catch (error) {
                        console.log("⚠️ Ошибка при поиске объявлений:", error.message);
                    }

                    if (carLinks.length === 0) {
                        console.warn(`⚠️ На странице ${currentPage} не найдено объявлений`);
                        
                        // Проверяем, есть ли вообще контент на странице
                        const pageContent = await page.evaluate(() => document.body.textContent);
                        if (pageContent.length < 1000) {
                            console.warn(`⚠️ Страница ${currentPage} выглядит пустой, возможно сайт недоступен`);
                            break;
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
                console.error(`❌ Ошибка при парсинге страницы ${currentPage}:`, error);
                attempt++;
                
                if (attempt >= this.config.maxRetries) {
                    throw error;
                }
                
                console.log(`🔄 Повторная попытка ${attempt}/${this.config.maxRetries}...`);
                await this.sleep(this.config.retryDelay);
            } finally {
                await page.close();
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

module.exports = { AutotradersListingParser };
