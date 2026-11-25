const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Security, comparePassword } = require('../src/core/security.cjs');
const { resolveDataDirectory, syncPassword } = require('../src/core/profile.cjs');
const fixture = require('./fixtures/security-v1.json');

async function temp(t) {
  const root = path.resolve(__dirname, '../work');
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, 'password-sync-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), root);
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('Node accepts existing Node and legacy Rust credentials and rejects wrong passwords', async () => {
  for (const record of [fixture.node, fixture.legacyRust]) {
    assert.equal(await comparePassword(fixture.password, record), true);
    assert.equal(await comparePassword('incorrect-password', record), false);
  }
});

test('shared profile follows native manifest; invalid manifests never create a second profile', async t => {
  const root = await temp(t), env = { LOCALAPPDATA: path.join(root, 'local'), APPDATA: path.join(root, 'roaming') };
  assert.equal(await resolveDataDirectory(env), path.join(env.APPDATA, 'antigravity-custom'));
  const manifest = path.join(env.LOCALAPPDATA, 'Programs/Antigravity/resources/agc-custom/install.json');
  await fs.mkdir(path.dirname(manifest), { recursive: true });
  const directory = path.join(root, 'custom-profile');
  await fs.writeFile(manifest, JSON.stringify({ product: 'antigravity-custom-native', dataDirectory: directory }));
  assert.equal(await resolveDataDirectory(env), directory);
  for (const content of ['{broken', JSON.stringify({ product: 'antigravity-custom-native', dataDirectory: 'relative' })]) {
    await fs.writeFile(manifest, content);
    await assert.rejects(resolveDataDirectory(env));
  }
});

test('explicit password sync backs up native credentials, preserves config/assets and reads changes across instances', async t => {
  const root = await temp(t), legacy = path.join(root, 'legacy'), native = path.join(root, 'native');
  await fs.mkdir(legacy); await fs.mkdir(native);
  const old = JSON.stringify({ ...fixture.node, failures: 2 });
  await fs.writeFile(path.join(legacy, 'security.json'), JSON.stringify(fixture.legacyRust));
  await fs.writeFile(path.join(native, 'security.json'), old);
  await fs.writeFile(path.join(native, 'config.json'), '{"personal":"preserve"}');
  const result = await syncPassword(legacy, native);
  assert.equal(result.changed, true);
  assert.equal(await fs.readFile(result.backup, 'utf8'), old);
  assert.equal(await fs.readFile(path.join(native, 'config.json'), 'utf8'), '{"personal":"preserve"}');
  const launcher = new Security(native), app = new Security(native);
  await launcher.verify(fixture.password);
  await launcher.change(fixture.password, 'new-shared-password');
  await assert.rejects(app.verify(fixture.password));
  await app.verify('new-shared-password');
  await app.change('new-shared-password', 'changed-in-native');
  await launcher.verify('changed-in-native');
  const before = await fs.readFile(app.file, 'utf8');
  await fs.writeFile(path.join(legacy, 'security.json'), '{}');
  await assert.rejects(syncPassword(legacy, native));
  assert.equal(await fs.readFile(app.file, 'utf8'), before);
});

test('independent credential authorities serialize setup and release shared lock after rejection', async t => {
  const root = await temp(t), a = new Security(root), b = new Security(root);
  const results = await Promise.allSettled([a.setup('first-password'), b.setup('second-password')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const winner = results[0].status === 'fulfilled' ? 'first-password' : 'second-password';
  await b.verify(winner);
  await assert.rejects(fs.stat(path.join(root, 'security.json.lock')));
});
