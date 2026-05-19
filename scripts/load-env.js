const path = require('path');
const { parseEnvFile } = require('./env-parse');

/** 供 CLI 脚本加载与 Next 相同的环境变量 */
function loadProjectEnv() {
  const root = path.join(__dirname, '..');
  for (const rel of [
    'config/scf.env',
    'config/app.env',
    'config/secrets.env',
    '.env.local',
    '.env',
  ]) {
    const vars = parseEnvFile(path.join(root, rel));
    for (const [k, v] of Object.entries(vars)) {
      if (v !== undefined && v !== '') process.env[k] = v;
    }
  }
}

module.exports = { loadProjectEnv };
