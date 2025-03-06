async function extractPhotos(page) {
  try {
    console.log("📸 Собираем изображения...");

    return await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll(".MuiModal-root .MuiImageList-root img")
      )
        .map((img) => img.src)
        .filter(
          (src) =>
            src.includes(".jpeg") ||
            src.includes(".jpg") ||
            src.includes(".png")
        );
    });
  } catch (error) {
    console.warn("⚠️ Ошибка при получении изображений:", error);
    return [];
  }
}

module.exports = { extractPhotos };