function installAntigravityCustom(data) {
  if (location.origin !== data.origin) return { installed: false };
  if (window.__agcSettingsBridge) { window.__agcSettingsBridge.update(data); return { installed: true, version: 4 }; }
  // Remove legacy floating controls and previous elements when upgrading.
  window.__agcCleanup?.();
  document.querySelector('#antigravity-custom-companion')?.remove();
  document.querySelector('#agc-quota-hud')?.remove();
  document.querySelector('#agc-sidebar-quota-card')?.remove();
  document.querySelector('#agc-custom-theme-overrides')?.remove();

  let current = data, active = false, modal, pane, wrapper, tab, header, lastBounds = '', scheduled = false, destroyed = false;
  const originalChildren = new Map(), selectedButtons = new Map();
  const command = value => { if (typeof window.__agcCommand === 'function') window.__agcCommand(JSON.stringify(value)); };

  // 1. Wallpaper Layer (Supports dynamic video wallpaper and static image wallpaper)
  const wallpaper = document.createElement('div');
  wallpaper.id = 'antigravity-custom-wallpaper';
  wallpaper.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;mix-blend-mode:screen;transition:opacity 0.6s ease;overflow:hidden;';

  const wallpaperArt = document.createElement('div');
  wallpaperArt.id = 'antigravity-custom-wallpaper-art';
  wallpaperArt.style.cssText = 'height:100%;width:100%;background-size:cover;background-position:center;transition:filter 0.3s ease;';

  const wallpaperVideo = document.createElement('video');
  wallpaperVideo.id = 'antigravity-custom-wallpaper-video';
  wallpaperVideo.setAttribute('autoplay', '');
  wallpaperVideo.setAttribute('loop', '');
  wallpaperVideo.setAttribute('muted', '');
  wallpaperVideo.setAttribute('playsinline', '');
  wallpaperVideo.muted = true;
  wallpaperVideo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:filter 0.3s ease;pointer-events:none;';
  wallpaperVideo.hidden = true;

  wallpaper.append(wallpaperArt, wallpaperVideo);
  document.documentElement.append(wallpaper);

  function updateWallpaper() {
    const w = current.wallpaper || {}, p = current.preset || {};
    wallpaper.hidden = !w.enabled;
    if (!w.enabled) {
      wallpaperVideo.pause();
      return;
    }
    const opacity = typeof w.opacity === 'number' ? w.opacity : 20;
    wallpaper.style.opacity = String(opacity / 100);
    const blurPx = `blur(${w.blur || 0}px)`;

    // Always keep static poster ready underneath as fallback
    wallpaperArt.hidden = false;
    wallpaperArt.style.filter = blurPx;
    wallpaperArt.style.backgroundImage = `radial-gradient(ellipse at 70% 42%,${p.accent || '#5ddddd'}33,transparent 65%)`;
    if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(current.wallpaperData || '')) {
      wallpaperArt.style.backgroundImage = `url("${current.wallpaperData}")`;
    }

    const isVideo = !!(current.wallpaperIsVideo || w.mode === 'video');
    if (isVideo && current.wallpaperVideoUrl) {
      wallpaperVideo.hidden = false;
      wallpaperVideo.style.filter = blurPx;
      wallpaperVideo.onplaying = () => { wallpaperArt.hidden = true; };
      wallpaperVideo.onerror = () => { wallpaperVideo.hidden = true; wallpaperArt.hidden = false; };
      if (wallpaperVideo.src !== current.wallpaperVideoUrl) {
        wallpaperVideo.src = current.wallpaperVideoUrl;
        wallpaperVideo.load();
      }
      wallpaperVideo.play().catch(() => {
        wallpaperVideo.hidden = true;
        wallpaperArt.hidden = false;
      });
    } else {
      wallpaperVideo.hidden = true;
      wallpaperVideo.pause();
    }
  }
  // 2. In-App Theme Styling Overrides
  const themeStyle = document.createElement('style');
  themeStyle.id = 'agc-custom-theme-overrides';
  document.head.append(themeStyle);

  function updateTheme() {
    const p = current.preset || {};
    const accent = p.accent || '#22d3ee';
    themeStyle.textContent = `
      :root {
        --agc-accent: ${accent};
        --agc-accent-glow: ${accent}40;
      }
      .agc-glow-accent {
        border-color: ${accent} !important;
        box-shadow: 0 0 12px ${accent}40 !important;
      }
    `;
  }

  // 3. Helper: Countdown & Token Formatters
  function formatCountdown(resetsAtSec, currentPercent, hasData = true) {
    if (!hasData || currentPercent === null || currentPercent === undefined) return 'Chưa có API';
    if (currentPercent >= 100) return 'Ready';
    if (!resetsAtSec) return 'Chưa có API';
    const now = Math.floor(Date.now() / 1000);
    const diff = resetsAtSec - now;
    if (diff <= 0) return 'Ready';
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = Math.floor(diff % 60);
    const padSec = secs < 10 ? '0' + secs : secs;
    if (days > 0) return `${days}d ${hours}h ${mins}m ${padSec}s`;
    if (hours > 0) return `${hours}h ${mins}m ${padSec}s`;
    return `${mins}m ${padSec}s`;
  }

  function formatTokens(n) {
    if (typeof n !== 'number' || Number.isNaN(n) || n < 0) return '0';
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(Math.round(n));
  }

  // 4. Quota Data State & Telemetry Metrics
  const savedPlan = (() => { try { return localStorage.getItem('__agc_user_plan'); } catch { return null; } })();
  const savedGeminiQuota = (() => {
    try {
      const raw = localStorage.getItem('__agc_gemini_quota');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch { return null; }
  })();
  let quotaData = {
    plan: savedPlan || current?.quota?.plan || 'Google AI Pro',
    gemini5h: savedGeminiQuota?.gemini5h ?? null,
    geminiWeek: savedGeminiQuota?.geminiWeek ?? null,
    gemini5hResetAt: savedGeminiQuota?.gemini5hResetAt ?? null,
    geminiWeekResetAt: savedGeminiQuota?.geminiWeekResetAt ?? null,
    codex5h: null,
    codexWeek: null,
    codex5hResetAt: null,
    codexWeekResetAt: null,
    ...(current.quota || {})
  };

  // Telemetry real-time metrics (measured dynamically from DOM, no fake floors)
  let telemetry = {
    activeModel: 'Đang nhận diện...',
    provider: '—',
    contextWindow: '—',
    speedTokPerSec: null,
    ttftMs: null,
    cacheHitPercent: null,
    cachedTokens: null,
    uncachedTokens: null,
    sessionInputTokens: 0,
    sessionOutputTokens: 0,
    sessionTurns: 0
  };
  let lastUserCharCount = 0;
  let lastOutputCharCount = 0;
  let lastSampleTime = Date.now();
  let pendingRequestAt = 0;

  // 5. Sidebar Quota Card Element (Positioned directly above "⚙ Settings")
  const card = document.createElement('div');
  card.id = 'agc-sidebar-quota-card';
  card.className = 'agc-sidebar-card';

  card.innerHTML = `
    <style>
      #agc-sidebar-quota-card {
        box-sizing: border-box;
        width: calc(100% - 16px);
        margin: 6px 8px 8px;
        background: rgba(10, 16, 25, 0.94);
        border: 1px solid rgba(34, 211, 238, 0.22);
        border-radius: 10px;
        padding: 10px 12px;
        color: #e2e8f0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        line-height: 1.35;
        user-select: none;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.55), 0 0 12px rgba(34, 211, 238, 0.06);
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
      }
      #agc-sidebar-quota-card:hover {
        border-color: rgba(34, 211, 238, 0.45);
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(34, 211, 238, 0.14);
      }
      .agc-hd-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .agc-hd-left {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .agc-main-title {
        font-weight: 700;
        font-size: 13px;
        color: #ffffff;
        letter-spacing: 0.2px;
      }
      .agc-plan-pill {
        display: inline-block;
        background: rgba(14, 165, 233, 0.18);
        border: 1px solid rgba(14, 165, 233, 0.45);
        color: #38bdf8;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 7px;
        border-radius: 12px;
        letter-spacing: 0.2px;
        cursor: pointer;
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
      }
      .agc-plan-pill:hover {
        background: rgba(14, 165, 233, 0.32);
        border-color: rgba(56, 189, 248, 0.7);
        color: #f0f9ff;
      }
      .agc-plan-pill:active {
        transform: scale(0.96);
      }
      .agc-hd-right {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .agc-action-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 3px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s ease, background 0.15s ease, transform 0.2s ease;
      }
      .agc-action-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }
      .agc-chevron-icon {
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .agc-expanded .agc-chevron-icon {
        transform: rotate(180deg);
      }
      .agc-spinning svg {
        animation: agcSpin 0.6s linear;
      }
      @keyframes agcSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes agcPulseGlow {
        0% { color: #38bdf8; text-shadow: 0 0 10px rgba(56, 189, 248, 0.9); }
        50% { color: #7dd3fc; text-shadow: 0 0 14px rgba(125, 211, 252, 0.7); }
        100% { color: inherit; text-shadow: none; }
      }
      .agc-num-pulse {
        animation: agcPulseGlow 0.75s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .agc-section-lbl {
        font-size: 11px;
        font-weight: 600;
        color: #cbd5e1;
        margin-top: 7px;
        margin-bottom: 3px;
      }
      .agc-metric-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        margin-top: 3px;
      }
      .agc-time-txt {
        color: #cbd5e1;
        font-weight: 500;
      }
      .agc-percent-txt {
        font-family: Consolas, monospace;
        font-weight: 700;
        font-size: 11px;
        color: #f8fafc;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .agc-green-dot {
        font-size: 9px;
        color: #10b981;
      }
      .agc-green-dot.low {
        color: #f59e0b;
      }
      .agc-green-dot.crit {
        color: #ef4444;
      }
      .agc-p-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 3px;
        margin-bottom: 5px;
      }
      .agc-p-fill {
        height: 100%;
        border-radius: 3px;
        background: #10b981;
        transition: width 0.4s ease, background 0.3s ease;
      }
      .agc-p-fill.low {
        background: #f59e0b;
      }
      .agc-p-fill.crit {
        background: #ef4444;
      }
      /* Drawer */
      .agc-telemetry-drawer {
        display: none;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        animation: agcSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .agc-expanded .agc-telemetry-drawer {
        display: block;
      }
      @keyframes agcSlideDown {
        0% { opacity: 0; transform: translateY(-4px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      .agc-drawer-box {
        margin-bottom: 9px;
      }
      .agc-drawer-box:last-child {
        margin-bottom: 0;
      }
      .agc-drawer-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 3px;
      }
      .agc-drawer-title {
        font-size: 9.5px;
        font-weight: 700;
        color: #38bdf8;
        letter-spacing: 0.8px;
        text-transform: uppercase;
      }
      .agc-tag-small {
        font-size: 9px;
        font-weight: 600;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 5px;
        border-radius: 3px;
      }
      .agc-model-val {
        font-size: 12px;
        font-weight: 600;
        color: #ffffff;
      }
      .agc-meta-txt {
        font-size: 10px;
        color: #94a3b8;
        margin-top: 2px;
      }
      .agc-meta-txt b {
        color: #e2e8f0;
      }
      .agc-grid-stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 4px;
      }
      .agc-stat-card {
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 5px;
        padding: 5px 8px;
      }
      .agc-stat-number {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        font-family: Consolas, monospace;
      }
      .agc-stat-number small {
        font-size: 9.5px;
        font-weight: 500;
        color: #94a3b8;
      }
      .agc-stat-caption {
        font-size: 9px;
        color: #94a3b8;
        margin-top: 1px;
      }
      .agc-cache-bar-box {
        margin-top: 4px;
      }
      .agc-cache-labels {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
        color: #94a3b8;
        margin-top: 3px;
      }
      .agc-cache-labels b {
        color: #e2e8f0;
      }
      .agc-session-summary {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 4px;
        margin-top: 4px;
        background: rgba(255, 255, 255, 0.03);
        border-radius: 5px;
        padding: 6px;
        text-align: center;
      }
      .agc-session-item span {
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: #f1f5f9;
        font-family: Consolas, monospace;
      }
      .agc-session-item small {
        display: block;
        font-size: 8.5px;
        color: #94a3b8;
        margin-top: 1px;
      }
      .agc-drawer-foot {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .agc-link-settings {
        background: transparent;
        border: none;
        color: #38bdf8;
        cursor: pointer;
        font-size: 10px;
        font-weight: 600;
        padding: 2px 4px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        text-decoration: underline;
      }
      .agc-link-settings:hover {
        color: #7dd3fc;
      }
    </style>

    <!-- Header matching Image 2 -->
    <div class="agc-hd-row">
      <div class="agc-hd-left">
        <span class="agc-main-title">Quota</span>
        <span class="agc-plan-pill" id="agc-plan-badge" title="Gói tài khoản (Bấm để chuyển đổi Pro / Ultra / Standard)">Google AI Pro</span>
      </div>
      <div class="agc-hd-right">
        <button type="button" class="agc-action-btn" id="agc-btn-refresh" title="Làm mới Quota">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
        <button type="button" class="agc-action-btn" id="agc-btn-toggle" title="Mở rộng / Thu gọn chi tiết">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="agc-chevron-icon">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <!-- Gemini Section -->
    <div class="agc-section-lbl">Gemini Models</div>
    <div class="agc-metric-line">
      <span class="agc-time-txt" id="agc-txt-gemini-5h">5h · Chưa có API</span>
      <span class="agc-percent-txt"><span class="agc-green-dot" id="agc-dot-gemini-5h">●</span> <span id="agc-val-gemini-5h">--%</span></span>
    </div>
    <div class="agc-p-bar">
      <div class="agc-p-fill" id="agc-bar-gemini-5h" style="width: 0%"></div>
    </div>

    <div class="agc-metric-line">
      <span class="agc-time-txt" id="agc-txt-gemini-week">Weekly · Chưa có API</span>
      <span class="agc-percent-txt"><span class="agc-green-dot" id="agc-dot-gemini-week">●</span> <span id="agc-val-gemini-week">--%</span></span>
    </div>
    <div class="agc-p-bar">
      <div class="agc-p-fill" id="agc-bar-gemini-week" style="width: 0%"></div>
    </div>

    <!-- Claude / GPT Section -->
    <div class="agc-section-lbl">Claude and GPT models</div>
    <div class="agc-metric-line">
      <span class="agc-time-txt" id="agc-txt-codex-5h">5h · Chưa có API</span>
      <span class="agc-percent-txt"><span class="agc-green-dot" id="agc-dot-codex-5h">●</span> <span id="agc-val-codex-5h">--%</span></span>
    </div>
    <div class="agc-p-bar">
      <div class="agc-p-fill" id="agc-bar-codex-5h" style="width: 0%"></div>
    </div>

    <div class="agc-metric-line">
      <span class="agc-time-txt" id="agc-txt-codex-week">Weekly · Chưa có API</span>
      <span class="agc-percent-txt"><span class="agc-green-dot" id="agc-dot-codex-week">●</span> <span id="agc-val-codex-week">--%</span></span>
    </div>
    <div class="agc-p-bar">
      <div class="agc-p-fill" id="agc-bar-codex-week" style="width: 0%"></div>
    </div>

    <!-- Expandable Accordion Drawer -->
    <div class="agc-telemetry-drawer" id="agc-drawer-content">
      <!-- Active Model Info -->
      <div class="agc-drawer-box">
        <div class="agc-drawer-head">
          <span class="agc-drawer-title">Active Model</span>
          <span class="agc-tag-small" id="agc-drawer-provider">—</span>
        </div>
        <div class="agc-model-val" id="agc-drawer-model">Đang nhận diện...</div>
        <div class="agc-meta-txt">Context: <b id="agc-drawer-context">—</b></div>
      </div>

      <!-- Live Speed & Latency -->
      <div class="agc-drawer-box">
        <div class="agc-drawer-title">Speed & Performance</div>
        <div class="agc-grid-stats">
          <div class="agc-stat-card">
            <div class="agc-stat-number" id="agc-stat-speed">-- <small>tok/s</small></div>
            <div class="agc-stat-caption">Tốc độ Output</div>
          </div>
          <div class="agc-stat-card">
            <div class="agc-stat-number" id="agc-stat-ttft">-- <small>ms</small></div>
            <div class="agc-stat-caption">Độ trễ TTFT</div>
          </div>
        </div>
      </div>

      <!-- Cache & Efficiency -->
      <div class="agc-drawer-box">
        <div class="agc-drawer-head">
          <span class="agc-drawer-title">Prompt Cache</span>
          <span class="agc-tag-small" id="agc-cache-pct-tag">Chưa có API</span>
        </div>
        <div class="agc-cache-bar-box">
          <div class="agc-p-bar" style="margin-bottom:0">
            <div class="agc-p-fill" id="agc-cache-bar-fill" style="width: 0%; background: linear-gradient(90deg, #0ea5e9, #22d3ee);"></div>
          </div>
        </div>
        <div class="agc-cache-labels">
          <span>Cached: <b id="agc-cache-cached">--</b></span>
          <span>Mới: <b id="agc-cache-uncached">--</b></span>
        </div>
      </div>

      <!-- Session Usage -->
      <div class="agc-drawer-box">
        <div class="agc-drawer-title">Session Usage</div>
        <div class="agc-session-summary">
          <div class="agc-session-item">
            <span id="agc-sess-tok-in">0</span>
            <small>Input tok</small>
          </div>
          <div class="agc-session-item">
            <span id="agc-sess-tok-out">0</span>
            <small>Output tok</small>
          </div>
          <div class="agc-session-item">
            <span id="agc-sess-turn-cnt">0</span>
            <small>Lượt chat</small>
          </div>
        </div>
      </div>

      <!-- Settings Action Link -->
      <div class="agc-drawer-foot">
        <button type="button" class="agc-link-settings" id="agc-btn-goto-custom">Tùy biến Custom →</button>
      </div>
    </div>
  `;

  // 6. Sidebar Anchor Finder & Attacher (Locates Settings in left sidebar)
  function findSettingsAnchor() {
    // 1. Check known selectors in sidebar
    const selectors = [
      '[aria-label="Settings"]',
      '[aria-label*="Settings"]',
      '[aria-label*="Cài đặt"]',
      '[data-testid="settings-button"]',
      '.codicon-settings-gear',
      '.codicon-settings'
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.left < 360) {
          return el.closest('[data-testid*="settings"], [role="listitem"], .sidebar-item, button, div') || el;
        }
      }
    }
    // 2. Scan text nodes in sidebar region
    for (const el of document.querySelectorAll('button, a, [role="button"], div')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.left < 360 && r.top > window.innerHeight * 0.4) {
        const t = (el.textContent || '').trim();
        if ((t === 'Settings' || t === 'Cài đặt' || t.startsWith('Settings') || t.startsWith('Cài đặt')) && r.height > 15 && r.height < 60) {
          return el.closest('[role="listitem"], .sidebar-item, button, div') || el;
        }
      }
    }
    return null;
  }

  function attachSidebarCard() {
    if (destroyed) return;
    const anchor = findSettingsAnchor();
    if (anchor && anchor.parentElement) {
      if (card.nextElementSibling !== anchor) {
        anchor.parentElement.insertBefore(card, anchor);
      }
    } else if (!card.isConnected) {
      // Fallback: append inside left sidebar navigation if anchor is not yet ready
      const nav = document.querySelector('nav, [role="navigation"], .sidebar, [data-testid="sidebar"]');
      if (nav && nav.getBoundingClientRect().left < 360) {
        nav.append(card);
      }
    }
  }

  // 7. Interactive Controls: Toggle Drawer & Refresh Button
  let drawerExpanded = false;
  function toggleDrawer() {
    drawerExpanded = !drawerExpanded;
    card.classList.toggle('agc-expanded', drawerExpanded);
  }

  card.querySelector('#agc-btn-toggle')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDrawer();
  });

  card.querySelector('.agc-hd-row')?.addEventListener('click', e => {
    if (e.target.closest('#agc-btn-refresh')) return;
    toggleDrawer();
  });

  const refreshBtn = card.querySelector('#agc-btn-refresh');
  refreshBtn?.addEventListener('click', e => {
    e.stopPropagation();
    refreshBtn.classList.add('agc-spinning');
    scanQuota();
    silentSyncGeminiQuota();
    updateTelemetryUI(true);
    command({ type: 'quota-refresh' });
    setTimeout(() => refreshBtn.classList.remove('agc-spinning'), 600);
  });

  const planBadge = card.querySelector('#agc-plan-badge');
  planBadge?.addEventListener('click', e => {
    e.stopPropagation();
    const plans = ['Google AI Pro', 'Google AI Ultra', 'Google AI Standard'];
    const curIdx = plans.indexOf(quotaData.plan);
    const nextPlan = plans[(curIdx + 1) % plans.length];
    quotaData.plan = nextPlan;
    try { localStorage.setItem('__agc_user_plan', nextPlan); } catch {}
    if (planBadge) {
      planBadge.textContent = nextPlan;
      planBadge.title = `Gói tài khoản: ${nextPlan} (Bấm để chuyển đổi)`;
    }
    command({ type: 'quota-update', quota: { plan: nextPlan } });
  });

  card.querySelector('#agc-btn-goto-custom')?.addEventListener('click', () => {
    if (tab?.isConnected) activate();
    else {
      const btn = findSettingsAnchor() || document.querySelector('[aria-label="Settings"]');
      btn?.click();
      setTimeout(() => { if (tab?.isConnected) activate(); }, 250);
    }
  });

  // 8. Update Quota UI & Real-Time Countdowns
  function updateQuotaUI(nextData) {
    quotaData = { ...quotaData, ...(nextData || {}) };

    const setBar = (valId, barId, dotId, val) => {
      const hasVal = typeof val === 'number' && !Number.isNaN(val);
      const num = hasVal ? Math.max(0, Math.min(100, Math.round(val))) : 0;
      const vEl = card.querySelector(valId), bEl = card.querySelector(barId), dEl = card.querySelector(dotId);
      if (vEl) vEl.textContent = hasVal ? `${num}%` : '--%';
      if (bEl) {
        bEl.style.width = `${num}%`;
        bEl.classList.toggle('low', hasVal && num <= 30 && num > 10);
        bEl.classList.toggle('crit', hasVal && num <= 10);
      }
      if (dEl) {
        dEl.style.opacity = hasVal ? '1' : '0.35';
        dEl.classList.toggle('low', hasVal && num <= 30 && num > 10);
        dEl.classList.toggle('crit', hasVal && num <= 10);
      }
    };

    // Plan Badge
    const planBadge = card.querySelector('#agc-plan-badge');
    if (planBadge) planBadge.textContent = quotaData.plan || 'Google AI Pro';

    // Numbers & Bars
    setBar('#agc-val-gemini-5h', '#agc-bar-gemini-5h', '#agc-dot-gemini-5h', quotaData.gemini5h);
    setBar('#agc-val-gemini-week', '#agc-bar-gemini-week', '#agc-dot-gemini-week', quotaData.geminiWeek);
    setBar('#agc-val-codex-5h', '#agc-bar-codex-5h', '#agc-dot-codex-5h', quotaData.codex5h);
    setBar('#agc-val-codex-week', '#agc-bar-codex-week', '#agc-dot-codex-week', quotaData.codexWeek);

    // Dynamic countdown labels
    const g5hTxt = card.querySelector('#agc-txt-gemini-5h');
    if (g5hTxt) g5hTxt.textContent = `5h · ${formatCountdown(quotaData.gemini5hResetAt, quotaData.gemini5h, typeof quotaData.gemini5h === 'number')}`;

    const gWkTxt = card.querySelector('#agc-txt-gemini-week');
    if (gWkTxt) gWkTxt.textContent = `Weekly · ${formatCountdown(quotaData.geminiWeekResetAt, quotaData.geminiWeek, typeof quotaData.geminiWeek === 'number')}`;

    const c5hTxt = card.querySelector('#agc-txt-codex-5h');
    if (c5hTxt) c5hTxt.textContent = `5h · ${formatCountdown(quotaData.codex5hResetAt, quotaData.codex5h, typeof quotaData.codex5h === 'number')}`;

    const cWkTxt = card.querySelector('#agc-txt-codex-week');
    if (cWkTxt) cWkTxt.textContent = `Weekly · ${formatCountdown(quotaData.codexWeekResetAt, quotaData.codexWeek, typeof quotaData.codexWeek === 'number')}`;

    attachSidebarCard();
  }

  function detectActiveModelFromDOM() {
    const modelPattern = /(Gemini\s+\d+(?:\.\d+)?(?:\s+[A-Za-z0-9().-]+){0,4}|Claude\s+[A-Za-z0-9.\s()-]{1,25}|GPT-[A-Za-z0-9.-]{1,15}|o[134](?:-mini|-pro)?)/i;
    try {
      // 1. Prefer interactive model selector buttons in composer / bottom workspace (exclude sidebar & our own card)
      const composerInputs = document.querySelectorAll('form, [contenteditable="true"], textarea, [role="textbox"]');
      for (const inp of composerInputs) {
        let box = inp.parentElement;
        for (let depth = 0; depth < 4 && box; depth++, box = box.parentElement) {
          const btns = box.querySelectorAll('button, [role="button"], [data-testid*="model"]');
          for (const btn of btns) {
            if (card.contains(btn)) continue;
            const txt = (btn.getAttribute('aria-label') || btn.textContent || '').replace(/\s+/g, ' ').trim();
            if (!txt || txt.length > 60) continue;
            const m = txt.match(modelPattern);
            if (m) return m[1].trim();
          }
        }
      }

      // 2. Fallback: explicit model picker elements in main pane (never scan chat message bodies)
      const pickers = document.querySelectorAll('[data-testid*="model-picker"], [data-testid*="model-selector"], [aria-label*="Select model"], [aria-label*="Model"]');
      for (const el of pickers) {
        if (card.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.left < 220) continue;
        const txt = (el.textContent || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        if (txt.length > 60) continue;
        const m = txt.match(modelPattern);
        if (m) return m[1].trim();
      }
    } catch {}
    return null;
  }

  // 9. Telemetry & Active Model Detection in DOM (Real-time 1s cycle)
  function updateTelemetryUI(forced = false) {
    const now = Date.now();

    // 1. Active Model detection
    const detectedModel = detectActiveModelFromDOM();
    if (detectedModel) {
      telemetry.activeModel = detectedModel;
      if (/Gemini/i.test(detectedModel)) {
        telemetry.provider = 'Google DeepMind';
        telemetry.contextWindow = /(1\.5|2\.5)\s+Pro/i.test(detectedModel)
          ? '2,097,152 tokens (2M)'
          : '1,048,576 tokens (1M)';
      } else if (/Claude/i.test(detectedModel)) {
        telemetry.provider = 'Anthropic';
        telemetry.contextWindow = '200,000 tokens (200k)';
      } else if (/GPT|o[134]/i.test(detectedModel)) {
        telemetry.provider = 'OpenAI';
        telemetry.contextWindow = '128,000 tokens (128k)';
      }
    }

    // 2. Scan real conversation messages (excluding our card & left sidebar)
    try {
      const filterMain = list => [...list].filter(el => !card.contains(el) && el.getBoundingClientRect().left >= 200);
      const userMsgs = filterMain(document.querySelectorAll('[data-role="user"], [data-message-author-role="user"], [data-testid*="user-message"], [class*="user-message"]'));
      const assistantMsgs = filterMain(document.querySelectorAll('[data-role="assistant"], [data-role="model"], [data-message-author-role="assistant"], [data-message-author-role="model"], [data-testid*="assistant"], [data-testid*="model-message"], [data-testid*="agent-message"], [data-testid*="response"], [class*="assistant-message"], [class*="model-message"], .agent-response'));

      let userChars = 0;
      for (const el of userMsgs) userChars += (el.innerText || el.textContent || '').length;

      let assistantChars = 0;
      if (assistantMsgs.length > 0) {
        for (const el of assistantMsgs) assistantChars += (el.innerText || el.textContent || '').length;
      } else {
        // Fallback: measure main chat scroll container minus userMsgs & composer input
        let chatRoot = null;
        if (userMsgs.length > 0) {
          let p = userMsgs[0].parentElement;
          while (p && p !== document.body) {
            const st = getComputedStyle(p);
            if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && p.clientHeight > 200) {
              chatRoot = p;
              break;
            }
            p = p.parentElement;
          }
          if (!chatRoot) chatRoot = userMsgs[0].parentElement?.parentElement || null;
        }
        if (!chatRoot) {
          chatRoot = filterMain(document.querySelectorAll('main, [role="main"], [data-testid*="conversation"], [class*="conversation"], [class*="chat-messages"]'))[0] || null;
        }
        if (chatRoot) {
          let rootChars = (chatRoot.innerText || chatRoot.textContent || '').length;
          // Subtract composer/input area if inside chatRoot
          const forms = chatRoot.querySelectorAll('form, [contenteditable="true"], textarea');
          for (const f of forms) rootChars -= (f.innerText || f.textContent || '').length;
          assistantChars = Math.max(0, rootChars - userChars);
        }
      }

      let turnCount = userMsgs.length + assistantMsgs.length;
      if (turnCount === 0) {
        const genericTurns = filterMain(document.querySelectorAll('[data-role], [data-message-author-role], [data-testid*="chat-turn"], [data-testid*="message-"], .conversation-turn, .chat-turn'));
        turnCount = genericTurns.length;
      } else if (assistantMsgs.length === 0 && assistantChars > 0) {
        turnCount = userMsgs.length * 2;
      }
      telemetry.sessionTurns = turnCount;

      telemetry.sessionInputTokens = Math.round(userChars / 3.8);
      telemetry.sessionOutputTokens = Math.round(assistantChars / 3.8);

      // Track TTFT when user sends a new prompt
      if (userChars > lastUserCharCount && lastUserCharCount > 0) {
        pendingRequestAt = now;
      }

      // Real streaming speed measurement from DOM character growth
      const deltaChars = assistantChars - lastOutputCharCount;
      const deltaSec = (now - lastSampleTime) / 1000;
      if (deltaChars > 0 && deltaSec > 0 && lastOutputCharCount > 0) {
        if (pendingRequestAt > 0) {
          telemetry.ttftMs = Math.max(50, Math.round(now - pendingRequestAt));
          pendingRequestAt = 0;
        }
        const liveSpeed = Math.round((deltaChars / 3.8) / deltaSec);
        if (liveSpeed >= 1 && liveSpeed <= 500) {
          telemetry.speedTokPerSec = telemetry.speedTokPerSec
            ? Math.round(telemetry.speedTokPerSec * 0.4 + liveSpeed * 0.6)
            : liveSpeed;
        }
      }

      lastUserCharCount = userChars;
      lastOutputCharCount = assistantChars;
      lastSampleTime = now;
    } catch {}

    // 3. Update DOM Elements
    const mEl = card.querySelector('#agc-drawer-model');
    if (mEl) mEl.textContent = telemetry.activeModel;

    const provEl = card.querySelector('#agc-drawer-provider');
    if (provEl) provEl.textContent = telemetry.provider;

    const ctxEl = card.querySelector('#agc-drawer-context');
    if (ctxEl) ctxEl.textContent = telemetry.contextWindow;

    const spdEl = card.querySelector('#agc-stat-speed');
    if (spdEl) {
      spdEl.innerHTML = telemetry.speedTokPerSec !== null
        ? `${telemetry.speedTokPerSec} <small>tok/s</small>`
        : `-- <small>tok/s</small>`;
      if (forced) { spdEl.classList.remove('agc-num-pulse'); void spdEl.offsetWidth; spdEl.classList.add('agc-num-pulse'); }
    }

    const ttftEl = card.querySelector('#agc-stat-ttft');
    if (ttftEl) {
      ttftEl.innerHTML = telemetry.ttftMs !== null
        ? `${telemetry.ttftMs} <small>ms</small>`
        : `-- <small>ms</small>`;
      if (forced) { ttftEl.classList.remove('agc-num-pulse'); void ttftEl.offsetWidth; ttftEl.classList.add('agc-num-pulse'); }
    }

    const cacheBar = card.querySelector('#agc-cache-bar-fill');
    if (cacheBar) cacheBar.style.width = telemetry.cacheHitPercent !== null ? `${telemetry.cacheHitPercent}%` : '0%';

    const cacheTag = card.querySelector('#agc-cache-pct-tag');
    if (cacheTag) cacheTag.textContent = telemetry.cacheHitPercent !== null ? `${telemetry.cacheHitPercent}% Hit` : 'Chưa có API';

    const cacheCached = card.querySelector('#agc-cache-cached');
    if (cacheCached) cacheCached.textContent = telemetry.cachedTokens !== null ? formatTokens(telemetry.cachedTokens) : '--';

    const cacheUncached = card.querySelector('#agc-cache-uncached');
    if (cacheUncached) cacheUncached.textContent = telemetry.uncachedTokens !== null ? formatTokens(telemetry.uncachedTokens) : '--';

    const sessIn = card.querySelector('#agc-sess-tok-in');
    if (sessIn) sessIn.textContent = formatTokens(telemetry.sessionInputTokens);

    const sessOut = card.querySelector('#agc-sess-tok-out');
    if (sessOut) sessOut.textContent = formatTokens(telemetry.sessionOutputTokens);

    const sessTurns = card.querySelector('#agc-sess-turn-cnt');
    if (sessTurns) sessTurns.textContent = String(telemetry.sessionTurns);
  }

  function detectPlanFromDOM() {
    try {
      const candidates = document.querySelectorAll('[data-testid*="tier"], [data-testid*="plan"], [class*="subscription"], [class*="plan"], [class*="tier"], [aria-label*="account"], [aria-label*="Plan"]');
      for (const el of candidates) {
        if (card.contains(el)) continue;
        const t = (el.textContent || '').trim();
        if (/Google\s+AI\s+Ultra/i.test(t) || /\bUltra\b/i.test(t)) return 'Google AI Ultra';
        if (/Google\s+AI\s+Pro/i.test(t) || /\bPro\b/i.test(t) || /Gemini\s+Advanced/i.test(t) || /Gemini\s+Pro/i.test(t)) return 'Google AI Pro';
      }
    } catch {}
    return null;
  }

  function parseResetDurationSec(snippet) {
    if (!snippet) return null;
    if (/\bReady\b/i.test(snippet)) return null;
    const now = Math.floor(Date.now() / 1000);
    let total = 0;
    const d = snippet.match(/(\d+)\s*(?:days?|d)\b/i);
    const h = snippet.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i);
    const m = snippet.match(/(\d+)\s*(?:minutes?|mins?|m(?!s))\b/i);
    const s = snippet.match(/(\d+)\s*(?:seconds?|secs?|s)\b/i);
    if (d) total += parseInt(d[1], 10) * 86400;
    if (h) total += parseInt(h[1], 10) * 3600;
    if (m) total += parseInt(m[1], 10) * 60;
    if (s) total += parseInt(s[1], 10);
    return total > 0 ? now + total : null;
  }

  let lastSentGeminiKey = '';
  function scanQuota() {
    try {
      const detectedPlan = detectPlanFromDOM();
      if (detectedPlan && detectedPlan !== quotaData.plan && !savedPlan) {
        quotaData.plan = detectedPlan;
        const b = card.querySelector('#agc-plan-badge');
        if (b) b.textContent = detectedPlan;
        command({ type: 'quota-update', quota: { plan: detectedPlan } });
      }

      // Scan outside our own card for real Gemini quota percentages & reset timers when Settings / Quota panel is open
      const candidates = document.querySelectorAll('[role="dialog"], [data-testid*="settings"], [data-testid*="quota"], [class*="quota"], [class*="models"], [class*="account"], main');
      for (const el of candidates) {
        if (card.contains(el)) continue;
        const text = el.innerText || '';
        const gemIdx = text.search(/Gemini\s+Models|Gemini/i);
        if (gemIdx === -1) continue;

        const block = text.slice(gemIdx, gemIdx + 800);
        // Stop before Claude / GPT section if present
        const cutIdx = block.search(/Claude|GPT/i);
        const gemBlock = cutIdx > 0 ? block.slice(0, cutIdx) : block;

        let g5h = null, gWk = null, g5hReset = null, gWkReset = null;

        const mWk = gemBlock.match(/(?:Weekly\s+Limit\s+Remaining|Weekly)[\s\S]{0,240}?(\d{1,3})\s*%/i);
        if (mWk) {
          const val = parseInt(mWk[1], 10);
          if (!Number.isNaN(val) && val <= 100) {
            gWk = val;
            gWkReset = parseResetDurationSec(mWk[0]);
          }
        }

        const m5h = gemBlock.match(/(?:Five\s+Hour\s+Limit\s+Remaining|5-hour\s+limit|5h|hourly|session)[\s\S]{0,240}?(\d{1,3})\s*%/i);
        if (m5h) {
          const val = parseInt(m5h[1], 10);
          if (!Number.isNaN(val) && val <= 100) {
            g5h = val;
            g5hReset = parseResetDurationSec(m5h[0]);
          }
        }

        // Single-percentage fallback (e.g. "Gemini 83%")
        if (g5h === null && gWk === null) {
          const single = gemBlock.match(/Gemini[^%]{0,80}?(\d{1,3})\s*%/i);
          if (single) {
            const val = parseInt(single[1], 10);
            if (!Number.isNaN(val) && val <= 100) {
              g5h = val;
              g5hReset = parseResetDurationSec(gemBlock.slice(0, 140));
            }
          }
        }

        if (g5h !== null || gWk !== null) {
          const patch = {};
          if (g5h !== null) patch.gemini5h = g5h;
          if (gWk !== null) patch.geminiWeek = gWk;
          if (g5hReset !== null) patch.gemini5hResetAt = g5hReset;
          if (gWkReset !== null) patch.geminiWeekResetAt = gWkReset;

          const key = `${g5h}:${gWk}`;
          if (key !== lastSentGeminiKey) {
            lastSentGeminiKey = key;
            try { localStorage.setItem('__agc_gemini_quota', JSON.stringify({ ...quotaData, ...patch })); } catch {}
            updateQuotaUI(patch);
            command({ type: 'quota-update', quota: patch });
          }
          attachSidebarCard();
          return true;
        }
      }
    } catch {}
    attachSidebarCard();
    return false;
  }

  let silentSyncing = false;
  function silentSyncGeminiQuota() {
    if (destroyed || silentSyncing || active) return;
    // If Settings is already open by the user, just scan directly without touching it
    if (document.querySelector('[role="dialog"][aria-label="Settings"]')) {
      scanQuota();
      return;
    }
    const settingsBtn = findSettingsAnchor() || document.querySelector('[aria-label="Settings"]');
    if (!settingsBtn) return;

    silentSyncing = true;
    const prevFocus = document.activeElement;
    document.querySelector('#agc-stealth-settings-sync')?.remove();
    const stealth = document.createElement('style');
    stealth.id = 'agc-stealth-settings-sync';
    stealth.textContent = `
      [role="dialog"][aria-label="Settings"],
      div:has(> [role="dialog"][aria-label="Settings"]) {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.append(stealth);

    let clickedModels = false;
    let finished = false;
    const finishSync = () => {
      if (finished) return;
      finished = true;
      clearInterval(poller);
      const dlg = document.querySelector('[role="dialog"][aria-label="Settings"]');
      if (dlg) {
        const closeBtn = dlg.querySelector('button[aria-label="Close"], [data-testid*="close"]');
        if (closeBtn) closeBtn.click();
        else {
          dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
        }
      }
      setTimeout(() => {
        stealth.remove();
        if (prevFocus && typeof prevFocus.focus === 'function' && prevFocus.isConnected) {
          try { prevFocus.focus({ preventScroll: true }); } catch {}
        }
        silentSyncing = false;
      }, 60);
    };

    settingsBtn.click();
    const startedAt = Date.now();
    const poller = setInterval(() => {
      if (destroyed) { finishSync(); return; }
      const dlg = document.querySelector('[role="dialog"][aria-label="Settings"]');
      if (dlg && !clickedModels) {
        const modelsNav = dlg.querySelector('[data-testid="settings-nav-item-Models"]')
          || [...dlg.querySelectorAll('[data-testid^="settings-nav-item-"], button, [role="tab"]')]
              .find(b => /^(Models|Model)$/i.test((b.textContent || '').trim()));
        if (modelsNav) {
          clickedModels = true;
          modelsNav.click();
        }
      }
      if (scanQuota() || Date.now() - startedAt > 1600) {
        finishSync();
      }
    }, 80);
  }

  updateQuotaUI();
  updateTelemetryUI();

  // Polling timers: 1s interval for real-time countdown & telemetry, 4s for quota DOM scan
  const liveTicker = setInterval(() => {
    updateQuotaUI();
    updateTelemetryUI();
  }, 1000);
  const quotaScanInterval = setInterval(scanQuota, 4000);
  scanQuota();

  // One-time silent sync on startup if Gemini quota has not been captured yet
  if (quotaData.gemini5h === null && quotaData.geminiWeek === null) {
    setTimeout(() => {
      if (!destroyed && quotaData.gemini5h === null && quotaData.geminiWeek === null) {
        silentSyncGeminiQuota();
      }
    }, 1500);
  }

  // 10. Custom Settings Tab Integration
  function restoreContent() {
    for (const [node, previous] of originalChildren) {
      if (node.isConnected) { node.style.visibility = previous.visibility; node.inert = previous.inert; }
    }
    originalChildren.clear();
    for (const [button, selected] of selectedButtons) {
      if (button.isConnected) button.classList.toggle('bg-sidebar-secondary', selected);
    }
    selectedButtons.clear();
    header?.remove();
    header = null;
  }

  function leave(notify = true) {
    if (!active) return;
    active = false;
    lastBounds = '';
    tab?.classList.remove('bg-sidebar-secondary');
    tab?.removeAttribute('aria-current');
    restoreContent();
    if (notify) command({ type: 'settings-tab-close' });
  }

  function bounds() {
    if (!active || !modal?.isConnected || !pane?.isConnected) return;
    const r = pane.getBoundingClientRect(), m = modal.getBoundingClientRect();
    if (r.width < 240 || r.height < 220) return;
    if (header) {
      header.style.left = `${r.left - m.left + 32}px`;
      header.style.top = `${r.top - m.top + 22}px`;
      header.style.width = `${Math.max(100, r.width - 96)}px`;
    }
    const rect = { x: r.left + 1, y: r.top + 88, width: r.width - 2, height: r.height - 96 };
    const key = JSON.stringify(rect);
    if (key !== lastBounds) {
      lastBounds = key;
      command({ type: 'settings-tab-bounds', bounds: rect });
    }
    return rect;
  }

  function activate() {
    if (active) return;
    active = true;
    for (const child of pane.children) {
      originalChildren.set(child, { visibility: child.style.visibility, inert: child.inert });
      child.style.visibility = 'hidden';
      child.inert = true;
    }
    for (const button of modal.querySelectorAll('[data-testid^="settings-nav-item-"]')) {
      if (button === tab) continue;
      selectedButtons.set(button, button.classList.contains('bg-sidebar-secondary'));
      button.classList.remove('bg-sidebar-secondary');
    }
    tab.classList.add('bg-sidebar-secondary');
    tab.setAttribute('aria-current', 'page');
    header = document.createElement('div');
    header.id = 'agc-custom-settings-heading';
    header.style.cssText = 'position:absolute;pointer-events:none;z-index:20;color:inherit;';
    const title = document.createElement('h2');
    title.textContent = 'Custom';
    title.style.cssText = 'font-size:24px;font-weight:500;line-height:1.3;font-family:inherit;margin:0 0 8px;';
    const description = document.createElement('p');
    description.textContent = 'Chủ đề, hình nền, âm thanh và bảo mật phiên của bạn.';
    description.style.cssText = 'font-size:13px;line-height:1.5;color:var(--muted-foreground,#92929a);margin:0;';
    header.append(title, description);
    modal.append(header);
    const rect = bounds();
    if (rect) command({ type: 'settings-tab-open', bounds: rect });
  }

  function nativeTabClick(event) {
    const button = event.target.closest?.('[data-testid^="settings-nav-item-"]');
    if (button && button !== tab) leave();
  }

  const resizer = new ResizeObserver(() => schedule());

  function detach() {
    leave();
    if (modal) modal.removeEventListener('click', nativeTabClick, true);
    resizer.disconnect();
    wrapper?.remove();
    wrapper = null;
    tab = null;
    modal = null;
    pane = null;
  }

  function scan() {
    scheduled = false;
    if (destroyed) return;
    attachSidebarCard();
    if (modal && !modal.isConnected) detach();
    const sidebar = document.querySelector('[role="dialog"][aria-label="Settings"] [data-testid="settings-sidebar"]');
    if (!sidebar) return;
    scanQuota();
    const found = sidebar.closest('[role="dialog"]');
    if (modal && found !== modal) detach();
    if (!tab?.isConnected) {
      const general = sidebar.querySelector('[data-testid="settings-nav-item-General"]'), split = sidebar.closest('[data-split-root]');
      const content = split && [...split.children].find(child => !child.contains(sidebar));
      if (!general || !content) return;
      modal = found;
      pane = content;
      wrapper = document.createElement('div');
      wrapper.className = general.parentElement.className;
      wrapper.dataset.agcOwned = 'settings-tab';
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = general.className;
      tab.classList.remove('bg-sidebar-secondary');
      tab.dataset.testid = 'settings-nav-item-Custom';
      tab.setAttribute('aria-label', 'Custom');
      const label = document.createElement('span');
      label.className = general.firstElementChild?.className || '';
      label.textContent = 'Custom';
      tab.append(label);
      tab.addEventListener('click', activate);
      wrapper.append(tab);
      general.parentElement.parentElement.append(wrapper);
      modal.addEventListener('click', nativeTabClick, true);
      resizer.observe(pane);
      resizer.observe(modal);
    }
    if (active) bounds();
  }

  function schedule() {
    if (!scheduled && !destroyed) {
      scheduled = true;
      requestAnimationFrame(() => {
        scan();
      });
    }
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);

  window.__agcLeaveCustom = () => {
    const general = modal?.querySelector('[data-testid="settings-nav-item-General"]');
    leave();
    general?.click();
  };

  const cleanup = () => {
    destroyed = true;
    document.querySelector('#agc-stealth-settings-sync')?.remove();
    clearInterval(quotaScanInterval);
    clearInterval(liveTicker);
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    detach();
    wallpaper.remove();
    themeStyle.remove();
    card.remove();
    delete window.__agcSettingsBridge;
    delete window.__agcLeaveCustom;
    delete window.__agcCleanup;
  };

  window.__agcSettingsBridge = {
    update(next) {
      current = next;
      updateWallpaper();
      updateTheme();
      if (next.quota) updateQuotaUI(next.quota);
      schedule();
    },
    cleanup
  };
  window.__agcCleanup = cleanup;

  updateWallpaper();
  updateTheme();
  scan();
  return { installed: true, version: 4 };
}
