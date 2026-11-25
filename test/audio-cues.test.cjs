const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {CUE_FILES,importCueFolder}=require('../src/core/audio-cues.cjs');
const {normalizeConfig,exportPreset,importPreset}=require('../src/core/config.cjs');
class FakeAudio{
 constructor(){this.paused=true;this.muted=false;this.loop=false;this.volume=1;this.src='';}
 play(){this.paused=false;this.onplaying?.();return Promise.resolve();}
 pause(){this.paused=true;}removeAttribute(){this.src='';}load(){}
}
test('cue player cancels previous event, ignores stale end, and settles mute/teardown',async()=>{
 const {createCuePlayer}=await import('../src/renderer/cue-player.mjs');const element=new FakeAudio(),activity=[];
 const player=createCuePlayer({element,sources:{begin:'a',verifying:'b',authenticated:'c'},onActivity:v=>activity.push(v)});
 const first=player.play('begin'),stale=element.onended;
 const next=player.play('verifying');assert.equal(await first,'interrupted');stale();assert.equal(player.event,'verifying');
 element.onended();assert.equal(await next,'ended');assert.equal(player.playing,false);
 const auth=player.play('authenticated');player.setMuted(true);assert.equal(await auth,'muted');assert.equal(await player.play('begin'),'muted');
 player.setMuted(false);const pending=player.play('begin');player.dispose();assert.equal(await pending,'disposed');assert.equal(await player.play('begin'),'disposed');assert.equal(activity.at(-1),false);
});
test('cue player resolves missing, rejected play and stalled playback without hanging',async()=>{
 const {createCuePlayer}=await import('../src/renderer/cue-player.mjs');const element=new FakeAudio();
 const player=createCuePlayer({element,sources:{begin:'a'},timeoutMs:15});assert.equal(await player.play('unknown'),'missing');
 assert.equal(await player.play('begin'),'timeout');element.play=()=>Promise.reject(new Error('autoplay blocked'));assert.equal(await player.play('begin'),'error');player.dispose();
});
test('cue settings whitelist event IDs, preserve old track and exclude personal cues from export',()=>{
 const id='abcdef12-abcd-abcd-abcd-abcdef123456.mp3';const c=normalizeConfig({rg:{audioMode:'events',startupAudioId:id,cueAudioIds:{begin:id,enter:'../../security.json',injected:id}}});
 assert.equal(c.rg.audioMode,'events');assert.equal(c.rg.cueAudioIds.begin,id);assert.equal(c.rg.cueAudioIds.enter,'');assert.equal(Object.hasOwn(c.rg.cueAudioIds,'injected'),false);
 const p=normalizeConfig({rg:{audioMode:'parallel'}});assert.equal(p.rg.audioMode,'parallel');
 const bundle=exportPreset(c);assert.equal(JSON.stringify(bundle).includes(id),false);const next=importPreset(c,bundle,'custom-cues');assert.equal(next.rg.cueAudioIds.begin,id);assert.equal(next.rg.startupAudioId,id);
 assert.equal(normalizeConfig({}).rg.audioMode,'track');
});
test('cue folder import validates every file before copying and generates portable IDs',async()=>{
 const work=await fs.mkdtemp(path.join(path.resolve(__dirname,'../work'),'cue-import-')),folder=path.join(work,'input'),assets=path.join(work,'assets');await fs.mkdir(folder);
 const entries=Object.values(CUE_FILES);for(const name of entries.slice(1))await fs.writeFile(path.join(folder,name),Buffer.from('ID3test'));
 await assert.rejects(importCueFolder(folder,assets,normalizeConfig()));await assert.rejects(fs.stat(assets));
 await fs.writeFile(path.join(folder,entries[0]),Buffer.from('not audio'));await assert.rejects(importCueFolder(folder,assets,normalizeConfig()),/MP3/);
 await fs.writeFile(path.join(folder,entries[0]),Buffer.from('ID3test'));const c=await importCueFolder(folder,assets,normalizeConfig());
 assert.equal(c.rg.audioMode,'events');assert.equal((await fs.readdir(assets)).length,6);
 for(const id of Object.values(c.rg.cueAudioIds))assert.match(id,/^[a-f0-9-]{36}\.mp3$/);
});
