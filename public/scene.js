// Sân vận động: sân cỏ, sân khấu kiểu cũ (giàn đèn, loa, màn LED + video), 3 khán đài, 6 chủ đề
const Scene = (() => {
  const TAU = Math.PI * 2;
  const W = SHARED.WORLD.w, H = SHARED.WORLD.h, CX = W / 2;
  const WALL = SHARED.WALL;     // màn LED lớn (hình theo chủ đề)
  const SCR = SHARED.SCREEN;    // khung video YouTube nằm giữa màn LED
  const FY = SHARED.FENCE_Y;    // hàng rào trước sân khấu
  const ST = { backY: 410, frontY: 545, bx1: 330, bx2: 1590, fx1: 210, fx2: 1710 }; // sân khấu hình thang
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const frac = (v) => v - Math.floor(v);

  const FX = {
    neon: { beams: 9, width: 0.09, speed: 0.9, swing: 0.6, alpha: 0.26, laser: false, strobe: 0 },
    rock: { beams: 9, width: 0.07, speed: 2.2, swing: 0.4, alpha: 0.3, laser: false, strobe: 0.1 },
    edm: { beams: 10, width: 0.012, speed: 1.4, swing: 0.95, alpha: 0.75, laser: true, strobe: 0.09 },
    sakura: { beams: 7, width: 0.12, speed: 0.5, swing: 0.4, alpha: 0.2, laser: false, strobe: 0 },
    ballad: { beams: 5, width: 0.14, speed: 0.3, swing: 0.3, alpha: 0.17, laser: false, strobe: 0 },
    disco: { beams: 9, width: 0.05, speed: 1.1, swing: 0.7, alpha: 0.3, laser: false, strobe: 0.04 },
  };
  const STAGE_COL = { neon: '#26104d', rock: '#2b0f0a', edm: '#0e1330', sakura: '#3a1d33', ballad: '#10183a', disco: '#2a1a35' };

  let parts = [], lastBeat = -1, flash = 0, performers = [], perfIdx = -1;
  const stars = [...Array(90)].map(() => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6, s: Math.random() * 1.6 + 0.5 }));

  /* ---------- Biểu diễn viên ---------- */
  function buildPerformers(idx) {
    const th = SHARED.THEMES[idx];
    const topBy = { neon: 'top_sequin', rock: 'top_jacket', edm: 'top_hoodie', sakura: 'top_idol', ballad: 'top_idol', disco: 'top_sequin' };
    const hatBy = { neon: null, rock: 'hat_headband', edm: 'hat_cat', sakura: 'hat_bunny', ballad: 'hat_halo', disco: null };
    performers = [-260, -130, 0, 130, 260].map((dx, i) => {
      const look = SHARED.sanitizeLook({
        skin: (idx + i * 2) % 6, hairStyle: (i + idx) % 6, hairColor: (i * 3 + idx * 2) % 10, eyes: (i + idx) % 4,
        shirt: (i * 2 + idx) % 10, top: topBy[th.id], hat: i === 2 ? 'hat_crown' : hatBy[th.id], stick: 'stick_star', face: i === 1 ? 'face_star' : null,
      }, null);
      return { x: CX + dx, y: i === 2 ? 530 : 505 + (i % 2) * 9, look, scale: i === 2 ? 1.5 : 1.3, mic: i === 2 };
    });
    perfIdx = idx;
  }
  const SEQ = { neon: [1, 2, 3, 2], rock: [5, 1, 5, 3], edm: [1, 5, 1, 2], sakura: [3, 2, 4, 2], ballad: [3, 2, 3, 4], disco: [1, 3, 2, 1] };

  /* ---------- Hạt ---------- */
  function spawn(p) { if (parts.length < 360) parts.push(Object.assign({ life: 0, max: 3, vx: 0, vy: 0, rot: 0, vr: 0, size: 4, g: 0 }, p)); }
  function burst(th) {
    for (let i = 0; i < 160; i++) spawn({ type: 'confetti', x: CX + rand(-260, 260), y: 400, vx: rand(-460, 460), vy: rand(-680, -160), g: 540, max: rand(2.5, 4.5), color: th.palette[i % 4], size: rand(4, 8), rot: rand(0, TAU), vr: rand(-9, 9) });
    flash = 1;
  }
  function pyro() {
    for (const dx of [-520, -330, 330, 520]) for (let i = 0; i < 26; i++) spawn({ type: 'spark', x: CX + dx + rand(-8, 8), y: ST.frontY - 4, vx: rand(-40, 40), vy: rand(-640, -300), g: 360, max: rand(0.6, 1.3), color: i % 2 ? '#ffb400' : '#ff4a00', size: rand(3, 7) });
  }

  function update(dt, st) {
    const th = st.theme, r = (n) => Math.random() < n * dt;
    if (th.id === 'neon' && r(7)) spawn({ type: 'bubble', x: rand(0, W), y: H + 10, vy: rand(-70, -35), max: rand(8, 14), color: th.palette[(Math.random() * 3) | 0], size: rand(5, 14), phase: rand(0, 6) });
    if (th.id === 'edm' && r(12)) spawn({ type: 'confetti', x: rand(0, W), y: -10, vy: rand(60, 120), vx: rand(-30, 30), max: 12, color: th.palette[(Math.random() * 4) | 0], size: rand(3, 6), rot: rand(0, TAU), vr: rand(-6, 6) });
    if (th.id === 'rock' && r(30)) spawn({ type: 'spark', x: rand(300, W - 300), y: ST.frontY, vx: rand(-30, 30), vy: rand(-170, -80), g: -20, max: rand(1.5, 3), color: Math.random() < 0.5 ? '#ff9d2e' : '#ff4a00', size: rand(1.5, 3.5) });
    if (th.id === 'sakura' && r(16)) spawn({ type: 'petal', x: rand(-50, W + 50), y: -20, vy: rand(40, 85), vx: rand(10, 50), max: 20, color: Math.random() < 0.5 ? '#ffb3cf' : '#ffd6e6', size: rand(5, 9), phase: rand(0, 6), rot: rand(0, TAU), vr: rand(-2, 2) });
    if (th.id === 'ballad' && r(12)) spawn({ type: 'twinkle', x: rand(0, W), y: rand(0, H - 20), max: rand(2, 4), color: Math.random() < 0.5 ? '#ffe9a8' : '#bcd4ff', size: rand(2, 5) });
    if (th.id === 'disco' && r(26)) spawn({ type: 'twinkle', x: rand(0, W), y: rand(0, H - 20), max: rand(0.3, 0.7), color: '#ffffff', size: rand(3, 8) });
    const bi = Math.floor(st.beat);
    if (bi !== lastBeat) {
      lastBeat = bi;
      if (th.id === 'rock' && bi % 8 === 0 && bi > 0) pyro();
      if ((th.id === 'neon' || th.id === 'edm') && bi % 16 === 0 && bi > 0) for (let i = 0; i < 40; i++) spawn({ type: 'confetti', x: CX + rand(-360, 360), y: 480, vx: rand(-250, 250), vy: rand(-440, -120), g: 450, max: rand(2, 3.5), color: th.palette[i % 4], size: rand(3, 6), rot: rand(0, TAU), vr: rand(-8, 8) });
    }
    flash = Math.max(0, flash - dt * 0.8);
    for (const p of parts) {
      p.life += dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.type === 'petal' || p.type === 'bubble') p.x += Math.sin(st.time * 1.5 + p.phase) * 25 * dt;
    }
    parts = parts.filter((p) => p.life < p.max && p.y < H + 60 && p.y > -80);
  }
  function setTheme(idx, withBurst) {
    perfIdx = -1; parts = parts.filter((p) => p.type === 'confetti' && p.life < 1);
    if (withBurst) burst(SHARED.THEMES[idx]);
  }

  /* ---------- Hình trên màn LED lớn ---------- */
  const WALLFX = {
    neon(c, st) {
      const { x, y, w, h } = WALL, t = st.time, cx = x + w / 2;
      let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#12003a'); g.addColorStop(0.62, '#7a1d8f'); g.addColorStop(1, '#ff2e93');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      const horizon = y + h * 0.68, r = 78 + st.bass * 5, sp = (2 * r) / 9;
      c.save(); c.beginPath();
      for (let k = 0; k < 9; k++) c.rect(cx - r - 2, horizon - 2 * r + k * sp, r * 2 + 4, 3 + k * sp * 0.08);
      c.clip();
      g = c.createLinearGradient(0, horizon - r * 2, 0, horizon); g.addColorStop(0, '#ffe600'); g.addColorStop(1, '#ff2e93');
      c.fillStyle = g; c.beginPath(); c.arc(cx, horizon - r + 8, r, 0, TAU); c.fill(); c.restore();
      c.fillStyle = '#12002a'; c.fillRect(x, horizon, w, y + h - horizon);
      c.strokeStyle = rgba('#00e5ff', 0.8); c.lineWidth = 1.5;
      for (let i = -16; i <= 16; i++) { c.beginPath(); c.moveTo(cx + i * 8, horizon); c.lineTo(cx + i * 62, y + h); c.stroke(); }
      for (let k = 0; k < 7; k++) { const p = frac(t * 0.6 + k / 7); const yy = horizon + p * p * (y + h - horizon); c.globalAlpha = 0.3 + p * 0.7; c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
      c.globalAlpha = 1;
    },
    rock(c, st) {
      const { x, y, w, h } = WALL, t = st.time;
      let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#120000'); g.addColorStop(1, '#6b1200');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(x + w / 2, y + h * 0.42, 80 + st.bass * 8, 0, TAU); c.fill();
      g = c.createLinearGradient(0, y + h - 190, 0, y + h); g.addColorStop(0, 'rgba(255,230,0,0)'); g.addColorStop(0.4, '#ffb400'); g.addColorStop(1, '#ff2200');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, y + h);
      for (let i = 0; i <= w / 12; i++) {
        const fx = x + i * 12, hh = 50 + 40 * Math.sin(t * 5 + i * 0.6) + 26 * Math.sin(t * 9 + i * 1.3) + 70 * st.bass;
        c.lineTo(fx + 6, y + h - hh); c.lineTo(fx + 12, y + h);
      }
      c.closePath(); c.fill();
      if (st.beat % 8 < 0.15) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x, y, w, h); }
    },
    edm(c, st) {
      const { x, y, w, h } = WALL, t = st.time, th = st.theme, cx = x + w / 2, cy = y + h / 2;
      c.fillStyle = '#05010f'; c.fillRect(x, y, w, h);
      for (let k = 0; k < 6; k++) {
        const rr = ((t * 0.5 + k / 6) % 1) * 240;
        c.strokeStyle = rgba(th.palette[k % 4], 1 - rr / 240); c.lineWidth = 3;
        c.beginPath(); c.ellipse(cx, cy, rr * 1.8, rr * 0.9, 0, 0, TAU); c.stroke();
      }
      const n = 56, bw = w / n;
      for (let i = 0; i < n; i++) {
        const a = Math.abs(Math.sin(t * 3 + i * 0.45)) * (0.35 + 0.65 * st.bass) * 0.7 + Math.abs(Math.sin(t * 1.3 + i * 0.2)) * 0.3;
        const bh = 14 + a * (h * 0.7);
        c.fillStyle = th.palette[Math.floor((i / n) * 3.99)]; c.fillRect(x + i * bw + 1, y + h - bh, bw - 2, bh);
      }
    },
    sakura(c, st) {
      const { x, y, w, h } = WALL, t = st.time, cx = x + w / 2;
      let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#ffd9e8'); g.addColorStop(1, '#ff8fb8');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      c.save(); c.globalAlpha = 0.5 + st.bass * 0.15; g = c.createRadialGradient(cx, y + h * 0.45, 10, cx, y + h * 0.45, 160); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(cx - 170, y, 340, h); c.restore();
      c.fillStyle = '#fff7fb'; c.beginPath(); c.arc(cx, y + h * 0.45, 80, 0, TAU); c.fill();
      c.strokeStyle = '#6b2f45'; c.lineCap = 'round';
      const branch = (sx, dir) => {
        c.lineWidth = 8; c.beginPath(); c.moveTo(sx, y + h); c.bezierCurveTo(sx + dir * 60, y + h * 0.65, sx + dir * 20, y + h * 0.4, sx + dir * 190, y + h * 0.14); c.stroke();
        c.lineWidth = 5; c.beginPath(); c.moveTo(sx + dir * 30, y + h * 0.6); c.quadraticCurveTo(sx + dir * 130, y + h * 0.5, sx + dir * 250, y + h * 0.56); c.stroke();
        for (let i = 0; i < 24; i++) { c.fillStyle = i % 2 ? '#ff9fc4' : '#ffc2d9'; c.beginPath(); c.arc(sx + dir * (10 + i * 11) + Math.sin(i * 3) * 10, y + 30 + ((i * 37) % 170) + Math.sin(t * 1.5 + i) * 2, 7 + (i % 3), 0, TAU); c.fill(); }
      };
      branch(x + 6, 1); branch(x + w - 6, -1);
    },
    ballad(c, st) {
      const { x, y, w, h } = WALL, t = st.time, cx = x + w / 2;
      let g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#040824'); g.addColorStop(1, '#1d3278');
      c.fillStyle = g; c.fillRect(x, y, w, h);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        c.fillStyle = rgba(['#3cffb0', '#5b8cff', '#a07cff'][k], 0.12);
        c.beginPath(); c.moveTo(x, y + h);
        for (let i = 0; i <= 48; i++) c.lineTo(x + (i / 48) * w, y + h * 0.45 + k * 26 + Math.sin(t * 0.6 + i * 0.25 + k * 2) * 34);
        c.lineTo(x + w, y + h); c.closePath(); c.fill();
      }
      c.restore();
      for (const s of stars) { c.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(t * s.s + s.p))})`; c.beginPath(); c.arc(x + s.x * w, y + s.y * h * 0.85, s.s, 0, TAU); c.fill(); }
      c.fillStyle = '#ffe9a8'; c.beginPath(); c.arc(cx + 300, y + h * 0.3, 48, 0, TAU); c.fill();
      c.fillStyle = '#0b1650'; c.beginPath(); c.arc(cx + 318, y + h * 0.3 - 9, 43, 0, TAU); c.fill();
    },
    disco(c, st) {
      const { x, y, w, h } = WALL, t = st.time, cx = x + w / 2, s = 36;
      for (let i = 0; i < w / s; i++) for (let j = 0; j < h / s + 1; j++) {
        const hue = (i * 14 + j * 22 + t * 60) % 360, on = (i + j + Math.floor(t * 2)) % 2;
        c.fillStyle = `hsl(${hue},80%,${on ? 48 + st.bass * 12 : 24}%)`; c.fillRect(x + i * s, y + j * s, s - 1, s - 1);
      }
      const by = y + h * 0.5, R = 66;
      c.strokeStyle = '#aaa'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, y); c.lineTo(cx, by - R); c.stroke();
      const g = c.createRadialGradient(cx - 18, by - 20, 4, cx, by, R); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#b9bfd0'); g.addColorStop(1, '#4b5068');
      c.fillStyle = g; c.beginPath(); c.arc(cx, by, R, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1;
      for (let k = -4; k <= 4; k++) { c.beginPath(); c.ellipse(cx, by, R, Math.abs(k) * 8 + 1, 0, 0, TAU); c.stroke(); c.beginPath(); c.ellipse(cx, by, Math.abs(k) * 8 + 1, R, 0, 0, TAU); c.stroke(); }
      for (let i = 0; i < 6; i++) { const a = t * 2 + i; c.fillStyle = '#fff'; Char.starPath(c, cx + Math.cos(a * 1.3) * 56, by + Math.sin(a) * 50, 7, 1.7, 4); c.fill(); }
    },
  };

  function drawWall(c, st) {
    const { x, y, w, h } = WALL, th = st.theme, t = st.time;
    c.fillStyle = '#07060d'; c.fillRect(x - 14, y - 14, w + 28, h + 28);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    WALLFX[th.id](c, st);
    c.font = 'italic 900 30px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = th.palette[1]; c.shadowBlur = 16; c.fillStyle = '#fff'; c.globalAlpha = 0.92;
    c.fillText(th.name.toUpperCase(), x + w / 2, y + 26); c.shadowBlur = 0; c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.14)'; for (let yy = y; yy < y + h; yy += 4) c.fillRect(x, yy, w, 1.5);
    c.restore();
    // viền đèn LED quanh màn
    const n = Math.floor(w / 26), m = Math.floor(h / 26);
    for (let i = 0; i <= n; i++) {
      c.fillStyle = th.palette[(i + Math.floor(t * 5)) % 4];
      c.beginPath(); c.arc(x + (i / n) * w, y - 7, 2.8, 0, TAU); c.fill(); c.beginPath(); c.arc(x + (i / n) * w, y + h + 7, 2.8, 0, TAU); c.fill();
    }
    for (let j = 1; j < m; j++) {
      c.fillStyle = th.palette[(j + 2 + Math.floor(t * 5)) % 4];
      c.beginPath(); c.arc(x - 7, y + (j / m) * h, 2.8, 0, TAU); c.fill(); c.beginPath(); c.arc(x + w + 7, y + (j / m) * h, 2.8, 0, TAU); c.fill();
    }
    // khung cửa sổ video
    c.strokeStyle = '#05050a'; c.lineWidth = 12; c.strokeRect(SCR.x - 6, SCR.y - 6, SCR.w + 12, SCR.h + 12);
    c.save(); c.shadowColor = th.palette[1]; c.shadowBlur = 18; c.strokeStyle = rgba(th.palette[1], 0.9); c.lineWidth = 3; c.strokeRect(SCR.x - 1, SCR.y - 1, SCR.w + 2, SCR.h + 2); c.restore();
  }

  /* ---------- Giàn đèn + loa ---------- */
  function trussXs(n) { return Array.from({ length: n }, (_, i) => 380 + (W - 760) * (i / (n - 1 || 1))); }
  function drawTruss(c, st) {
    const th = st.theme, fx = FX[th.id], x0 = 300, x1 = W - 300;
    c.strokeStyle = '#555a6e'; c.lineWidth = 3;
    for (const yy of [30, 52]) { c.beginPath(); c.moveTo(x0, yy); c.lineTo(x1, yy); c.stroke(); }
    c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, 30);
    for (let x = x0; x < x1 - 28; x += 28) { c.lineTo(x + 14, 52); c.lineTo(x + 28, 30); } c.stroke();
    c.lineWidth = 4; for (const x of [x0, x1]) { c.beginPath(); c.moveTo(x, 30); c.lineTo(x, ST.backY + 10); c.stroke(); }
    trussXs(fx.beams).forEach((ox, i) => {
      c.fillStyle = '#20222d'; c.fillRect(ox - 9, 52, 18, 12);
      c.fillStyle = th.palette[i % 4]; c.beginPath(); c.arc(ox, 66, 7, 0, TAU); c.fill();
    });
  }
  function drawSpeakers(c, st) {
    const th = st.theme, b = st.bass;
    for (const x0 of [140, W - 140 - 160]) {
      for (let k = 0; k < 5; k++) {
        const y0 = 150 + k * 56;
        Char.rr(c, x0, y0, 160, 54, 5); c.fillStyle = '#15161d'; c.fill();
        c.strokeStyle = '#2b2d3a'; c.lineWidth = 2; c.stroke();
        for (const dx of [42, 118]) {
          const r = 18 * (1 + 0.1 * b);
          c.fillStyle = '#07070a'; c.beginPath(); c.arc(x0 + dx, y0 + 27, r + 2, 0, TAU); c.fill();
          c.fillStyle = '#23242e'; c.beginPath(); c.arc(x0 + dx, y0 + 27, r, 0, TAU); c.fill();
          c.fillStyle = '#3a3c4c'; c.beginPath(); c.arc(x0 + dx, y0 + 27, r * 0.4 * (1 + 0.25 * b), 0, TAU); c.fill();
        }
        c.fillStyle = th.palette[k % 4]; c.globalAlpha = 0.5 + 0.5 * b; c.fillRect(x0 + 74, y0 + 6, 12, 3); c.globalAlpha = 1;
      }
      c.fillStyle = '#0d0e14'; c.fillRect(x0 + 10, 430, 140, 10);
    }
  }

  /* ---------- Sân khấu hình thang ---------- */
  function stagePath(c) { c.beginPath(); c.moveTo(ST.bx1, ST.backY); c.lineTo(ST.bx2, ST.backY); c.lineTo(ST.fx2, ST.frontY); c.lineTo(ST.fx1, ST.frontY); c.closePath(); }
  function drawStage(c, st) {
    const th = st.theme, t = st.time;
    stagePath(c);
    const g = c.createLinearGradient(0, ST.backY, 0, ST.frontY); g.addColorStop(0, STAGE_COL[th.id]); g.addColorStop(1, '#0a0912');
    c.fillStyle = g; c.fill();
    c.save(); stagePath(c); c.clip();
    c.strokeStyle = rgba(th.palette[0], 0.16); c.lineWidth = 1;
    for (let i = 0; i <= 18; i++) { c.beginPath(); c.moveTo(ST.bx1 + (i / 18) * (ST.bx2 - ST.bx1), ST.backY); c.lineTo(ST.fx1 + (i / 18) * (ST.fx2 - ST.fx1), ST.frontY); c.stroke(); }
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.12 + st.bass * 0.18;
    const g2 = c.createRadialGradient(CX, 500, 10, CX, 500, 560); g2.addColorStop(0, th.palette[0]); g2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g2; c.fillRect(ST.fx1, ST.backY, ST.fx2 - ST.fx1, ST.frontY - ST.backY);
    c.restore();
    const n = 48;
    for (let i = 0; i < n; i++) {
      const x = ST.fx1 + 8 + (i / (n - 1)) * (ST.fx2 - ST.fx1 - 16);
      c.fillStyle = th.palette[(i + Math.floor(t * 6)) % 4]; c.globalAlpha = 0.7 + st.bass * 0.3; c.fillRect(x - 10, ST.frontY - 5, 20, 4);
    }
    c.globalAlpha = 1; c.fillStyle = '#05050a'; c.fillRect(ST.fx1, ST.frontY, ST.fx2 - ST.fx1, 11);
  }
  function drawPerformers(c, st) {
    if (perfIdx !== st.themeIdx) buildPerformers(st.themeIdx);
    const seq = SEQ[st.theme.id], bar = Math.floor(st.beat / 8);
    performers.forEach((p, i) => {
      Char.draw(c, p.look, { x: p.x, y: p.y, scale: p.scale, time: st.time + i, beat: st.beat, dance: seq[(bar + (i % 2)) % seq.length], sitting: false, moving: false, accent: st.theme.palette[i % 4], pulse: st.bass, seed: i, mic: p.mic });
    });
  }
  function drawFog(c, st) {
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {
      const x = ((st.time * (10 + i * 3) + i * 260) % (W + 300)) - 150;
      const g = c.createRadialGradient(x, ST.frontY, 10, x, ST.frontY, 190); g.addColorStop(0, rgba(st.theme.palette[i % 4], 0.13)); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(x - 190, ST.frontY - 120, 380, 240);
    }
    c.restore();
  }
  function drawBarrier(c, st) {
    c.fillStyle = '#1b1c26'; c.fillRect(170, FY - 8, W - 340, 8);
    c.fillStyle = st.theme.palette[1]; c.globalAlpha = 0.65; c.fillRect(170, FY - 8, W - 340, 2); c.globalAlpha = 1;
    for (let x = 170; x <= W - 170; x += 100) { c.fillStyle = '#2a2c3a'; c.fillRect(x - 3, FY - 8, 6, 18); }
  }

  /* ---------- Sân cỏ ---------- */
  function drawGrass(c, st) {
    const th = st.theme;
    c.fillStyle = '#16602f'; c.fillRect(0, 0, W, H);
    for (let i = 0; i * 54 < H; i++) { c.fillStyle = i % 2 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.035)'; c.fillRect(0, i * 54, W, 54); }
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 3;
    c.strokeRect(30, 30, W - 60, H - 60);
    c.beginPath(); c.moveTo(560, 700); c.lineTo(W - 560, 700); c.stroke();
    c.beginPath(); c.arc(CX, 700, 96, 0, TAU); c.stroke();
    c.beginPath(); c.arc(CX, 700, 4, 0, TAU); c.fillStyle = 'rgba(255,255,255,.3)'; c.fill();
    c.fillStyle = 'rgba(2,6,16,.42)'; c.fillRect(0, 0, W, H);
    c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.2 + st.bass * 0.13;
    const g = c.createRadialGradient(CX, 560, 20, CX, 560, 900); g.addColorStop(0, th.palette[1]); g.addColorStop(0.5, rgba(th.palette[0], 0.4)); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, FY, W, H - FY); c.restore();
  }

  /* ---------- Khán đài A (chữ nhật), B và C (chữ nhật xoay chéo) ---------- */
  function standPath(c, poly) { c.beginPath(); poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); }
  function standSign(c, text, x, y, st) {
    c.font = '800 16px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(text).width + 26;
    Char.rr(c, x - w / 2, y - 12, w, 24, 8); c.fillStyle = '#10121b'; c.fill(); c.strokeStyle = st.theme.palette[1]; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.fillText(text, x, y + 1);
  }
  function drawStands(c, st) {
    for (const sd of SHARED.STANDS) {
      const ys = sd.poly.map((p) => p[1]);
      standPath(c, sd.poly);
      const g = c.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys)); g.addColorStop(0, '#2c3042'); g.addColorStop(1, '#1b1d29');
      c.fillStyle = g; c.fill();
      c.save(); standPath(c, sd.poly); c.clip();
      c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.1)';
      for (const [p, q] of sd.tiers) { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
      c.restore();
      standPath(c, sd.poly); c.strokeStyle = rgba(st.theme.palette[2], 0.8); c.lineWidth = 3; c.stroke();
    }
  }
  function drawStandSigns(c, st) { for (const sd of SHARED.STANDS) standSign(c, 'KHÁN ĐÀI ' + sd.name, sd.label[0], sd.label[1], st); }

  // Thảm đỏ từ sân khấu xuống cổng + cổng vào
  function drawGate(c, st) {
    const th = st.theme, t = st.time;
    c.fillStyle = '#5a0c26'; c.fillRect(CX - 48, FY + 8, 96, H - FY - 8);
    c.fillStyle = '#d4a63c'; c.fillRect(CX - 50, FY + 8, 3, H - FY - 8); c.fillRect(CX + 47, FY + 8, 3, H - FY - 8);
    for (const x of [CX - 112, CX + 90]) { Char.rr(c, x, 1046, 22, 34, 6); c.fillStyle = '#1d1a2c'; c.fill(); c.strokeStyle = rgba(th.palette[1], 0.8); c.lineWidth = 2; c.stroke(); }
    Char.rr(c, CX - 118, 1018, 236, 28, 10); c.fillStyle = '#15111f'; c.fill(); c.strokeStyle = rgba(th.palette[0], 0.95); c.lineWidth = 2.5; c.stroke();
    c.font = '900 16px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = th.palette[0]; c.shadowBlur = 12; c.fillStyle = '#fff'; c.fillText('★ CỔNG VÀO ★', CX, 1033); c.shadowBlur = 0;
    for (let i = 0; i < 9; i++) { c.fillStyle = th.palette[(i + Math.floor(t * 4)) % 4]; c.beginPath(); c.arc(CX - 100 + i * 25, 1052, 2.6, 0, TAU); c.fill(); }
  }

  /* ---------- Đèn quét từ giàn đèn ---------- */
  function drawLights(c, st) {
    const th = st.theme, fx = FX[th.id], t = st.time;
    c.save(); c.globalCompositeOperation = 'lighter';
    const n = fx.beams, boost = 0.8 + st.bass * 0.5;
    trussXs(n).forEach((ox, i) => {
      const oy = 66, a = Math.sin(t * fx.speed + i * 1.37) * fx.swing + (i - (n - 1) / 2) * 0.05;
      const col = th.palette[i % 4];
      if (fx.laser) {
        const len = 1300, ex = ox + Math.sin(a) * len, ey = oy + Math.cos(a) * len;
        c.strokeStyle = rgba(col, 0.18); c.lineWidth = 9; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ex, ey); c.stroke();
        c.strokeStyle = rgba(col, 0.85); c.lineWidth = 2; c.beginPath(); c.moveTo(ox, oy); c.lineTo(ex, ey); c.stroke();
      } else {
        const len = 820, a1 = a - fx.width, a2 = a + fx.width, mx = ox + Math.sin(a) * len, my = oy + Math.cos(a) * len;
        const g = c.createLinearGradient(ox, oy, mx, my); g.addColorStop(0, rgba(col, fx.alpha * boost)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g; c.beginPath(); c.moveTo(ox, oy);
        c.lineTo(ox + Math.sin(a1) * len * 1.05, oy + Math.cos(a1) * len * 1.05); c.lineTo(ox + Math.sin(a2) * len * 1.05, oy + Math.cos(a2) * len * 1.05); c.closePath(); c.fill();
        const px = ox + Math.sin(a) * 760, py = Math.min(H - 20, oy + Math.cos(a) * 760);
        const gg = c.createRadialGradient(px, py, 2, px, py, 70); gg.addColorStop(0, rgba(col, 0.3 * boost)); gg.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gg; c.fillRect(px - 70, py - 70, 140, 140);
      }
    });
    c.restore();
  }

  function drawFront(c, st) {
    const th = st.theme, fx = FX[th.id];
    for (const p of parts) {
      const k = p.life / p.max;
      c.save(); c.translate(p.x, p.y);
      if (p.type === 'confetti') { c.rotate(p.rot); c.fillStyle = p.color; c.globalAlpha = Math.min(1, (1 - k) * 2); c.scale(1, Math.abs(Math.sin(p.rot * 2)) * 0.8 + 0.2); c.fillRect(-p.size / 2, -p.size, p.size, p.size * 2); }
      else if (p.type === 'spark') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 1 - k; c.fillStyle = p.color; c.beginPath(); c.arc(0, 0, p.size * (1 - k * 0.5), 0, TAU); c.fill(); }
      else if (p.type === 'petal') { c.rotate(p.rot); c.fillStyle = p.color; c.globalAlpha = 0.9; c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); c.fill(); }
      else if (p.type === 'bubble') { c.globalCompositeOperation = 'lighter'; c.strokeStyle = p.color; c.lineWidth = 2; c.globalAlpha = Math.min(0.8, (1 - k) * 1.2); c.beginPath(); c.arc(0, 0, p.size, 0, TAU); c.stroke(); }
      else if (p.type === 'twinkle') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(k * Math.PI); c.fillStyle = p.color; Char.starPath(c, 0, 0, p.size * 1.6, p.size * 0.35, 4); c.fill(); }
      c.restore();
    }
    const bf = Math.exp(-frac(st.beat) * 9);
    if (fx.strobe && bf > 0.02) { c.fillStyle = `rgba(255,255,255,${fx.strobe * bf})`; c.fillRect(0, 0, W, H); }
    if (flash > 0) { c.fillStyle = `rgba(255,255,255,${flash * 0.6})`; c.fillRect(0, 0, W, H); }
    const g = c.createRadialGradient(CX, H / 2, 500, CX, H / 2, 1250); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function drawBack(c, st) {
    drawGrass(c, st);
    drawStands(c, st);
    drawGate(c, st);
    drawStandSigns(c, st);
    drawWall(c, st);
    drawTruss(c, st);
    drawSpeakers(c, st);
    drawStage(c, st);
    drawPerformers(c, st);
    drawFog(c, st);
    drawBarrier(c, st);
  }

  return { update, drawBack, drawLights, drawFront, setTheme, burst };
})();
