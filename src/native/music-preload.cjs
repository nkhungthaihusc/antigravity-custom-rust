const{contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('musicHost',Object.freeze({ready:()=>ipcRenderer.send('agc-native:music:ready'),status:value=>ipcRenderer.send('agc-native:music:status',value),onUpdate:callback=>ipcRenderer.on('agc-native:music:update',(_event,value)=>callback(value))}));
