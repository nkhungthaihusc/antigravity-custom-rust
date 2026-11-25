const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
async function atomicWrite(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }).catch(() => {}); }
}
class ConfigStore {
  constructor(directory, normalize) { this.file = path.join(directory, 'config.json'); this.normalize = normalize; this.queue = Promise.resolve(); }
  async load() {
    try { return this.normalize(JSON.parse(await fs.readFile(this.file, 'utf8'))); }
    catch (e) {
      if (e.code === 'ENOENT') return this.normalize({});
      if (e instanceof SyntaxError) {
        const backup = `${this.file}.invalid-${Date.now()}`;
        await fs.rename(this.file, backup);
        this.recovered = true;
        return this.normalize({});
      }
      throw e;
    }
  }
  save(value) { const normalized = this.normalize(value); this.queue = this.queue.catch(() => {}).then(() => atomicWrite(this.file, normalized)); return this.queue.then(() => normalized); }
}
module.exports = { atomicWrite, ConfigStore };
