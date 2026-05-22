'use client';

import { useState } from 'react';

/**
 * 说明站长平台「sitemap 提交」与本工具「同步队列 / 主动推送」的区别。
 */
export default function BaiduSitemapGuide({ sitemapUrl, pushSite }) {
  const [copied, setCopied] = useState(false);
  const url = (sitemapUrl || 'https://www.ai-code8.com/sitemap.xml').trim();

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="card card-inset"
      style={{
        marginBottom: 16,
        padding: 14,
        border: '1px solid var(--color-border)',
      }}
    >
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 8px' }}>Sitemap 提交说明（必读）</h3>
      <p className="muted" style={{ marginTop: 0, marginBottom: 10, fontSize: '0.88rem' }}>
        站长平台「网页抓取 → 链接提交」里的 <strong>sitemap</strong> 曲线，只统计你在{' '}
        <a href="https://ziyuan.baidu.com/" target="_blank" rel="noreferrer">
          百度搜索资源平台
        </a>{' '}
        登记的 Sitemap 地址；与本工具下方操作<strong>不是同一统计</strong>。
      </p>

      <table className="table-simple" style={{ fontSize: '0.88rem', marginBottom: 12 }}>
        <thead>
          <tr>
            <th>操作</th>
            <th>是否算平台「sitemap」</th>
            <th>作用</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>站长平台提交 Sitemap</strong>
            </td>
            <td>
              <span className="badge badge-ok">是</span>
            </td>
            <td>登记整份 sitemap.xml，图表 sitemap 才可能 &gt; 0</td>
          </tr>
          <tr>
            <td>本工具「同步 Sitemap」</td>
            <td>否</td>
            <td>仅把 URL 导入本地队列，不提交 sitemap 文件</td>
          </tr>
          <tr>
            <td>本工具「推送今日一批」/ 推送到百度</td>
            <td>否</td>
            <td>
              算<strong>主动推送</strong>（<code>data.zz.baidu.com</code>），<strong>不是</strong>站长后台「手动提交」
            </td>
          </tr>
          <tr>
            <td>勾选 Ping 登记 Sitemap</td>
            <td>理论上辅助</td>
            <td>常失败 HTTP 500，请以站长平台手动提交为准</td>
          </tr>
        </tbody>
      </table>

      <p
        className="issue-high"
        style={{ margin: '0 0 10px', fontSize: '0.88rem', fontWeight: 400 }}
      >
        若站长平台显示 <strong>今日提交上限：0 条</strong>、提交按钮灰色，表示该账号当前{' '}
        <strong>没有 sitemap 文件提交额度</strong>（与 API 主动推送约 10 条/天是两套配额）。可尝试：
        完成站点验证、在平台填写<strong>主体备案号</strong>（页面「去填写」）、或隔几天再看额度是否放开。额度为
        0 时无法在此渠道提交，请继续用本页<strong>主动推送 / 队列</strong>。
      </p>

      <p className="muted" style={{ margin: '0 0 8px', fontSize: '0.88rem' }}>
        <strong>有额度时在站长平台提交（复制下面地址，须为 .xml 页面列表，不要提交索引型 sitemap）：</strong>
      </p>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <code
          style={{
            flex: '1 1 200px',
            wordBreak: 'break-all',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'var(--color-surface-2, rgba(0,0,0,0.04))',
          }}
        >
          {url}
        </code>
        <button type="button" className="btn btn-secondary" onClick={copyUrl}>
          {copied ? '已复制' : '复制 Sitemap 地址'}
        </button>
        <a
          className="btn"
          href="https://ziyuan.baidu.com/linksubmit/index"
          target="_blank"
          rel="noreferrer"
        >
          打开站长平台提交
        </a>
      </div>

      {pushSite ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
          推送 API 使用的 site：<code>{pushSite}</code>。请与站长平台验证站点、Sitemap 主域（www / 裸域）保持一致。
        </p>
      ) : null}
    </div>
  );
}
