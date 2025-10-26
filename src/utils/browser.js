const { chromium } = require('playwright');

async function startBrowser() {
    // Определяем режим: headless в Docker, обычный режим локально
    const isHeadless = process.env.NODE_ENV === 'production' || process.env.DOCKER === 'true';
    const browser = await chromium.launch({ 
        headless: isHeadless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Для Docker
    });
    return browser;
}

// Функция для мониторинга памяти
function logMemoryUsage() {
    const used = process.memoryUsage();
    console.log(`📊 Использование памяти:
    RSS: ${Math.round(used.rss / 1024 / 1024)} MB
    Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)} MB
    Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)} MB
    External: ${Math.round(used.external / 1024 / 1024)} MB`);
}

// Принудительная очистка памяти
function forceGarbageCollection() {
    if (global.gc) {
        global.gc();
        console.log('🗑️ Принудительная очистка памяти выполнена');
    }
}

module.exports = { startBrowser, logMemoryUsage, forceGarbageCollection };