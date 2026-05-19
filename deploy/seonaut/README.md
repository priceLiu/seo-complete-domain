# SEOnaut 本机试用

## 启动

```bash
cd deploy/seonaut
docker compose up -d
```

浏览器打开：**http://localhost:9000**

## 第一次使用

1. 注册本地账号（邮箱、密码自定）
2. 新建项目 → 填 `https://www.ai-code8.com`（或你的站点根 URL）
3. 进入项目 → 启动 **Crawl** 爬取
4. 完成后查看 **Issues**、链接报告

## 停止 / 清理

```bash
docker compose down      # 保留数据库
docker compose down -v   # 删除数据库 volume
```

## Apple Silicon（M 系列 Mac）

官方镜像仅 `amd64`，`docker-compose.yml` 已为 `app` 设置 `platform: linux/amd64`（Rosetta/QEMU 模拟，首次启动会稍慢）。

## 说明

- 与 `seo-complete-domain` 主项目独立，不影响 CloudBase 部署
- 整站爬取可能需数分钟，视页面数量而定
- 百度推送仍用主项目 + SCF
