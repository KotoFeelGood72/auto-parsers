const { chromium } = require('playwright');

async function startBrowser() {
    const browser = await chromium.launch({ headless: true, args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process"
    ] }); // Можно true, если не нужен UI
    return browser;
}

module.exports = { startBrowser };