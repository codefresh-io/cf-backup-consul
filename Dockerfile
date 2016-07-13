FROM node:6.3.0-slim

ENV SHELL /bin/bash
COPY *.js package.json cf-backup-consul/

WORKDIR /cf-backup-consul
RUN npm install

CMD npm start