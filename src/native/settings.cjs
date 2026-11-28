const {WebContentsView,ipcMain,dialog,shell}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto'),{pathToFileURL}=require('node:url');
const {importCueFolder}=require('./core/audio-cues.cjs');
const {BUILTINS}=require('./core/presets.cjs');
const {normalizeConfig,exportPreset,importPreset}=require('./core/config.cjs');
const contexts=new Map();let registered=false;
function register(){
 if(registered)return;registered=true;
 const methods=['bootstrap','setup','unlock','lock','save','change-password','detect','choose-executable','import-media','import-cues','export-preset','import-preset','launch','minimize','open-data','remove-integration','native-status','native-install','native-uninstall','preview-native','end-session','voice-activity'];
 for(const name of methods)ipcMain.handle(`agc-native:manager:${name}`,async(event,arg)=>{
  try{const c=contexts.get(event.sender.id);if(!c||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url!==pathToFileURL(path.join(__dirname,'renderer/index.html')).href)throw new Error('Nguồn yêu cầu không hợp lệ.');
   if(!['bootstrap','setup','unlock','lock','voice-activity'].includes(name))c.security.require();return{ok:true,value:await dispatch(c,name,arg)};
  }catch(e){return{ok:false,error:e.message};}
 });
}
function publicState(c){const config=c.getConfig();return{config,builtins:BUILTINS,appVersion:'0.5.0',hostMode:c.embedded?'native-settings-tab':'native',builtinAudioBase:pathToFileURL(path.join(__dirname,'audio')+path.sep).href,musicStatus:c.music.status,nativeStatus:{installed:true,appVersion:c.manifest.appVersion},integration:{state:'native',message:'Tích hợp trong Settings của App.'},assets:{splash:config.splash.mediaId?`agc-asset://local/${config.splash.mediaId}`:'',audio:config.splash.audioId?`agc-asset://local/${config.splash.audioId}`:'',wallpaper:config.wallpaper.mediaId?`agc-asset://local/${config.wallpaper.mediaId}`:'',wallpaperImage:config.wallpaper.imageMediaId?`agc-asset://local/${config.wallpaper.imageMediaId}`:'',wallpaperVideo:config.wallpaper.videoMediaId?`agc-asset://local/${config.wallpaper.videoMediaId}`:''}};}
async function save(c,value){const config=await c.store.save(value);c.setConfig(config);await c.music.update(config);await c.updateRuntime();return publicState(c);}
async function dispatch(c,name,arg){
 const config=c.getConfig();
 switch(name){
  case'bootstrap':return{...publicState(c),security:await c.security.status(),detectedPath:c.executable};
  case'setup':return c.security.setup(arg);
  case'unlock':return c.security.verify(arg);
  case'lock':c.security.lock();return c.security.status();
  case'save':return save(c,arg);
  case'change-password':return c.security.change(arg?.current,arg?.next);
  case'launch':c.close();return{started:true,stayInWindow:true,message:'Đã trở lại Antigravity.'};
  case'end-session':setImmediate(()=>c.win.close());return true;
  case'preview-native':c.preview();return true;
  case'voice-activity':c.music.setDuck(c.webContentsId,arg===true);return true;
  case'minimize':c.win.minimize();return true;
  case'open-data':await shell.openPath(c.dataDirectory);return true;
  case'detect':return publicState(c);
  case'choose-executable':throw new Error('Đang cấu hình chính App này; không cần chọn file .exe khác.');
  case'native-status':return{installed:true,appVersion:c.manifest.appVersion};
  case'native-install':case'native-uninstall':throw new Error('Để cài/gỡ tích hợp, đóng App rồi dùng bộ quản lý Antigravity Custom.');
  case'remove-integration':await c.removeRuntime();return publicState(c);
  case'import-cues':{
   const result=await dialog.showOpenDialog({title:'Chọn thư mục Gundam-Startup-Cues đã giải nén',properties:['openDirectory']});
   if(result.canceled)return null;
   return save(c,await importCueFolder(result.filePaths[0],path.join(c.dataDirectory,'assets'),config));
  }
  case'import-media':{
   const extensions=['audio','startup-audio','end-audio'].includes(arg)?['mp3','wav','ogg','m4a']:arg==='wallpaper'?['png','jpg','jpeg','webp','gif','mp4','webm']:arg==='wallpaper-video'?['mp4','webm']:arg==='wallpaper-image'?['png','jpg','jpeg','webp','gif']:arg==='splash'?['png','jpg','jpeg','webp','gif','mp4','webm']:null;
   if(!extensions)throw new Error('Loại tài nguyên không hợp lệ.');
   const result=await dialog.showOpenDialog({title:'Chọn tài nguyên tùy biến',properties:['openFile'],filters:[{name:'Media',extensions}]});if(result.canceled)return null;
   const file=result.filePaths[0],ext=path.extname(file).slice(1).toLowerCase(),stat=await fs.stat(file),limit=100;
   if(!extensions.includes(ext)||!stat.isFile()||stat.size>limit*1024*1024)throw new Error(`File không hợp lệ hoặc vượt quá ${limit} MB.`);
   const id=`${randomUUID()}.${ext}`;const folder=path.join(c.dataDirectory,'assets');await fs.mkdir(folder,{recursive:true});await fs.copyFile(file,path.join(folder,id));
   const next=structuredClone(config);
   if(arg==='startup-audio')next.rg.startupAudioId=id;
   else if(arg==='end-audio')next.rg.endAudioId=id;
   else if(arg==='wallpaper'||arg==='wallpaper-image'||arg==='wallpaper-video'){
     if(['mp4','webm'].includes(ext)){next.wallpaper.videoMediaId=id;next.wallpaper.mode='video';}
     else{next.wallpaper.imageMediaId=id;next.wallpaper.mediaId=id;next.wallpaper.mode='image';}
   }else if(arg==='audio'){const family=next.presets.find(p=>p.id===next.selectedPreset)?.family||'focus';next.splash.themeAudioIds={...next.splash.themeAudioIds,[family]:id};}
   else next.splash.mediaId=id;
   return save(c,next);
  }
  case'export-preset':{const bundle=exportPreset(config),result=await dialog.showSaveDialog({defaultPath:`${bundle.preset.id}.agc.json`,filters:[{name:'Preset',extensions:['json']}]});if(result.canceled)return false;await fs.writeFile(result.filePath,JSON.stringify(bundle,null,2));return true;}
  case'import-preset':{const result=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Preset',extensions:['json']}]});if(result.canceled)return null;const file=result.filePaths[0];if((await fs.stat(file)).size>128*1024)throw new Error('Preset vượt quá 128 KB.');return save(c,importPreset(config,JSON.parse(await fs.readFile(file,'utf8')),`custom-${randomUUID()}`));}
  default:throw new Error('Thao tác không được hỗ trợ.');
 }
}
function createSettings(context){
 register();let view,embedded=false,requestedBounds;
 let closing=Promise.resolve();
 const hide=()=>{
  if(!view||view.webContents.isDestroyed())return;
  const previous=view,contents=previous.webContents;view=null;
  if(!context.win.isDestroyed())context.win.contentView.removeChildView(previous);
  closing=contents.executeJavaScript('window.__agcFlushSettings?.()').catch(error=>console.warn('[Antigravity Custom] Settings save:',error.message)).finally(()=>{
   if(!contents.isDestroyed())contents.close();
  });
 };
 const close=()=>{context.security.require();hide();if(embedded)void context.hub.executeJavaScript('window.__agcLeaveCustom?.()').catch(()=>{});context.hub.focus();};
 const resize=()=>{if(view&&!view.webContents.isDestroyed()&&!context.win.isDestroyed()){
   const[w,h]=context.win.getContentSize();
   if(embedded&&requestedBounds){const zoom=context.hub.getZoomFactor(),origin=context.getHubBounds?.()||{x:0,y:0};const x=Math.max(0,Math.min(w-1,Math.round(origin.x+requestedBounds.x*zoom))),y=Math.max(0,Math.min(h-1,Math.round(origin.y+requestedBounds.y*zoom)));view.setBounds({x,y,width:Math.max(1,Math.min(w-x,Math.round(requestedBounds.width*zoom))),height:Math.max(1,Math.min(h-y,Math.round(requestedBounds.height*zoom)))});}
   else view.setBounds({x:0,y:0,width:w,height:h});
 }};
 const updateBounds=bounds=>{if(!bounds||!['x','y','width','height'].every(key=>typeof bounds[key]==='number'&&Number.isFinite(bounds[key]))||bounds.width<200||bounds.height<120||bounds.width>10000||bounds.height>10000)return;requestedBounds=bounds;resize();};
 context.win.on('resize',resize);
 return{show:async(options={})=>{
  await closing;
  context.security.require();
  embedded=!!options.embedded;if(options.bounds)updateBounds(options.bounds);
  if(view&&!view.webContents.isDestroyed()){resize();view.webContents.focus();return;}
  view=new WebContentsView({webPreferences:{preload:path.join(__dirname,'settings-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false}});
  view.setBackgroundColor(embedded?'#09090a':'#101416');const wc=view.webContents,id=wc.id;contexts.set(id,{...context,close,embedded,webContentsId:id});wc.once('destroyed',()=>{contexts.delete(id);context.music.setDuck(id,false);});
  wc.setWindowOpenHandler(()=>({action:'deny'}));const allowed=pathToFileURL(path.join(__dirname,'renderer/index.html')).href;wc.on('will-navigate',(event,url)=>{if(url!==allowed)event.preventDefault();});
  context.win.contentView.addChildView(view);resize();await wc.loadFile(path.join(__dirname,'renderer/index.html'));wc.focus();
 },hide,updateBounds,focus:()=>{if(view&&!view.webContents.isDestroyed())view.webContents.focus();},dispose:()=>{context.win.off('resize',resize);if(view&&!view.webContents.isDestroyed())view.webContents.close();view=null;}};
}
module.exports={createSettings};
