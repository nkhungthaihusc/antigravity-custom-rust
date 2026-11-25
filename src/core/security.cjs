const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { atomicWrite } = require('./store.cjs');
const { withCredentialLock } = require('./credential-lock.cjs');
const scrypt = promisify(crypto.scrypt);
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function validatePassword(value) { if (typeof value !== 'string' || value.length < 8 || value.length > 256) throw new Error('Mật khẩu cần từ 8 đến 256 ký tự.'); }
async function hashPassword(password) { validatePassword(password); const salt = crypto.randomBytes(16).toString('hex'); const hash = await scrypt(password, salt, 64, PARAMS); return { algorithm: 'scrypt-v1', salt, hash: hash.toString('hex') }; }
function validCredential(record) { return record?.algorithm === 'scrypt-v1' && /^[0-9a-f]{32}$/.test(record.salt) && /^[0-9a-f]{128}$/.test(record.hash); }
async function comparePassword(password, record) {
  if (typeof password !== 'string' || password.length > 256 || !validCredential(record)) return false;
  const candidate = await scrypt(password, record.salt, 64, PARAMS);
  const expected = Buffer.from(record.hash, 'hex');
  if (crypto.timingSafeEqual(candidate, expected)) return true;
  // Compatibility with v0.5.0 Rust, which decoded the stored salt first.
  const legacy = await scrypt(password, Buffer.from(record.salt, 'hex'), 64, PARAMS);
  return crypto.timingSafeEqual(legacy, expected);
}
class Security {
  constructor(directory) { this.file = path.join(directory, 'security.json'); this.sessionUntil = 0; this.queue = Promise.resolve(); }
  exclusive(fn) { const promise = this.queue.catch(() => {}).then(() => withCredentialLock(this.file, fn)); this.queue = promise; return promise; }
  async record() {
    try { const record = JSON.parse(await fs.readFile(this.file, 'utf8')); if (!validCredential(record)) throw new Error('Dữ liệu mật khẩu hỏng. Xem hướng dẫn khôi phục trong README.'); return record; }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async status() { const r = await this.record(); return { configured: !!r, unlocked: this.isUnlocked(), retryAfterMs: Math.max(0, (r?.lockedUntil || 0) - Date.now()) }; }
  isUnlocked() { return this.sessionUntil > Date.now(); }
  require() { if (!this.isUnlocked()) throw new Error('Phiên đã khóa. Hãy đăng nhập lại.'); this.sessionUntil = Date.now() + 30 * 60 * 1000; }
  lock() { this.sessionUntil = 0; }
  setup(password) { return this.exclusive(async () => { if (await this.record()) throw new Error('Mật khẩu đã được thiết lập.'); const r = await hashPassword(password); await atomicWrite(this.file, { ...r, failures: 0, lockedUntil: 0 }); this.sessionUntil = Date.now() + 30 * 60 * 1000; return this.status(); }); }
  verify(password) { return this.exclusive(async () => {
    const r = await this.record(); if (!r) throw new Error('Hãy thiết lập mật khẩu trước.');
    if (r.lockedUntil > Date.now()) throw new Error(`Thử lại sau ${Math.ceil((r.lockedUntil - Date.now()) / 1000)} giây.`);
    if (!await comparePassword(password, r)) {
      const failures = Math.min(20, (Number.isInteger(r.failures) ? r.failures : 0) + 1);
      const lockedUntil = failures >= 5 ? Date.now() + Math.min(300000, 30000 * 2 ** (failures - 5)) : 0;
      await atomicWrite(this.file, { ...r, failures, lockedUntil });
      throw new Error(lockedUntil ? 'Sai mật khẩu 5 lần trở lên. Tạm khóa ít nhất 30 giây.' : 'Mật khẩu chưa đúng.');
    }
    await atomicWrite(this.file, { ...r, failures: 0, lockedUntil: 0 }); this.sessionUntil = Date.now() + 30 * 60 * 1000; return this.status();
  }); }
  change(current, next) { return this.exclusive(async () => { this.require(); validatePassword(next); const r = await this.record(); if (!r || !await comparePassword(current, r)) throw new Error('Mật khẩu hiện tại chưa đúng.'); await atomicWrite(this.file, { ...await hashPassword(next), failures: 0, lockedUntil: 0 }); return true; }); }
}
module.exports = { Security, hashPassword, comparePassword, PASSWORD_FORMAT_VERSION: 2 };
