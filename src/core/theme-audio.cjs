// Resolve bundled theme audio in main; caller-supplied media IDs keep priority.
function themeAudio(config,{assetUrl,bundledUrl}){
 const family=config.presets.find(p=>p.id===config.selectedPreset)?.family,sao=family==='sao';
 const privateId=config.splash.themeAudioIds?.[family]||(!sao?config.splash.audioId:'');
 const music=privateId?assetUrl(privateId):sao?bundledUrl('swordland.mp3'):['gundam','focus'].includes(family)?bundledUrl('gundam-background.mp3'):'';
 const cues=Object.fromEntries(Object.entries(config.rg.cueAudioIds||{}).map(([event,id])=>[event,sao?'':assetUrl(id)]));
 // Link Start belongs after successful authentication, never on each password attempt.
 if(sao)cues.authenticated=bundledUrl('sao-link-start.mp3');
 if(['gundam','focus'].includes(family)&&!cues.begin)cues.begin=bundledUrl('gundam-gp-base.mp3');
 if(['gundam','focus'].includes(family)&&!cues.enter)cues.enter=bundledUrl('gundam-battle-start.mp3');
 const ending=!sao&&['gundam','focus'].includes(family)?assetUrl(config.rg.endAudioId)||bundledUrl('gundam-session-end.mp3'):'';
 return{audioUrl:music,cueAudioUrls:cues,endAudioUrl:ending,sao};
}
module.exports={themeAudio};
