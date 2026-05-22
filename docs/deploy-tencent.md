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

### 3. 定时触发器（必在「触发管理」创建）

**不要只改「函数配置」里的 JSON。** 国内控制台创建时**通常没有「启用」开关**——在 **触发管理** 里新增一条即生效。

**推荐路径**：

1. 函数详情 → 左侧 **「触发管理」** → **「创建触发器」**
2. 触发方式选 **定时触发**
3. 名称：`seo-push-daily`
4. Cron / 触发周期：**`0 0 3 * * * *`**（7 段 = 每天 03:00:00，东八区）
5. 提交后，**触发管理列表里应出现一行**；列表为空则 3 点不会自动跑

也可用 **「去设定」** 图形向导选「每天 3:00」。

「函数配置 → 触发器配置 → 编辑代码」里的 JSON 仅作参考（与列表二选一以 **触发管理列表** 为准）：

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

保存代码 zip 后，在函数页 **「测试」** 运行一次，看返回里 `ok` 与 `results`。

详见 [scf-troubleshooting.md](./scf-troubleshooting.md)。

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
