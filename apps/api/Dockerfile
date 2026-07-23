# Fastify API Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/

RUN pnpm install --frozen-lockfile

COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src/
COPY packages/contracts/ packages/contracts/
COPY prisma/schema.prisma prisma/

RUN npx prisma generate && cd apps/api && npx tsc

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
