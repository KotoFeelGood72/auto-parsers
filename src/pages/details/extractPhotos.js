async function extractPhotos(page) {
  try {
    console.log("📸 Собираем изображения...");

    const mainImageSelector = ".MuiImageListItem-standard";
    let clicked = false;

    // 🔹 Дожидаемся главного изображения и пробуем кликнуть (3 попытки)
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`📸 Попытка клика #${attempt + 1}...`);

      const mainImage = await page.$(mainImageSelector);
      if (!mainImage) {
        console.warn("⚠️ Главное изображение не найдено, пробуем снова...");
        await page.waitForTimeout(1000);
        continue;
      }

      try {
        await mainImage.hover();
        await page.waitForTimeout(500);
        await mainImage.click({ delay: 200 });
        clicked = true;
        break;
      } catch (error) {
        console.warn("⚠️ Ошибка при клике по главному изображению, повторяем...");
        await page.waitForTimeout(1000);
      }
    }

    if (!clicked) {
      console.warn("🚨 Не удалось кликнуть на главное изображение. Продолжаем без модалки...");
    } else {
      console.log("📸 Кликнули, ждем загрузки модального окна...");

      // 🔹 Ждем появления модального окна
      await page.waitForSelector(".MuiModal-root", { timeout: 15000 }).catch(() => {
        console.warn("⚠️ Модальное окно не загрузилось!");
      });

      // 🔹 Ждем загрузки изображений в модалке
      await page.waitForFunction(() => {
        const modal = document.querySelector(".MuiModal-root");
        return modal && modal.querySelectorAll(".MuiImageList-root img").length > 0;
      }, { timeout: 45000 }).catch(() => {
        console.warn("⚠️ Изображения в модалке не загрузились!");
      });
    }

    // 🔹 Собираем изображения
    const photos = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".MuiModal-root .MuiImageList-root img"))
        .map((img) => img.src)
        .filter((src) => /\.(jpeg|jpg|png|webp)$/i.test(src));
    });

    console.log(`📸 Собрано изображений: ${photos.length}`);
    return photos;
  } catch (error) {
    console.warn("⚠️ Ошибка при получении изображений:", error);
    return [];
  }
}

module.exports = { extractPhotos };