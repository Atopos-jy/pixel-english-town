# Socket.IO Dockerfile
FROM node:20-alpine
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate && pnpm install --frozen-lockfile

COPY apps/socket/src/socket-server.mjs apps/socket/src/
COPY prisma/schema.prisma prisma/

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/socket/src/socket-server.mjs"]
