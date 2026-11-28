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

function formatRemaining(resetsAtSec, currentPercent) {
  if (currentPercent !== undefined && currentPercent >= 100) return 'Ready';
  if (!resetsAtSec) return 'Chưa có API';
  const now = Math.floor(Date.now() / 1000);
  const diff = resetsAtSec - now;
  if (diff <= 0) return 'Ready';
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = Math.floor(diff % 60);
  const padSec = secs < 10 ? '0' + secs : secs;
  if (days > 0) return `${days}d ${hours}h ${mins}m ${padSec}s`;
  if (hours > 0) return `${hours}h ${mins}m ${padSec}s`;
  return `${mins}m ${padSec}s`;
}

function getLiveQuota(configQuota = {}) {
  const codex = readCodexQuota();

  const g5h = typeof configQuota.gemini5h === 'number' ? configQuota.gemini5h : null;
  const gWk = typeof configQuota.geminiWeek === 'number' ? configQuota.geminiWeek : null;
  const c5h = codex ? codex.codex5h : (typeof configQuota.codex5h === 'number' ? configQuota.codex5h : null);
  const cWk = codex ? codex.codexWeek : (typeof configQuota.codexWeek === 'number' ? configQuota.codexWeek : null);

  return {
    plan: configQuota.plan || 'Google AI Pro',
    gemini5h: g5h,
    geminiWeek: gWk,
    gemini5hResetAt: configQuota.gemini5hResetAt || null,
    geminiWeekResetAt: configQuota.geminiWeekResetAt || null,
    codex5h: c5h,
    codexWeek: cWk,
    codex5hResetAt: codex?.codex5hResetAt || configQuota.codex5hResetAt || null,
    codexWeekResetAt: codex?.codexWeekResetAt || configQuota.codexWeekResetAt || null
  };
}

module.exports = { readCodexQuota, getLiveQuota, formatRemaining };
