# SCF 定时推送排查清单

云函数 **不会** 随 CloudBase 云托管自动运行；必须在 **SCF 控制台** 单独配置触发器并查看日志。

## 1. 先确认：定时器是否真的在跑

在腾讯云 SCF 函数页检查（不是只看「函数配置」里的 JSON）：

| 检查项 | 期望 |
|--------|------|
| **触发管理** | 存在名为 `seo-push-daily` 的 **定时触发器**，状态 **已启用** |
| **Cron** | `0 0 3 * * * *`（7 段，每天 03:00:00，东八区） |
| **日志** | 每天约 03:00 有一条调用记录；`scf-seo-push start` / `done` |
| **监控** | 调用次数 ≥ 1/天 |

仅把 JSON 写在「函数配置 → 触发器配置」里，**若「触发管理」列表为空，则不会定时执行**。请在 **触发管理 → 创建触发器 → 定时触发** 再建一条。

## 2. 手动测试（必做）

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
| 日志里无 03:00 记录 | 触发器未创建/未启用 | 触发管理新建定时触发器 |
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
