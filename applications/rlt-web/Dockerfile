# ==================================================
# BUILD STAGE
# ==================================================

FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG VITE_ORCHESTRATOR_URL=/orchestrator

ENV VITE_ORCHESTRATOR_URL=$VITE_ORCHESTRATOR_URL

RUN npm run build


# ==================================================
# NGINX STAGE
# ==================================================

FROM nginx:alpine

COPY nginx.conf \
  /etc/nginx/conf.d/default.conf

COPY --from=build \
  /app/dist \
  /usr/share/nginx/html

EXPOSE 80

CMD [ "nginx", "-g", "daemon off;"]
