const { chromium } = require('playwright');

async function startBrowser() {
    return await chromium.launch({
        headless: true,
        args: [
            '--disable-gpu',               // Отключаем GPU
            '--disable-software-rasterizer', // Отключаем рендеринг
            '--disable-dev-shm-usage',     // Убираем ограничение shared memory
            '--no-sandbox',                // Запуск без песочницы
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-sync',
            '--no-first-run',
            '--mute-audio'
        ]
    });

    
}

module.exports = { startBrowser };