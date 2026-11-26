// A mounted App shell can show offline/model errors and still be safe to reveal.
// Network availability, quota and the number of buttons are not readiness gates.
const HUB_READY_SCRIPT="Boolean(document.readyState !== 'loading' && document.querySelector('#root')?.childElementCount)";
async function probeHubReady(hub,timeoutMs=1500){
 let timer;
 try{return(await Promise.race([
  hub.executeJavaScript(HUB_READY_SCRIPT),
  new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Giao diện App chưa phản hồi.')),timeoutMs);})
 ]))===true;}finally{clearTimeout(timer);}
}
function canRevealApp(state,arg){
 if(!state.authenticated&&!state.reusedSession)throw new Error('Chưa xác thực splash.');
 return !!state.ready||arg?.allowPending===true;
}
module.exports={HUB_READY_SCRIPT,probeHubReady,canRevealApp};
