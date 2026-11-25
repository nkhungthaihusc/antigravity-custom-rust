function installAntigravityCustom(data) {
  if (location.origin !== data.origin) return { installed: false };
  if (window.__agcSettingsBridge) { window.__agcSettingsBridge.update(data); return { installed: true, version: 3 }; }
  // Remove legacy floating controls when upgrading.
  window.__agcCleanup?.();
  document.querySelector('#antigravity-custom-companion')?.remove();
  document.querySelector('#agc-quota-hud')?.remove();
  document.querySelector('#agc-custom-theme-overrides')?.remove();

  let current = data, active = false, modal, pane, wrapper, tab, header, lastBounds = '', scheduled = false, destroyed = false;
  const originalChildren = new Map(), selectedButtons = new Map();
  const command = value => { if (typeof window.__agcCommand === 'function') window.__agcCommand(JSON.stringify(value)); };

  // 1. Wallpaper Layer
  const wallpaper = document.createElement('div');
  wallpaper.id = 'antigravity-custom-wallpaper';
  wallpaper.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000;mix-blend-mode:screen;transition:opacity 0.6s ease;';
  const wallpaperArt = document.createElement('div');
  wallpaperArt.style.cssText = 'height:100%;width:100%;background-size:cover;background-position:center;';
  wallpaper.append(wallpaperArt);
  document.documentElement.append(wallpaper);

  function updateWallpaper() {
    const w = current.wallpaper || {}, p = current.preset || {};
    wallpaper.hidden = !w.enabled;
    const opacity = typeof w.opacity === 'number' ? w.opacity : 25;
    wallpaper.style.opacity = String(opacity / 100);
    wallpaperArt.style.filter = `blur(${w.blur || 0}px)`;
    wallpaperArt.style.backgroundImage = `radial-gradient(ellipse at 70% 42%,${p.accent || '#5ddddd'}33,transparent 65%)`;
    if (/^data:image\/(png|jpeg|webp|gif);base64,/.test(current.wallpaperData || '')) {
      wallpaperArt.style.backgroundImage = `url("${current.wallpaperData}")`;
    }
  }

  // 2. In-App Theme Styling Overrides
  const themeStyle = document.createElement('style');
  themeStyle.id = 'agc-custom-theme-overrides';
  document.head.append(themeStyle);

  function updateTheme() {
    const p = current.preset || {};
    const accent = p.accent || '#5ddddd';
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
    if(p.family==='sao')themeStyle.textContent+=`
      #agc-quota-hud #agc-quota-pill { border-color:${accent}88; border-radius:2px; box-shadow:none; }
      #agc-quota-hud .agc-dot { background:${accent}!important;box-shadow:none!important; }
      #agc-quota-hud :is(.agc-hd-title,.agc-hd-badge,.agc-btn-link,.agc-pill-item i) { color:${accent}!important; }
      #agc-quota-hud .agc-fill:not(.agc-fill-low) { background:${accent}!important; }
    `;
  }

  // 3. Live Quota Telemetry HUD
  const hud = document.createElement('div');
  hud.id = 'agc-quota-hud';
  hud.style.cssText = 'position:fixed;top:6px;right:235px;z-index:2147483600;font-family:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,sans-serif;font-size:11px;user-select:none;line-height:1;transition:right 0.2s ease;';

  hud.innerHTML = `
    <style>
      #agc-quota-hud .agc-pill {
        height: 24px;
        box-sizing: border-box;
        background: rgba(9, 15, 23, 0.88);
        border: 1px solid rgba(34, 211, 238, 0.35);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border-radius: 999px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        gap: 7px;
        color: #d8e5e8;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 2px 10px rgba(0,0,0,0.4), 0 0 10px rgba(34, 211, 238, 0.12);
      }
      #agc-quota-hud .agc-pill:hover {
        border-color: rgba(34, 211, 238, 0.75);
        color: #ffffff;
        background: rgba(12, 20, 32, 0.95);
        box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 14px rgba(34, 211, 238, 0.28);
      }
      #agc-quota-hud .agc-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22d3ee;
        box-shadow: 0 0 7px #22d3ee;
        animation: agcPulse 1.4s infinite alternate ease-in-out;
      }
      #agc-quota-hud .agc-pill-item { display: inline-flex; align-items: center; gap: 3px; font-weight: 500; }
      #agc-quota-hud .agc-pill-item b { font-family: Consolas, monospace; font-size: 11px; color: #edf5f5; }
      #agc-quota-hud .agc-pill-item b.agc-low { color: #f87171 !important; text-shadow: 0 0 8px rgba(248, 113, 113, 0.6); }
      #agc-quota-hud .agc-tag { font-size: 8.5px; opacity: 0.55; margin-right: 2px; text-transform: uppercase; font-weight: 400; }
      #agc-quota-hud .agc-sep { width: 1px; height: 11px; background: rgba(255,255,255,0.18); }
      #agc-quota-hud .agc-arrow { font-size: 8px; opacity: 0.65; margin-left: 1px; }
      @keyframes agcPulse { 0% { opacity: 0.4; transform: scale(0.85); } 100% { opacity: 1; transform: scale(1.15); } }
      #agc-quota-hud .agc-dropdown {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 320px;
        background: rgba(9, 15, 22, 0.96);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(34, 211, 238, 0.4);
        border-radius: 8px;
        padding: 14px 16px;
        box-shadow: 0 14px 40px rgba(0,0,0,0.85), 0 0 24px rgba(34, 211, 238, 0.15);
        display: none;
        flex-direction: column;
        gap: 12px;
        color: #edf3f2;
      }
      #agc-quota-hud .agc-dropdown.open {
        display: flex;
        animation: agcPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes agcPop { 0% { opacity: 0; transform: translateY(-6px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
      .agc-hd-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .agc-hd-title { font-weight: 700; font-size: 10px; letter-spacing: 1.5px; color: #22d3ee; }
      .agc-hd-badge { font-size: 8px; font-weight: 700; color: #22d3ee; background: rgba(34,211,238,0.14); border: 1px solid rgba(34,211,238,0.3); padding: 2px 5px; border-radius: 3px; letter-spacing: 0.5px; }
      .agc-card {
        background: rgba(16, 26, 36, 0.7);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 6px;
        padding: 10px 12px;
      }
      .agc-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .agc-row-name { font-size: 11px; font-weight: 600; color: #f0f6f6; display: flex; align-items: center; gap: 5px; }
      .agc-metric { margin-bottom: 7px; }
      .agc-metric:last-child { margin-bottom: 0; }
      .agc-metric-row { display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-bottom: 3px; }
      .agc-metric-row b { color: #e2e8f0; font-family: Consolas, monospace; font-size: 10.5px; }
      .agc-track { width: 100%; height: 5px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }
      .agc-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
      .agc-fill-gemini { background: linear-gradient(90deg, #0284c7, #22d3ee); }
      .agc-fill-claude { background: linear-gradient(90deg, #059669, #34d399); }
      .agc-fill-week { background: linear-gradient(90deg, #6366f1, #38bdf8); }
      .agc-fill-low { background: linear-gradient(90deg, #ef4444, #f59e0b) !important; box-shadow: 0 0 8px rgba(239,68,68,0.6); }
      .agc-hd-foot {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-top: 6px;
        border-top: 1px solid rgba(255,255,255,0.06);
        font-size: 9.5px;
        color: #718096;
      }
      .agc-btn-link {
        background: transparent;
        border: none;
        color: #22d3ee;
        cursor: pointer;
        font-size: 10px;
        font-weight: 600;
        padding: 0;
        text-decoration: underline;
      }
      .agc-btn-link:hover { color: #67e8f9; }
    </style>
    <div class="agc-pill" id="agc-quota-pill" title="Quota: Gemini & ChatGPT (5h & Tuần)">
      <span class="agc-dot"></span>
      <span class="agc-pill-item"><i style="color:#22d3ee;font-style:normal">✦</i> Gemini <b id="agc-pill-gemini">99%</b><span class="agc-tag">5h</span> <b id="agc-pill-gemini-week">100%</b><span class="agc-tag">T</span></span>
      <span class="agc-sep"></span>
      <span class="agc-pill-item"><i style="color:#38bdf8;font-style:normal">◈</i> ChatGPT <b id="agc-pill-codex">100%</b><span class="agc-tag">5h</span> <b id="agc-pill-codex-week">4%</b><span class="agc-tag">T</span></span>
      <span class="agc-arrow">▾</span>
    </div>
    <div class="agc-dropdown" id="agc-quota-dropdown">
      <div class="agc-hd-head">
        <span class="agc-hd-title">AI ENGINE QUOTA TELEMETRY</span>
        <span class="agc-hd-badge">LIVE SYNC</span>
      </div>
      <div class="agc-card">
        <div class="agc-row">
          <span class="agc-row-name"><i style="color:#22d3ee;font-style:normal">✦</i> ANTIGRAVITY (GEMINI)</span>
        </div>
        <div class="agc-metric">
          <div class="agc-metric-row"><span>Hạn mức 5h</span><b id="agc-dd-gemini-5h">99%</b></div>
          <div class="agc-track"><div class="agc-fill agc-fill-gemini" id="agc-dd-gemini-5h-bar" style="width:99%"></div></div>
        </div>
        <div class="agc-metric">
          <div class="agc-metric-row"><span>Hạn mức tuần</span><b id="agc-dd-gemini-week">100%</b></div>
          <div class="agc-track"><div class="agc-fill agc-fill-week" id="agc-dd-gemini-week-bar" style="width:100%"></div></div>
        </div>
      </div>
      <div class="agc-card">
        <div class="agc-row">
          <span class="agc-row-name"><i style="color:#38bdf8;font-style:normal">◈</i> CODEX (CHATGPT)</span>
        </div>
        <div class="agc-metric">
          <div class="agc-metric-row"><span>Hạn mức 5h</span><b id="agc-dd-codex-5h">100%</b></div>
          <div class="agc-track"><div class="agc-fill agc-fill-claude" id="agc-dd-codex-5h-bar" style="width:100%"></div></div>
        </div>
        <div class="agc-metric">
          <div class="agc-metric-row"><span>Hạn mức tuần</span><b id="agc-dd-codex-week">4%</b></div>
          <div class="agc-track"><div class="agc-fill agc-fill-low" id="agc-dd-codex-week-bar" style="width:4%"></div></div>
        </div>
      </div>
      <div class="agc-hd-foot">
        <span>Chu kỳ 5h rolling & Tuần · Live</span>
        <button class="agc-btn-link" type="button" id="agc-btn-open-settings">Tùy biến Custom →</button>
      </div>
    </div>
  `;
  document.documentElement.append(hud);

  function updateHudPosition() {
    const candidates = [
      document.querySelector('[aria-label*="More Actions"]'),
      document.querySelector('[aria-label*="thêm"]'),
      document.querySelector('.codicon-more'),
      document.querySelector('.codicon-ellipsis'),
      document.querySelector('[aria-label*="Customize Layout"]'),
      document.querySelector('[aria-label*="Bố cục"]'),
      document.querySelector('.titlebar-right')
    ];
    const anchor = candidates.find(el => el && el.getBoundingClientRect().width > 0);
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      if (r.left > 120) {
        hud.style.right = `${Math.round(window.innerWidth - r.left + 12)}px`;
        return;
      }
    }
    hud.style.right = '235px';
  }

  const pill = hud.querySelector('#agc-quota-pill');
  const dropdown = hud.querySelector('#agc-quota-dropdown');
  pill?.addEventListener('click', e => {
    e.stopPropagation();
    dropdown?.classList.toggle('open');
  });

  document.addEventListener('click', e => {
    if (!hud.contains(e.target)) dropdown?.classList.remove('open');
  });

  hud.querySelector('#agc-btn-open-settings')?.addEventListener('click', () => {
    dropdown?.classList.remove('open');
    if (tab?.isConnected) activate();
    else {
      const btn = document.querySelector('[aria-label="Settings"]') || document.querySelector('[data-testid="settings-button"]');
      btn?.click();
      setTimeout(() => { if (tab?.isConnected) activate(); }, 250);
    }
  });

  let quotaData = {
    gemini5h: 99,
    geminiWeek: 100,
    codex5h: 100,
    codexWeek: 4,
    ...(current.quota || {})
  };

  function updateQuotaUI(nextData) {
    quotaData = { ...quotaData, ...(nextData || {}) };
    const setMetric = (valId, barId, val) => {
      const num = typeof val === 'number' ? Math.max(0, Math.min(100, Math.round(val))) : 100;
      const vEl = hud.querySelector(valId), bEl = hud.querySelector(barId);
      if (vEl) vEl.textContent = `${num}%`;
      if (bEl) { bEl.style.width = `${num}%`; bEl.classList.toggle('agc-fill-low', num <= 20); }
    };
    const pGem = hud.querySelector('#agc-pill-gemini'), pGemWk = hud.querySelector('#agc-pill-gemini-week');
    const pCodex = hud.querySelector('#agc-pill-codex'), pCodexWk = hud.querySelector('#agc-pill-codex-week');
    if (pGem) { pGem.textContent = `${quotaData.gemini5h}%`; pGem.classList.toggle('agc-low', quotaData.gemini5h <= 20); }
    if (pGemWk) { pGemWk.textContent = `${quotaData.geminiWeek}%`; pGemWk.classList.toggle('agc-low', quotaData.geminiWeek <= 20); }
    if (pCodex) { pCodex.textContent = `${quotaData.codex5h}%`; pCodex.classList.toggle('agc-low', quotaData.codex5h <= 20); }
    if (pCodexWk) { pCodexWk.textContent = `${quotaData.codexWeek}%`; pCodexWk.classList.toggle('agc-low', quotaData.codexWeek <= 20); }

    setMetric('#agc-dd-gemini-5h', '#agc-dd-gemini-5h-bar', quotaData.gemini5h);
    setMetric('#agc-dd-gemini-week', '#agc-dd-gemini-week-bar', quotaData.geminiWeek);
    setMetric('#agc-dd-codex-5h', '#agc-dd-codex-5h-bar', quotaData.codex5h);
    setMetric('#agc-dd-codex-week', '#agc-dd-codex-week-bar', quotaData.codexWeek);
    updateHudPosition();
  }

  let lastSentGemini = null;
  function scanQuota() {
    try {
      const text = document.body?.innerText || '';
      const gemMatch = text.match(/Gemini\s*(\d+)%/i);
      if (gemMatch) {
        const gVal = parseInt(gemMatch[1], 10);
        if (!Number.isNaN(gVal) && gVal !== lastSentGemini) {
          lastSentGemini = gVal;
          updateQuotaUI({ gemini5h: gVal });
          command({ type: 'quota-update', quota: { gemini5h: gVal } });
        }
      }
    } catch {}
  }

  updateQuotaUI();
  const quotaScanInterval = setInterval(scanQuota, 4000);
  scanQuota();

  // 4. Custom Settings Tab Integration
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
    if (modal && !modal.isConnected) detach();
    const sidebar = document.querySelector('[role="dialog"][aria-label="Settings"] [data-testid="settings-sidebar"]');
    if (!sidebar) return;
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
        updateHudPosition();
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
    clearInterval(quotaScanInterval);
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    detach();
    wallpaper.remove();
    themeStyle.remove();
    hud.remove();
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
  return { installed: true, version: 3 };
}
