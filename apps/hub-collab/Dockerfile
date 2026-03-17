FROM node:22-alpine
WORKDIR /app
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm ci --omit=dev
COPY collab-server.mjs /app/collab-server.mjs
COPY shared/jwksVerifier.mjs /shared/jwksVerifier.mjs
EXPOSE 1234
CMD ["node", "/app/collab-server.mjs"]
