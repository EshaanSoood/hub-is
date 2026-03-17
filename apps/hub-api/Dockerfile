FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN cp -r /app/shared /shared
EXPOSE 3001
CMD ["node", "/app/hub-api.mjs"]
