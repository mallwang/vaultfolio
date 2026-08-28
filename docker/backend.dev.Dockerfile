# syntax=docker/dockerfile:1
# Development image for apps/backend. Installs deps once at build time; the
# compose override (docker-compose.override.yml) then bind-mounts the live
# workspace over this image and runs `nx serve`, which rebuilds and restarts
# the process on every source change.

FROM node:24-slim
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci

EXPOSE 3000
CMD ["npx", "nx", "serve", "backend"]
