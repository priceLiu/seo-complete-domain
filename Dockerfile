# CloudBase 云托管 · Next.js 14
# 平台健康检查默认探测 80，故容器监听 80（需 root，云托管常见做法）
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
ENV SEO_SKIP_ENV_BOOTSTRAP=1
RUN npm ci --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SEO_SKIP_ENV_BOOTSTRAP=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=80
ENV HOSTNAME=0.0.0.0
EXPOSE 80

RUN mkdir -p data/push-queue

COPY --from=builder /app/public ./public
COPY --from=builder /app/config ./config
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

CMD ["node", "server.js"]
