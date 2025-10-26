/**
 * Парсинг списка объявлений для OneClickDrive.com
 */

class OneclickdriveListingParser {
    constructor(config) {
        this.config = config;
        
        // Селектор для элементов списка машин
        this.listingSelector = '.gallery-img-link';
    }

    /**
     * Получение списка объявлений
     */
    async* getListings(context) {
        let currentPage = 1;
        let processedLinks = new Set(); // Защита от повторного парсинга

        while (true) {
            const page = await context.newPage();
            let pageError = false;

            try {
                console.log("🔍 Открываем каталог OneClickDrive...");

                while (true) {
                    try {
                        // Формируем URL с параметром page
                        const separator = this.config.listingsUrl.includes('?') ? '&' : '?';
                        const url = `${this.config.listingsUrl}${separator}page=${currentPage}`;
                        console.log(`📄 Загружаем страницу ${currentPage}: ${url}`);

                        await page.goto(url, { 
                            waitUntil: "domcontentloaded", 
                            timeout: this.config.timeout 
                        });

                        // Ждём основной список машин
                        await page.waitForSelector(
                            this.listingSelector, 
                            { timeout: 30000 }
                        );

                        const carLinks = await page.$$eval(
                            this.listingSelector, 
                            (elements, baseUrl) =>
                                elements
                                    .map((el) => el.getAttribute("href"))
                                    .filter((href) => href && href.startsWith(baseUrl)),
                            this.config.baseUrl
                        );

                        console.log(`✅ Найдено ${carLinks.length} объявлений на странице ${currentPage}`);

                        // Проверяем есть ли новые ссылки
                        let newLinksFound = 0;
                        for (const link of carLinks) {
                            if (!processedLinks.has(link)) {
                                processedLinks.add(link);
                                yield link;
                                newLinksFound++;
                            }
                        }

                        console.log(`📌 Обработано новых объявлений: ${newLinksFound} (всего уникальных: ${processedLinks.size})`);

                        // Если нет новых ссылок, значит страница повторяется или это последняя
                        if (newLinksFound === 0) {
                            console.log("⚠️ Повторяющиеся объявления обнаружены. Переходим к следующей странице...");
                        }

                        // Проверяем наличие следующей страницы
                        const hasNextPage = await page.$('.paginationdesign a.nextbtn');
                        if (!hasNextPage) {
                            console.log("🏁 Последняя страница достигнута. Завершаем парсинг.");
                            break;
                        }

                        currentPage++;
                        
                        // Небольшая задержка между страницами
                        await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenRequests));

                    } catch (pageError) {
                        console.error(`❌ Ошибка при парсинге страницы ${currentPage}:`, pageError.message);
                        // Прерываем внутренний цикл при ошибке
                        pageError = true;
                        break;
                    }
                }

                // Если все ок или достигли последней страницы, закрываем страницу и выходим
                await page.close();
                return;

            } catch (error) {
                console.error(`❌ Ошибка при работе со страницей:`, error.message);
                pageError = true;
            } finally {
                try {
                    await page.close();
                } catch (e) {
                    // Игнорируем ошибки закрытия страницы
                }
            }

            // Если была ошибка и мы не достигли лимита страниц, пробуем следующую
            if (pageError) {
                console.log("⚠️ Проблема с текущей страницей, переходим к следующей...");
                currentPage++;
                
                // Защита от бесконечного цикла
                if (currentPage > 100) {
                    console.log("🚨 Достигнут лимит страниц. Завершаем парсинг.");
                    break;
                }
            }
        }

        console.log(`✅ Парсинг завершен. Всего уникальных объявлений: ${processedLinks.size}`);
    }
}

module.exports = { OneclickdriveListingParser };

