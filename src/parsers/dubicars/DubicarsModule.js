/**
 * Модуль парсера Dubicars
 * Автономный модуль для парсинга сайта Dubicars.com
 */

const { scrapeDubicarsListings } = require('./listings');
const { scrapeDubicarsDetails } = require('./details');
const { startBrowser } = require('../../utils/browser');

class DubicarsModule {
    constructor() {
        this.name = 'Dubicars';
        this.browser = null;
    }

    /**
     * Инициализация модуля
     */
    async initialize() {
        try {
            console.log(`🚀 Инициализация модуля ${this.name}...`);
            
            // Создаем браузер
            this.browser = await startBrowser();
            
            console.log(`✅ Модуль ${this.name} инициализирован`);
            return true;
        } catch (error) {
            console.error(`❌ Ошибка инициализации модуля ${this.name}:`, error.message);
            return false;
        }
    }

    /**
     * Запуск парсинга
     */
    async run() {
        try {
            console.log(`🏃 Запуск парсинга ${this.name}...`);
            
            if (!this.browser) {
                throw new Error('Модуль не инициализирован');
            }

            let processedCount = 0;
            const maxProcessed = 5; // Ограничиваем для демонстрации

            // Используем генератор для получения списка объявлений
            for await (const listingUrl of scrapeDubicarsListings(this.browser)) {
                if (processedCount >= maxProcessed) {
                    console.log(`🏁 Достигнут лимит обработанных объявлений: ${maxProcessed}`);
                    break;
                }

                console.log(`\n📄 Обрабатываем объявление ${processedCount + 1}: ${listingUrl}`);
                
                try {
                    // Извлекаем детальную информацию
                    const carDetails = await scrapeDubicarsDetails(listingUrl, this.browser);
                    
                    if (carDetails) {
                        console.log(`✅ Объявление ${processedCount + 1} обработано успешно`);
                        console.log(`   📝 Название: ${carDetails.title}`);
                        console.log(`   💰 Цена: ${carDetails.price_formatted}`);
                        console.log(`   🚗 Марка: ${carDetails.make}`);
                        console.log(`   📸 Фото: ${carDetails.photos.length} шт.`);
                        
                        // Здесь можно добавить сохранение в базу данных
                        // await saveCarDetails(carDetails);
                    } else {
                        console.log(`❌ Не удалось обработать объявление ${processedCount + 1}`);
                    }
                } catch (error) {
                    console.error(`❌ Ошибка при обработке объявления ${processedCount + 1}:`, error.message);
                }

                processedCount++;
            }

            console.log(`\n🎉 Парсинг ${this.name} завершен! Обработано объявлений: ${processedCount}`);
            return { success: true, processed: processedCount };
            
        } catch (error) {
            console.error(`❌ Ошибка при запуске парсинга ${this.name}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Получение информации о модуле
     */
    getInfo() {
        return {
            name: this.name,
            initialized: !!this.browser,
            type: 'standalone'
        };
    }
}

module.exports = { DubicarsModule };
