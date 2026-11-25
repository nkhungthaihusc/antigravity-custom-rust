const {contextBridge,ipcRenderer}=require('electron');
const methods=['bootstrap','setup','unlock','lock','save','change-password','detect','choose-executable','import-media','import-cues','export-preset','import-preset','launch','minimize','open-data','remove-integration','native-status','native-install','native-uninstall','preview-native','end-session','voice-activity'];
const api={};
for(const name of methods)api[name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=async arg=>{const result=await ipcRenderer.invoke(`agc-native:manager:${name}`,arg);if(!result.ok)throw new Error(result.error);return result.value;};
api.onState=callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('agc-native:manager:state',listener);return()=>ipcRenderer.removeListener('agc-native:manager:state',listener);};
api.onIntegrationStatus=()=>()=>{};
contextBridge.exposeInMainWorld('custom',Object.freeze(api));
