FROM node:lts-alpine

WORKDIR /app

COPY . .
COPY package.*json .
COPY nginx.conf /etc/nginx/nginx.conf

RUN yarn
RUN yarn global add pm2

EXPOSE 8088

CMD ["yarn", "start:prod"]
