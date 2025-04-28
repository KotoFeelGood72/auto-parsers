const { extractText } = require("./details/extractText");

async function scrapeCarDetails(url, context) {
  const page = await context.newPage();
  let carDetails = { short_url: url, sellers: {}, photos: [], contact: {} };

  try {
    console.log(`🚗 Переходим к ${url}`);

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    console.log("📄 Загружаем данные...");

    const fields = [
      {
        key: "title",
        selector: "h1",
        default: "Не указано",
      },
      {
        key: "year",
        selector: ".mileage .item:nth-child(1) .mileage_text",
        default: "Не указано",
      },
      {
        key: "body_type",
        selector:
          ".features-list .feature-list__item:nth-child(9) .feature-value",
        default: "Не указано",
      },
      {
        key: "drivetype",
        selector:
          ".features-list .feature-list__item:nth-child(5) .feature-value",
        default: "Не указано",
      },
      {
        key: "fuel_type",
        selector:
          ".features-list .feature-list__item:nth-child(11) .feature-value",
        default: "Не указано",
      },
      {
        key: "kilometers",
        selector: ".mileage .item:nth-child(2) .mileage_text",
        default: "0",
        sanitize: (v) => v.replace(/\D/g, ""),
      },
      {
        key: "exterior_color",
        selector:
          ".features-list .feature-list__item:nth-child(8) .feature-value",
        default: "Не указано",
      },
      {
        key: "location",
        selector: "#location_text",
        default: "Не указано",
      },
      {
        key: "motors_trim",
        selector:
          ".features-list .feature-list__item:nth-child(7) .feature-value",
        default: "Не указано",
      },
    ];

    for (const field of fields) {
      try {
        carDetails[field.key] = await extractText(page, field.selector);
        if (field.sanitize) {
          carDetails[field.key] = field.sanitize(carDetails[field.key]);
        }
      } catch {
        carDetails[field.key] = field.default;
      }
    }

    // 🔹 Сбор только data-src из недублированных слайдов
    try {
      await page.waitForSelector(".swiper-slide img", { timeout: 7000 });

      carDetails.photos = await page.evaluate(() => {
        const slides = document.querySelectorAll(
          ".swiper-slide:not(.swiper-slide-duplicate) img"
        );
        const urls = new Set();

        slides.forEach((img) => {
          const src = img.getAttribute("data-src");
          if (src) {
            urls.add(src.startsWith("//") ? "https:" + src : src);
          }
        });

        return Array.from(urls);
      });

      console.log(`📸 Найдено изображений: ${carDetails.photos.length}`);
    } catch (err) {
      console.warn("⚠️ Ошибка при сборе изображений:", err.message);
    }

    const knownMakes = [
      "Alfa Romeo",
      "Aston Martin",
      "Audi",
      "Bentley",
      "BMW",
      "Bugatti",
      "Cadillac",
      "Chevrolet",
      "Chrysler",
      "Citroen",
      "Dacia",
      "Daewoo",
      "Daihatsu",
      "Dodge",
      "Ferrari",
      "Fiat",
      "Ford",
      "GMC",
      "Geely",
      "Genesis",
      "Honda",
      "Hummer",
      "Hyundai",
      "Infiniti",
      "Isuzu",
      "Jaguar",
      "Jeep",
      "Kia",
      "Lada",
      "Lamborghini",
      "Lancia",
      "Land Rover",
      "Lexus",
      "Lincoln",
      "Maserati",
      "Mazda",
      "McLaren",
      "Mercedes-Benz",
      "Mini",
      "Mitsubishi",
      "Nissan",
      "Opel",
      "Peugeot",
      "Pontiac",
      "Porsche",
      "Renault",
      "Rolls Royce",
      "Rover",
      "Saab",
      "Seat",
      "Skoda",
      "Smart",
      "SsangYong",
      "Subaru",
      "Suzuki",
      "Tesla",
      "Toyota",
      "Volkswagen",
      "Volvo",
      "Range Rover",
    ];

    const getMakeFromTitle = (title) => {
      if (!title || typeof title !== "string") return "Неизвестно";

      const normalizedTitle = title.toLowerCase();

      const foundMake = knownMakes.find((make) =>
        normalizedTitle.startsWith(make.toLowerCase())
      );

      return foundMake || "Неизвестно";
    };

    // 🏷️ Извлекаем марку из заголовка
    carDetails.make = getMakeFromTitle(carDetails.title);

    return carDetails;
  } catch (error) {
    console.error(`❌ Ошибка при загрузке данных с ${url}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

module.exports = { scrapeCarDetails };
