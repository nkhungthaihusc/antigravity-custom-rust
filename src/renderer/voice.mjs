export function createAnnouncer(baseUrl,settings){
 let audio,settle,generation=0;
 function stop(){generation++;if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}settle?.(false);settle=null;}
 async function playSequence(lines=['welcome','prompt']){
  stop();const token=generation;
  for(const line of lines){
   if(token!==generation||!['welcome','prompt'].includes(line))return;
   audio=new Audio(new URL(`${line}-${settings.style==='clean'?'clean':'system'}.wav`,baseUrl).href);audio.volume=Math.max(0,Math.min(1,settings.volume/100));
   const finished=new Promise((resolve,reject)=>{settle=resolve;audio.onended=()=>resolve(true);audio.onerror=()=>reject(new Error('Không phát được giọng thông báo.'));});
   try{const[,completed]=await Promise.all([audio.play(),finished]);if(!completed)return;}catch(error){if(token!==generation)return;throw error;}finally{settle=null;}
  }
 }
 return{playSequence,stop,get playing(){return !!audio&&!audio.paused;}};
}
