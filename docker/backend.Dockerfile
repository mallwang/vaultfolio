# syntax=docker/dockerfile:1
# Multi-stage build for apps/backend (NestJS), built inside the Nx workspace
# so its workspace-local libs (libs/api-contract, libs/domain/*) are resolved
# via Nx's TypeScript project references, per plan.md's Project Structure.

FROM node:22-slim AS build
WORKDIR /workspace

COPY package.json package-lock.json nx.json tsconfig.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs

RUN npm ci
RUN npx nx build backend --configuration=production
RUN npx nx run backend:prune

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /workspace/apps/backend/dist/ ./
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["node", "main.js"]
