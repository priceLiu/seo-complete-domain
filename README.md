# SEO Complete Domain

目标站点 SEO 监控（页面审计 + 收录与索引说明）。栈：**Next.js 14（App Router）**、**ECharts**、本地 JSON 存储（无 CloudBase 云函数）。

## 当前版本

见 [docs/releases/v0.3.2.md](./docs/releases/v0.3.2.md)，更多版本见 [docs/releases/README.md](./docs/releases/README.md)。

## 快速开始

默认配置在 **`config/app.env`**；**百度 / Bing 密钥**写在 **`config/secrets.env`**（可复制 `config/secrets.env.example`）。`npm run dev` 前会自动执行 `env:sync` 合并到 `.env.local`。

```bash
npm install
# 编辑 config/secrets.env，粘贴百度「接口调用地址」或 BAIDU_TOKEN
npm run dev
```

浏览器打开 <http://localhost:3000>。

## 环境变量

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SITE_URL` | 站点根 URL，用于拼接 `/sitemap.xml`、与 Bing 站点匹配 |
| `AUDIT_USER_AGENT` | 抓取页面时的 User-Agent |
| `AUDIT_RUN_SECRET` | 可选；设置后 `POST /api/audit/run` 需带 `Authorization: Bearer` 或 body `secret` |
| `BING_WEBMASTER_API_KEY` | 可选；服务端拉取 Bing Webmaster（站点列表、`GetRankAndTrafficStats`） |
| `BAIDU_PUSH_API_URL` | 可选（推荐）；资源平台复制的完整推送 URL，含 `site`、`token`，验证通过后可直接使用 |
| `BAIDU_PUSH_TOKEN` | 可选；单独配置准入密钥时需配合下方 `site` 或与整段 URL 二选一 |
| `BAIDU_PUSH_SITE` | 可选；`site=` 参数，须与平台接口一致；默认同 `NEXT_PUBLIC_SITE_URL` |

审计结果写入 `data/audit-latest.json`（已 gitignore）。

## 脚本

- `npm run dev` — 开发  
- `npm run build` / `npm start` — 生产构建与运行  
- `npm run lint` — ESLint  

## 迭代规范

每次版本在 `docs/releases/vX.Y.Z.md` 记录：需求、计划、进度、完成情况、遗留问题。详见 [docs/releases/README.md](./docs/releases/README.md) 与 `.cursor/rules/release-iteration.mdc`。
