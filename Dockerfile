# CloudBase 云托管 · Next.js 14
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
ENV SEO_SKIP_ENV_BOOTSTRAP=1
# 镜像构建不跑 postinstall（无 secrets.env）；运行时靠云托管环境变量
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

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN mkdir -p data/push-queue && chown -R nextjs:nodejs /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/config ./config
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
CMD ["node", "server.js"]
