const { chromium } = require('playwright');

async function startBrowser() {
    const browser = await chromium.launch({ 
        headless: true,
        // Оптимизации для снижения потребления памяти
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--memory-pressure-off',
            '--max_old_space_size=512' // Ограничиваем память для Node.js
        ]
    });
    
    // Ограничиваем количество одновременных страниц
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        // Отключаем загрузку изображений для экономии памяти
        ignoreHTTPSErrors: true
    });
    
    return { browser, context };
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