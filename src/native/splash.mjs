import{createCuePlayer}from'./renderer/cue-player.mjs';
import{mountPlavskyMotion}from'./renderer/plavsky-motion.mjs';
import{animateScene}from'./renderer/scene.mjs';
import{createAnnouncer}from'./renderer/voice.mjs';
const $=s=>document.querySelector(s),api=window.nativeCustom;
let state,ready=false,bootStarted=false,animationFinished=false,finishing=false,audio,announcer,skipTimer,rgActive=false;
let cuePlayer,cueMode=false,trackMode=false,cueGeneration=0,authPending=false;
let muted=false,flowTimer,cinematic,cinematicTimer,cinematicAttempted=false,cinematicFinished=false,removeMotion=()=>{};
const audioStatus=text=>{$('#audio-status').hidden=!rgActive;$('#audio-status').textContent=text;};
function stopCinematic(){clearTimeout(cinematicTimer);if(cinematic){cinematic.onended=null;cinematic.onerror=null;cinematic.onplaying=null;cinematic.ontimeupdate=null;cinematic.pause();cinematic.removeAttribute('src');cinematic.load();cinematic=null;}void api.voiceActivity(false).catch(()=>{});}
function startCinematic(preview=false){
 if(!trackMode)return false;
 if(cinematicAttempted)return !cinematicFinished;
 if(!rgActive||(!preview&&state.config.rg.cinematicMode!=='full')||!state.startupAudioUrl||!state.config.splash.enabled)return false;
 cinematicAttempted=true;cinematic=$('#cinematic-audio');cinematic.src=state.startupAudioUrl;cinematic.volume=state.config.splash.volume/100;cinematic.muted=muted;
 const complete=()=>{cinematicFinished=true;stopCinematic();audioStatus('Âm khởi động đã kết thúc');if(bootStarted&&(!cueMode||welcomeShown)){animationFinished=true;showWelcome();}};
 cinematic.onended=complete;cinematic.onerror=()=>{audioStatus('Không đọc được âm khởi động. Hãy chọn lại file trong RG System.');cinematicFinished=true;stopCinematic();if(bootStarted&&(!cueMode||welcomeShown)){animationFinished=true;showWelcome();}};
 cinematic.onplaying=()=>audioStatus(muted?'Âm khởi động đang phát · đang tắt tiếng':'Âm khởi động đang phát');
 cinematic.ontimeupdate=()=>{if(bootStarted&&!welcomeShown&&cinematic?.currentTime>2)flow('welcome','CHÀO MỪNG TỚI ANTIGRAVITY');};
 cinematicTimer=setTimeout(complete,120000);void api.voiceActivity(true);
 void cinematic.play().catch(()=>{cinematicFinished=true;stopCinematic();audioStatus('Chưa phát được âm thanh. Bấm Nghe thử để thử lại.');if(bootStarted&&(!cueMode||welcomeShown)){animationFinished=true;showWelcome();}});
 return true;
}
function playCue(event){return state?.cueAudioUrls?.[event]?cuePlayer?.play(event)||Promise.resolve('missing'):Promise.resolve('missing');}
function flow(name,label){document.body.dataset.flow=name;$('#flow-banner').textContent=label;}
const names={sao:'Link Start',gundam:'System Startup',focus:'Ready to Focus'};
function stage(id,number,label){for(const key of['consent','identity','boot','welcome'])$(`#${key}`).hidden=key!==id;document.body.dataset.phase=id;$('#step').textContent=`0${number} / 04 · ${label}`;$('#progress').style.width=`${number*25}%`;}
function rgStatus(text,error=false){const el=$('#rg-auth-status');if(el)el.textContent=text;document.body.classList.toggle('rg-access-denied',error);}
function status(text){$('#system-status').textContent=text;}
let welcomeShown=false;
function updateQuotaTelemetry(){
 const q = state.quota || state.config?.quota || { gemini5h: 99, geminiWeek: 100, codex5h: 100, codexWeek: 100 };
 const setBar = (valId, barId, val) => {
  const num = typeof val === 'number' ? Math.max(0, Math.min(100, Math.round(val))) : 100;
  const vEl = $(valId), bEl = $(barId);
  if (vEl) vEl.textContent = `${num}%`;
  if (bEl) { bEl.style.width = `${num}%`; bEl.classList.toggle('low', num <= 20); }
 };
 setBar('#splash-q-gemini-5h', '#splash-q-gemini-5h-bar', q.gemini5h);
 setBar('#splash-q-gemini-week', '#splash-q-gemini-week-bar', q.geminiWeek);
 setBar('#splash-q-codex-5h', '#splash-q-codex-5h-bar', q.codex5h);
 setBar('#splash-q-codex-week', '#splash-q-codex-week-bar', q.codexWeek);
}
function showWelcome(){
 if(!ready||!animationFinished||welcomeShown)return;
 welcomeShown=true;
 stage('welcome',4,'Sẵn sàng');flow('ready','HỆ THỐNG SẴN SÀNG');
 $('#welcome-title').textContent='Chào '+(state.config.splash.displayName||'Pilot');
 status('Giao diện Antigravity đã sẵn sàng');rgStatus('SYSTEM ONLINE');
 updateQuotaTelemetry();
 const enter=$('#enter-system');
 enter.hidden=false;
 enter.focus();
}
function fadeAudioDown(durationMs){
 const targets=[audio,cinematic].filter(el=>el&&!el.paused&&el.volume>0);
 if(!targets.length)return[];
 const initial=targets.map(el=>el.volume);
 const start=performance.now();
 const step=()=>{
  const progress=Math.min(1,(performance.now()-start)/Math.max(100,durationMs));
  const factor=Math.pow(1-progress,1.6);
  targets.forEach((el,i)=>{try{el.volume=Math.max(0,initial[i]*factor);}catch{}});
  if(progress<1&&finishing)requestAnimationFrame(step);
 };
 requestAnimationFrame(step);
 return targets.map((el,i)=>({el,vol:initial[i]}));
}
async function enterSystem(){
 if(!welcomeShown||finishing)return;
 finishing=true;
 const button=$('#enter-system');if(button)button.disabled=true;flow('entering','ĐANG VÀO ANTIGRAVITY');
 status('Đang khởi chạy giao diện Antigravity…');
 const overlay=$('#transition-overlay');if(overlay)overlay.hidden=false;
 document.body.classList.add('is-entering');
 if(cueMode)void playCue('enter');
 const reduced=document.body.classList.contains('reduced-motion')||state.config.accessibility.reducedMotion;
 const transitionDuration=reduced?300:1200;
 const savedVolumes=fadeAudioDown(transitionDuration);
 if(!reduced){
  setTimeout(()=>{
   const statusEl=$('#transition-status');
   if(statusEl)statusEl.textContent='WORKSPACE SYNCHRONIZED · LAUNCHING';
  },600);
 }
 await new Promise(r=>setTimeout(r,transitionDuration));
 try{
  if((await api.finish()).finished){audio?.pause();cuePlayer?.stop();stopCinematic();return;}
  status('Đang chờ giao diện App…');
 }catch(e){status(e.message);}
 finishing=false;if(button){button.disabled=false;button.hidden=false;}
 savedVolumes.forEach(({el,vol})=>{try{el.volume=vol;}catch{}});
 document.body.classList.remove('is-entering');if(overlay)overlay.hidden=true;
 flow('ready','HỆ THỐNG SẴN SÀNG');
 void audio?.play().catch(()=>{});
}
function startSplashMusic({soundEnabled,volume}){
 if(!soundEnabled||!state.audioUrl||state.closing)return;
 audio=$('#startup-music');
 audio.src=state.audioUrl;audio.volume=volume/100;
 void audio.play().catch(()=>status('Không phát được nhạc nền đã chọn.'));
}
function startBoot(){
 if(bootStarted)return;bootStarted=true;announcer?.stop();stage('boot',3,'System initialization');const currentPreset=state.config.presets.find(p=>p.id===state.config.selectedPreset)||state.config.presets[0];$('#boot-title').textContent=(currentPreset&&names[currentPreset.family])||'Link Start';rgStatus('ACCESS GRANTED');flow('success','XÁC THỰC THÀNH CÔNG');clearTimeout(flowTimer);flowTimer=setTimeout(()=>{if(!welcomeShown)flow('welcome','CHÀO MỪNG TỚI ANTIGRAVITY');},state.config.accessibility.reducedMotion?0:700);
 status(ready?'Giao diện đã tải · đang hoàn tất hiệu ứng':'Đang chờ giao diện App');
 if(cueMode){
  clearTimeout(flowTimer);const generation=++cueGeneration;
  void(async()=>{
   await playCue('authenticated');if(generation!==cueGeneration)return;
   flow('welcome','CHÀO MỪNG TỚI ANTIGRAVITY');await playCue('welcome');
  })();
 }

 if(state.config.splash.soundEnabled){
  if(state.config.splash.chime){try{const context=new AudioContext(),osc=context.createOscillator(),gain=context.createGain();osc.frequency.value=660;gain.gain.value=state.config.splash.volume/100*.05;osc.connect(gain);gain.connect(context.destination);osc.start();gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.45);osc.stop(context.currentTime+.5);setTimeout(()=>context.close(),600);}catch{}}
 }
 if(startCinematic())return;
 const duration=5000;
 skipTimer=setTimeout(()=>{animationFinished=true;showWelcome();},state.config.accessibility.reducedMotion?500:duration);
}
try{
 state=await api.bootstrap();ready=state.ready;muted=!state.config.splash.soundEnabled;const preset=state.config.presets.find(p=>p.id===state.config.selectedPreset)||state.config.presets[0],rg=state.config.rg;
 const sao=preset.family==='sao';
 document.body.dataset.themeFamily=preset.family;
 document.body.style.setProperty('--accent',preset.accent);
 document.body.style.setProperty('--sao-bg',preset.background);
 document.body.style.setProperty('--sao-text',preset.foreground);
 if(sao){$('header small').textContent='FullDive Interface';$('.brand-sub').textContent='LINK START · CONNECTION ESTABLISHED';}
 rgActive=false;
 function applyConfiguredUI(){
  if(!state.configured){
   $('#identity-title').textContent='Thiết lập danh tính';
   $('#identity-description').textContent='Tạo mật khẩu để bảo vệ màn khởi động Antigravity.';
   $('#confirmation-wrap').hidden=false;
   $('#confirmation').required=true;
   $('#password').minLength=8;
   $('#password').autocomplete='new-password';
   $('#authenticate').textContent='Tạo mật khẩu';
  }else{
   $('#identity-title').textContent='Xác minh danh tính';
   $('#identity-description').textContent='Nhập mật khẩu để tiếp tục vào Antigravity.';
   $('#confirmation-wrap').hidden=true;
   $('#confirmation').required=false;
   $('#password').minLength=1;
   $('#password').autocomplete='current-password';
   $('#authenticate').textContent='Xác nhận danh tính';
  }
 }
 applyConfiguredUI();
 const hasEventSources=Object.values(state.cueAudioUrls||{}).some(Boolean);
 cueMode=sao||(hasEventSources&&(rg.audioMode==='events'||rg.audioMode==='parallel'));
 trackMode=!sao&&(rg.audioMode==='track'||rg.audioMode==='parallel'||(!hasEventSources&&!!state.startupAudioUrl));
 if(cueMode||state.cueAudioUrls?.begin)cuePlayer=createCuePlayer({element:$('#cue-audio'),sources:state.cueAudioUrls,volume:state.config.splash.volume/100,muted,
  onActivity:active=>{if(audio)audio.volume=state.config.splash.volume/100*(active ? 0.28 : 1);void api.voiceActivity(active).catch(()=>{});},
  onStatus:(event,result)=>{const labels={begin:'Bắt đầu',verifying:'Chờ xác minh',authenticated:'Xác thực thành công',welcome:'Chào mừng',enter:'Vào Antigravity',shutdown:'Kết thúc phiên'};audioStatus(result==='playing'?`Đang phát: ${labels[event]}`:result==='error'||result==='timeout'?`Không phát được cue: ${labels[event]}`:result==='interrupted'||result==='muted'||result==='disposed'?`Đã dừng: ${labels[event]}`:`Đã phát: ${labels[event]}`);}});
document.body.classList.toggle('rg-system',false);document.body.dataset.phase='consent';
 const reduced=state.config.accessibility.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches||(sao&&!preset.motion);
 const hasCustomMedia=Boolean(state.config.splash.mediaId);
 const hasBackdrop=true;
 document.body.classList.toggle('reduced-motion',reduced);
 document.body.classList.toggle('has-custom-backdrop',true);
 removeMotion=()=>{};
 if(sao){$('#scene').hidden=false;removeMotion=animateScene($('#scene'),()=>preset,()=>!reduced);}
 $('#preset-label').textContent=preset.name;$('#native-preview-label').hidden=!state.preview;
 flow('consent','SẴN SÀNG BẮT ĐẦU');
 const video=$('#backdrop-video');
 if(hasCustomMedia&&!/\.(mp4|webm)$/i.test(state.config.splash.mediaId)){
  $('#backdrop-image').src=`agc-asset://local/${state.config.splash.mediaId}`;
  $('#backdrop-image').hidden=false;
 }else if(sao&&reduced&&!hasCustomMedia){
  video.pause();video.removeAttribute('src');video.load();video.hidden=true;
  $('#backdrop-image').src='renderer/sao-poster.jpg';$('#backdrop-image').hidden=false;
 }else{
  video.src=hasCustomMedia?`agc-asset://local/${state.config.splash.mediaId}`:sao?'renderer/sao.mp4':'white-gundam.mp4';
  if(sao){video.poster='renderer/sao-poster.jpg';video.onerror=()=>{video.hidden=true;$('#backdrop-image').src='renderer/sao-poster.jpg';$('#backdrop-image').hidden=false;};}
  video.hidden=false;video.muted=true;video.loop=true;video.playsInline=true;
  video.play().catch(()=>{});
 }
 $('#begin').onclick=()=>{announcer?.stop();if(state.cueAudioUrls?.begin)void playCue('begin');if(trackMode&&!state.cueAudioUrls?.begin)startCinematic();$('#startup-preview').hidden=true;stage('identity',2,state.configured?'Nhập mật khẩu':'Tạo mật khẩu');flow('identity','XÁC MINH NGƯỜI ĐIỀU KHIỂN');rgStatus('IDENTITY CHECK');applyConfiguredUI();$('#password').focus();status('Đang chờ xác minh mật khẩu');};
 $('#auth-form').onsubmit=async event=>{
  event.preventDefault();if(authPending)return;authPending=true;$('#authenticate').disabled=true;$('#auth-error').textContent='';
  try{
   rgStatus('VERIFYING');flow('verifying','ĐANG XÁC NHẬN DANH TÍNH');$('#authenticate').textContent='Đang xác nhận…';if(cueMode)void playCue('verifying');
   const result=await api.authenticate({password:$('#password').value,confirmation:$('#confirmation').value});
   $('#password').value='';$('#confirmation').value='';state.configured=true;state.authenticated=true;ready=result.ready;startBoot();
  }catch(e){
   cuePlayer?.stop();$('#auth-error').textContent=e.message;rgStatus('ACCESS DENIED',true);flow('identity',state.configured?'MẬT KHẨU CHƯA ĐÚNG':'KHỞI TẠO MẬT KHẨU');
  }finally{
   authPending=false;$('#authenticate').disabled=false;$('#authenticate').textContent=state?.configured?'Xác nhận danh tính':'Tạo mật khẩu';
  }
 };
 $('#skip').onclick=()=>{cueGeneration++;cuePlayer?.stop();cinematicFinished=true;stopCinematic();audioStatus('Đã bỏ qua âm khởi động');clearTimeout(skipTimer);animationFinished=true;$('#skip').hidden=true;showWelcome();};
 $('#enter-system').onclick=enterSystem;
 if(state.preview)document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();void api.dismissPreview().catch(error=>status(error.message));}
 });
 api.onReady(value=>{ready=value;if(bootStarted){$('#boot-status').textContent='Giao diện chính đã sẵn sàng.';rgStatus('CORE ONLINE');showWelcome();}});
 document.addEventListener('keydown',event=>{
  if(event.key==='Enter'){
   if(!$('#consent').hidden){event.preventDefault();$('#begin').click();}
   else if(!$('#welcome').hidden&&!finishing){event.preventDefault();enterSystem();}
  }
 });
 $('#sound-toggle').textContent=muted?'Bật âm thanh':'Tắt âm thanh';$('#sound-toggle').setAttribute('aria-pressed',String(muted));
 if(state.closing){
  for(const section of document.querySelectorAll('main section'))section.hidden=true;
  const panel=document.createElement('section');const title=document.createElement('h1');title.textContent='Kết thúc phiên';const message=document.createElement('p');message.textContent='Đang đóng Antigravity · Hẹn gặp lại';panel.append(title,message);$('main').append(panel);flow('shutdown','HẸN GẶP LẠI');status('Đang đóng Antigravity');rgStatus('Đang ngắt kết nối');$('#step').textContent='Kết thúc phiên';$('#sound-toggle').hidden=true;
  const endingSource=state.cueAudioUrls?.shutdown||state.endAudioUrl;
  if(!sao&&endingSource&&state.config.splash.soundEnabled){cinematic=$('#cinematic-audio');cinematic.src=endingSource;cinematic.volume=state.config.splash.volume/100;cinematic.muted=false;void cinematic.play().catch(()=>status('Không phát được âm kết thúc phiên.'));}
  window.addEventListener('pagehide',()=>{cueGeneration++;cuePlayer?.dispose();removeMotion();stopCinematic();},{once:true});
 }else{
 startSplashMusic(state.config.splash);
 const cueCount=Object.values(state.cueAudioUrls||{}).filter(Boolean).length;
 const modeLabel=rg.audioMode==='parallel'?`Song song · track nền & ${cueCount}/6 cue`:rg.audioMode==='events'?`Từng chức năng · ${cueCount}/6 cue riêng`:'Một track khởi động';
 $('#startup-preview').hidden=!rgActive||!((cueMode&&state.cueAudioUrls?.begin)||(trackMode&&state.startupAudioUrl));
 $('#startup-preview').onclick=()=>{
  announcer?.stop();
  if(cuePlayer?.playing||(cinematic&&!cinematic.paused)){
   cuePlayer?.stop();cinematicFinished=true;stopCinematic();audioStatus('Đã dừng nghe thử');return;
  }
  muted=false;cuePlayer?.setMuted(false);void api.muteSound(false).catch(()=>{});
  $('#sound-toggle').textContent='Tắt âm thanh';$('#sound-toggle').setAttribute('aria-pressed','false');
  if(cueMode)void playCue('begin');
  if(trackMode){cinematicAttempted=false;cinematicFinished=false;startCinematic(true);}
 };
 audioStatus(cueMode||state.startupAudioUrl?`${modeLabel} · ${muted?'đang tắt tiếng':'sẵn sàng'}`:'Chưa chọn âm khởi động trong RG System');

 if(state.authenticated)startBoot();else{$('#begin').focus();if(state.config.voice.enabled&&!state.preview&&!cueMode){announcer=createAnnouncer(new URL('./audio/',import.meta.url),state.config.voice);const volume=audio?.volume;if(audio)audio.volume=volume*.28;void api.voiceActivity(true);announcer.playSequence(['welcome','prompt']).catch(()=>{}).finally(()=>{if(audio)audio.volume=volume;return api.voiceActivity(!!cinematic&&!cinematic.paused).catch(()=>{});});}}
 $('#sound-toggle').hidden=!rgActive&&!sao&&!state.audioUrl;$('#sound-toggle').onclick=()=>{muted=!muted;cuePlayer?.setMuted(muted);void api.muteSound(muted).catch(()=>{});if(audio)audio.muted=muted;if(cinematic)cinematic.muted=muted;if(muted)announcer?.stop();audioStatus(muted?'Âm thanh đang tắt':`${modeLabel} · đã bật`);$('#sound-toggle').textContent=muted?'Bật âm thanh':'Tắt âm thanh';$('#sound-toggle').setAttribute('aria-pressed',String(muted));};
 window.addEventListener('pagehide',()=>{cueGeneration++;cuePlayer?.dispose();removeMotion();clearTimeout(flowTimer);clearTimeout(skipTimer);stopCinematic();audio?.pause();announcer?.stop();});
 }
}catch(e){status('Không thể tải cấu hình tùy biến.');$('#consent .description').textContent=e.message;$('#begin').disabled=true;}
