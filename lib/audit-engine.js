import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = process.env.AUDIT_USER_AGENT || 'SEO-Monitor/1.0';

function push(issues, severity, message, recommendation) {
  issues.push({ severity, message, recommendation });
}

/**
 * 单页 SEO 审计：规则 + 扣分，返回 0–100 分
 * @param {string} pageUrl
 * @param {string[]} [keywordHints] 可选，检查首屏相关词
 */
export async function auditPage(pageUrl, keywordHints = []) {
  const issues = [];
  let score = 100;

  const res = await axios.get(pageUrl, {
    timeout: 20000,
    maxRedirects: 5,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
    },
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const $ = cheerio.load(res.data);
  const title = ($('title').first().text() || '').trim();
  const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();
  const canonical = ($('link[rel="canonical"]').attr('href') || '').trim();
  const h1 = $('h1');
  const h1Text = h1
    .map((_, e) => $(e).text().trim())
    .get()
    .filter(Boolean);

  if (!title) {
    push(issues, 'high', '缺少 <title>', '为页面添加唯一、包含核心主题的 title。');
    score -= 20;
  } else if (title.length < 15) {
    push(issues, 'med', `标题过短（${title.length} 字）`, '适当拉长 title，包含品牌与核心词，通常 25–60 字较合适。');
    score -= 6;
  } else if (title.length > 70) {
    push(issues, 'low', `标题过长（${title.length} 字）`, '考虑精简，避免在搜索结果中被截断。');
    score -= 3;
  }

  if (!metaDesc) {
    push(issues, 'med', '缺少 meta description', '添加 name="description"，概括页面价值并含主要关键词。');
    score -= 10;
  } else if (metaDesc.length < 50) {
    push(issues, 'low', 'meta description 偏短', '建议 80–160 字，清晰卖点 + 行动语。');
    score -= 4;
  } else if (metaDesc.length > 200) {
    push(issues, 'low', 'meta description 过长', '可精简到约 160 字内，避免折行浪费。');
    score -= 2;
  }

  if (h1.length === 0) {
    push(issues, 'high', '缺少 H1', '每页应有一个明确 H1，概括页面主题。');
    score -= 15;
  } else if (h1.length > 1) {
    push(issues, 'med', `存在 ${h1.length} 个 H1`, '建议整页仅保留一个 H1，其余改用 H2–H6。');
    score -= 8;
  }

  if (!canonical) {
    push(issues, 'low', '未设置 canonical', '添加 rel=canonical，减少重复 URL 分散权重。');
    score -= 4;
  }

  const imgs = $('img');
  let missingAlt = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt === null) missingAlt += 1;
  });
  if (imgs.length && missingAlt) {
    push(
      issues,
      'med',
      `${missingAlt} 张图片缺少 alt`,
      '为内容图写描述性 alt；装饰图可用 alt="" 并配合 aria 属性。',
    );
    score -= Math.min(12, missingAlt * 2);
  }

  const bodyText = $('body').text().replace(/\s+/g, ' ').slice(0, 8000).toLowerCase();
  for (const kw of keywordHints) {
    const k = (kw || '').trim().toLowerCase();
    if (k.length >= 2 && !bodyText.includes(k)) {
      push(issues, 'low', `正文未明显包含关键词「${kw}」`, '在首段或小标题中自然融入目标词（若该页应对应此词）。');
      score -= 3;
    }
  }

  if ($('meta[name="robots"][content*="noindex"]').length) {
    push(issues, 'high', '存在 noindex', '确认是否故意阻止收录；若需收录请移除 noindex。');
    score -= 25;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    url: pageUrl,
    score,
    issues,
    details: {
      title,
      titleLength: title.length,
      metaDescriptionLength: metaDesc.length,
      h1Count: h1.length,
      h1Preview: h1Text[0]?.slice(0, 120),
      canonical: canonical || null,
      imagesWithoutAlt: missingAlt,
      statusCode: res.status,
    },
  };
}
