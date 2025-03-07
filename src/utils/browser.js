const { chromium } = require('playwright');

async function startBrowser() {
    return await chromium.launch({
        headless: false,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage"
        ]
    });
}

module.exports = { startBrowser };