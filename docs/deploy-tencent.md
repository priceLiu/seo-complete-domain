# 腾讯云 SCF 部署（定时推送）

> **网站用 CloudBase 云托管？** 先看 [deploy-cloudbase.md](./deploy-cloudbase.md)（云托管与 SCF 分工、环境变量）。

# 云函数 seo-push（简化版）

**不用配 `SITES_SECRETS_JSON`**。本地打好包上传即可，密钥已包含在 zip 内。

## 三步完成

### 1. 本地打包（自动带上密钥）

确保 `config/secrets.env` 里已有百度 / Bing 密钥（你平时开发用的那份），然后：

```bash
npm run scf:package
```

会生成 **`dist/scf-seo-push.zip`**（含 `sites.json`、`sites-secrets.json`、默认 `scf.env`）。

### 2. 上传云函数

| 配置项 | 填什么 |
|--------|--------|
| 函数名 | `seo-push`（随意） |
| 运行环境 | Node.js 18 |
| 执行方法 | **`index.main`** |
| 内存 | 256MB |
| **执行超时** | **90 秒**（在「函数配置」里，不是「初始化超时」） |

上传 `dist/scf-seo-push.zip` 作为代码。

**环境变量**：可不填（已打在包里）。若挂了 COS，只需加一条：`PUSH_QUEUE_DIR=/mnt/queue`。

### 3. 定时触发器

**路径**：函数详情 → **触发管理** / **触发器** → 编辑代码（或「去设定」向导）

把原来的空 `triggers: []` 换成下面整段，保存：

```json
{
  "triggers": [
    {
      "name": "seo-push-daily",
      "type": "timer",
      "config": "0 0 3 * * * *"
    }
  ]
}
```

- `config` 为 **7 段** Cron：每天 **03:00:00**（秒 分 时 日 月 星期 年）
- 时区为 **UTC+8**（国内账号默认东八区，无需再选）

也可用页面上的 **「去设定」** 图形界面，选「定时触发」、填 `0 0 3 * * * *`。

保存后在函数页 **「测试」** 运行一次，看返回里 `ok: true`。

**重要**：除「函数配置」里的 JSON 外，务必打开 **「触发管理」** 确认已有一条 **已启用** 的定时触发器；若列表为空，定时不会执行。详见 [scf-troubleshooting.md](./scf-troubleshooting.md)。

本地模拟：`npm run scf:test`

---

## 可选：COS 持久化队列

不配 COS 时队列在 `/tmp`，函数冷启动后可能丢进度。  
将桶挂载到 `/mnt/queue`，并设环境变量 `PUSH_QUEUE_DIR=/mnt/queue`。

---

## 安全提醒

- zip 内含密钥，**不要**发到公开网盘或提交 git（`dist/` 已在 `.gitignore`）。  
- 仅上传到自己的腾讯云函数。

---

## 与本地命令等价

云函数每次执行 ≈ `npm run schedule:run`（所有站点的百度 + Bing 各推一批）。
