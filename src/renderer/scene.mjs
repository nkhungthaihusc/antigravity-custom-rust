export function drawScene(canvas, preset, time = 0, motion = false) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
  }
  const c = canvas.getContext('2d');
  c.setTransform(ratio, 0, 0, ratio, 0, 0);
  c.clearRect(0, 0, w, h);

  const t = motion ? time / 1000 : 0;
  const accent = preset.accent || '#22d3ee';
  if (preset.family === 'sao') {
    drawSao(c,w,h,accent,t);
    return;
  }
  c.strokeStyle = accent;
  c.fillStyle = accent;

  // Modern White Gundam / Neural Plavsky particle effect
  const count = 32;
  for (let i = 0; i < count; i++) {
    const seedX = ((i * 997 + 61) % 1000) / 1000;
    const seedY = ((i * 317 + 83) % 1000) / 1000;
    const x = (seedX * w + Math.sin(t * 0.8 + i) * 12 + w) % w;
    const y = (seedY * h - t * (12 + (i % 8) * 4) + h * 100) % h;
    const size = (i % 3 === 0) ? 2.5 : 1.5;
    const alpha = 0.15 + 0.35 * Math.sin(t * 1.5 + i * 0.7);

    c.save();
    c.globalAlpha = Math.max(0.08, alpha);
    c.shadowColor = accent;
    c.shadowBlur = 6;
    c.beginPath();
    c.arc(x, y, size, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Futuristic HUD corner brackets
  c.save();
  c.globalAlpha = 0.45;
  c.lineWidth = 1.2;
  const bSize = Math.min(w, h) * 0.12;
  const pad = 12;

  // Top-left bracket
  c.beginPath();
  c.moveTo(pad, pad + bSize);
  c.lineTo(pad, pad);
  c.lineTo(pad + bSize, pad);
  c.stroke();

  // Top-right bracket
  c.beginPath();
  c.moveTo(w - pad - bSize, pad);
  c.lineTo(w - pad, pad);
  c.lineTo(w - pad, pad + bSize);
  c.stroke();

  // Bottom-left bracket
  c.beginPath();
  c.moveTo(pad, h - pad - bSize);
  c.lineTo(pad, h - pad);
  c.lineTo(pad + bSize, h - pad);
  c.stroke();

  // Bottom-right bracket
  c.beginPath();
  c.moveTo(w - pad - bSize, h - pad);
  c.lineTo(w - pad, h - pad);
  c.lineTo(w - pad, h - pad - bSize);
  c.stroke();

  // Central subtle scanning pulse
  if (motion) {
    const scanY = ((t * 40) % (h + 40)) - 20;
    if (scanY >= 0 && scanY <= h) {
      const grad = c.createLinearGradient(0, scanY - 15, 0, scanY + 15);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.5, accent + '22');
      grad.addColorStop(1, 'transparent');
      c.fillStyle = grad;
      c.fillRect(0, scanY - 15, w, 30);
    }
  }

  c.restore();
}

function drawSao(c,w,h,accent,t) {
  c.save();c.strokeStyle=accent;c.fillStyle=accent;c.lineWidth=1;
  // Triangular fragments reference the virtual world's polygon dissolution.
  for(let i=0;i<18;i++){
    const x=((i*137+23)%997)/997*w;
    const y=(((i*71)%251)/251*h-t*(5+i%4)+h*100)%h;
    const size=3+i%4;c.globalAlpha=.12+(i%3)*.07;
    c.beginPath();c.moveTo(x,y-size);c.lineTo(x+size,y+size);c.lineTo(x-size,y+size);c.closePath();c.stroke();
  }
  const x=w*.78,y=h*.43,r=Math.min(w,h)*.21;
  c.translate(x,y);c.rotate(t*.08);c.globalAlpha=.4;
  for(let i=0;i<4;i++){c.beginPath();c.arc(0,0,r,i*Math.PI/2+.1,i*Math.PI/2+1.15);c.stroke();}
  c.rotate(Math.PI/4);c.strokeRect(-r*.57,-r*.57,r*1.14,r*1.14);
  c.restore();
}

export function animateScene(canvas, getPreset, getMotion) {
  let frame, last = 0, disposed = false, lastKey = '';
  function tick(now) {
    if (disposed) return;
    if (now - last >= 33 && canvas.getClientRects().length > 0) {
      const preset = getPreset(), motion = getMotion();
      const rect = canvas.getBoundingClientRect();
      const key = JSON.stringify([preset?.family,preset?.accent, motion, rect.width, rect.height, devicePixelRatio]);
      if (motion || key !== lastKey) {
        drawScene(canvas, preset || {}, now, motion);
        lastKey = key;
      }
      last = now;
    }
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
  };
}
