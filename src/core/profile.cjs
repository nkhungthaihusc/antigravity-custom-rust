const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { withCredentialLock } = require('./credential-lock.cjs');
const { atomicWrite } = require('./store.cjs');

async function resolveDataDirectory(env = process.env) {
  if (!env.APPDATA || !env.LOCALAPPDATA) throw new Error('Không tìm thấy thư mục dữ liệu Windows.');
  const file = path.join(env.LOCALAPPDATA, 'Programs', 'Antigravity', 'resources', 'agc-custom', 'install.json');
  let manifest;
  try { manifest = JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return path.join(env.APPDATA, 'antigravity-custom');
    throw new Error('Không đọc được manifest tích hợp native.', { cause: error });
  }
  if (manifest.product !== 'antigravity-custom-native' || typeof manifest.dataDirectory !== 'string' || !path.isAbsolute(manifest.dataDirectory)) throw new Error('Thư mục dữ liệu trong manifest native không hợp lệ.');
  return manifest.dataDirectory;
}

// Explicit repair only. Normal startup never chooses between two passwords or
// copies an old profile over the active shared profile.
async function syncPassword(sourceDirectory, targetDirectory) {
  const source = path.resolve(sourceDirectory, 'security.json'), target = path.resolve(targetDirectory, 'security.json');
  if (source.toLowerCase() === target.toLowerCase()) return { changed: false };
  const files = [source, target].sort();
  return withCredentialLock(files[0], () => withCredentialLock(files[1], async () => {
    const bytes = await fs.readFile(source), record = JSON.parse(bytes.toString('utf8'));
    if (record.algorithm !== 'scrypt-v1' || !/^[0-9a-f]{32}$/.test(record.salt) || !/^[0-9a-f]{128}$/.test(record.hash) || !Number.isInteger(record.failures ?? 0) || (record.failures ?? 0) < 0 || (record.failures ?? 0) > 20 || !Number.isSafeInteger(record.lockedUntil ?? 0) || (record.lockedUntil ?? 0) < 0) throw new Error('Dữ liệu mật khẩu nguồn không hợp lệ; chưa thay đổi mật khẩu dùng chung.');
    let previous;
    try { previous = await fs.readFile(target); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous?.equals(bytes)) return { changed: false };
    let backup;
    if (previous) {
      backup = path.join(targetDirectory, `security.before-sync-${randomUUID()}.json`);
      await fs.writeFile(backup, previous, { flag: 'wx', mode: 0o600 });
    }
    await atomicWrite(target, record);
    return { changed: true, backup };
  }));
}
module.exports = { resolveDataDirectory, syncPassword };
