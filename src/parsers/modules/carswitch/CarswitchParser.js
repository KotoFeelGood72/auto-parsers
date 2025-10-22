const { BaseParser } = require('../../BaseParser');
const { saveData } = require('../../../utils/saveData');
const { CarswitchListingParser } = require('./entities/listing');
const { CarswitchDetailParser } = require('./entities/detail');

/**
 * Парсер для сайта Carswitch.com
 * Использует отдельные модули для парсинга списка и деталей
 */
class CarswitchParser extends BaseParser {
    constructor(config) {
        super('Carswitch', {
            baseUrl: 'https://carswitch.com',
            listingsUrl: 'https://carswitch.com/uae/used-cars/search',
            ...config
        });
        
        // Инициализируем парсеры
        this.listingParser = new CarswitchListingParser(this.config);
        this.detailParser = new CarswitchDetailParser(this.config);
    }

    /**
     * Получение списка объявлений
     */
    async* getListings() {
        yield* this.listingParser.getListings(this.context);
    }

    /**
     * Парсинг детальной информации об объявлении
     */
    async parseListing(url) {
        return await this.detailParser.parseCarDetails(url, this.context);
    }

    /**
     * Запуск полного цикла парсинга
     */
    async run() {
        const results = [];
        
        try {
            console.log(`🚀 Запуск парсера ${this.name}...`);
            
            for await (const listingUrl of this.getListings()) {
                console.log(`🚗 Обрабатываем ${listingUrl}`);
                
                const data = await this.parseListing(listingUrl);
                if (data && this.validateData(data)) {
                    const normalizedData = this.normalizeData(data);
                    results.push(normalizedData);
                    
                    // Сохраняем данные в базу
                    await this.saveData(normalizedData);
                    
                    console.log(`✅ Обработано объявление: ${data.title}`);
                } else {
                    console.log(`⚠️ Пропущено объявление (невалидные данные): ${listingUrl}`);
                }
                
                // Пауза между запросами
                await this.sleep(this.config.delayBetweenRequests);
            }
            
            console.log(`✅ Парсер ${this.name} завершен. Обработано: ${results.length} объявлений`);
            return results;
            
        } catch (error) {
            console.error(`❌ Ошибка в парсере ${this.name}:`, error.message);
            throw error;
        }
    }

    /**
     * Сохранение данных в базу
     */
    async saveData(carDetails) {
        try {
            await saveData(carDetails);
        } catch (error) {
            console.error(`❌ Ошибка сохранения данных:`, error.message);
        }
    }

    /**
     * Утилита для паузы
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = { CarswitchParser };