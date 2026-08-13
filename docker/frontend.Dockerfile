# syntax=docker/dockerfile:1
# Multi-stage build for apps/frontend (Angular): compile inside the Nx
# workspace, then serve the static output with nginx.

FROM node:22-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json nx.json tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm ci
RUN npx nx build frontend --configuration=production

FROM nginx:alpine AS runtime
COPY docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/apps/frontend/browser /usr/share/nginx/html

EXPOSE 80
