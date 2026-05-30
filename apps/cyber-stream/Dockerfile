# ==========================================
# ЭТАП 1: СБОРКА (BUILDER STAGE)
# ==========================================
FROM node:24-alpine AS builder
WORKDIR /app

# Копируем конфиги и ставим ВТИХУЮ абсолютно ВСЕ зависимости (включая TS и компиляторы)
COPY package*.json ./
RUN npm ci

# Копируем схему и жестко генерируем локальный клиент Prisma
COPY prisma ./prisma
RUN DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma generate

# Копируем исходники и компилируем TypeScript в чистый JS внутри папки dist/
COPY . .
RUN npm run build

# ==========================================
# ЭТАП 2: ПРОДАКШЕН РАНТАЙМ (RUNNER STAGE)
# ==========================================
FROM node:24-alpine AS runner
WORKDIR /app

# Переносим переменные окружения, если они нужны в рантайме
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# Копируем package.json во второй этап
COPY package*.json ./

# КРИТИЧЕСКИЙ ХАК: Ставим СТРОГО только production-зависимости! 
# Никакого TypeScript, Jest или ESLint на проде не будет!
RUN npm ci --omit=dev

# Переносим сгенерированный клиент Prisma из первого этапа
COPY --from=builder /app/prisma ./prisma
# Принудительно генерируем рантайм-клиент под чистый prod
RUN DATABASE_URL="postgresql://fake:fake@localhost:5432/fake" npx prisma generate

# Забираем из первого этапа СТРОГО скомпилированный код
COPY --from=builder /app/dist ./dist

# Открываем порт нашего киберспортивного WebSocket-шлюза
EXPOSE 3000

# Запускаем чистый, легкий и безопасный JS-код
CMD ["node", "dist/src/main.js"]
