FROM node:24-alpine

WORKDIR /app

# Java is required by validator_cli.jar
RUN apk add --no-cache \
    openjdk21-jre \
    ca-certificates

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "start"]