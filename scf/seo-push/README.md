# SCF 定时推送

**不用配 SITES_SECRETS_JSON。**

```bash
npm run scf:package
```

上传 `dist/scf-seo-push.zip`，执行方法 **`index.main`**，加定时触发器 `0 0 3 * * * *`。

详见 [docs/deploy-tencent.md](../../docs/deploy-tencent.md)。
