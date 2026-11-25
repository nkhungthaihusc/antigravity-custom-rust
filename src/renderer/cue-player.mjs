// Playback is a consequence of app state, never a source of authorization.
export function createCuePlayer({element,sources={},volume=.25,muted=false,onActivity=()=>{},onStatus=()=>{},timeoutMs=15000}){
 let active=null,disposed=false,generation=0;
 function stop(reason='interrupted'){
  generation++;const previous=active;active=null;
  if(previous){clearTimeout(previous.timer);element.onended=null;element.onerror=null;element.onplaying=null;element.pause();element.removeAttribute('src');element.load();onActivity(false);onStatus(previous.event,reason);previous.resolve(reason);}
 }
 function play(event){
  stop();if(disposed)return Promise.resolve('disposed');
  if(!Object.hasOwn(sources,event)||!sources[event])return Promise.resolve('missing');
  if(muted)return Promise.resolve('muted');
  const token=generation;return new Promise(resolve=>{
   active={event,resolve,timer:null};if(element.dataset)element.dataset.event=event;element.src=sources[event];element.loop=false;element.volume=Math.max(0,Math.min(1,volume));element.muted=false;
   const finish=reason=>{if(token!==generation)return;stop(reason);};
   element.onended=()=>finish('ended');element.onerror=()=>finish('error');element.onplaying=()=>{if(token===generation)onStatus(event,'playing');};
   active.timer=setTimeout(()=>finish('timeout'),timeoutMs);onActivity(true);
   try{Promise.resolve(element.play()).catch(()=>finish('error'));}catch{finish('error');}
  });
 }
 return{play,stop,setMuted(value){muted=!!value;if(muted)stop('muted');},dispose(){disposed=true;stop('disposed');},get playing(){return !!active;},get event(){return active?.event||'';}};
}
