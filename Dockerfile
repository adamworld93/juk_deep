FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server server
COPY shared shared
COPY public public
ENV PORT=8080 DATA_DIR=/data
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
CMD ["node", "server/index.js"]
