const { extractText } = require("./extractText");

async function extractSellerDetails(page) {
  let seller = {
    name: "Не указан",
    type: "Частное лицо",
    logo: null,
    profileLink: null,
  };

  try {
    console.log("⌛ Ожидаем загрузку блока продавца...");
    await page.waitForSelector('[data-testid="name"]', { timeout: 30000 });

    seller.name = await extractText(page, '[data-testid="name"]');
    seller.type = await extractText(page, '[data-testid="type"]');
    seller.logo = await page.$eval('[data-testid="logo"] img', (el) => el.src).catch(() => null);
    seller.profileLink = await page.$eval('[data-testid="view-all-cars"]', (el) => el.href).catch(() => null);

    console.log(`🏢 Продавец: ${seller.name} (${seller.type})`);
  } catch (error) {
    console.warn("⚠️ Ошибка при получении данных о продавце:", error);
  }

  return seller;
}

module.exports = { extractSellerDetails };