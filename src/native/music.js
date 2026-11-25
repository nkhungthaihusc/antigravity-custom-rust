const audio=document.querySelector('#music');let source='',fade;
const report=error=>window.musicHost.status({playing:!audio.paused,error:error||''});
window.musicHost.onUpdate(async value=>{
 if(!value.enabled){clearInterval(fade);audio.pause();report();return;}
 if(value.source!==source){source=value.source;audio.src=source;audio.volume=0;}
 try{if(audio.paused)await audio.play();clearInterval(fade);const target=Math.max(0,Math.min(1,value.volume));fade=setInterval(()=>{const difference=target-audio.volume;if(Math.abs(difference)<.005){audio.volume=target;clearInterval(fade);}else audio.volume=Math.max(0,Math.min(1,audio.volume+difference*.22));},35);report();}catch{report('Không phát được nhạc nền đã chọn.');}
});
audio.addEventListener('error',()=>report('Không đọc được file nhạc nền.'));window.musicHost.ready();
