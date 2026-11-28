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
  importMedia: async (type) => null,
  readPreviewAudio: () => window.__TAURI__.core.invoke('preview_audio'),
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

const cleanText = str => typeof str === 'string' ? str.replace(/Â·/g, '·').replace(/â€™/g, "'") : '';

const preset = () => config.presets.find(p => p.id === config.selectedPreset) || config.presets[0];
const selectedAudioId = () => config.splash.themeAudioIds?.[preset().family] || (preset().family !== 'sao' ? config.splash.audioId : '');
const motion = () => !!config && preset().motion && !config.accessibility.reducedMotion && !prefersReduced;
const titles = { sao: 'Link Start', gundam: 'White Gundam · Online', focus: 'Stealth Mode · Online' };

let toastTimer, voicePreview, saoAudioPreview;
const nativeHost = () => state?.hostMode?.startsWith('native');

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.hidden = true, 5000);
}

function fail(error) {
  toast(error.message || String(error));
  if (error.message?.includes('Phiên đã khóa')) void lock();
}

function action(fn) {
  return (...args) => Promise.resolve().then(() => fn(...args)).catch(fail);
}

function accept(next) {
  if (!next) return;
  state = { ...(state || {}), ...next };
  if (next.config) config = next.config;
  render();
}

function setValue(selector, value) {
  const el = $(selector);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = value;
  else if (document.activeElement !== el) el.value = value;
}

function markChanged() {
  revision++;
  const st = $('#save-state');
  if (st) st.textContent = 'Đang lưu…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushSave().catch(fail), 250);
}

async function flushSave() {
  clearTimeout(saveTimer);
  const captured = structuredClone(config), myRevision = revision;
  saving = saving.catch(() => {}).then(() => api.save(captured));
  const next = await saving;
  savedRevision = Math.max(savedRevision, myRevision);
  if (myRevision === revision) {
    state = { ...state, ...next };
    config = next.config;
    const st = $('#save-state');
    if (st) st.textContent = 'Đã lưu trên máy';
  }
  return next;
}

if (api.previewNative) window.__agcFlushSettings = () => revision > savedRevision ? flushSave().then(() => true) : true;

function set(path, value) {
  let parent = config;
  const keys = path.split('.');
  for (const key of keys.slice(0, -1)) parent = parent[key];
  parent[keys.at(-1)] = value;
  markChanged();
  renderControls();
}

function showPanel(name) {
  const labels = {
    themes: 'Chủ đề',
    wallpaper: 'Nền trong App',
    splash: 'Splash & âm thanh',
    launcher: 'Ứng dụng & bảo mật',
    sharing: 'Chia sẻ preset'
  };
  $$('.panel').forEach(panel => panel.hidden = panel.id !== `panel-${name}`);
  $$('.nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.panel === name);
    button.setAttribute('aria-current', button.dataset.panel === name ? 'page' : 'false');
  });
  const bc = $('#breadcrumb-current');
  if (bc) bc.textContent = labels[name] || name;
  const cnt = $('.content');
  if (cnt) cnt.scrollTop = 0;
  if (name === 'themes') renderGallery();
  if (name === 'wallpaper') renderControls();
}

// -------------------------------------------------------------
// THEME GALLERY WITH FAMILY GROUPING & ACCORDION EXPANSION
// -------------------------------------------------------------
const FAMILIES = [
  {
    id: 'sao',
    name: 'Sword Art Online Series',
    subtitle: 'FullDive VR System · 5 Thế giới ảo',
    banner: 'sao-poster.jpg',
    video: 'sao.mp4',
    accent: '#00e5ff',
    badge: '5 Biến thể thế giới'
  },
  {
    id: 'gundam',
    name: 'White Gundam Mecha Series',
    subtitle: 'Neural Combat Interface · 4 Biến thể giáp',
    banner: 'white-gundam.png',
    video: 'white-gundam.mp4',
    accent: '#22d3ee',
    badge: '4 Biến thể giáp'
  },
  {
    id: 'custom',
    name: 'Chủ đề tùy biến riêng',
    subtitle: 'Bản phối màu và thiết lập cá nhân hóa',
    banner: 'white-gundam.png',
    video: 'white-gundam.mp4',
    accent: '#a855f7',
    badge: 'Tùy biến'
  }
];

const expandedFamilies = new Set(['sao', 'gundam']);

function getPresetFamilyKey(p) {
  if (p.family === 'sao') return 'sao';
  if (p.id.startsWith('custom-')) return 'custom';
  return 'gundam';
}

function getVariantShortTitle(p) {
  const clean = cleanText(p.name);
  if (clean.includes('·')) {
    return clean.split('·').slice(1).join('·').trim();
  }
  return clean;
}

function renderGallery() {
  const searchInput = $('#theme-search');
  const search = (searchInput?.value || '').toLocaleLowerCase('vi');
  const grid = $('#theme-grid');
  if (!grid) return;
  grid.replaceChildren();

  const presets = config.presets || [];
  const curPreset = preset();

  // Group presets into families
  const groups = { sao: [], gundam: [], custom: [] };
  for (const p of presets) {
    p.name = cleanText(p.name);
    p.description = cleanText(p.description);
    const key = getPresetFamilyKey(p);
    if (!groups[key]) groups[key] = [];
    const matchesFilter = filter === 'all' || p.mode === filter;
    const matchesSearch = !search || `${p.name} ${p.description}`.toLocaleLowerCase('vi').includes(search);
    if (matchesFilter && matchesSearch) {
      groups[key].push(p);
    }
  }

  let totalVisible = 0;
  for (const fam of FAMILIES) {
    const items = groups[fam.id] || [];
    if (!items.length) continue;
    totalVisible += items.length;

    // Check if this family contains the active preset
    const containsActive = items.some(p => p.id === curPreset.id);
    if (containsActive || search) {
      expandedFamilies.add(fam.id);
    }
    const isExpanded = expandedFamilies.has(fam.id);

    // Create Grand Parent Card
    const famCard = document.createElement('div');
    famCard.className = `theme-family-card${containsActive ? ' family-active' : ''}`;
    famCard.style.setProperty('--fam-accent', fam.accent);

    // Family Header
    const famHeader = document.createElement('div');
    famHeader.className = 'family-header';
    famHeader.setAttribute('role', 'button');
    famHeader.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    famHeader.tabIndex = 0;

    const famThumb = document.createElement('div');
    famThumb.className = 'family-thumb';
    famThumb.style.backgroundImage = `url("${fam.banner}")`;

    const famInfo = document.createElement('div');
    famInfo.className = 'family-info';

    const famTitleRow = document.createElement('div');
    famTitleRow.className = 'family-title-row';

    const famTitle = document.createElement('h3');
    famTitle.className = 'family-title';
    famTitle.textContent = fam.name;

    const famBadge = document.createElement('span');
    famBadge.className = 'family-badge';
    famBadge.textContent = `${items.length} biến thể`;

    famTitleRow.append(famTitle, famBadge);

    const famSub = document.createElement('p');
    famSub.className = 'family-subtitle';
    famSub.textContent = fam.subtitle;

    famInfo.append(famTitleRow, famSub);

    // Active status tag if active
    const famRight = document.createElement('div');
    famRight.className = 'family-right';

    if (containsActive) {
      const activeTag = document.createElement('span');
      activeTag.className = 'family-active-pill';
      activeTag.innerHTML = `<span class="active-dot"></span>Đang dùng: <b>${getVariantShortTitle(curPreset)}</b>`;
      famRight.append(activeTag);
    }

    const chevron = document.createElement('span');
    chevron.className = `family-chevron${isExpanded ? ' open' : ''}`;
    chevron.innerHTML = `<svg class="icon"><use href="#i-chevron-down"/></svg>`;
    famRight.append(chevron);

    famHeader.append(famThumb, famInfo, famRight);

    // Toggle expansion
    const toggleExpand = () => {
      if (expandedFamilies.has(fam.id)) {
        expandedFamilies.delete(fam.id);
      } else {
        expandedFamilies.add(fam.id);
      }
      renderGallery();
    };

    famHeader.onclick = toggleExpand;
    famHeader.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } };

    // Sub-variants Tray (Drawer)
    const drawer = document.createElement('div');
    drawer.className = `family-drawer${isExpanded ? ' open' : ''}`;

    const subgrid = document.createElement('div');
    subgrid.className = 'family-subgrid';

    for (const p of items) {
      const isSelected = p.id === curPreset.id;
      const subCard = document.createElement('button');
      subCard.type = 'button';
      subCard.className = `sub-preset-card${isSelected ? ' selected' : ''}`;
      subCard.style.setProperty('--sub-accent', p.accent);
      subCard.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

      const colorIndicator = document.createElement('span');
      colorIndicator.className = 'sub-color-indicator';
      colorIndicator.style.background = p.accent;

      const subCopy = document.createElement('div');
      subCopy.className = 'sub-copy';

      const subTitle = document.createElement('strong');
      subTitle.className = 'sub-title';
      subTitle.textContent = getVariantShortTitle(p);

      const subMode = document.createElement('span');
      subMode.className = 'sub-mode';
      subMode.textContent = `${p.mode === 'dark' ? 'Tối' : 'Sáng'} · ${p.motion ? 'Có chuyển động' : 'Tĩnh'}`;

      subCopy.append(subTitle, subMode);

      const check = document.createElement('span');
      check.className = 'sub-check';
      check.innerHTML = '<svg class="icon"><use href="#i-check"/></svg>';

      subCard.append(colorIndicator, subCopy, check);

      subCard.onclick = (e) => {
        e.stopPropagation();
        config.selectedPreset = p.id;
        markChanged();
        render();
      };

      subgrid.append(subCard);
    }

    drawer.append(subgrid);
    famCard.append(famHeader, drawer);
    grid.append(famCard);
  }

  const countEl = $('#theme-count');
  if (countEl) countEl.textContent = `${totalVisible} chủ đề phù hợp`;
  const emptyEl = $('#empty-themes');
  if (emptyEl) emptyEl.hidden = totalVisible > 0;
}

// -------------------------------------------------------------
// CONTROLS & WALLPAPER PANEL MANAGEMENT
// -------------------------------------------------------------
function renderControls() {
  const p = preset();
  p.name = cleanText(p.name);
  p.description = cleanText(p.description);

  document.documentElement.style.setProperty('--accent', p.accent);
  document.body.dataset.themeFamily = p.family;

  const saoSetup = $('.sao-setup');
  if (saoSetup) saoSetup.hidden = p.family !== 'sao';
  if (p.family !== 'sao') saoAudioPreview?.pause();

  document.body.style.setProperty('--sao-bg', p.background);
  document.body.style.setProperty('--sao-text', p.foreground);
  document.body.classList.toggle('reduced-motion', !motion());

  const miniLabel = $('.mini-label');
  if (miniLabel) miniLabel.textContent = p.family === 'sao' ? 'SWORD ART ONLINE · FULLDIVE INTERFACE' : 'WHITE GUNDAM · NEURAL INTERFACE';
  const selName = $('#selected-name');
  if (selName) selName.textContent = p.name;
  const selDesc = $('#selected-description');
  if (selDesc) selDesc.textContent = p.description;
  const prevGreet = $('#preview-greeting');
  if (prevGreet) prevGreet.textContent = titles[p.family] || 'Online';

  const accCode = $('#accent-code');
  if (accCode) accCode.textContent = p.accent.toUpperCase();
  setValue('#preset-accent', p.accent);
  setValue('#preset-motion', p.motion);
  setValue('#preset-name', p.name);

  const swatches = $('#swatches');
  if (swatches) {
    swatches.replaceChildren();
    for (const color of [p.background, p.accent, p.foreground]) {
      const dot = document.createElement('span');
      dot.className = 'swatch';
      dot.style.background = color;
      dot.title = color;
      swatches.append(dot);
    }
  }

  const isBuiltin = (state?.builtins || []).some(b => b.id === p.id);
  const delBtn = $('#delete-preset');
  if (delBtn) delBtn.hidden = isBuiltin;
  const resetBtn = $('#reset-preset');
  if (resetBtn) resetBtn.hidden = !isBuiltin;

  // Sync basic inputs
  const values = {
    '#splash-enabled': config?.splash?.enabled,
    '#display-name': config?.splash?.displayName,
    '#splash-duration': config?.splash?.durationMs,
    '#sound-enabled': config?.splash?.soundEnabled,
    '#volume': config?.splash?.volume,
    '#chime-enabled': config?.splash?.chime,
    '#wallpaper-enabled': config?.wallpaper?.enabled,
    '#wallpaper-opacity': config?.wallpaper?.opacity,
    '#wallpaper-blur': config?.wallpaper?.blur,
    '#reduced-motion': config?.accessibility?.reducedMotion
  };
  for (const [selector, value] of Object.entries(values || {})) setValue(selector, value);

  // Labels & Sliders
  const durVal = $('#duration-value');
  if (durVal) durVal.textContent = `${(config.splash.durationMs / 1000).toFixed(1)} giây`;
  const volVal = $('#volume-value');
  if (volVal) volVal.textContent = `${config.splash.volume}%`;
  const opacVal = $('#opacity-value');
  if (opacVal) opacVal.textContent = `${config.wallpaper.opacity}%`;
  const blurVal = $('#blur-value');
  if (blurVal) blurVal.textContent = `${config.wallpaper.blur}px`;

  // Splash media file label
  const splashFile = $('#splash-file');
  if (splashFile) {
    splashFile.textContent = config.splash.mediaId ? `File riêng · ${config.splash.mediaId.split('.').at(-1).toUpperCase()}` : 'Đồ họa của chủ đề';
  }

  // Audio file label
  const audioFile = $('#audio-file');
  if (audioFile) {
    audioFile.textContent = selectedAudioId() ? 'Đã chọn nhạc riêng' : p.family === 'sao' ? 'Swordland · Nhạc chủ đề SAO' : ['gundam', 'focus'].includes(p.family) ? 'GUNDAM BUILD FIGHTERS · Yuki Hayashi' : 'Chưa chọn nhạc';
  }

  // -----------------------------------------------------------
  // WALLPAPER PANEL: Live Wallpaper Mode vs Static Image Mode
  // -----------------------------------------------------------
  const w = config.wallpaper || {};
  const currentMode = w.mode === 'video' ? 'video' : 'image';

  // Update mode toggle buttons
  const btnVideo = $('#btn-mode-video');
  const btnImage = $('#btn-mode-image');
  if (btnVideo) btnVideo.classList.toggle('active', currentMode === 'video');
  if (btnImage) btnImage.classList.toggle('active', currentMode === 'image');

  // Toggle mode cards visibility
  const cardVideo = $('#card-mode-video');
  const cardImage = $('#card-mode-image');
  if (cardVideo) cardVideo.hidden = currentMode !== 'video';
  if (cardImage) cardImage.hidden = currentMode !== 'image';

  // Video file text & preview
  const videoFileTxt = $('#wallpaper-video-file');
  if (videoFileTxt) {
    videoFileTxt.textContent = w.videoMediaId ? `Video riêng · ${w.videoMediaId.split('.').at(-1).toUpperCase()}` : (p.family === 'sao' ? 'Video mặc định · SAO FullDive (sao.mp4)' : 'Video mặc định · White Gundam (white-gundam.mp4)');
  }
  const miniVideo = $('#wallpaper-mini-video');
  if (miniVideo) {
    const targetVideoSrc = w.videoMediaId ? `agc-asset://local/${w.videoMediaId}` : new URL(p.family === 'sao' ? './sao.mp4' : './white-gundam.mp4', import.meta.url).href;
    if (miniVideo.src !== targetVideoSrc) {
      miniVideo.src = targetVideoSrc;
      miniVideo.load();
      miniVideo.play().catch(() => {});
    }
  }

  // Image file text & preview
  const imageFileTxt = $('#wallpaper-image-file');
  if (imageFileTxt) {
    const activeImgId = w.imageMediaId || (!/\.(mp4|webm)$/i.test(w.mediaId) ? w.mediaId : '');
    imageFileTxt.textContent = activeImgId ? `Ảnh riêng · ${activeImgId.split('.').at(-1).toUpperCase()}` : (p.family === 'sao' ? 'Poster mặc định · SAO Kirito' : 'Poster mặc định · White Gundam');
  }
  const miniImg = $('#wallpaper-mini-image');
  if (miniImg) {
    const activeImgId = w.imageMediaId || (!/\.(mp4|webm)$/i.test(w.mediaId) ? w.mediaId : '');
    miniImg.src = activeImgId ? `agc-asset://local/${activeImgId}` : new URL(p.family === 'sao' ? './sao-poster.jpg' : './white-gundam.png', import.meta.url).href;
  }

  // Target App status dot
  const found = !!(config.launcher?.executable || state?.detectedPath);
  const targetDot = $('#target-dot');
  if (targetDot) targetDot.classList.toggle('ok', found);
  const targetTxt = $('#target-status-text');
  if (targetTxt) targetTxt.textContent = found ? 'Đã tìm thấy bản cài' : 'Tích hợp sẵn trong App';

  // Native install/uninstall buttons
  if ($('#native-message')) {
    $('#native-message').textContent = state.nativeStatus?.updateAvailable ? 'Tích hợp trong App đang có bản mới. Cập nhật để nhận Live Wallpaper và theme mới.' : state.nativeStatus?.installed ? 'Đã tích hợp vào Antigravity. Mở App trực tiếp để sử dụng.' : state.nativeStatus?.error || 'Chưa cài tích hợp native. Cài một lần để thay splash ngay trong Antigravity.';
    $('#native-install').disabled = (!!state.nativeStatus?.installed && !state.nativeStatus?.updateAvailable) || nativeHost();
    $('#native-install').textContent = state.nativeStatus?.updateAvailable ? 'Cập nhật tích hợp' : 'Cài tích hợp native';
    $('#native-uninstall').disabled = !state.nativeStatus?.installed || nativeHost();
  }

  if (nativeHost()) {
    const launchBtn = $('#launch-button');
    if (launchBtn?.firstChild) launchBtn.firstChild.textContent = 'Về Antigravity';
    const tgt = $('#target-status-text');
    if (tgt) tgt.textContent = 'Tích hợp trong cửa sổ App';
    const lockBtn = $('#lock-button');
    if (lockBtn?.lastChild) lockBtn.lastChild.textContent = 'Khóa giao diện';
  }
}

function render() {
  if (!config) return;
  renderGallery();
  renderControls();
  const vEl = $('#version');
  if (vEl) vEl.textContent = state?.appVersion || '0.5.0';
}

function showGate() {
  $('#gate').hidden = false;
  $('#workspace').hidden = true;
  $('#auth-eyebrow').textContent = configured ? 'Chào mừng trở lại' : 'Thiết lập lần đầu';
  $('#auth-title').textContent = configured ? 'Mở khóa không gian của bạn' : 'Tạo mật khẩu launcher';
  $('#auth-description').textContent = configured ? 'Nhập mật khẩu để vào bảng tùy chỉnh và mở App.' : 'Mật khẩu được xác minh trên máy của bạn.';
  $('#confirm-wrap').hidden = configured;
  $('#confirm-password').required = !configured;
  $('#password').autocomplete = configured ? 'current-password' : 'new-password';
  $('#password').minLength = configured ? 1 : 8;
  $('#auth-submit').firstChild.textContent = configured ? 'Mở khóa ' : 'Tạo mật khẩu ';
  $('#password').value = '';
  $('#confirm-password').value = '';
  $('#auth-error').textContent = '';
  $('#show-password').checked = false;
  $('#password').type = 'password';
  $('#confirm-password').type = 'password';
  $('#password').focus();
}

async function lock() {
  saoAudioPreview?.pause();
  await flushSave().catch(() => {});
  await api.lock();
  showGate();
}

function chime(volume) {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = volume / 100 * .12;
  master.connect(context.destination);
  for (const [index, freq] of [523.25, 783.99].entries()) {
    const tone = context.createOscillator(), gain = context.createGain();
    tone.type = 'sine';
    tone.frequency.value = freq;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(.4, context.currentTime + .03 + index * .1);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .6 + index * .1);
    tone.connect(gain);
    gain.connect(master);
    tone.start(context.currentTime + index * .1);
    tone.stop(context.currentTime + .75);
  }
  setTimeout(() => context.close(), 1000);
}

async function runSplash(preview = true) {
  if (preview && nativeHost() && api.previewNative) {
    if (busy) return;
    busy = true;
    try {
      await flushSave();
      await api.previewNative();
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
    return;
  }
  if (busy) return;
  busy = true;
  $('#launch-button').disabled = true;
  $('#preview-button').disabled = true;
  let audio, audioObjectUrl, timers = [], skipped = false;
  try {
    await flushSave();
    clearTimeout(toastTimer);
    $('#toast').hidden = true;
    const show = preview;
    if (show) {
      $('#splash-overlay').hidden = false;
      $('#workspace').inert = true;
      $('#skip-splash').focus();
      $('#splash-title').textContent = titles[preset().family];
      $('#splash-preset-name').textContent = preset().name;
      $('#splash-greeting').textContent = `Chào ${config.splash.displayName || 'Pilot'}, sẵn sàng cho phiên mới.`;
      $('#splash-preview-tag').textContent = preview ? 'Xem trước · không mở App' : 'Launcher';
      $('#splash-phase').textContent = 'Đã xác thực launcher';
      $('#splash-status').textContent = preview ? 'Đây là bản xem trước hiệu ứng.' : 'Đang gửi lệnh mở Antigravity App…';
      $('#splash-progress').style.width = '25%';
      const image = $('#splash-image'), video = $('#splash-video');
      image.hidden = true;
      video.hidden = true;
      if (config.splash.mediaId) {
        const url = `agc-asset://local/${config.splash.mediaId}`;
        if (/\.(mp4|webm)$/i.test(config.splash.mediaId)) {
          video.src = url;
          video.hidden = false;
          video.play().catch(() => toast('Không phát được video. Đang dùng đồ họa chủ đề.'));
        } else {
          image.src = url;
          image.hidden = false;
        }
      } else if (preset().family === 'sao') {
        image.src = new URL('./sao-poster.jpg', import.meta.url).href;
        image.hidden = false;
        if (motion()) {
          video.src = new URL('./sao.mp4', import.meta.url).href;
          video.hidden = false;
          video.play().catch(() => { video.hidden = true; });
        }
      }
      if (config.splash.soundEnabled) {
        if (config.splash.chime) chime(config.splash.volume);
        const audioId = selectedAudioId();
        const bundledTrack = preset().family === 'sao' ? 'swordland.mp3' : ['gundam', 'focus'].includes(preset().family) ? 'gundam-background.mp3' : '';
        let musicUrl = audioId ? `agc-asset://local/${audioId}` : bundledTrack ? new URL(`./audio/${bundledTrack}`, import.meta.url).href : '';
        if (audioId && api.readPreviewAudio) {
          const media = await api.readPreviewAudio();
          if (media) {
            audioObjectUrl = URL.createObjectURL(new Blob([new Uint8Array(media.bytes)], { type: media.mime }));
            musicUrl = audioObjectUrl;
          } else musicUrl = '';
        }
        if (musicUrl) {
          audio = new Audio(musicUrl);
          audio.volume = config.splash.volume / 100;
          audio.play().catch(() => toast('Không phát được nhạc nền đã chọn.'));
        }
      }
    }
    const visual = show ? new Promise(resolve => {
      skipResolve = () => { skipped = true; resolve(); };
      timers.push(setTimeout(resolve, config.accessibility.reducedMotion || prefersReduced ? 1000 : config.splash.durationMs));
    }) : Promise.resolve();

    const launched = preview ? Promise.resolve({ message: 'Xem trước hoàn tất.' }) : api.launch();
    const result = await launched;
    $('#splash-status').textContent = result.message;
    $('#splash-phase').textContent = preview ? 'Chủ đề đã sẵn sàng' : 'Đã gửi lệnh mở App';
    $('#splash-progress').style.width = '100%';
    await visual;
    if (!preview) {
      toast(result.message);
      if (config.launcher.minimizeAfterLaunch && !skipped && !result.stayInWindow) await api.minimize();
    }
  } catch (e) {
    fail(e);
  } finally {
    timers.forEach(clearTimeout);
    audio?.pause();
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
    $('#splash-video').pause();
    $('#splash-video').removeAttribute('src');
    $('#splash-video').load();
    $('#splash-image').removeAttribute('src');
    $('#splash-overlay').hidden = true;
    $('#workspace').inert = false;
    skipResolve = null;
    busy = false;
    $('#launch-button').disabled = false;
    $('#preview-button').disabled = false;
    $('#preview-button').focus();
  }
}

function bind() {
  $('#apply-sao').onclick = action(async () => {
    await flushSave();
    if (preset().family !== 'sao') config.selectedPreset = 'sao-aincrad';
    config.splash.themeAudioIds = { ...config.splash.themeAudioIds, sao: '' };
    markChanged();
    await flushSave();
    render();
    toast('Đã áp dụng SAO + Swordland. Mở lại Antigravity để xem splash mới.');
  });

  $('#listen-sao').onclick = action(async () => {
    saoAudioPreview?.pause();
    saoAudioPreview = new Audio(new URL('./audio/sao-link-start.mp3', import.meta.url).href);
    saoAudioPreview.volume = config.splash.volume / 100;
    await saoAudioPreview.play();
  });

  $('#stop-sao-audio').onclick = () => saoAudioPreview?.pause();

  // Authentication form
  $('#auth-form').onsubmit = async event => {
    event.preventDefault();
    const button = $('#auth-submit');
    button.disabled = true;
    $('#auth-error').textContent = '';
    try {
      const password = $('#password').value;
      if (!configured && password !== $('#confirm-password').value) throw new Error('Hai mật khẩu chưa khớp.');
      if (configured) {
        await api.unlock(password);
      } else {
        try {
          await api.setup(password);
        } catch (setupErr) {
          const msg = typeof setupErr === 'string' ? setupErr : (setupErr?.message || String(setupErr || ''));
          if (msg.includes('Mật khẩu đã được thiết lập') || msg.includes('already configured')) {
            await api.unlock(password);
          } else {
            throw (setupErr instanceof Error ? setupErr : new Error(msg));
          }
        }
      }
      const next = await api.bootstrap();
      accept(next);
      configured = true;
      $('#password').value = '';
      $('#confirm-password').value = '';
      $('#gate').hidden = true;
      $('#workspace').hidden = false;
      render();
      $('#launch-button')?.focus?.();
    } catch (e) {
      $('#auth-error').textContent = e?.message || String(e);
    } finally {
      button.disabled = false;
    }
  };

  $('#show-password').onchange = event => {
    $('#password').type = event.target.checked ? 'text' : 'password';
    $('#confirm-password').type = event.target.checked ? 'text' : 'password';
  };

  $$('.nav-item').forEach(button => button.onclick = () => showPanel(button.dataset.panel));
  $$('[data-filter]').forEach(button => button.onclick = () => {
    filter = button.dataset.filter;
    $$('[data-filter]').forEach(b => b.classList.toggle('active', b === button));
    renderGallery();
  });
  $('#theme-search').oninput = renderGallery;

  // Basic controls bindings
  const controls = {
    'splash-enabled': ['splash.enabled', 'boolean'],
    'display-name': ['splash.displayName', 'string'],
    'splash-duration': ['splash.durationMs', 'number'],
    'sound-enabled': ['splash.soundEnabled', 'boolean'],
    'volume': ['splash.volume', 'number'],
    'chime-enabled': ['splash.chime', 'boolean'],
    'wallpaper-enabled': ['wallpaper.enabled', 'boolean'],
    'wallpaper-opacity': ['wallpaper.opacity', 'number'],
    'wallpaper-blur': ['wallpaper.blur', 'number'],
    'reduced-motion': ['accessibility.reducedMotion', 'boolean']
  };
  for (const [element, [path, type]] of Object.entries(controls)) {
    const el = $(`#${element}`);
    if (el) el.addEventListener(type === 'boolean' ? 'change' : 'input', event => set(path, type === 'boolean' ? event.target.checked : type === 'number' ? Number(event.target.value) : event.target.value));
  }

  // Wallpaper Mode Switchers (Video vs Image)
  const setWallMode = mode => {
    config.wallpaper.mode = mode;
    markChanged();
    renderControls();
  };
  $('#btn-mode-video')?.addEventListener('click', () => setWallMode('video'));
  $('#btn-mode-image')?.addEventListener('click', () => setWallMode('image'));

  $('#clear-wallpaper-video')?.addEventListener('click', () => {
    config.wallpaper.videoMediaId = '';
    markChanged();
    renderControls();
    toast('Đã khôi phục video lặp mặc định của chủ đề.');
  });

  $('#clear-wallpaper-image')?.addEventListener('click', () => {
    config.wallpaper.imageMediaId = '';
    config.wallpaper.mediaId = '';
    markChanged();
    renderControls();
    toast('Đã khôi phục ảnh poster mặc định của chủ đề.');
  });

  // Preset quick edit inputs
  $('#preset-motion').onchange = event => {
    preset().motion = event.target.checked;
    markChanged();
    renderGallery();
    renderControls();
  };

  $('#preset-name').oninput = event => {
    preset().name = event.target.value || 'Chủ đề riêng';
    markChanged();
    $('#selected-name').textContent = preset().name;
    renderGallery();
  };

  $('#preset-accent').oninput = event => {
    preset().accent = event.target.value;
    markChanged();
    renderGallery();
    renderControls();
  };

  $('#duplicate-button').onclick = () => {
    const cur = preset();
    const p = { ...cur, id: `custom-${crypto.randomUUID()}`, name: `${cur.name} · Bản riêng`.slice(0, 60) };
    if (config.presets.length >= 64) return toast('Đã đạt giới hạn 64 preset.');
    config.presets.push(p);
    config.selectedPreset = p.id;
    markChanged();
    render();
    toast('Đã tạo chủ đề riêng. Bạn có thể đổi màu và hiệu ứng tùy ý.');
  };

  $('#reset-preset').onclick = () => {
    const original = state.builtins.find(p => p.id === preset().id);
    if (original) {
      config.presets[config.presets.findIndex(p => p.id === original.id)] = structuredClone(original);
      markChanged();
      render();
      toast('Đã khôi phục thiết lập gốc của chủ đề.');
    }
  };

  $('#delete-preset').onclick = () => {
    const p = preset();
    if (state.builtins.some(b => b.id === p.id)) return;
    config.presets = config.presets.filter(b => b.id !== p.id);
    config.selectedPreset = 'sao-aincrad';
    markChanged();
    render();
    toast('Đã xóa chủ đề riêng.');
  };

  $('#preview-button').onclick = () => runSplash(true);
  $('#preview-splash-secondary').onclick = () => runSplash(true);
  $('#launch-button').onclick = () => runSplash(false);
  $('#skip-splash').onclick = () => skipResolve?.();

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && busy) skipResolve?.();
  });

  $('#lock-button').onclick = action(lock);

  // Import media handler
  $$('[data-import]').forEach(button => button.onclick = action(async () => {
    await flushSave();
    accept(await api.importMedia(button.dataset.import));
  }));

  // Clear splash and audio
  $$('[data-clear]').forEach(button => button.onclick = () => {
    const kind = button.dataset.clear;
    if (kind === 'audio') {
      config.splash.themeAudioIds = { ...config.splash.themeAudioIds, [preset().family]: '' };
      if (preset().family !== 'sao') config.splash.audioId = '';
      markChanged();
      renderControls();
    } else {
      set(kind === 'splash' ? 'splash.mediaId' : 'wallpaper.mediaId', '');
    }
  });

  $('#open-data').onclick = action(() => api.openData());

  $('#native-install').onclick = action(async () => {
    await flushSave();
    $('#native-install').disabled = true;
    try {
      accept(await api.nativeInstall());
      toast('Đã cài splash native vào Antigravity.');
    } finally {
      renderControls();
    }
  });

  $('#native-uninstall').onclick = action(async () => {
    await flushSave();
    $('#native-uninstall').disabled = true;
    try {
      accept(await api.nativeUninstall());
      toast('Đã khôi phục splash Antigravity gốc.');
    } finally {
      renderControls();
    }
  });

  $('#change-password-form').onsubmit = async event => {
    event.preventDefault();
    $('#password-error').textContent = '';
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      if ($('#next-password').value !== $('#next-password-confirm').value) throw new Error('Hai mật khẩu mới chưa khớp.');
      await api.changePassword({ current: $('#current-password').value, next: $('#next-password').value });
      event.target.reset();
      toast('Đã đổi mật khẩu thành công.');
    } catch (e) {
      $('#password-error').textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };

  api.onState(next => accept(next));
  api.onIntegrationStatus(status => {
    state.integration = status;
    renderControls();
  });
}

try {
  state = await api.bootstrap();
  config = state.config;
  configured = state.security.configured;
  bind();

  if (state.hostMode === 'native-settings-tab') {
    document.body.classList.add('embedded-mode');
    const nav = $('.sidebar nav');
    nav.classList.add('embedded-tabs');
    $('.workspace-main').insertBefore(nav, $('.content'));
    nav.append($('#save-state'));
    const nCard = $('#native-install')?.closest('.settings-card');
    if (nCard) nCard.hidden = true;
    const lk = $('#lock-button');
    if (lk?.lastChild) lk.lastChild.textContent = 'Khóa cài đặt';
  }

  render();
  if (nativeHost() && state.security.unlocked) {
    $('#gate').hidden = true;
    $('#workspace').hidden = false;
    render();
  } else {
    showGate();
  }
  initialized = true;

  animateScene($('#gate-canvas'), preset, () => false);
  animateScene($('#preview-canvas'), preset, motion);
  animateScene($('#splash-canvas'), preset, motion);

  if (state.recovered) toast('Cấu hình lỗi đã được giữ thành file .invalid; đang dùng cấu hình mặc định.');
} catch (error) {
  const msg = typeof error === 'string' ? error : (error?.message || String(error || 'Lỗi khởi động'));
  $('#auth-error').textContent = msg;
  $('#auth-submit').disabled = true;
}

window.addEventListener('unhandledrejection', event => {
  if (initialized) {
    event.preventDefault();
    fail(event.reason);
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (initialized && !$('#panel-themes').hidden) renderGallery();
  }, 120);
});
