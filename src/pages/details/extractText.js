async function extractText(page, selector) {
  try {
    return await page.$eval(selector, (el) => el.innerText.trim());
  } catch {
    return "Не указан";
  }
}

module.exports = { extractText };