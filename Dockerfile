FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
COPY workers ./workers

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @degenlab/bot build

ENV NODE_ENV=production
ENV PORT=8000
ENV DEGENLAB_ASSETS_DIR=/app/packages/card-renderer/assets

EXPOSE 8000

CMD ["node", "apps/bot/dist/index.js"]
