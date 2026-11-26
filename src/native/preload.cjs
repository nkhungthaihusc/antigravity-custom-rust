const {contextBridge,ipcRenderer}=require('electron');
const api={};
for(const name of ['bootstrap','authenticate','readiness','finish','dismiss-preview','mute-sound','voice-activity'])api[name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=async value=>{const result=await ipcRenderer.invoke(`agc-native:splash:${name}`,value);if(!result.ok)throw new Error(result.error);return result.value;};
api.onReady=callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('agc-native:splash:ready',listener);return()=>ipcRenderer.removeListener('agc-native:splash:ready',listener);};
contextBridge.exposeInMainWorld('nativeCustom',Object.freeze(api));
