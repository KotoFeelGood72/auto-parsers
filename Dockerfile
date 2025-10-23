# Используем стандартный образ Node.js
FROM node:18-bullseye-slim

# Устанавливаем системные зависимости для Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Создаем пользователя для безопасности
RUN groupadd -r parser && useradd -r -g parser parser

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и package-lock.json перед установкой зависимостей
COPY package*.json ./

# Устанавливаем зависимости (включая Playwright)
RUN npm ci --only=production && \
    npx playwright install --with-deps chromium && \
    npm cache clean --force

# Копируем весь код парсера в контейнер
COPY . .

# Создаем необходимые директории
RUN mkdir -p /app/data /app/logs && \
    chown -R parser:parser /app

# Переключаемся на пользователя parser
USER parser

# Открываем порт (если потребуется)
EXPOSE 3000

# Добавляем healthcheck
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 \
    CMD node -e "process.exit(0)"

# Запускаем парсер
CMD ["node", "--expose-gc", "--max-old-space-size=512", "src/index.js", "cycle"]