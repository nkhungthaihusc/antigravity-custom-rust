function shutdownPresentation(config){
 const family=config.presets.find(p=>p.id===config.selectedPreset)?.family;
 const sao=family==='sao';
 return{enabled:sao||(['gundam','focus'].includes(family)&&!!config.rg.shutdownEnabled),silent:sao,durationMs:sao?(config.accessibility?.reducedMotion?300:2400):4000};
}

function attachSessionClose({win,getConfig,stopAudio,createEnding,schedule=setTimeout,cancel=clearTimeout}){
 let closing=false,timer;
 const finish=()=>{if(!win.isDestroyed())win.close();};
 const onClose=event=>{
  const presentation=shutdownPresentation(getConfig());
  if(closing||!presentation.enabled)return;
  event.preventDefault();closing=true;stopAudio();
  let ending;try{ending=createEnding();}catch{finish();return;}
  // Keep shutdown bounded if loading fails; allow the normal duration after the view loads.
  timer=schedule(finish,presentation.durationMs+2000);
  ending.webContents.once('did-finish-load',()=>{cancel(timer);timer=schedule(finish,presentation.durationMs);});
 };
 win.on('close',onClose);
 win.once('closed',()=>{cancel(timer);win.off('close',onClose);});
}
module.exports={shutdownPresentation,attachSessionClose};
