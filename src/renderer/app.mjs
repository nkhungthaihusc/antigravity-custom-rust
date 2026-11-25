import { animateScene, drawScene } from './scene.mjs';
import { createAnnouncer } from './voice.mjs';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const tauriApi = window.__TAURI__?.core ? {
  bootstrap: () => window.__TAURI__.core.invoke('bootstrap'),
  setup: (password) => window.__TAURI__.core.invoke('setup_password', { password }),
  unlock: (password) => window.__TAURI__.core.invoke('unlock', { password }),
  lock: () => window.__TAURI__.core.invoke('lock'),
  save: (config) => window.__TAURI__.core.invoke('save', { config }),
  changePassword: ({ current, next }) => window.__TAURI__.core.invoke('change_password', { current, next }),
  launch: () => window.__TAURI__.core.invoke('launch'),
  minimize: () => window.__TAURI__.core.invoke('minimize'),
  openData: () => window.__TAURI__.core.invoke('open_data'),
  nativeInstall: () => window.__TAURI__.core.invoke('native_install'),
  nativeUninstall: () => window.__TAURI__.core.invoke('native_uninstall'),
  detect: () => window.__TAURI__.core.invoke('bootstrap'),
  importMedia: async () => null,
  importCues: async () => null,
  exportPreset: async () => false,
  importPreset: async () => null,
  removeIntegration: async () => window.__TAURI__.core.invoke('bootstrap'),
  onState: () => {},
  onIntegrationStatus: () => {}
} : null;
const api = window.custom || tauriApi;
let state, config, initialized = false, configured = false, filter = 'all', busy = false, saveTimer, revision = 0, savedRevision = 0, saving = Promise.resolve(), skipResolve;
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const preset = () => config.presets.find(p => p.id === config.selectedPreset) || config.presets[0];
const motion = () => !!config && preset().motion && !config.accessibility.reducedMotion && !prefersReduced;
const titles = { sao: 'White Gundam · Online', gundam: 'White Gundam · Online', focus: 'Stealth Mode · Online' };
let toastTimer,voicePreview;
const nativeHost=()=>state?.hostMode?.startsWith('native');
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 5000); }
function fail(error) { toast(error.message || String(error)); if (error.message?.includes('Phiên đã khóa')) void lock(); }
function action(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch(fail); }
function accept(next) { if (!next) return; state = { ...state, ...next }; config = next.config; render(); }
function setValue(selector, value) { const el = $(selector); if (el.type === 'checkbox') el.checked = value; else if (document.activeElement !== el) el.value = value; }
function markChanged() { revision++; $('#save-state').textContent = 'Đang lưu…'; clearTimeout(saveTimer); saveTimer = setTimeout(() => flushSave().catch(fail), 250); }
async function flushSave() {
  clearTimeout(saveTimer);
  const captured = structuredClone(config), myRevision = revision;
  saving = saving.catch(() => {}).then(() => api.save(captured));
  const next = await saving;
  savedRevision = Math.max(savedRevision,myRevision);
  if (myRevision === revision) { state = { ...state, ...next }; config = next.config; $('#save-state').textContent = 'Đã lưu trên máy'; }
  return next;
}
if (api.previewNative) window.__agcFlushSettings = () => revision > savedRevision ? flushSave().then(()=>true) : true;
function set(path, value) { let parent = config; const keys = path.split('.'); for (const key of keys.slice(0,-1)) parent = parent[key]; parent[keys.at(-1)] = value; markChanged(); renderControls(); }
function showPanel(name) {
  const labels = { themes: 'Chủ đề', splash: 'Splash & âm thanh', rg:'RG System',wallpaper: 'Nền trong App', launcher: 'Ứng dụng & bảo mật', sharing: 'Chia sẻ preset' };
  $$('.panel').forEach(panel => panel.hidden = panel.id !== `panel-${name}`);
  $$('.nav-item').forEach(button => { button.classList.toggle('active', button.dataset.panel === name); button.setAttribute('aria-current', button.dataset.panel === name ? 'page' : 'false'); });
  $('#breadcrumb-current').textContent = labels[name];
  $('.content').scrollTop = 0;
  if(name === 'themes') renderGallery();
}
function renderGallery() {
  const search = $('#theme-search').value.toLocaleLowerCase('vi');
  const visible = config.presets.filter(p => (filter === 'all' || p.mode === filter) && `${p.name} ${p.description}`.toLocaleLowerCase('vi').includes(search));
  $('#theme-count').textContent = `${visible.length} chủ đề`; $('#theme-grid').replaceChildren(); $('#empty-themes').hidden = visible.length > 0;
  for (const p of visible) {
    const button = document.createElement('button'); button.className = `theme-card${p.id === config.selectedPreset ? ' selected' : ''}`; button.dataset.preset = p.id; button.setAttribute('aria-label', p.name); button.setAttribute('aria-pressed', p.id === config.selectedPreset ? 'true' : 'false');
    const art = document.createElement('div'); art.className = 'theme-art'; const canvas = document.createElement('canvas'); art.append(canvas);
    const check = document.createElement('span'); check.className = 'theme-check'; check.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';
    const copy = document.createElement('div'); copy.className = 'theme-card-copy'; const name = document.createElement('span'); name.className = 'theme-card-title'; name.textContent = p.name;
    const mode = document.createElement('span'); mode.className = 'theme-card-mode'; mode.textContent = `${p.mode === 'dark' ? 'Giao diện tối' : 'Giao diện sáng'} · ${p.motion ? 'Có chuyển động' : 'Tĩnh'}`;
    copy.append(name, mode); button.append(art, check, copy); $('#theme-grid').append(button);
    requestAnimationFrame(() => drawScene(canvas, p));
    button.onclick = () => { config.selectedPreset = p.id; markChanged(); render(); };
  }
}
function renderControls() {
  const p = preset(); document.documentElement.style.setProperty('--accent', p.accent);
  document.body.classList.toggle('reduced-motion', config.accessibility.reducedMotion);
  $('#selected-name').textContent = p.name; $('#selected-description').textContent = p.description; $('#preview-greeting').textContent = titles[p.family];
  $('#accent-code').textContent = p.accent.toUpperCase(); setValue('#preset-accent', p.accent); setValue('#preset-motion', p.motion);
  setValue('#preset-name',p.name);
  $('#swatches').replaceChildren(); for (const color of [p.background,p.accent,p.foreground]) { const dot = document.createElement('span'); dot.className = 'swatch'; dot.style.background = color; dot.title = color; $('#swatches').append(dot); }
  $('#delete-preset').hidden = state.builtins.some(b => b.id === p.id); $('#reset-preset').hidden = !state.builtins.some(b => b.id === p.id);
  const values = { '#splash-enabled':config.splash.enabled, '#display-name':config.splash.displayName, '#splash-duration':config.splash.durationMs, '#sound-enabled':config.splash.soundEnabled, '#volume':config.splash.volume, '#chime-enabled':config.splash.chime, '#integration-enabled':config.integration.enabled, '#wallpaper-enabled':config.wallpaper.enabled, '#wallpaper-opacity':config.wallpaper.opacity, '#wallpaper-blur':config.wallpaper.blur, '#executable-path':config.launcher.executable || state.detectedPath || '', '#minimize-after-launch':config.launcher.minimizeAfterLaunch, '#reduced-motion':config.accessibility.reducedMotion };
  for (const [selector,value] of Object.entries(values)) setValue(selector,value);
  const rg = config.rg || {};
  $('#plavsky-audio-status').textContent=`Khởi động: ${rg.startupAudioId?'đã chọn':'chưa chọn'} · Kết thúc: ${rg.endAudioId?'đã chọn':'chưa chọn'}`;
  $('#cue-status').textContent=`Đã chọn ${Object.values(rg.cueAudioIds || {}).filter(Boolean).length}/6 cue · không đi theo preset chia sẻ`;
  const extra={'#audio-mode':rg.audioMode || 'track','#cinematic-mode':rg.cinematicMode || 'quick','#shutdown-enabled':!!rg.shutdownEnabled,'#rg-enabled':!!rg.enabled,'#rg-color':rg.color || '#22d3ee','#rg-operator':rg.operatorName || '','#rg-unit':rg.unitName || 'WHITE GUNDAM','#rg-model':rg.modelName || 'RG-01','#rg-class':rg.operatorClass || 'OPERATOR','#rg-system-name':rg.systemName || 'NEURAL SYSTEM','#rg-ready-text':rg.readyText || 'SYSTEM READY','#voice-enabled':!!config.voice?.enabled,'#voice-style':config.voice?.style || 'system','#voice-volume':config.voice?.volume ?? 45,'#music-scope':config.splash?.musicScope || 'startup'};
  for(const[selector,value]of Object.entries(extra))setValue(selector,value);
  $('#voice-volume-value').textContent=`${config.voice?.volume ?? 45}%`;
  for(const[selector,value]of Object.entries({'#rg-preview-operator':rg.operatorName||config.splash?.displayName||'PILOT','#rg-preview-fighter':rg.operatorName||config.splash?.displayName||'PILOT','#rg-preview-unit':rg.unitName || 'WHITE GUNDAM','#rg-preview-model':rg.modelName || 'RG-01','#rg-class':rg.operatorClass || 'OPERATOR','#rg-preview-system':rg.systemName || 'NEURAL SYSTEM','#rg-preview-banner-system':rg.systemName || 'NEURAL SYSTEM','#rg-preview-banner-text':rg.readyText || 'SYSTEM READY'})){const el=$(selector);if(el)el.textContent=value;}
  $$('#rg-preview .rg-device,#rg-preview .rg-banner').forEach(element=>element.style.setProperty('--rg-cyan',rg.color || '#22d3ee'));
  $('#duration-value').textContent = `${(config.splash.durationMs/1000).toFixed(1)} giây`; $('#volume-value').textContent = `${config.splash.volume}%`; $('#opacity-value').textContent = `${config.wallpaper.opacity}%`; $('#blur-value').textContent = `${config.wallpaper.blur}px`;
  $('#splash-file').textContent = config.splash.mediaId ? `File riêng · ${config.splash.mediaId.split('.').at(-1).toUpperCase()}` : 'Đồ họa của chủ đề';
  $('#audio-file').textContent = config.splash.audioId ? 'Đã chọn nhạc riêng' : 'Chưa chọn nhạc'; $('#wallpaper-file').textContent = config.wallpaper.mediaId ? 'Đã chọn ảnh riêng' : 'Màu theo chủ đề';
  const found = !!(config.launcher.executable || state.detectedPath); $('#target-dot').classList.toggle('ok', found); $('#target-status-text').textContent = found ? 'Đã tìm thấy bản cài' : 'Chọn file ở Launcher';
  $('#integration-dot').classList.toggle('ok', state.integration?.state === 'connected'); $('#integration-dot').classList.toggle('error', state.integration?.state === 'error'); $('#integration-message').textContent = state.integration?.message || 'Chưa kết nối.';
  if($('#native-message')){
    $('#native-message').textContent=state.nativeStatus?.installed?'Đã thay splash gốc. Mở Antigravity trực tiếp để sử dụng.':'Chưa cài tích hợp native. Cài một lần để thay splash ngay trong Antigravity.';
    $('#native-install').disabled=(!!state.nativeStatus?.installed&&!state.nativeStatus.updateAvailable)||nativeHost();
    $('#native-install').textContent=state.nativeStatus?.updateAvailable?'Cập nhật tích hợp':'Cài tích hợp native';
    $('#native-uninstall').disabled=!state.nativeStatus?.installed||nativeHost();
  }
  $('#integration-enabled').closest('.settings-card').hidden=true;
  if(nativeHost()){
    $('#launch-button').firstChild.textContent='Về Antigravity';$('#target-status-text').textContent='Tích hợp trong cửa sổ App';
    $('#integration-enabled').closest('.settings-card').hidden=true;
    $('#lock-button').lastChild.textContent='Khóa giao diện';
  }
}
function render() { renderGallery(); renderControls(); $('#version').textContent = state.appVersion; }
function showGate() {
  $('#gate').hidden = false; $('#workspace').hidden = true;
  $('#auth-eyebrow').textContent = configured ? 'Chào mừng trở lại' : 'Thiết lập lần đầu'; $('#auth-title').textContent = configured ? 'Mở khóa không gian của bạn' : 'Tạo mật khẩu launcher';
  $('#auth-description').textContent = configured ? 'Nhập mật khẩu để vào bảng tùy chỉnh và mở App.' : 'Mật khẩu được xác minh trên máy của bạn.';
  $('#confirm-wrap').hidden = configured; $('#confirm-password').required = !configured;
  $('#password').autocomplete = configured ? 'current-password' : 'new-password'; $('#password').minLength = configured ? 1 : 8;
  $('#auth-submit').firstChild.textContent = configured ? 'Mở khóa ' : 'Tạo mật khẩu ';
  $('#password').value = ''; $('#confirm-password').value = ''; $('#auth-error').textContent = ''; $('#show-password').checked = false;
  $('#password').type = 'password'; $('#confirm-password').type = 'password'; $('#password').focus();
}
async function lock() { await flushSave().catch(() => {}); await api.lock(); showGate(); }
function chime(volume) {
  const context = new AudioContext(); const master = context.createGain(); master.gain.value = volume / 100 * .12; master.connect(context.destination);
  for (const [index,freq] of [523.25,783.99].entries()) { const tone = context.createOscillator(), gain = context.createGain(); tone.type='sine';tone.frequency.value=freq;gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(.4,context.currentTime+.03+index*.1);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+.6+index*.1);tone.connect(gain);gain.connect(master);tone.start(context.currentTime+index*.1);tone.stop(context.currentTime+.75); }
  setTimeout(() => context.close(),1000);
}
async function runSplash(preview = true) {
  if(preview&&nativeHost()&&api.previewNative){if(busy)return;busy=true;try{await flushSave();await api.previewNative();}catch(e){fail(e);}finally{busy=false;}return;}
  if (busy) return; busy = true; $('#launch-button').disabled = true; $('#preview-button').disabled = true;
  let audio, timers = [], skipped = false;
  try {
    await flushSave(); clearTimeout(toastTimer); $('#toast').hidden = true;
    const show = preview; // Actual startup belongs to Antigravity's own window, never a second launcher splash.
    if (show) {
      $('#splash-overlay').hidden = false; $('#workspace').inert = true; $('#skip-splash').focus();
      $('#splash-title').textContent = titles[preset().family]; $('#splash-preset-name').textContent = preset().name;
      $('#splash-greeting').textContent = `Chào ${config.splash.displayName || 'Pilot'}, sẵn sàng cho phiên mới.`;
      $('#splash-preview-tag').textContent = preview ? 'Xem trước · không mở App' : 'Launcher'; $('#splash-phase').textContent = 'Đã xác thực launcher'; $('#splash-status').textContent = preview ? 'Đây là bản xem trước hiệu ứng.' : 'Đang gửi lệnh mở Antigravity App…'; $('#splash-progress').style.width = '25%';
      const image = $('#splash-image'), video = $('#splash-video'); image.hidden = true; video.hidden = true;
      if (config.splash.mediaId) { const url = `agc-asset://local/${config.splash.mediaId}`; if (/\.(mp4|webm)$/i.test(config.splash.mediaId)) { video.src = url; video.hidden = false; video.play().catch(() => toast('Không phát được video. Đang dùng đồ họa chủ đề.')); } else { image.src = url; image.hidden = false; } }
      if (config.splash.soundEnabled) {
        if (config.splash.chime) chime(config.splash.volume);
        if (config.splash.audioId) { audio = new Audio(`agc-asset://local/${config.splash.audioId}`); audio.volume = config.splash.volume / 100; audio.play().catch(() => toast('Không phát được file nhạc đã chọn.')); }
      }
    }
    const visual = show ? new Promise(resolve => { skipResolve = () => { skipped = true; resolve(); }; timers.push(setTimeout(resolve, config.accessibility.reducedMotion || prefersReduced ? 1000 : config.splash.durationMs)); }) : Promise.resolve();
    const launched = preview ? Promise.resolve({ message: 'Xem trước hoàn tất.' }) : api.launch();
    const result = await launched;
    $('#splash-status').textContent = result.message; $('#splash-phase').textContent = preview ? 'Chủ đề đã sẵn sàng' : 'Đã gửi lệnh mở App'; $('#splash-progress').style.width = '100%';
    await visual;
    if (!preview) { toast(result.message); if (config.launcher.minimizeAfterLaunch && !skipped && !result.stayInWindow) await api.minimize(); }
  } catch (e) { fail(e); }
  finally {
    timers.forEach(clearTimeout); audio?.pause(); $('#splash-video').pause(); $('#splash-video').removeAttribute('src'); $('#splash-video').load(); $('#splash-image').removeAttribute('src');
    $('#splash-overlay').hidden = true; $('#workspace').inert = false; skipResolve = null; busy = false; $('#launch-button').disabled = false; $('#preview-button').disabled = false; $('#preview-button').focus();
  }
}
function bind() {
  $('#auth-form').onsubmit = async event => {
    event.preventDefault(); const button = $('#auth-submit'); button.disabled = true; $('#auth-error').textContent = '';
    try {
      const password = $('#password').value;
      if (!configured && password !== $('#confirm-password').value) throw new Error('Hai mật khẩu chưa khớp.');
      if (configured) await api.unlock(password); else await api.setup(password);
      accept(await api.bootstrap());
      configured = true; $('#password').value = ''; $('#confirm-password').value = ''; $('#gate').hidden = true; $('#workspace').hidden = false;
      render(); $('#launch-button').focus();
    } catch (e) { $('#auth-error').textContent = e.message; }
    finally { button.disabled = false; }
  };
  $('#show-password').onchange = event => { $('#password').type = event.target.checked ? 'text' : 'password'; $('#confirm-password').type = event.target.checked ? 'text' : 'password'; };
  $$('.nav-item').forEach(button => button.onclick = () => showPanel(button.dataset.panel));
  $$('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; $$('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); renderGallery(); });
  $('#theme-search').oninput = renderGallery;
  const controls = { 'splash-enabled':['splash.enabled','boolean'], 'display-name':['splash.displayName','string'], 'splash-duration':['splash.durationMs','number'], 'sound-enabled':['splash.soundEnabled','boolean'], 'volume':['splash.volume','number'], 'chime-enabled':['splash.chime','boolean'], 'integration-enabled':['integration.enabled','boolean'], 'wallpaper-enabled':['wallpaper.enabled','boolean'], 'wallpaper-opacity':['wallpaper.opacity','number'], 'wallpaper-blur':['wallpaper.blur','number'], 'minimize-after-launch':['launcher.minimizeAfterLaunch','boolean'], 'reduced-motion':['accessibility.reducedMotion','boolean'] };
  for (const [element,[path,type]] of Object.entries(controls)) $(`#${element}`).addEventListener(type === 'boolean' ? 'change' : 'input', event => set(path,type === 'boolean' ? event.target.checked : type === 'number' ? Number(event.target.value) : event.target.value));
  $('#end-session').hidden=!api.endSession;$('#end-session').onclick=action(async()=>{await flushSave();await api.endSession();});
  $('#import-cues').onclick=action(async()=>{await flushSave();accept(await api.importCues());});
  const extras={'audio-mode':['rg.audioMode','string'],'cinematic-mode':['rg.cinematicMode','string'],'shutdown-enabled':['rg.shutdownEnabled','boolean'],'rg-enabled':['rg.enabled','boolean'],'rg-color':['rg.color','string'],'rg-operator':['rg.operatorName','string'],'rg-unit':['rg.unitName','string'],'rg-model':['rg.modelName','string'],'rg-class':['rg.operatorClass','string'],'rg-system-name':['rg.systemName','string'],'rg-ready-text':['rg.readyText','string'],'voice-enabled':['voice.enabled','boolean'],'voice-style':['voice.style','string'],'voice-volume':['voice.volume','number'],'music-scope':['splash.musicScope','string']};
  for(const[id,[path,type]]of Object.entries(extras))$(`#${id}`).addEventListener(type==='boolean'||id==='voice-style'||id==='music-scope'||id==='audio-mode'||id==='cinematic-mode'?'change':'input',event=>set(path,type==='boolean'?event.target.checked:type==='number'?Number(event.target.value):event.target.value));
  $('#preview-rg').onclick=()=>runSplash(true);
  $('#voice-preview').onclick=action(async()=>{await flushSave();voicePreview?.stop();voicePreview=createAnnouncer(state.builtinAudioBase,config.voice);await api.voiceActivity?.(true);try{await voicePreview.playSequence(['welcome','prompt']);}finally{await api.voiceActivity?.(false);}});
  $('#voice-stop').onclick=()=>voicePreview?.stop();
  $('#preset-motion').onchange = event => { preset().motion = event.target.checked; markChanged(); renderGallery(); };
  $('#preset-name').oninput = event => { preset().name=event.target.value || 'Chủ đề riêng';markChanged();$('#selected-name').textContent=preset().name;renderGallery(); };
  $('#preset-accent').oninput = event => { preset().accent = event.target.value; markChanged(); renderGallery(); renderControls(); };
  $('#duplicate-button').onclick = () => { const p = { ...preset(),id:`custom-${crypto.randomUUID()}`,name:`${preset().name} · bản riêng`.slice(0,60) }; if (config.presets.length >= 64) return toast('Đã đạt giới hạn 64 preset.');config.presets.push(p); config.selectedPreset = p.id; markChanged();render();toast('Đã tạo chủ đề riêng. Bạn có thể đổi màu và chuyển động.'); };
  $('#reset-preset').onclick = () => { const original = state.builtins.find(p => p.id === preset().id); if (original) { config.presets[config.presets.findIndex(p=>p.id===original.id)] = structuredClone(original); markChanged();render(); } };
  $('#delete-preset').onclick = () => { const p = preset(); if (state.builtins.some(b => b.id === p.id)) return;config.presets = config.presets.filter(b=>b.id!==p.id);config.selectedPreset='sao';markChanged();render(); };
  $('#preview-button').onclick = () => runSplash(true); $('#preview-splash-secondary').onclick = () => runSplash(true); $('#launch-button').onclick = () => runSplash(false); $('#skip-splash').onclick = () => skipResolve?.();
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && busy) skipResolve?.(); });
  $('#lock-button').onclick = action(lock);
  for (const [selector,method] of [['#detect-button','detect'],['#choose-executable','chooseExecutable'],['#import-preset','importPreset']]) $(selector).onclick = action(async () => { await flushSave(); accept(await api[method]()); });
  $$('[data-import]').forEach(button => button.onclick = action(async () => { await flushSave(); accept(await api.importMedia(button.dataset.import)); }));
  $$('[data-clear]').forEach(button => button.onclick = () => { const kind = button.dataset.clear; set(kind === 'audio' ? 'splash.audioId' : kind === 'splash' ? 'splash.mediaId' : 'wallpaper.mediaId',''); });
  $('#export-preset').onclick = action(async () => { await flushSave(); if (await api.exportPreset()) toast('Đã xuất preset. Không kèm mật khẩu hoặc dữ liệu riêng.'); });
  $('#remove-integration').onclick = action(async () => { accept(await api.removeIntegration()); toast('Đã gỡ giao diện tùy biến khỏi phiên hiện tại.'); });
  $('#open-data').onclick = action(() => api.openData());
  $('#native-install').onclick=action(async()=>{await flushSave();$('#native-install').disabled=true;try{accept(await api.nativeInstall());toast('Đã cài splash native. Từ giờ mở Antigravity trực tiếp.');}finally{renderControls();}});
  $('#native-uninstall').onclick=action(async()=>{await flushSave();$('#native-uninstall').disabled=true;try{accept(await api.nativeUninstall());toast('Đã khôi phục splash Antigravity gốc.');}finally{renderControls();}});
  $('#change-password-form').onsubmit = async event => { event.preventDefault(); $('#password-error').textContent = ''; const button = event.target.querySelector('button'); button.disabled = true;
    try { if ($('#next-password').value !== $('#next-password-confirm').value) throw new Error('Hai mật khẩu mới chưa khớp.'); await api.changePassword({ current:$('#current-password').value,next:$('#next-password').value });event.target.reset();toast('Đã đổi mật khẩu.'); }
    catch(e) { $('#password-error').textContent = e.message; } finally { button.disabled = false; }
  };
  api.onState(next => accept(next)); api.onIntegrationStatus(status => { state.integration = status; renderControls(); });
}
try {
  state = await api.bootstrap(); config = state.config; configured = state.security.configured;
  bind();if(state.hostMode==='native-settings-tab'){document.body.classList.add('embedded-mode');const nav=$('.sidebar nav');nav.classList.add('embedded-tabs');$('.workspace-main').insertBefore(nav,$('.content'));nav.append($('#save-state'));$('#native-install').closest('.settings-card').hidden=true;$('#executable-path').closest('.settings-card').hidden=true;$('#lock-button').lastChild.textContent='Khóa cài đặt';}
  render(); if(nativeHost()&&state.security.unlocked){$('#gate').hidden=true;$('#workspace').hidden=false;render();}else showGate(); initialized = true;
  animateScene($('#gate-canvas'),()=>config.presets.find(p=>p.id==='sao'),()=>false);
  animateScene($('#preview-canvas'),preset,motion); animateScene($('#splash-canvas'),preset,motion);
  if (state.recovered) toast('Cấu hình lỗi đã được giữ thành file .invalid; đang dùng cấu hình mặc định.');
} catch(error) { $('#auth-error').textContent = error.message; $('#auth-submit').disabled = true; }
window.addEventListener('unhandledrejection', event => { if (initialized) { event.preventDefault(); fail(event.reason); } });
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(initialized&&!$('#panel-themes').hidden)renderGallery();},120);});
