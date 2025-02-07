const { scrapeListings } = require('./pages/listings');
const { scrapeCarDetails } = require('./pages/details');
const { saveData } = require('./utils/saveData');

(async () => {
    console.log('🚀 Запуск парсера...');

    const links = await scrapeListings();

    if (links.length === 0) {
        console.error('❌ Ошибка: Не найдено ни одного объявления. Проверь парсер списка.');
        return;
    }

    const results = [];

    for (let link of links.slice(0, 5)) { // Ограничиваем до 5 объявлений для теста
        if (!link || typeof link !== 'string') {
            console.error('⚠️ Ошибка: URL объявления undefined или некорректен, пропускаем.');
            continue;
        }

        const carDetails = await scrapeCarDetails(link);
        if (carDetails) results.push(carDetails);
    }

    saveData('dubizzle_cars', results);
    console.log('✅ Парсер завершил работу.');
})();