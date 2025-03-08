const extractPhotos = async (page) => {
  try {
    console.log("📸 Начинаем сбор изображений...");

    const mainImageSelector = ".MuiImageListItem-standard";
    const modalSelector = ".MuiModal-root";
    const imagesSelector = ".MuiImageListItem-standard img"; // ✅ Исправленный селектор для изображений

    await page.waitForSelector(mainImageSelector, { timeout: 20000 });

    let clicked = false;

    // 🔹 3 попытки кликнуть на главное изображение
    for (let attempt = 0; attempt < 3; attempt++) {
      console.log(`📸 Попытка клика #${attempt + 1}...`);

      const mainImage = await page.$(mainImageSelector);
      if (!mainImage) {
        console.warn("⚠️ Главное изображение исчезло, пробуем заново...");
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
        console.warn("⚠️ Элемент изменился, пробуем снова...");
        await page.waitForTimeout(1000);
      }
    }

    if (!clicked) {
      console.warn("🚨 Не удалось кликнуть на главное изображение! Пробуем хотя бы его скачать...");
      const mainPhoto = await page.evaluate((mainImageSelector) => {
        const img = document.querySelector(mainImageSelector + " img");
        return img ? [img.src] : [];
      }, mainImageSelector);

      console.log(`📸 Найдено ${mainPhoto.length} изображение (основное фото)`);
      return mainPhoto;
    }

    console.log("📸 Кликнули, ждем загрузки модального окна...");

    // 🔹 Ждем появления модального окна
    await page.waitForSelector(modalSelector, { timeout: 15000 }).catch(() => {
      console.warn("⚠️ Модальное окно не загрузилось!");
    });

    console.log("🔍 Ожидаем загрузку изображений...");

    // 🔹 Ожидаем хотя бы одно изображение
    await page.waitForSelector(imagesSelector, { timeout: 45000 }).catch(() => {
      console.warn("⚠️ Изображения в модалке не загрузились!");
    });

    console.log("📜 Прокручиваем модалку для ленивой загрузки...");

    // 🔹 Скроллим вниз для подгрузки всех изображений
    await page.evaluate(async () => {
      const modal = document.querySelector(".MuiModal-root");
      if (modal) {
        let totalHeight = modal.scrollHeight;
        let distance = 100;
        let currentPosition = 0;

        while (currentPosition < totalHeight) {
          modal.scrollBy(0, distance);
          currentPosition += distance;
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    });

    console.log("⏳ Ждем загрузку изображений после прокрутки...");
    await page.waitForTimeout(3000);

    console.log("📸 Собираем ссылки на изображения...");

    // 🔹 Получаем изображения из модального окна
    const photos = await page.evaluate((imagesSelector) => {
      return Array.from(document.querySelectorAll(imagesSelector))
        .map((img) => img.src)
        .filter((src) => /\.(jpeg|jpg|png|webp)$/i.test(src));
    }, imagesSelector);

    console.log(`📸 Собрано изображений: ${photos.length}`);

    await page.waitForTimeout(5000); // Ожидание перед закрытием модального окна
    return photos;
  } catch (error) {
    console.warn("⚠️ Ошибка при получении изображений:", error);
    return [];
  }
};

module.exports = { extractPhotos };