FROM node:20-alpine
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
