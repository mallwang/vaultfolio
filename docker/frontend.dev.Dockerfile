# syntax=docker/dockerfile:1
# Development image for apps/frontend. Installs deps once at build time; the
# compose override (docker-compose.override.yml) then bind-mounts the live
# workspace over this image and runs `nx serve`, whose dev server rebuilds
# and hot-reloads the browser on every source change.
#
# Serves on port 80 (not Angular's default 4200) so the container port
# matches docker-compose.yml's existing `4200:80` mapping unchanged.

FROM node:24-slim
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci

EXPOSE 80
CMD ["npx", "nx", "serve", "frontend", "--host", "0.0.0.0", "--port", "80"]
