FROM node:20.11.1

WORKDIR /app

# COPY package*.json ./
# RUN npm install
#COPY . .

EXPOSE 3000

CMD ["/bin/bash", "-c", "npm install; node ingest.js; node server.js"]
# CMD [ "node", "server.js" ]
