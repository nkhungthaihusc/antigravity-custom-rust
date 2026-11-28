const {CUE_FILES}=require('./audio-cues.cjs');
const { DEFAULT_CONFIG, BUILTINS } = require('./presets.cjs');
const clone = value => structuredClone(value);
const plain = x => x && typeof x === 'object' && !Array.isArray(x);
const bounded = (x, min, max, fallback) => typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : fallback;
const text = (x, max, fallback = '') => typeof x === 'string' ? x.replace(/[\u0000-\u001f]/g, '').slice(0, max) : fallback;
const flag = (x, fallback) => typeof x === 'boolean' ? x : fallback;
const color = (x, fallback) => typeof x === 'string' && /^#[a-f0-9]{6}$/i.test(x) ? x : fallback;
const id = x => typeof x === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(x) ? x : '';
const mediaId = x => typeof x === 'string' && /^[a-f0-9-]{36}\.(png|jpg|jpeg|webp|gif|mp4|webm|mp3|wav|ogg|m4a)$/i.test(x) ? x : '';
function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/Â·/g, '·').replace(/â€™/g, "'").replace(/[\u0000-\u001f]/g, '');
}
function normalizePreset(p, fallback = BUILTINS[0]) {
  if (!plain(p)) throw new Error('Preset không hợp lệ.');
  const rawName = text(p.name, 60, fallback.name) || fallback.name;
  const rawDesc = text(p.description, 180, fallback.description);
  return { id: id(p.id) || fallback.id, name: sanitizeText(rawName),
    description: sanitizeText(rawDesc), family: ['sao', 'gundam', 'focus'].includes(p.family) ? p.family : fallback.family,
    mode: p.mode === 'light' ? 'light' : 'dark', accent: color(p.accent, fallback.accent),
    background: color(p.background, fallback.background), foreground: color(p.foreground, fallback.foreground), motion: flag(p.motion, fallback.motion) };
}
function normalizeConfig(raw = {}) {
  if (!plain(raw)) throw new Error('Cấu hình phải là một đối tượng.');
  const d = DEFAULT_CONFIG, s = plain(raw.splash) ? raw.splash : {}, w = plain(raw.wallpaper) ? raw.wallpaper : {}, l = plain(raw.launcher) ? raw.launcher : {}, rg = plain(raw.rg) ? raw.rg : {};
  const presets = BUILTINS.map(clone);
  if (Array.isArray(raw.presets)) {
    const seen = new Set(presets.map(p => p.id));
    for (const p of raw.presets.slice(0, 64)) {
      if (!plain(p) || !id(p.id)) continue;
      const normalized = normalizePreset(p);
      const built = presets.findIndex(q => q.id === p.id);
      if (built >= 0 && BUILTINS.some(q => q.id === p.id)) presets[built] = normalized;
      else if (!seen.has(p.id)) { presets.push(normalized); seen.add(p.id); }
    }
  }
  const wallMode = ['video', 'image'].includes(w.mode) ? w.mode : (/\.(mp4|webm)$/i.test(w.mediaId) ? 'video' : 'image');
  const wallMedia = mediaId(w.mediaId);
  const wallImg = mediaId(w.imageMediaId || (!/\.(mp4|webm)$/i.test(wallMedia) ? wallMedia : ''));
  const wallVid = mediaId(w.videoMediaId || (/\.(mp4|webm)$/i.test(wallMedia) ? wallMedia : ''));
  return { schemaVersion: 1, selectedPreset: presets.some(p => p.id === raw.selectedPreset) ? raw.selectedPreset : d.selectedPreset, presets,
    splash: { enabled: flag(s.enabled, d.splash.enabled), durationMs: bounded(s.durationMs, 1000, 10000, d.splash.durationMs), displayName: text(s.displayName, 40, d.splash.displayName), mediaId: mediaId(s.mediaId), audioId: mediaId(s.audioId), themeAudioIds:Object.fromEntries(['sao','gundam','focus'].map(family=>[family,mediaId(plain(s.themeAudioIds)?s.themeAudioIds[family]:'')])), volume: bounded(s.volume, 0, 100, d.splash.volume), soundEnabled: flag(s.soundEnabled, false), chime: flag(s.chime, true), musicScope:'startup' },
    wallpaper: { enabled: flag(w.enabled, true), mode: wallMode, mediaId: wallMedia, imageMediaId: wallImg, videoMediaId: wallVid, opacity: bounded(w.opacity, 0, 40, 15), blur: bounded(w.blur, 0, 16, 0) },
    launcher: { executable: text(l.executable, 1024), minimizeAfterLaunch: flag(l.minimizeAfterLaunch, true) },
    integration: { enabled: flag(raw.integration?.enabled, false) }, accessibility: { reducedMotion: flag(raw.accessibility?.reducedMotion, false) },
    rg: { audioMode:['events','parallel','track'].includes(rg.audioMode)?rg.audioMode:'track', cueAudioIds:Object.fromEntries(Object.keys(CUE_FILES).map(key=>[key,mediaId(plain(rg.cueAudioIds)?rg.cueAudioIds[key]:'')])), cinematicMode: rg.cinematicMode === "full" ? "full" : "quick", startupAudioId: mediaId(rg.startupAudioId), endAudioId: mediaId(rg.endAudioId), shutdownEnabled: flag(rg.shutdownEnabled, false), enabled: flag(rg.enabled, true), color: color(rg.color, d.rg.color), operatorName: text(rg.operatorName, 40), unitName: text(rg.unitName, 40, d.rg.unitName), modelName: text(rg.modelName, 40, d.rg.modelName), operatorClass: text(rg.operatorClass, 24, d.rg.operatorClass), systemName: text(rg.systemName, 40, d.rg.systemName), readyText: text(rg.readyText, 48, d.rg.readyText) },
    voice: { enabled: flag(raw.voice?.enabled,false), style:raw.voice?.style==='clean'?'clean':'system',volume:bounded(raw.voice?.volume,0,100,45) },
    quota: plain(raw.quota) ? raw.quota : { plan: 'Google AI Pro' } };
}
function exportPreset(config) {
  const c = normalizeConfig(config);
  return { format: 'antigravity-custom-preset', schemaVersion: 1,
    preset: clone(c.presets.find(p => p.id === c.selectedPreset)),
    splash: { enabled: c.splash.enabled, durationMs: c.splash.durationMs, volume: c.splash.volume, soundEnabled: c.splash.soundEnabled, chime: c.splash.chime,musicScope:c.splash.musicScope },
    wallpaper: { enabled: c.wallpaper.enabled, mode: c.wallpaper.mode, opacity: c.wallpaper.opacity, blur: c.wallpaper.blur },
    accessibility: clone(c.accessibility), rg: { enabled:c.rg.enabled, color:c.rg.color, systemName:c.rg.systemName, readyText:c.rg.readyText },voice:clone(c.voice) };
}
function importPreset(config, bundle, newId) {
  if (!plain(bundle) || bundle.format !== 'antigravity-custom-preset' || bundle.schemaVersion !== 1 || !plain(bundle.preset)) throw new Error('File không đúng định dạng preset phiên bản 1.');
  const c = normalizeConfig(config);
  if (c.presets.length >= 64) throw new Error('Đã đạt giới hạn 64 preset.');
  const p = normalizePreset({ ...bundle.preset, id: newId });
  c.presets.push(p); c.selectedPreset = p.id;
  const s = plain(bundle.splash) ? bundle.splash : {}, w = plain(bundle.wallpaper) ? bundle.wallpaper : {};
  const rg=plain(bundle.rg)?bundle.rg:{};
  return normalizeConfig({ ...c, splash: { ...c.splash, enabled: s.enabled, durationMs: s.durationMs, volume: s.volume, soundEnabled: s.soundEnabled, chime: s.chime,musicScope:s.musicScope }, wallpaper: { ...c.wallpaper, enabled: w.enabled, opacity: w.opacity, blur: w.blur }, accessibility: bundle.accessibility,
    rg:{...c.rg,enabled:typeof rg.enabled==='boolean'?rg.enabled:c.rg.enabled,color:color(rg.color,c.rg.color),systemName:text(rg.systemName,40,c.rg.systemName),readyText:text(rg.readyText,48,c.rg.readyText)},voice:plain(bundle.voice)?bundle.voice:c.voice });
}
module.exports = { normalizeConfig, normalizePreset, exportPreset, importPreset, mediaId };
