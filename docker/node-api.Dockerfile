# Judge runtime for build-an-API questions in JavaScript: Express.
# Built once by the app (debug-gym/node-api:1); judge containers run it offline.
# NODE_PATH lets require('express') resolve from the candidate's /code folder.
FROM node:22-alpine
WORKDIR /opt/deps
RUN npm init -y > /dev/null && npm install --omit=dev --no-audit --no-fund express@4.21.2
ENV NODE_PATH=/opt/deps/node_modules
WORKDIR /
