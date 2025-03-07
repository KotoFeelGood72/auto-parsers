const { chromium } = require('playwright');

let browser;
let context;

async function startBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage"
            ]
        });
        context = await browser.newContext();
    }
    return context;
}

async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        context = null;
        console.log("✅ Браузер закрыт.");
    }
}

module.exports = { startBrowser, closeBrowser };