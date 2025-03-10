const { chromium } = require('playwright');

async function startBrowser() {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-gpu', // Отключаем GPU
            '--disable-software-rasterizer', // Отключаем рендеринг
            '--disable-dev-shm-usage', // Убираем ограничение shared memory
            '--no-sandbox', // Запуск без песочницы
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-web-security',
            '--disable-extensions',
            '--disable-sync',
            '--no-first-run',
            '--mute-audio',
            '--single-process', // Ограничиваем количество процессов Chromium
            '--no-zygote' // Отключаем форкинг процессов
        ]
    });

    // 📌 Обработка завершения процесса, чтобы не оставались зависшие процессы
    process.on('exit', async () => {
        console.log("🛑 Закрываем браузер Playwright...");
        await browser.close();
    });

    return browser;
}

module.exports = { startBrowser };