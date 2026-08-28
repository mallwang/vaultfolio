# syntax=docker/dockerfile:1
# Multi-stage build for apps/frontend (Angular): compile inside the Nx
# workspace, then serve the static output with nginx.

FROM node:24-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json nx.json tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm ci --ignore-scripts
RUN npx nx build frontend --configuration=production

FROM nginx:alpine AS runtime
COPY docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/frontend/browser /usr/share/nginx/html
COPY docker/frontend-entrypoint.sh /docker-entrypoint.d/40-vaultfolio-env.sh
RUN chmod +x /docker-entrypoint.d/40-vaultfolio-env.sh

EXPOSE 80
