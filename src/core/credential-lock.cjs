const fs = require('node:fs/promises');
const path = require('node:path');

async function withCredentialLock(file, fn) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`, start = Date.now();
  let handle;
  while (!handle) {
    try { handle = await fs.open(lock, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST' || Date.now() - start >= 10000) throw new Error('Không thể khóa dữ liệu mật khẩu dùng chung.', { cause: error });
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  try { return await fn(); }
  finally { await handle.close(); await fs.unlink(lock); }
}
module.exports = { withCredentialLock };
