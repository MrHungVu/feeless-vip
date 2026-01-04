FROM node:20-alpine
RUN apk add --no-cache python3 make g++ linux-headers eudev-dev
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/
RUN npm ci --legacy-peer-deps
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build -w shared && npm run build -w backend
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
