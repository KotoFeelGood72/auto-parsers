async function useText(page, selector, defaultValue = "Не указано") {
  try {
    await page.waitForSelector(selector, { timeout: 3000 });
    return await page.$eval(selector, (el) => el.textContent.trim());
  } catch {
    return defaultValue;
  }
}

module.exports = { useText };
