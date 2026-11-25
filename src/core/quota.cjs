const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function findNewestSessionFiles(dir, maxFiles = 10) {
  const results = [];
  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try {
          const stat = fs.statSync(fullPath);
          results.push({ path: fullPath, mtimeMs: stat.mtimeMs });
        } catch {}
      }
    }
  }
  walk(dir);
  results.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return results.slice(0, maxFiles);
}

function readCodexQuota() {
  const sessionsDir = path.join(os.homedir(), '.codex', 'sessions');
  const files = findNewestSessionFiles(sessionsDir, 8);
  const nowSec = Math.floor(Date.now() / 1000);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf8');
      const lines = content.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes('rate_limits')) continue;
        const parsed = JSON.parse(lines[i]);
        const rl = parsed?.payload?.rate_limits || parsed?.rate_limits;
        if (!rl) continue;

        const calcRemaining = (bucket) => {
          if (!bucket || typeof bucket.used_percent !== 'number') return null;
          if (typeof bucket.resets_at === 'number' && nowSec > bucket.resets_at) {
            return 100;
          }
          return Math.max(0, Math.min(100, Math.round(100 - bucket.used_percent)));
        };

        const p = rl.primary;
        const s = rl.secondary;
        const codex5h = calcRemaining(p);
        const codexWeek = calcRemaining(s);

        if (codex5h !== null || codexWeek !== null) {
          return {
            codex5h: codex5h ?? 100,
            codexWeek: codexWeek ?? 100,
            codex5hResetAt: p?.resets_at || null,
            codexWeekResetAt: s?.resets_at || null
          };
        }
      }
    } catch {}
  }

  return null;
}

function getLiveQuota(configQuota = {}) {
  const codex = readCodexQuota();
  return {
    gemini5h: typeof configQuota.gemini5h === 'number' ? configQuota.gemini5h : 99,
    geminiWeek: typeof configQuota.geminiWeek === 'number' ? configQuota.geminiWeek : 100,
    codex5h: codex ? codex.codex5h : (typeof configQuota.codex5h === 'number' ? configQuota.codex5h : 100),
    codexWeek: codex ? codex.codexWeek : (typeof configQuota.codexWeek === 'number' ? configQuota.codexWeek : 100)
  };
}

module.exports = { readCodexQuota, getLiveQuota };
