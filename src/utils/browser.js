const { chromium } = require('playwright');

async function startBrowser() {
    const headlessEnv = process.env.PWL_HEADLESS;
    const headless = headlessEnv === undefined ? true : String(headlessEnv).toLowerCase() === 'true';
    const browser = await chromium.launch({ headless });
    return browser;
}

module.exports = { startBrowser };