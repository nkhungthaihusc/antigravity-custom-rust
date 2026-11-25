const fs = require('node:fs/promises');
const path = require('node:path');
async function validateExecutable(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || path.basename(file).toLowerCase() !== 'antigravity.exe') throw new Error('Hãy chọn Antigravity.exe của bản App.');
  const handle = await fs.open(file, 'r');
  try { const buffer = Buffer.alloc(2); await handle.read(buffer, 0, 2, 0); if (buffer.toString() !== 'MZ') throw new Error('File không phải ứng dụng Windows hợp lệ.'); }
  finally { await handle.close(); }
  return path.resolve(file);
}
async function discoverExecutable(env = process.env) {
  const candidates = [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'Antigravity', 'Antigravity.exe'), env.ProgramFiles && path.join(env.ProgramFiles, 'Antigravity', 'Antigravity.exe')].filter(Boolean);
  for (const candidate of candidates) { try { return await validateExecutable(candidate); } catch {} }
  return '';
}
module.exports = { validateExecutable, discoverExecutable };
