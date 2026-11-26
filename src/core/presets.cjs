const BUILTINS = [
  ...require('./sao-presets.json'),
  { id: 'sao', name: 'White Gundam · Neural Cyan', description: 'Giao diện Mecha White Gundam với ánh sáng Plavsky Particle và viền kính Cyan.', family: 'gundam', mode: 'dark', accent: '#22d3ee', background: '#090e15', foreground: '#e2f4f8', motion: true },
  { id: 'gundam', name: 'White Gundam · Strike Sky', description: 'Biến thể Mecha bầu trời với ánh xanh lam Strike và hạt năng lượng cao.', family: 'gundam', mode: 'dark', accent: '#38bdf8', background: '#09111c', foreground: '#e0f2fe', motion: true },
  { id: 'focus', name: 'White Gundam · Stealth Dark', description: 'Tông đen xám cơ khí tối giản, giảm ánh sáng để tập trung lập trình.', family: 'focus', mode: 'dark', accent: '#94a3b8', background: '#0f172a', foreground: '#f8fafc', motion: false },
  { id: 'paper', name: 'White Gundam · Pure Light', description: 'Biến thể giáp trắng tinh khiết, tương phản sáng cao.', family: 'focus', mode: 'light', accent: '#0284c7', background: '#f8fafc', foreground: '#0f172a', motion: false }
];
const DEFAULT_CONFIG = {
  schemaVersion: 1, selectedPreset: 'sao', presets: BUILTINS,
  splash: { enabled: true, durationMs: 3200, displayName: 'Pilot', mediaId: '', volume: 25, audioId: '', soundEnabled: false, chime: true },
  wallpaper: { enabled: true, mediaId: '', opacity: 20, blur: 0 },
  launcher: { executable: '', minimizeAfterLaunch: true },
  integration: { enabled: false }, accessibility: { reducedMotion: false },
  rg: { enabled: true, color: '#22d3ee', operatorName: 'Pilot', unitName: 'WHITE GUNDAM', modelName: 'RG-01', operatorClass: 'OPERATOR', systemName: 'NEURAL SYSTEM', readyText: 'SYSTEM READY' },
  voice: { enabled: false, style: 'system', volume: 45 }
};
module.exports = { BUILTINS, DEFAULT_CONFIG };
