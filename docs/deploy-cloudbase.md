# CloudBase 云托管 + SCF 分工说明

本项目典型部署方式：

| 能力 | 部署在哪 | 是否随 Git 自动更新 |
|------|----------|---------------------|
| 监控网站（Next.js） | **CloudBase 云托管** | 是（推送代码后自动构建） |
| 每天定时推送 URL | **SCF 云函数 `seo-push`** | **否**，需单独 `scf:package` 上传 zip |

二者**不会自动关联**；云托管部署完成 ≠ 云函数已更新。

---

## 一、提交代码前（Git）

勿提交（已在 `.gitignore`）：

- `config/secrets.env`、`config/sites-secrets.json`
- `.env.local`
- `dist/`（含带密钥的 scf zip）
- `data/`

可提交：`config/sites.json`、`config/app.env`、业务代码、`docs/`。

---

## 二、CloudBase 云托管（网站）

### Dockerfile（Git 自动部署必填）

仓库根目录已提供 **`Dockerfile`**。若提示「代码仓库中没有找到 Dockerfile」，提交并推送该文件后，在云托管重新开启自动部署即可。

构建在镜像内完成（`npm ci --ignore-scripts` → `npm run build`），容器监听 **80** 端口。  
若构建日志出现 `postinstall` / `sync-env` 失败，请确认仓库已包含最新 `Dockerfile`。

**不要**在云托管里配置启动 `schedule:daemon`；定时推送交给 SCF。

### 环境变量（云托管 → 服务 → 环境变量）

构建机**没有** `config/secrets.env`，密钥必须在控制台配置。至少：

| 变量 | 说明 |
|------|------|
| `BAIDU_PUSH_API_URL` | 百度完整推送 URL（推荐） |
| `BING_WEBMASTER_API_KEY` | Bing API Key |
| `NEXT_PUBLIC_SITE_URL` | 如 `https://www.ai-code8.com` |
| `BAIDU_SCHEDULE_ENABLED` | `true`（页面/API 读调度状态时用） |

与 `config/sites.json` 中站点一致；多站可在控制台增加 `SITES_SECRETS_JSON`（整段 JSON，同本地 `sites-secrets.json`）。

改环境变量后需在云托管 **重新部署/发布** 一次才生效。

### 队列数据（`data/push-queue`）

云托管实例重启后，容器内 `data/` **可能清空**。  
**每日自动推送请以 SCF 为准**；在网页上点「推送」也会写容器本地队列，重启后进度可能丢失。

若要在云托管也持久化队列，需使用云托管 **挂载存储卷** 并设 `PUSH_QUEUE_DIR` 为挂载路径（进阶，非必须）。

---

## 三、SCF 云函数（定时推送）

与云托管无关，按 [deploy-tencent.md](./deploy-tencent.md) 操作：

1. 本地 `npm run scf:package`
2. 上传 `dist/scf-seo-push.zip` 到函数 `seo-push`
3. 执行方法 `index.main`，定时 `0 0 3 * * * *`

改推送逻辑或密钥后：**重新打包上传 zip**，与云托管发版分开。

---

## 四、推荐发版顺序

1. `git push` → 等待 CloudBase 云托管构建成功 → 打开线上站点检查页面  
2. 若改过推送相关代码或密钥 → `npm run scf:package` → 上传 SCF zip → 测试云函数  
3. 确认 SCF 定时触发器已启用  
