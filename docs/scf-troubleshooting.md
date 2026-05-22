# SCF 定时推送排查清单

云函数 **不会** 随 CloudBase 云托管自动运行；必须在 **SCF 控制台** 单独配置触发器并查看日志。

## 1. 没有「启用」开关？—— 正常

**创建定时触发器时，控制台往往没有「启用」这一项。**  
提交成功且 **「触发管理」列表里出现一行定时触发器**，就表示已生效。  
若要停用，在列表里对该触发器点 **启用/停用**（仅创建后才有）。

你改的 **「函数配置 → 触发器配置」JSON**，在多数账号下**不会单独创建定时任务**；  
**唯一标准：左侧「触发管理」列表是否有一条 Timer。**

### 正确创建步骤

1. [SCF 控制台](https://console.cloud.tencent.com/scf) → **函数服务** → 进入你的函数
2. 左侧 **「触发管理」**（不是「函数配置」）
3. **「创建触发器」** → 选 **定时触发**
4. 填写：

| 字段 | 值 |
|------|-----|
| 名称 | `seo-push-daily` |
| Cron | `0 0 3 * * * *`（或点 **去设定** 选每天 03:00） |
| 版本 | `$LATEST` |

5. **提交** → 列表里应新增一行

**列表为空 = 不会每天 3 点跑**（与函数配置里 JSON 无关）。

### 如何确认已在跑

| 检查项 | 期望 |
|--------|------|
| **触发管理列表** | ≥ 1 条定时触发器 |
| **Cron** | `0 0 3 * * * *` |
| **日志 / 测试** | 有 `scf-seo-push start` |

## 2. 测试报 `145 code exit unexpected`

**原因**：根目录 `index.js` 用了 `import/export`，或根 `package.json` 含 `"type":"module"`。SCF 用 `require()` 加载 `index.main`，会立刻崩溃。

**处理**：用 `npm run scf:package` 重新上传 zip（入口为 CommonJS 的 `index.js`，`lib/package.json` 单独标记 ESM），执行方法 **`index.main`**。

## 2b. 更新报 `entryFile did not find`

**原因**：执行方法写成 `index.cjs.main`，但代码包里没有 `index.cjs`（或平台不认该文件名）。

**处理**：执行方法改回 **`index.main`**，并上传最新 `dist/scf-seo-push.zip`（内含 `index.js`）。

## 2c. 测试报 `Cannot find package 'axios'`

**原因**：代码包未带 `node_modules`。

**处理**：重新 `npm run scf:package` 并上传新 zip（脚本会自动 `npm install`）。

## 2d. 测试报 `File is not defined`

**原因**：旧包含 `cheerio` 1.2，会加载 `undici`，在 SCF Node 18 上缺少全局 `File`。

**处理**：重新 `npm run scf:package` 并上传（sitemap 已改用纯正则解析，仅依赖 axios）。

## 2e. 测试报 `Invoking task timed out after 3 seconds`

**原因**：**执行超时** 只有 3 秒。拉 sitemap + 百度/Bing 推送通常要 10–60 秒。

**处理**（函数配置 → 编辑）：

| 项 | 应填 |
|----|------|
| **执行超时** | **90 秒** |
| 初始化超时 | 默认 3–65 秒即可（与「执行超时」不是同一项） |

保存后重新 **测试**（事件 `{}`）。

## 3. 手动测试（必做）

1. 本地重新打包：`npm run scf:package`
2. 上传最新 `dist/scf-seo-push.zip`
3. 执行方法：**`index.main`**
4. 函数页点击 **测试**，看返回 JSON：
   - `ok: true`：逻辑正常
   - `results[].engine` 为 `baidu` / `bing` 各站一批
   - `ok: false` 看 `error`（如 `over quota`、`site init fail`）

本地模拟：`npm run scf:test`（与云端同一套代码）

## 3. 常见失败原因

| 现象 | 原因 | 处理 |
|------|------|------|
| 日志里无 03:00 记录 | 触发管理列表为空 | 按上文「创建触发器」新建一条 |
| `site init fail` | 旧包或 `site=` 带 `https://` | 重打 zip；凭据须 `www.ai-code8.com` 纯域名 |
| `over quota` | 百度当日 API 额度用完 | 正常；次日再推 |
| Bing `fetch failed` | 出网访问 `ssl.bing.com` 失败 | 确认已开 **公网访问**；海外接口偶发失败 |
| 队列进度总为 0 | 未挂 COS，队列在 `/tmp` | 挂载 COS 到 `/mnt/queue`，设 `PUSH_QUEUE_DIR=/mnt/queue` |
| 本机 `/visibility` 显示旧失败 | 读的是本机 `data/`，不是云端 | 以 **SCF 日志** 为准 |

## 4. 推荐云端环境变量

| 变量 | 建议值 |
|------|--------|
| `PUSH_QUEUE_DIR` | `/mnt/queue`（已挂 COS 时） |
| `SCHEDULE_DATA_DIR` | `/mnt/queue/schedule-data`（可选，与队列同盘） |

zip 内已含 `config/scf.env`、`sites-secrets.json`，一般无需再填 `SITES_SECRETS_JSON`。

## 5. 与本地守护进程关系

| 方式 | 说明 |
|------|------|
| `npm run schedule:daemon` | 仅本机 Mac 常开时有效 |
| SCF 定时 | 云端 7×24，与云托管部署无关 |

两者不要混用同一 COS 目录，除非有意共享队列文件。
