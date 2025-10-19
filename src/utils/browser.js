const { chromium } = require('playwright');

async function startBrowser() {
    const browser = await chromium.launch({ headless: true }); // Можно true, если не нужен UI
    return browser;
}

module.exports = { startBrowser };