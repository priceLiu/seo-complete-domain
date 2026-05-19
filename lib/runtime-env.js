/** 是否运行在 CloudBase 云托管 / 无 Chrome 的容器环境 */
export function isCloudHosted() {
  return (
    process.env.SEO_CLOUD_HOSTED === '1' ||
    Boolean(process.env.TENCENTCLOUD_RUNENV) ||
    Boolean(process.env.CLOUDBASE_ENV)
  );
}

export function getCloudAuditLimits() {
  if (!isCloudHosted()) return null;
  return {
    maxRulesPages: 10,
    allowLighthouse: false,
    allowSiteAuditSeo: false,
    requestTimeoutHintSec: 60,
  };
}
