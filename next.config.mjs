import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 启动时加载 config/secrets.env（不提交 git），与 .env.local 叠加 */
function loadSecretsEnv() {
  const secretsPath = path.join(__dirname, 'config', 'secrets.env');
  if (!fs.existsSync(secretsPath)) return;
  const content = fs.readFileSync(secretsPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).trim();
    }
    process.env[key] = val;
  }
}

loadSecretsEnv();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['lighthouse', 'chrome-launcher'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('lighthouse', 'chrome-launcher');
    }
    return config;
  },
};

export default nextConfig;
