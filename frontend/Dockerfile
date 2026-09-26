FROM node:24-alpine

WORKDIR /app

# зависимости отдельным слоем: пока lock-файл не меняется, npm ci не повторяется
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host: иначе Vite слушает только localhost внутри контейнера
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
