/**
 * Парсинг списка объявлений для OpenSooq.com
 */

class OpenSooqListingParser {
    constructor(config) {
        this.config = config;
        
        // Основные селекторы для OpenSooq
        this.listingSelector = '.post-item';
        this.listingStemSelector = '.post-item a';
        
        // Селекторы для скролла
        this.scrollContainers = [
            '.posts-container',
            'main',
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
                console.log("🔍 Открываем каталог OpenSooq...");

                while (true) {
                    const url = `${this.config.listingsUrl}?page=${currentPage}`;
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
                        // Проверяем наличие контейнера с объявлениями
                        const listingContainer = await page.$(this.listingSelector);
                        if (listingContainer) {
                            carLinks = await page.$$eval(
                                this.listingStemSelector,
                                (anchors) => anchors.map((a) => a.href).filter(Boolean)
                            );
                            
                            if (carLinks.length > 0) {
                                console.log(`✅ Найдено ${carLinks.length} объявлений с основным селектором`);
                            }
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

module.exports = { OpenSooqListingParser };
