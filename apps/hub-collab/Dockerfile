FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN cp -r /app/shared /shared
EXPOSE 1234
CMD ["node", "/app/collab-server.mjs"]
