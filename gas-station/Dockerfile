FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY shared/package*.json ./shared/
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
