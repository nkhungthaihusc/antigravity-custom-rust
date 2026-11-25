// Node peer used by the Rust integration tests; only synthetic work/ profiles.
const fs = require('node:fs/promises');
const path = require('node:path');
const { Security } = require('../../src/core/security.cjs');
const { withCredentialLock } = require('../../src/core/credential-lock.cjs');
const fixture = require('./security-v1.json');
(async () => {
  const [directory, action, current, next] = process.argv.slice(2);
  const security = new Security(directory);
  if (action === 'hold-setup') {
    await withCredentialLock(path.join(directory, 'security.json'), async () => {
      await fs.writeFile(path.join(directory, 'peer-ready'), 'ready');
      await new Promise(resolve => setTimeout(resolve, 250));
      await fs.writeFile(security.file, JSON.stringify(fixture.node));
    });
  } else {
    await security.verify(current);
    if (action === 'change') await security.change(current, next);
  }
  console.log(JSON.stringify({ ok: true }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
