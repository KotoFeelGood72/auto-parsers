async function extractPhoneNumber(page) {
  let phoneNumber = "Не указан";

  try {
    console.log("📞 Проверяем наличие кнопки вызова...");

    // Берём первый локатор кнопки "Call"
    const callButton = page.locator('[data-testid="call-cta-button"]').first();
    const callButtonCount = await callButton.count();

    if (callButtonCount === 0) {
      console.warn("⚠️ Кнопка вызова не найдена, пропускаем...");
      return phoneNumber;
    }

    console.log(`📞 Найдено ${callButtonCount} кнопок вызова. Кликаем по первой...`);

    let clicked = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 Попытка ${attempt}...`);
        await callButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(2000);
        await callButton.click();
        clicked = true;
        console.log("✅ Успешно кликнули по кнопке 'Call'");
        break;
      } catch (error) {
        console.warn(`⚠️ Попытка ${attempt} не удалась. Ошибка:`, error);
        await page.waitForTimeout(2000);
      }
    }

    if (!clicked) {
      console.error("🚨 Не удалось кликнуть по кнопке 'Call' даже за 3 попытки!");
      return phoneNumber;
    }

    console.log("⌛ Ждем появления модального окна...");
    const modal = page.locator(".MuiDialog-container");
    await modal.waitFor({ state: "visible", timeout: 10000 });
    console.log("✅ Модальное окно найдено!");

    // Ожидаем появления номера телефона
    const phoneNumberLocator = modal.locator('[data-testid="phone-number"] p');
    await phoneNumberLocator.waitFor({ state: "visible", timeout: 15000 });

    // Считываем текст номера телефона
    phoneNumber = await phoneNumberLocator.innerText();
    console.log(`📞 Получен номер телефона: ${phoneNumber}`);

    // Закрываем модальное окно (если оно есть)
    const closeButton = modal.locator('[data-testid="close-button"]');
    if ((await closeButton.count()) > 0) {
      await closeButton.click();
      await page.waitForTimeout(2000);
      console.log("✅ Модальное окно закрыто.");
    }

  } catch (error) {
    console.warn("⚠️ Ошибка при получении номера телефона:", error);
  }

  return phoneNumber;
}

module.exports = { extractPhoneNumber };