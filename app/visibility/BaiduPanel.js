'use client';

import { useEffect, useState } from 'react';
import BaiduSchedulePanel from './BaiduSchedulePanel';

export default function BaiduPanel() {
  const [config, setConfig] = useState(null);
  const [requiresSecret, setRequiresSecret] = useState(false);
  const [submitMode, setSubmitMode] = useState('manual');
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [sitemapMax, setSitemapMax] = useState(50);
  const [sitemapPreview, setSitemapPreview] = useState(null);
  const [urlsText, setUrlsText] = useState('');
  const [pushType, setPushType] = useState('normal');
  const [auditSecret, setAuditSecret] = useState('');
  const [pingSitemap, setPingSitemap] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const [resultAt, setResultAt] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/baidu/config').then((r) => r.json()),
      fetch('/api/baidu/schedule').then((r) => r.json()),
      fetch('/api/audit/config').then((r) => r.json()),
    ])
      .then(([c, schedule, a]) => {
        setConfig(c);
        setScheduleStatus(schedule);
        const url =
          schedule?.sitemapUrl ||
          c?.scheduleSitemapUrl ||
          c?.defaultSitemapUrl ||
          '';
        if (url) setSitemapUrl(url);
        setRequiresSecret(Boolean(a.requiresSecret));
      })
      .catch(() => {
        setConfig(null);
      });
  }, []);

  const importFromAudit = () => {
    setErr('');
    setResult(null);
    fetch('/api/audit/latest')
      .then((r) => r.json())
      .then((d) => {
        if (d.empty || !Array.isArray(d.pages)) {
          setErr(d.message || '暂无审计数据，请先在「页面审计」运行一次。');
          return;
        }
        const lines = d.pages.map((p) => p.url).filter(Boolean);
        setUrlsText(lines.join('\n'));
      })
      .catch(() => setErr('读取审计结果失败。'));
  };

  const previewSitemap = () => {
    setErr('');
    setSitemapPreview(null);
    const u = sitemapUrl.trim();
    if (!u) {
      setErr('请填写 Sitemap 地址。');
      return;
    }
    fetch(`/api/baidu/sitemap?sitemapUrl=${encodeURIComponent(u)}&maxPages=${sitemapMax}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then(setSitemapPreview)
      .catch((e) => setErr(e.message || String(e)));
  };

  const pushSitemap = () => {
    if (!config?.configured) {
      setErr('请先配置 BAIDU_PUSH_API_URL 或 BAIDU_PUSH_TOKEN。');
      return;
    }
    if (requiresSecret && !auditSecret.trim()) {
      setErr('请输入审计密钥（与服务端 AUDIT_RUN_SECRET 一致）。');
      return;
    }
    const u = sitemapUrl.trim();
    if (!u) {
      setErr('请填写 Sitemap 地址。');
      return;
    }
    setErr('');
    setResult(null);
    setResultAt(null);
    setLoading(true);
    const secret = auditSecret.trim();
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    fetch('/api/baidu/sitemap', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sitemapUrl: u,
        maxPages: sitemapMax,
        type: pushType === 'daily' ? 'daily' : 'normal',
        ping: pingSitemap,
        ...(secret ? { secret } : {}),
      }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        setResult(j);
        setResultAt(new Date().toISOString());
        fetch('/api/baidu/schedule')
          .then((r) => r.json())
          .then(setScheduleStatus)
          .catch(() => {});
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  const push = () => {
    if (!config?.configured) {
      setErr('请先配置 BAIDU_PUSH_API_URL 或 BAIDU_PUSH_TOKEN。');
      return;
    }
    if (requiresSecret && !auditSecret.trim()) {
      setErr('请输入审计密钥（与服务端 AUDIT_RUN_SECRET 一致）。');
      return;
    }
    const urls = urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!urls.length) {
      setErr('请填写至少一行 URL。');
      return;
    }
    setErr('');
    setResult(null);
    setResultAt(null);
    setLoading(true);
    const secret = auditSecret.trim();
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    fetch('/api/baidu/push', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        urls,
        type: pushType === 'daily' ? 'daily' : 'normal',
        ...(secret ? { secret } : {}),
      }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        return j;
      })
      .then((j) => {
        setResult(j);
        setResultAt(new Date().toISOString());
      })
      .catch((e) => setErr(e.message || String(e)))
      .finally(() => setLoading(false));
  };

  const queueToday = scheduleStatus?.queue?.daily?.successCount;
  const queueLimit = scheduleStatus?.dailyLimit;

  if (!config) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        加载百度配置…
      </p>
    );
  }

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        使用搜索资源平台{' '}
        <a href="https://ziyuan.baidu.com/linksubmit/index" target="_blank" rel="noreferrer">
          普通收录 / 快速收录
        </a>{' '}
        的 <strong>API 提交</strong>：接口域名为 <code>data.zz.baidu.com</code>，POST 体为每行一条
        URL（UTF-8）。
        <br />
        <a href="https://ziyuan.baidu.com/" target="_blank" rel="noreferrer">
          百度搜索资源平台
        </a>
        完成站点验证后，在「资源提交」复制 **整段接口调用地址** 写入 <code>BAIDU_PUSH_API_URL</code>，或分别配置{' '}
        <code>site</code> 与 <code>token</code>；索引量等统计仍请在平台内查看。
      </p>

      {!config.configured ? (
        <>
          <p className="muted">
            在 <strong>项目根目录</strong> 编辑 <code>config/secrets.env</code>（可复制{' '}
            <code>config/secrets.env.example</code>），填入百度接口地址或 token 后执行{' '}
            <code>npm run env:sync</code> 并重启 <code>npm run dev</code>。
          </p>
          <span className="badge badge-warn">未配置 token</span>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 12 }}>
            Sitemap / 定时推送 <code>site</code>：
            <strong style={{ marginLeft: 6 }}>
              {config.sitemapPushSite || config.pushSite}
            </strong>
            <span className="badge badge-ok" style={{ marginLeft: 8 }}>
              已配置
            </span>
            {config.credentialPushSite &&
            config.sitemapPushSite &&
            config.credentialPushSite !== config.sitemapPushSite ? (
              <span className="muted" style={{ display: 'block', marginTop: 6, fontSize: '0.88rem' }}>
                凭据里 site 为 <code>{config.credentialPushSite}</code>（
                <code>BAIDU_PUSH_API_URL</code>），与 ai-code8 不一致时请在站长平台复制
                ai-code8 的接口地址并 <code>npm run env:sync</code>。
              </span>
            ) : config.configSource === 'api_url' ? (
              <span className="muted" style={{ marginLeft: 8, fontSize: '0.88rem' }}>
                （来自 <code>BAIDU_PUSH_API_URL</code>）
              </span>
            ) : null}
          </p>

          <BaiduSchedulePanel requiresSecret={requiresSecret} auditSecret={auditSecret} />

          <div style={{ marginBottom: 12 }}>
            <span className="muted" style={{ marginRight: 12 }}>
              提交方式
            </span>
            <label style={{ marginRight: 16 }}>
              <input
                type="radio"
                name="baiduSubmitMode"
                checked={submitMode === 'manual'}
                onChange={() => setSubmitMode('manual')}
              />{' '}
              手动 URL
            </label>
            <label>
              <input
                type="radio"
                name="baiduSubmitMode"
                checked={submitMode === 'sitemap'}
                onChange={() => setSubmitMode('sitemap')}
              />{' '}
              Sitemap 抓取推送
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span className="muted" style={{ marginRight: 12 }}>
              收录类型
            </span>
            <label style={{ marginRight: 16 }}>
              <input
                type="radio"
                name="baiduPushType"
                checked={pushType === 'normal'}
                onChange={() => setPushType('normal')}
              />{' '}
              普通收录
            </label>
            <label>
              <input
                type="radio"
                name="baiduPushType"
                checked={pushType === 'daily'}
                onChange={() => setPushType('daily')}
              />{' '}
              快速收录（<code>type=daily</code>，须在平台开通）
            </label>
          </div>

          {submitMode === 'sitemap' ? (
            <>
              <p className="muted" style={{ marginTop: 0 }}>
                从 <code>sitemap.xml</code> 解析 URL 并按百度返回的 <code>remain</code>{' '}
                分批推送（不会一次提交全部 URL）；同时尝试 ping 登记 Sitemap 地址。整站 URL 较多时请用上方
                「定时队列」按 <code>config/sites.json</code> 的 <code>baiduDailyLimit</code> 每日续推。
              </p>
              <label className="muted" style={{ display: 'block', marginBottom: 8 }}>
                Sitemap 地址
              </label>
              <input
                type="url"
                value={sitemapUrl}
                placeholder="https://www.ai-code8.com/sitemap.xml"
                onChange={(e) => setSitemapUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  marginBottom: 12,
                }}
              />
              <label className="muted" style={{ display: 'block', marginBottom: 8 }}>
                最多抓取（≤2000）
              </label>
              <input
                type="number"
                min={1}
                max={2000}
                value={sitemapMax}
                onChange={(e) => setSitemapMax(Number(e.target.value))}
                style={{
                  width: 120,
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  marginBottom: 12,
                }}
              />
              {sitemapPreview ? (
                <p className="muted" style={{ marginTop: 0 }}>
                  预览：共 <strong>{sitemapPreview.count}</strong> 条 URL。
                  {sitemapPreview.count > 20 ? (
                    <>
                      {' '}
                      若一次推送报「额度超了」，通常是条数大于百度当日剩余配额（接口字段{' '}
                      <code>remain</code>），与「昨天是否点过推送」无关；请改用小批次或队列。
                    </>
                  ) : null}
                </p>
              ) : null}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={pingSitemap}
                  onChange={(e) => setPingSitemap(e.target.checked)}
                />
                <span className="muted" style={{ fontSize: '0.88rem' }}>
                  同时 Ping 登记 Sitemap（<code>ping.baidu.com</code>，可选；失败常表现为 HTTP
                  500，<strong>与 URL 推送配额无关</strong>）
                </span>
              </label>
            </>
          ) : (
            <>
              <label className="muted" style={{ display: 'block', marginBottom: 8 }}>
                URL 列表（每行一条，单次最多 2000 条）
              </label>
              <textarea
                value={urlsText}
                onChange={(e) => setUrlsText(e.target.value)}
                rows={8}
                placeholder="https://www.example.com/page-a&#10;https://www.example.com/page-b"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              />
            </>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            {submitMode === 'manual' ? (
              <button type="button" className="btn btn-secondary" onClick={importFromAudit}>
                从最近一次审计导入
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={previewSitemap}>
                预览 Sitemap
              </button>
            )}
            {requiresSecret ? (
              <label style={{ flex: '1 1 200px' }}>
                <div className="muted">审计密钥</div>
                <input
                  type="password"
                  autoComplete="off"
                  value={auditSecret}
                  onChange={(e) => setAuditSecret(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--color-border)' }}
                />
              </label>
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={submitMode === 'sitemap' ? pushSitemap : push}
              disabled={loading}
            >
              {loading
                ? '推送中…'
                : submitMode === 'sitemap'
                  ? '从 Sitemap 推送'
                  : '推送到百度'}
            </button>
          </div>
        </>
      )}

      {err ? (
        <p className="issue-high" style={{ marginTop: 16, marginBottom: 0 }}>
          {err}
        </p>
      ) : null}

      {result?.ok ? (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <h3 style={{ fontSize: '0.95rem', margin: '0 0 4px' }}>
            本次手动推送结果
            {resultAt ? (
              <span className="muted" style={{ fontWeight: 400, fontSize: '0.82rem', marginLeft: 8 }}>
                {new Date(resultAt).toLocaleString('zh-CN', { hour12: false })}
              </span>
            ) : null}
          </h3>
          <p className="muted" style={{ margin: '0 0 12px', fontSize: '0.82rem' }}>
            与上方「定时队列推送」中的<strong>历史记录</strong>不是同一次操作。
          </p>

          {result.mode === 'sitemap' && result.push ? (
            <>
              <h4 style={{ fontSize: '0.88rem', margin: '0 0 6px' }}>
                1. URL 主动推送（<code>data.zz.baidu.com</code>）
              </h4>
              <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
                {result.push.pushedCount > 0 ? (
                  <>
                    已提交 <strong>{result.push.pushedCount}</strong> / {result.push.urlCount} 条，百度成功{' '}
                    <strong>{result.push.totalSuccess}</strong> 条
                    {typeof result.push.lastRemain === 'number' ? (
                      <>
                        ，剩余额度 <strong>{result.push.lastRemain}</strong>
                      </>
                    ) : null}
                    。
                  </>
                ) : (
                  <>
                    <span className="issue-high">本次未向百度提交任何 URL</span>
                    {result.push.quotaExhausted ? '（今日配额已用尽）' : ''}。
                    {queueLimit != null && queueToday != null && queueToday >= queueLimit ? (
                      <>
                        {' '}
                        定时队列今日已记 <strong>{queueToday}/{queueLimit}</strong> 条，与百度{' '}
                        <code>remain: 0</code> 一致时无法再推。
                      </>
                    ) : (
                      <> 请查看百度站长平台今日剩余条数，或明日再试。</>
                    )}
                  </>
                )}
                {result.push.skippedCount > 0 ? (
                  <>
                    {' '}
                    另有 <strong>{result.push.skippedCount}</strong> 条未提交。
                  </>
                ) : null}
              </p>
              <pre
                style={{
                  margin: '0 0 12px',
                  fontSize: 12,
                  overflow: 'auto',
                  color: 'var(--color-muted)',
                }}
              >
                {JSON.stringify(result.push, null, 2)}
              </pre>

              <h4 style={{ fontSize: '0.88rem', margin: '0 0 6px' }}>
                2. Sitemap Ping（<code>ping.baidu.com</code>，可选）
              </h4>
              {!pingSitemap ? (
                <p className="muted" style={{ margin: 0 }}>
                  未勾选 Ping，已跳过。
                </p>
              ) : result.ping ? (
                <p className="muted" style={{ margin: 0 }}>
                  成功（HTTP {result.ping.status}）。
                </p>
              ) : result.pingError ? (
                <p className="issue-high" style={{ margin: 0 }}>
                  {result.pingError}
                  <span className="muted" style={{ display: 'block', marginTop: 6, fontWeight: 400 }}>
                    这是 Ping 接口报错，<strong>不是</strong> URL 推送配额问题；不影响{' '}
                    <code>data.zz.baidu.com</code> 的主动推送结果。
                  </span>
                </p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  无 Ping 结果。
                </p>
              )}
            </>
          ) : (
            <>
              <h4 style={{ fontSize: '0.88rem', margin: '0 0 6px' }}>
                URL 主动推送（<code>data.zz.baidu.com</code>）
              </h4>
              <pre
                style={{
                  margin: '0 0 8px',
                  fontSize: 12,
                  overflow: 'auto',
                  color: 'var(--color-muted)',
                }}
              >
                {JSON.stringify(result.result, null, 2)}
              </pre>
              <p className="muted" style={{ margin: 0 }}>
                <code>success</code>：本次成功条数；<code>remain</code>：今日剩余可推送条数。
              </p>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
