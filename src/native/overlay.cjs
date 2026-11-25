const {app,WebContentsView,ipcMain,protocol,net}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),{pathToFileURL}=require('node:url');
const {Security}=require('./core/security.cjs');const {ConfigStore}=require('./core/store.cjs');const {normalizeConfig,mediaId}=require('./core/config.cjs');const {getLiveQuota}=require('./core/quota.cjs');
const {createSettings}=require('./settings.cjs');
const {createMusic}=require('./music.cjs');
if(!app.isReady())protocol.registerSchemesAsPrivileged([{scheme:'agc-asset',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
const shutdownWindows=new WeakSet();
const screens=new Map();let servicePromise,registered=false;
async function service(){
 if(!servicePromise)servicePromise=(async()=>{
  const manifest=JSON.parse(await fs.readFile(path.join(__dirname,'install.json'),'utf8'));if(manifest.product!=='antigravity-custom-native'||!path.isAbsolute(manifest.dataDirectory))throw new Error('Manifest tùy biến không hợp lệ.');
  const store=new ConfigStore(manifest.dataDirectory,normalizeConfig),config=await store.load(),security=new Security(manifest.dataDirectory);
  const assetUrl=id=>mediaId(id)?pathToFileURL(path.join(manifest.dataDirectory,'assets',id)).href:'';
  protocol.handle('agc-asset',async request=>{try{const url=new URL(request.url),file=assetUrl(url.pathname.slice(1));if(url.hostname!=='local'||!file)return new Response(null,{status:403});return net.fetch(file);}catch{return new Response(null,{status:404});}});
  return {manifest,store,config,security,assetUrl,dataDirectory:manifest.dataDirectory,music:createMusic(assetUrl),windows:new Set()};
 })();return servicePromise;
}
function register(){
 if(registered)return;registered=true;
 for(const method of ['bootstrap','authenticate','finish','dismiss-preview','mute-sound','voice-activity'])ipcMain.handle(`agc-native:splash:${method}`,async(event,arg)=>{
  try{
   const state=screens.get(event.sender.id);if(!state||event.senderFrame!==event.sender.mainFrame||event.senderFrame.url!==pathToFileURL(path.join(__dirname,'splash.html')).href)throw new Error('Nguồn xác thực không hợp lệ.');
   const s=await service();
   if(method==='mute-sound'){s.music.setMuted(event.sender.id,arg===true);return{ok:true,value:true};}
   if(method==='voice-activity'){s.music.setDuck(event.sender.id,arg===true);return{ok:true,value:true};}
   if(method==='bootstrap')return{ok:true,value:{config:s.config,quota:getLiveQuota(s.config.quota),audioUrl:s.assetUrl(s.config.splash.audioId),cueAudioUrls:Object.fromEntries(Object.entries(s.config.rg.cueAudioIds).map(([key,id])=>[key,s.assetUrl(id)])),startupAudioUrl:s.assetUrl(s.config.rg.startupAudioId),endAudioUrl:s.assetUrl(s.config.rg.endAudioId),closing:!!state.closing,configured:(await s.security.status()).configured,authenticated:state.authenticated||state.reusedSession,ready:state.ready,preview:!!state.preview,readinessError:state.readinessError||'',version:'0.4.2'}};
   if(method==='dismiss-preview'){
    if(!state.preview)throw new Error('Thao tác chỉ dùng trong màn xem trước.');
    setImmediate(()=>state.release());return{ok:true,value:true};
   }
   if(method==='authenticate'){
    const status=await s.security.status();
    if(status.configured)await s.security.verify(arg?.password);
    else{if(arg?.password!==arg?.confirmation)throw new Error('Hai mật khẩu chưa khớp.');await s.security.setup(arg?.password);}
    state.authenticated=true;return{ok:true,value:{authenticated:true,ready:state.ready}};
   }
   s.security.require();if(!state.authenticated&&!state.reusedSession)throw new Error('Chưa xác thực splash.');
   if(!state.ready)return{ok:true,value:{finished:false,waiting:true}};
   setImmediate(()=>state.release());return{ok:true,value:{finished:true}};
  }catch(e){return{ok:false,error:e.message};}
 });
}
function create({getHubWebContents,getHubView}){
 register();
 function attachLoadingOverlay(win,foregroundColor,backgroundColor,afterUnlock,options={}){
  const hub=getHubWebContents(win)??win.webContents;
  const view=new WebContentsView({webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webviewTag:false,autoplayPolicy:'no-user-gesture-required'}});
  view.setBackgroundColor('#00000000');
  const state={win,view,hub,ready:!!options.preview,preview:!!options.preview,authenticated:false,reusedSession:false,disposed:false,closing:!!options.closing},screenId=view.webContents.id;screens.set(screenId,state);
  let poll,manager,ownedDebugger=false,debugListener;
  const resize=()=>{if(!win.isDestroyed()&&!view.webContents.isDestroyed()){const[w,h]=win.getContentSize();view.setBounds({x:0,y:0,width:w,height:h});}};
  win.contentView.addChildView(view);resize();win.on('resize',resize);
  const allowed=pathToFileURL(path.join(__dirname,'splash.html')).href;
  view.webContents.on('will-navigate',(event,url)=>{if(url!==allowed)event.preventDefault();});view.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  view.webContents.once('destroyed',()=>{screens.delete(screenId);void service().then(s=>{s.music.setDuck(screenId,false);s.music.setMuted(screenId,false);});});
  async function removeRuntime(){if(!hub.isDestroyed()){await hub.executeJavaScript('window.__agcCleanup?.()').catch(()=>{});if(ownedDebugger&&hub.debugger.isAttached())hub.debugger.detach();}if(debugListener)hub.debugger.off('message',debugListener);debugListener=null;ownedDebugger=false;}
  async function updateRuntime(){
   const s=await service();if(hub.isDestroyed())return;
   const url=new URL(hub.getURL());if(!['https:','http:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname))return;
   if(!hub.debugger.isAttached()){
    hub.debugger.attach('1.3');ownedDebugger=true;await hub.debugger.sendCommand('Runtime.enable');await hub.debugger.sendCommand('Runtime.addBinding',{name:'__agcCommand'});
    debugListener=(_event,method,params)=>{if(method!=='Runtime.bindingCalled'||params.name!=='__agcCommand')return;void(async()=>{
     let command;try{command=JSON.parse(params.payload);
      if(command.type==='settings-tab-close'){manager.hide();return;}
      if(command.type==='settings-tab-bounds'){manager.updateBounds(command.bounds);return;}
      if(command.type==='quota-update'&&command.quota){const q={...(s.config.quota||{}),...command.quota};s.config.quota=q;try{s.security.require();s.config=await s.store.save({...s.config,quota:q});}catch{}return;}
      s.security.require();
      if(command.type==='settings-tab-open')await manager.show({embedded:true,bounds:command.bounds});
      else if(command.type==='settings')await manager.show();
      else if(command.type==='remove')await removeRuntime();
      else if(command.type==='select'&&s.config.presets.some(p=>p.id===command.id)){s.config=await s.store.save({...s.config,selectedPreset:command.id});await updateRuntime();}
     }catch(e){if(e.message?.includes('Phiên đã khóa'))attachLoadingOverlay(win,foregroundColor,backgroundColor,()=>manager.show({embedded:command?.type==='settings-tab-open',bounds:command?.bounds}));}
    })();};hub.debugger.on('message',debugListener);
   }
   let wallpaperData='';const id=s.config.wallpaper.mediaId;
   if(mediaId(id)&&/\.(png|jpe?g|webp|gif)$/i.test(id)){try{const file=path.join(s.dataDirectory,'assets',id),stat=await fs.stat(file);if(stat.size<=8*1024*1024){const ext=path.extname(id).slice(1);wallpaperData=`data:image/${ext==='jpg'?'jpeg':ext};base64,${(await fs.readFile(file)).toString('base64')}`;}}catch{}}
   if(!wallpaperData){try{const file=path.join(__dirname,'white-gundam.png'),stat=await fs.stat(file);if(stat.size<=8*1024*1024)wallpaperData=`data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;}catch{}}
   const data={native:true,origin:url.origin,preset:s.config.presets.find(p=>p.id===s.config.selectedPreset),presets:s.config.presets,wallpaper:s.config.wallpaper,wallpaperData,quota:getLiveQuota(s.config.quota)};
   const source=await fs.readFile(path.join(__dirname,'runtime.js'),'utf8');await hub.executeJavaScript(`(${source})(${JSON.stringify(data)})`);
  }
  const dispose=()=>{if(state.disposed)return;state.disposed=true;clearInterval(poll);win.off('resize',resize);hub.off('did-finish-load',checkReady);if(!win.isDestroyed()){try{win.contentView.removeChildView(view);}catch{}}if(!view.webContents.isDestroyed())view.webContents.close();};
  state.release=async()=>{if(state.disposed)return;dispose();if(options.preview){options.onReturn?.();return;}hub.focus();
   if(!shutdownWindows.has(win)){shutdownWindows.add(win);let closing=false;
    void service().then(s=>{const onClose=event=>{if(closing||!s.config.rg.shutdownEnabled||s.config.presets.find(p=>p.id===s.config.selectedPreset)?.family!=='gundam')return;event.preventDefault();closing=true;attachLoadingOverlay(win,foregroundColor,backgroundColor,undefined,{closing:true});const timer=setTimeout(()=>{if(!win.isDestroyed())win.close();},4000);win.once('closed',()=>clearTimeout(timer));};win.on('close',onClose);});
   }
   try{await updateRuntime();if(afterUnlock)await afterUnlock();}catch{/* Keep the authenticated App usable if its custom panel fails. */}};
  let checking=false;
  async function checkReady(){if(checking||state.disposed||hub.isDestroyed())return;checking=true;try{
   const ready=await hub.executeJavaScript('Boolean(document.querySelector("#root")?.childElementCount && (document.querySelector("[contenteditable=\\"true\\"],textarea") || document.querySelectorAll("button").length > 6))');
   if(ready){state.ready=true;clearInterval(poll);if(!view.webContents.isDestroyed())view.webContents.send('agc-native:splash:ready',true);}
  }catch(e){state.readinessError=e.message;}finally{checking=false;}}
  hub.on('did-finish-load',checkReady);poll=setInterval(checkReady,250);
  void(async()=>{const s=await service();state.reusedSession=s.security.isUnlocked();if(!options.preview&&!options.closing){s.windows.add(win);await s.music.update(s.config);manager=createSettings({win,hub,manifest:s.manifest,security:s.security,store:s.store,dataDirectory:s.dataDirectory,executable:process.execPath,getConfig:()=>s.config,setConfig:value=>s.config=value,updateRuntime,removeRuntime,music:s.music,getHubBounds:()=>getHubView?.(win)?.getBounds?.()||{x:0,y:0},preview:()=>attachLoadingOverlay(win,foregroundColor,backgroundColor,undefined,{preview:true,onReturn:()=>manager.focus()})});}})();
  void view.webContents.loadFile(path.join(__dirname,'splash.html')).then(()=>view.webContents.focus());
  win.once('closed',()=>{dispose();manager?.dispose();void removeRuntime();if(!options.preview)void service().then(s=>{s.windows.delete(win);if(!s.windows.size)s.music.stop();});});
 }
 return{attachLoadingOverlay};
}
module.exports={create};
