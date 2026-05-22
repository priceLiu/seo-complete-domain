'use client';

/**
 * 说明本工具推送在站长平台统计中的归类（主动推送 ≠ 手动提交）。
 */
export default function BaiduPushModeNotice() {
  return (
    <div
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-2, rgba(0,0,0,0.03))',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55 }}>
        <strong>本工具推送 = 主动推送（API）</strong>，不是站长后台网页里的{' '}
        <strong>手动提交</strong>。
        <span className="muted" style={{ display: 'block', marginTop: 6, fontSize: '0.88rem' }}>
          在百度搜索资源平台「网页抓取 → 链接提交」中，请查看蓝色曲线{' '}
          <strong>主动推送</strong>；「手动提交」为 0 属于正常。索引、抓取频次请在站长平台查看，勿与推送成功条数混为一谈。
        </span>
      </p>
    </div>
  );
}
