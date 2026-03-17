FROM node:22-alpine
WORKDIR /app
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm ci --omit=dev
COPY hub-api.mjs /app/hub-api.mjs
COPY shared/jwksVerifier.mjs /shared/jwksVerifier.mjs
EXPOSE 3001
CMD ["node", "/app/hub-api.mjs"]
