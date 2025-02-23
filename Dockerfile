# Используем стандартный образ Node.js
FROM node:18-bullseye

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json перед установкой зависимостей
COPY package*.json ./

# Устанавливаем зависимости (включая Playwright)
RUN npm install && npx playwright install --with-deps

# Копируем весь код парсера в контейнер
COPY . .

# Открываем порт (если потребуется)
EXPOSE 3000

# Запускаем парсер
CMD ["npm", "start"]