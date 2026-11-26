const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');
const {themeAudio}=require('../src/core/theme-audio.cjs');
const {normalizeConfig}=require('../src/core/config.cjs');
const {runtimeDigest}=require('../src/native/installer.cjs');
const resolve=config=>themeAudio(config,{assetUrl:id=>id?`private:${id}`:'',bundledUrl:name=>`bundled:${name}`});

test('SAO uses bundled Swordland and authenticated Link Start; other themes retain their audio',()=>{
 const sao=normalizeConfig({selectedPreset:'sao-aincrad'}),audio=resolve(sao);
 assert.equal(audio.audioUrl,'bundled:swordland.mp3');assert.deepEqual(audio.cueAudioUrls,{begin:'',verifying:'',authenticated:'bundled:sao-link-start.mp3',welcome:'',enter:'',shutdown:''});
 const gundam=resolve(normalizeConfig({selectedPreset:'sao'}));assert.equal(gundam.audioUrl,'bundled:gundam-background.mp3');assert.equal(gundam.cueAudioUrls.authenticated,'');
 const id='abcdef12-abcd-abcd-abcd-abcdef123456.mp3';
 sao.splash.audioId=id;sao.rg.cueAudioIds.authenticated=id;
 assert.equal(resolve(sao).audioUrl,'bundled:swordland.mp3');assert.equal(resolve(sao).cueAudioUrls.authenticated,'bundled:sao-link-start.mp3');
 sao.splash.themeAudioIds.sao=id;assert.equal(resolve(sao).audioUrl,`private:${id}`);
});

test('Gundam background soundtrack stays separate from startup cues for all three themes',()=>{
 const id='abcdef12-abcd-abcd-abcd-abcdef123456.mp3';
 const c=normalizeConfig({selectedPreset:'gundam',rg:{startupAudioId:id,cueAudioIds:{begin:id}},splash:{soundEnabled:true,musicScope:'session'}});
 assert.equal(c.splash.musicScope,'startup');assert.equal(resolve(c).audioUrl,'bundled:gundam-background.mp3');
 c.selectedPreset='sao-aincrad';assert.equal(resolve(c).audioUrl,'bundled:swordland.mp3');assert.equal(resolve(c).cueAudioUrls.begin,'');
 c.selectedPreset='gundam';assert.equal(resolve(c).audioUrl,'bundled:gundam-background.mp3');assert.equal(resolve(c).cueAudioUrls.begin,`private:${id}`);
 for(const selected of ['gundam','focus','paper']){c.selectedPreset=selected;assert.equal(resolve(c).audioUrl,'bundled:gundam-background.mp3');}
 c.splash.audioId=id;assert.equal(resolve(c).audioUrl,`private:${id}`);
});

test('theme audio imports validate IDs and never export personal media',()=>{
 const {exportPreset}=require('../src/core/config.cjs');const id='abcdef12-abcd-abcd-abcd-abcdef123456.mp3';
 const c=normalizeConfig({splash:{themeAudioIds:{sao:id,gundam:'../../credentials',other:id}}});
 assert.equal(c.splash.themeAudioIds.sao,id);assert.equal(c.splash.themeAudioIds.gundam,'');assert.equal(c.splash.themeAudioIds.other,undefined);
 assert.equal(JSON.stringify(exportPreset(c)).includes(id),false);
});

test('SAO has a bounded silent ending independent of the Gundam sound setting',()=>{
 const {shutdownPresentation}=require('../src/core/shutdown.cjs');
 const c=normalizeConfig({selectedPreset:'sao-aincrad',rg:{shutdownEnabled:false}});
 assert.deepEqual(shutdownPresentation(c),{enabled:true,silent:true,durationMs:2400});
 c.accessibility.reducedMotion=true;assert.equal(shutdownPresentation(c).durationMs,300);
 c.selectedPreset='gundam';assert.equal(shutdownPresentation(c).enabled,false);
 c.rg.shutdownEnabled=true;assert.equal(shutdownPresentation(c).enabled,true);assert.equal(shutdownPresentation(c).silent,false);
 assert.equal(shutdownPresentation(c).durationMs,4000);
 assert.equal(resolve(c).endAudioUrl,'bundled:gundam-session-end.mp3');
 for(const selected of ['focus','paper']){c.selectedPreset=selected;assert.equal(shutdownPresentation(c).enabled,true);}
 c.selectedPreset='sao-aincrad';assert.equal(resolve(c).endAudioUrl,'');
});

test('all Gundam variants intercept close before login and wait for the ending view',()=>{
 const {EventEmitter}=require('node:events');const {attachSessionClose}=require('../src/core/shutdown.cjs');
 for(const selected of ['gundam','focus','paper']){
  const config=normalizeConfig({selectedPreset:selected,rg:{shutdownEnabled:true}});
  const win=new EventEmitter(),contents=new EventEmitter(),tasks=new Map();let next=0,closed=0,stopped=0,shown=0;
  win.isDestroyed=()=>false;win.close=()=>{closed++;let prevented=false;win.emit('close',{preventDefault(){prevented=true;}});assert.equal(prevented,false);};
  attachSessionClose({win,getConfig:()=>config,stopAudio:()=>stopped++,createEnding:()=>{shown++;return{webContents:contents};},schedule:(fn,ms)=>{tasks.set(++next,{fn,ms});return next;},cancel:id=>tasks.delete(id)});
  let prevented=false;win.emit('close',{preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(closed,0);assert.equal(stopped,1);assert.equal(shown,1);
  assert.equal([...tasks.values()][0].ms,6000);
  contents.emit('did-finish-load');assert.equal(tasks.size,1);assert.equal([...tasks.values()][0].ms,4000);
  [...tasks.values()][0].fn();assert.equal(closed,1);assert.equal(shown,1);win.emit('closed');assert.equal(tasks.size,0);
 }
});

test('GP Base is a distinct begin cue, independent of startup track mode and absent in SAO',()=>{
 for(const selected of ['gundam','focus','paper']){
  const c=normalizeConfig({selectedPreset:selected,rg:{audioMode:'track'}}),a=resolve(c);
  assert.equal(a.cueAudioUrls.begin,'bundled:gundam-gp-base.mp3');assert.notEqual(a.cueAudioUrls.begin,a.audioUrl);
 }
 assert.equal(resolve(normalizeConfig({selectedPreset:'sao-aincrad'})).cueAudioUrls.begin,'');
});

test('Gundam entry uses the bundled battle cue in track mode and preserves private overrides',()=>{
 const id='abcdef12-abcd-abcd-abcd-abcdef123456.mp3';
 for(const selected of ['sao','gundam','focus','paper']){
  const c=normalizeConfig({selectedPreset:selected,rg:{audioMode:'track'}});
  assert.equal(resolve(c).cueAudioUrls.enter,'bundled:gundam-battle-start.mp3');
  c.rg.cueAudioIds.enter=id;assert.equal(resolve(c).cueAudioUrls.enter,`private:${id}`);
 }
 assert.equal(resolve(normalizeConfig({selectedPreset:'sao-aincrad'})).cueAudioUrls.enter,'');
});

test('legacy session scope cannot create a music player inside the App',async()=>{
 const vm=require('node:vm');let created=0;const listeners=new Map();
 const source=await fs.readFile(path.resolve(__dirname,'../src/native/music.cjs'),'utf8');
 const context={module:{exports:{}},__dirname:path.resolve(__dirname,'../src/native'),require:name=>name==='electron'?{WebContentsView:class{constructor(){created++;}},ipcMain:{on:(name,cb)=>listeners.set(name,cb),off:name=>listeners.delete(name)}}:require(name)};
 vm.runInNewContext(source,context);
 const music=context.module.exports.createMusic(()=> 'file:///bundled.mp3');
 await music.update({splash:{soundEnabled:true,musicScope:'session',volume:25}});
 assert.equal(created,0);assert.equal(music.status.playing,false);music.dispose();assert.equal(listeners.size,0);
});

test('native freshness changes when installed audio changes or is missing',async t=>{
 const root=path.resolve(__dirname,'../work/runtime-freshness');await fs.mkdir(root,{recursive:true});
 const directory=await fs.mkdtemp(path.join(root,'case-'));
 t.after(()=>{if(path.dirname(path.resolve(directory))!==root)throw new Error('Unsafe test cleanup');return fs.rm(directory,{recursive:true,force:true});});
 // Small fixture tree mirrors all installer-owned destinations, with real source files.
 const source=path.resolve(__dirname,'../src');
 const native=await fs.readdir(path.join(source,'native'));
 for(const name of native)await fs.copyFile(path.join(source,'native',name),path.join(directory,name));
 for(const name of ['renderer','core'])await fs.cp(path.join(source,name),path.join(directory,name),{recursive:true});
 await fs.copyFile(path.join(source,'integration/runtime.js'),path.join(directory,'runtime.js'));
 await fs.cp(path.resolve(source,'../assets/audio'),path.join(directory,'audio'),{recursive:true});
 const expected=await runtimeDigest(source);assert.equal(await runtimeDigest(directory,true),expected);
 await fs.appendFile(path.join(directory,'renderer/audio/sao-link-start.mp3'),'changed');
 assert.notEqual(await runtimeDigest(directory,true),expected);
 await fs.unlink(path.join(directory,'renderer/audio/sao-link-start.mp3'));
 assert.notEqual(await runtimeDigest(directory,true),expected);
});
