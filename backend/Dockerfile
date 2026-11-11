FROM node:20-alpine
WORKDIR /app
# najpierw tylko package*.json — warstwa z zależnościami jest cache'owana, dopóki się nie zmienią
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]
