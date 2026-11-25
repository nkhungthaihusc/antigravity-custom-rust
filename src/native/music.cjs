const {WebContentsView,ipcMain}=require('electron');
const path=require('node:path'),{pathToFileURL}=require('node:url');
function createMusic(assetUrl){
 let view,ready=false,desired={enabled:false,source:'',volume:0},state={playing:false,error:''};const duckers=new Set(),muters=new Set();
 const send=()=>{if(ready&&view&&!view.webContents.isDestroyed())view.webContents.send('agc-native:music:update',{...desired,volume:desired.volume*(muters.size?0:duckers.size ? 0.28 : 1)});};
 const valid=event=>view&&!view.webContents.isDestroyed()&&event.sender===view.webContents&&event.senderFrame===view.webContents.mainFrame&&event.senderFrame.url===pathToFileURL(path.join(__dirname,'music.html')).href;
 const onReady=event=>{if(valid(event)){ready=true;send();}};
 const onStatus=(event,status)=>{if(valid(event))state={playing:!!status?.playing,error:typeof status?.error==='string'?status.error.slice(0,120):''};};
 ipcMain.on('agc-native:music:ready',onReady);ipcMain.on('agc-native:music:status',onStatus);
 async function update(config){
  const s=config.splash;desired={enabled:s.soundEnabled&&!!s.audioId&&s.musicScope==='session',source:assetUrl(s.audioId),volume:s.volume/100};
  if(desired.enabled&&!view){view=new WebContentsView({webPreferences:{preload:path.join(__dirname,'music-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,autoplayPolicy:'no-user-gesture-required',backgroundThrottling:false}});view.webContents.setAudioMuted(false);view.webContents.setWindowOpenHandler(()=>({action:'deny'}));const allowed=pathToFileURL(path.join(__dirname,'music.html')).href;view.webContents.on('will-navigate',(e,url)=>{if(url!==allowed)e.preventDefault();});await view.webContents.loadFile(path.join(__dirname,'music.html'));}
  send();
 }
 return{update,setMuted(key,active){if(active)muters.add(key);else muters.delete(key);send();},stop(){desired.enabled=false;send();},setDuck(key,active){if(active)duckers.add(key);else duckers.delete(key);send();},get status(){return state;},dispose(){ipcMain.off('agc-native:music:ready',onReady);ipcMain.off('agc-native:music:status',onStatus);if(view&&!view.webContents.isDestroyed())view.webContents.close();view=null;ready=false;}};
}
module.exports={createMusic};
