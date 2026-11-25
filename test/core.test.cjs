const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Security, hashPassword, comparePassword } = require('../src/core/security.cjs');
const { normalizeConfig, exportPreset, importPreset } = require('../src/core/config.cjs');
const { ConfigStore } = require('../src/core/store.cjs');
const { validateExecutable } = require('../src/core/discovery.cjs');
const { supportedTarget } = require('../src/integration/adapter.cjs');
async function temp(t) { const parent = path.resolve(__dirname,'../work/test-data'); await fs.mkdir(parent,{recursive:true}); const directory = await fs.mkdtemp(path.join(parent,'agc-')); t.after(async()=>{ if(path.dirname(path.resolve(directory))!==parent)throw new Error('Unsafe test cleanup path');await fs.rm(directory,{recursive:true,force:true}); }); return directory; }
test('scrypt verifies Unicode passwords, uses unique salts and rejects bad input', async () => {
  const a = await hashPassword('mật-khẩu-kiểm-thử'), b = await hashPassword('mật-khẩu-kiểm-thử');
  assert.notEqual(a.salt,b.salt); assert.notEqual(a.hash,b.hash);
  assert.equal(await comparePassword('mật-khẩu-kiểm-thử',a),true); assert.equal(await comparePassword('wrong-pass',a),false);
  assert.equal(await comparePassword('x',{ ...a,hash:'broken' }),false); await assert.rejects(hashPassword('short'));
});
test('launch authorization is closed until authentication, and lock/change/restart work', async t => {
  const directory = await temp(t), security = new Security(directory);
  assert.throws(()=>security.require()); await security.setup('original-password');security.require();
  assert.equal((await fs.readFile(security.file,'utf8')).includes('original-password'),false);
  security.lock();assert.throws(()=>security.require());await assert.rejects(security.verify('wrong-password'));
  await security.verify('original-password');await assert.rejects(security.change('wrong-password','new-password'));
  await security.change('original-password','new-password');
  const restarted = new Security(directory);assert.throws(()=>restarted.require());await assert.rejects(restarted.verify('original-password'));await restarted.verify('new-password');restarted.require();
});
test('rate limiting persists across restart and setup cannot overwrite a password', async t => {
  const directory=await temp(t), security=new Security(directory);await security.setup('test-password');security.lock();
  for(let i=0;i<5;i++)await assert.rejects(security.verify('not-the-password'));
  const restarted=new Security(directory);assert.ok((await restarted.status()).retryAfterMs>0);await assert.rejects(restarted.verify('test-password'),/Thử lại/);await assert.rejects(restarted.setup('another-password'));
});
test('concurrent initial setup allows exactly one password, corrupt records fail closed', async t => {
  const directory=await temp(t), security=new Security(directory);
  const results=await Promise.allSettled([security.setup('first-password'),security.setup('second-password')]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  await fs.writeFile(security.file,'{}');await assert.rejects(security.status());await assert.rejects(security.setup('overwrite-password'));
});
test('preset export excludes all machine/private values; imports whitelist data', () => {
  const config=normalizeConfig({launcher:{executable:'C:\\private\\Antigravity.exe'},splash:{displayName:'Private name',audioId:'abcdef12-abcd-abcd-abcd-abcdef123456.mp3'},integration:{enabled:true}});
  const exported=exportPreset(config), json=JSON.stringify(exported);
  for(const term of ['Private name','private','executable','audioId','integration','password'])assert.equal(json.includes(term),false);
  exported.launcher={executable:'C:\\evil.exe'};exported.splash.displayName='attacker';exported.splash.audioId='../secret';exported.preset.accent='url(https://evil.example)';exported.preset.__proto__={polluted:true};
  const imported=importPreset(config,exported,'custom-test');assert.equal(imported.launcher.executable,config.launcher.executable);assert.equal(imported.splash.displayName,'Private name');assert.equal(imported.splash.audioId,config.splash.audioId);assert.equal(imported.integration.enabled,true);assert.match(imported.presets.at(-1).accent,/^#[0-9a-f]{6}$/i);assert.equal({}.polluted,undefined);
  assert.throws(()=>importPreset(config,{format:'bad'},'bad'));
});
test('config validation bounds effects and blocks asset traversal', () => {
  const config=normalizeConfig({splash:{durationMs:-3,volume:1000,mediaId:'../../security.json'},wallpaper:{opacity:999,blur:-4},selectedPreset:'missing',presets:[{id:'../../../bad'}]});
  assert.equal(config.splash.durationMs,1000);assert.equal(config.splash.volume,100);assert.equal(config.splash.mediaId,'');assert.equal(config.wallpaper.opacity,40);assert.equal(config.wallpaper.blur,0);assert.equal(config.selectedPreset,'sao');
});
test('config saves survive concurrent writes and malformed JSON is backed up', async t => {
  const directory=await temp(t), store=new ConfigStore(directory,normalizeConfig);
  await Promise.all([store.save({selectedPreset:'gundam'}),store.save({selectedPreset:'paper'})]);assert.equal((await store.load()).selectedPreset,'paper');
  await fs.writeFile(store.file,'{invalid');assert.equal((await store.load()).selectedPreset,'sao');assert.equal(store.recovered,true);assert.ok((await fs.readdir(directory)).some(name=>name.includes('.invalid-')));
});
test('executable selector accepts only App filename and PE header', async t => {
  const directory=await temp(t);const good=path.join(directory,'Antigravity.exe');await fs.writeFile(good,'MZfixture');assert.equal(await validateExecutable(good),good);
  await assert.rejects(validateExecutable(path.join(directory,'cmd.exe')));await fs.writeFile(good,'bad');await assert.rejects(validateExecutable(good));
});
test('runtime adapter never selects external pages or native popup pages', () => {
  const target={type:'page',title:'Antigravity',url:'https://127.0.0.1:34567/'};assert.equal(supportedTarget(target),true);
  for(const url of ['https://example.com','https://127.0.0.1.evil.test','data:text/html,test','file:///C:/private'])assert.equal(supportedTarget({...target,url}),false);
  assert.equal(supportedTarget({...target,type:'service_worker'}),false);assert.equal(supportedTarget({...target,title:'Unrelated browser tab'}),false);
});
test('splash HTML includes all selectors and DOM references required by splash script', async () => {
  const html = await fs.readFile(path.join(__dirname, '../src/native/splash.html'), 'utf8');
  const mjs = await fs.readFile(path.join(__dirname, '../src/native/splash.mjs'), 'utf8');
  const selectors = [...mjs.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]);
  for (const sel of selectors) {
    if (sel.startsWith('#') && !sel.includes(' ')) {
      const id = sel.slice(1);
      assert.ok(html.includes(`id="${id}"`), `Element ID ${id} must exist in splash.html`);
    }
  }
});
