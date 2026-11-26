const fs=require('fs/promises'),path=require('path'),crypto=require('crypto');
const installer=require('../src/native/installer.cjs');
const {discoverExecutable}=require('../src/core/discovery.cjs');
const {resolveDataDirectory}=require('../src/core/profile.cjs');
(async()=>{
 const app=await installer.inspect(await discoverExecutable());
 if(!app.installed)throw new Error('Chưa có tích hợp native để kiểm tra tài nguyên.');
 const runtime=path.join(app.mod,app.manifest.runtimeRelative);
 const names=['gundam-background.mp3','gundam-gp-base.mp3','gundam-battle-start.mp3','gundam-session-end.mp3','sao-link-start.mp3','swordland.mp3'];
 const results=[];const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 for(const name of names){const source=await fs.readFile(path.resolve(__dirname,'../src/renderer/audio',name));const installed=await fs.readFile(path.join(runtime,'renderer/audio',name));results.push({name,installedMatches:hash(source)===hash(installed)});}
 const data=await resolveDataDirectory(),config=JSON.parse(await fs.readFile(path.join(data,'config.json')));
 const ids=[config.splash.mediaId,config.splash.audioId,...Object.values(config.splash.themeAudioIds||{}),config.wallpaper.mediaId,config.rg.startupAudioId,config.rg.endAudioId,...Object.values(config.rg.cueAudioIds||{})].filter(Boolean);
 const assetExists=await Promise.all(ids.map(id=>fs.stat(path.join(data,'assets',id)).then(s=>s.isFile(),()=>false)));
 console.log(JSON.stringify({bundledAudio:results,allImportedMediaPresent:assetExists.every(Boolean),configReferencesDownload:JSON.stringify(config).toLowerCase().includes('download'),runtimeCurrent:!app.updateAvailable}));
})();
