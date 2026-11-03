// Vẽ nhân vật chibi bằng Canvas + 5 điệu nhảy theo nhịp
const Char = (() => {
  const TAU = Math.PI * 2;
  const L1 = 13, L2 = 13; // độ dài tay (bắp + cẳng)

  function shade(col, amt) {
    let r, g, b;
    if (col[0] === '#') { const n = parseInt(col.slice(1), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
    else { [r, g, b] = col.match(/\d+/g).map(Number); }
    r = Math.max(0, Math.min(255, r + amt)); g = Math.max(0, Math.min(255, g + amt)); b = Math.max(0, Math.min(255, b + amt));
    return `rgb(${r},${g},${b})`;
  }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function starPath(c, x, y, R, r, n = 5, rot = -Math.PI / 2) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + (i * Math.PI) / n, rad = i % 2 ? r : R;
      c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath();
  }
  function heartPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 0.9);
    c.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.8, y - s * 1.2, x, y - s * 0.4);
    c.bezierCurveTo(x + s * 0.8, y - s * 1.2, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
    c.closePath();
  }
  const dir = (a, s) => [s * Math.sin(a), Math.cos(a)]; // 0 = thẳng xuống, + = giơ ra ngoài/lên

  // Tính tư thế theo điệu nhảy. b = số nhịp (float), ph = b * 2π
  function pose(o) {
    const b = o.beat, ph = b * TAU, sit = o.sitting;
    const P = {
      bob: 0, lean: 0, head: 0, headDy: 0, jump: 0,
      R: [0.45, 0.7], L: [0.35, 0.5], legs: 0, clap: false, step: 0,
    };
    const walk = o.moving;
    const m = o.dance;
    if (!m) {
      P.bob = Math.sin(ph) * 1.4;
      P.lean = Math.sin(ph / 2) * 0.03;
      P.R = [0.5 + Math.sin(ph) * 0.08, 0.7];
      P.L = [0.35 - Math.sin(ph) * 0.05, 0.4];
      P.head = Math.sin(ph / 2) * 0.05;
    } else if (m === 1) { // nhảy bật
      const j = Math.abs(Math.sin(Math.PI * b));
      P.jump = sit ? j * 5 : j * 20;
      P.bob = -Math.sin(ph) * 1.5;
      P.R = [2.5 + Math.sin(ph) * 0.4, 0.25]; P.L = [2.5 - Math.sin(ph) * 0.4, 0.25];
      P.head = Math.sin(ph) * 0.08;
    } else if (m === 2) { // vẫy lightstick
      P.lean = Math.sin(ph / 2) * 0.1;
      P.bob = Math.abs(Math.sin(ph)) * -2;
      P.R = [2.6 + Math.sin(ph / 2) * 0.15, 0.9 * Math.sin(ph * 2)];
      P.L = [0.9 + Math.sin(ph) * 0.1, 0.5];
      P.head = Math.sin(ph / 2) * 0.12;
    } else if (m === 3) { // lắc lư
      const s = Math.sin(ph / 2);
      P.lean = s * 0.22; P.head = s * 0.15;
      P.R = [2.45 + 0.45 * s, 0.25]; P.L = [2.45 - 0.45 * s, 0.25];
      P.bob = Math.abs(s) * -2; P.step = s;
    } else if (m === 4) { // vỗ tay
      P.bob = Math.abs(Math.sin(ph)) * -3;
      const f = -1.1 - 0.55 * Math.cos(ph * 2);
      P.R = [0.55, f]; P.L = [0.55, f];
      P.clap = Math.cos(ph * 2) < -0.85;
      P.head = Math.sin(ph) * 0.06;
    } else if (m === 5) { // headbang
      const s = Math.sin(ph * 2);
      P.lean = s * 0.12; P.head = s * 0.55; P.headDy = Math.abs(s) * 4;
      P.bob = Math.abs(s) * 3;
      P.R = [2.7 + 0.35 * s, 0.3]; P.L = [2.7 - 0.35 * s, 0.3];
    }
    if (walk) { P.bob += Math.abs(Math.sin(o.time * 14)) * -2.5; P.legs = Math.sin(o.time * 14); P.R = [0.5 + 0.3 * Math.sin(o.time * 14), 0.5]; P.L = [0.35 - 0.3 * Math.sin(o.time * 14), 0.5]; }
    else if (m && !sit) P.legs = Math.sin(ph * (m === 5 ? 2 : 1)) * 0.6;
    return P;
  }

  // Vẽ lightstick tại vị trí tay
  function drawStick(c, id, hx, hy, ang, o) {
    const len = id === 'stick_sword' ? 40 : 28;
    const dx = Math.sin(ang), dy = -Math.cos(ang); // hướng "ra xa" cẳng tay
    const ex = hx + dx * len, ey = hy + dy * len;
    const accent = o.accent || '#ff7be5';
    const item = SHARED.ITEM_BY_ID[id];
    let col = item ? item.c[0] : '#ffffff';
    if (id === 'stick_basic') col = accent;
    if (id === 'stick_rainbow') col = `hsl(${(o.time * 160) % 360},95%,62%)`;
    if (id === 'mic') {
      c.strokeStyle = '#333'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + dx * 8, hy + dy * 8); c.stroke();
      c.fillStyle = '#cfd4dc'; circle(c, hx + dx * 11, hy + dy * 11, 4); c.fill();
      return;
    }
    // thân gậy
    c.lineCap = 'round';
    c.strokeStyle = '#2a2a38'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + dx * 10, hy + dy * 10); c.stroke();
    if (id === 'stick_sword') {
      c.strokeStyle = col; c.lineWidth = 4;
      c.beginPath(); c.moveTo(hx + dx * 8, hy + dy * 8); c.lineTo(ex, ey); c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(hx + dx * 8, hy + dy * 8); c.lineTo(ex, ey); c.stroke();
    } else {
      c.strokeStyle = shade('#888888', 40); c.lineWidth = 3;
      c.beginPath(); c.moveTo(hx + dx * 8, hy + dy * 8); c.lineTo(hx + dx * 16, hy + dy * 16); c.stroke();
    }
    // đầu gậy
    const tx = hx + dx * 20, ty = hy + dy * 20;
    c.save();
    c.translate(tx, ty); c.rotate(ang);
    c.fillStyle = col;
    if (id === 'stick_heart') { heartPath(c, 0, -3, 5.5); c.fill(); }
    else if (id === 'stick_star') { starPath(c, 0, -2, 9, 4.2); c.fill(); }
    else if (id === 'stick_bear') {
      circle(c, 0, -3, 7); c.fill(); circle(c, -6, -9, 3.2); c.fill(); circle(c, 6, -9, 3.2); c.fill();
      c.fillStyle = '#fff'; circle(c, 0, -1, 3); c.fill(); c.fillStyle = '#222'; circle(c, 0, -3, 1.2); c.fill();
    } else if (id !== 'stick_sword') { circle(c, 0, -3, 6); c.fill(); }
    c.restore();
    // phát sáng
    if (!o.noGlow) {
      c.save(); c.globalCompositeOperation = 'lighter';
      const gx = id === 'stick_sword' ? (hx + ex) / 2 : tx, gy = id === 'stick_sword' ? (hy + ey) / 2 : ty;
      const gr = c.createRadialGradient(gx, gy, 1, gx, gy, id === 'stick_sword' ? 26 : 20);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.55 + 0.25 * (o.pulse || 0);
      c.fillStyle = gr; c.fillRect(gx - 30, gy - 30, 60, 60);
      c.restore();
    }
  }

  function drawBack(c, id, P, o) {
    const it = SHARED.ITEM_BY_ID[id]; if (!it) return;
    const [c1, c2] = it.c;
    const flap = Math.sin(o.time * 6 + o.beat * 2) * (o.dance || o.moving ? 0.25 : 0.07);
    if (id === 'back_wings' || id === 'back_bat') {
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 6, -34); c.scale(s, 1); c.rotate(-0.5 - flap);
        c.fillStyle = c1; c.strokeStyle = c2; c.lineWidth = 1.5;
        c.beginPath();
        if (id === 'back_wings') {
          c.moveTo(0, 0); c.bezierCurveTo(20, -26, 46, -22, 44, -2); c.bezierCurveTo(36, -8, 30, -6, 28, 2);
          c.bezierCurveTo(22, -2, 14, 2, 8, 12); c.closePath();
        } else {
          c.moveTo(0, 0); c.lineTo(14, -28); c.lineTo(22, -14); c.lineTo(32, -26); c.lineTo(36, -8); c.lineTo(44, -6); c.lineTo(30, 10); c.lineTo(14, 4); c.closePath();
        }
        c.fill(); c.stroke(); c.restore();
      }
    } else if (id === 'back_cape') {
      const sw = Math.sin(o.time * 4) * 3 + P.lean * -20;
      c.fillStyle = c1;
      c.beginPath(); c.moveTo(-11, -38); c.lineTo(11, -38); c.lineTo(17 + sw, -6); c.lineTo(-17 + sw, -6); c.closePath(); c.fill();
      c.strokeStyle = c2; c.lineWidth = 2; c.beginPath(); c.moveTo(-17 + sw, -6); c.lineTo(17 + sw, -6); c.stroke();
    }
  }

  function drawTop(c, look, o) {
    const shirt = SHARED.SHIRTS[look.shirt];
    const it = look.top ? SHARED.ITEM_BY_ID[look.top] : null;
    const base = it ? it.c[0] : shirt, acc = it ? it.c[1] : shade(shirt, -35);
    rr(c, -12, -39, 24, 26, 7); c.fillStyle = base; c.fill();
    c.save(); rr(c, -12, -39, 24, 26, 7); c.clip();
    if (!it) { // áo thường: sọc nhẹ
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-12, -39, 24, 6);
    } else if (it.id === 'top_tee') {
      c.fillStyle = acc; starPath(c, 0, -26, 6, 2.6); c.fill();
    } else if (it.id === 'top_hoodie') {
      c.fillStyle = shade(base, -30); rr(c, -7, -22, 14, 8, 3); c.fill();
      c.strokeStyle = acc; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -39); c.lineTo(-3, -30); c.moveTo(3, -39); c.lineTo(3, -30); c.stroke();
    } else if (it.id === 'top_jersey') {
      c.fillStyle = acc; c.fillRect(-12, -39, 24, 3); c.fillRect(-12, -17, 24, 3);
      c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('10', 0, -23);
    } else if (it.id === 'top_sequin') {
      for (let i = 0; i < 9; i++) {
        const x = -9 + (i % 3) * 9, y = -35 + Math.floor(i / 3) * 8;
        const tw = 0.5 + 0.5 * Math.sin(o.time * 5 + i * 1.7);
        c.fillStyle = `rgba(255,255,255,${0.35 + tw * 0.6})`; circle(c, x, y, 1.6 + tw); c.fill();
      }
    } else if (it.id === 'top_jacket') {
      c.fillStyle = acc; c.fillRect(-1, -39, 2, 26);
      c.fillStyle = '#3a3a46'; c.beginPath(); c.moveTo(-12, -39); c.lineTo(-2, -39); c.lineTo(-7, -28); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(12, -39); c.lineTo(2, -39); c.lineTo(7, -28); c.closePath(); c.fill();
    } else if (it.id === 'top_idol') {
      const g = c.createLinearGradient(0, -39, 0, -13); g.addColorStop(0, '#fff'); g.addColorStop(1, acc);
      c.fillStyle = g; c.fillRect(-12, -39, 24, 26);
      c.fillStyle = '#ff6fa8'; c.beginPath(); c.moveTo(0, -32); c.lineTo(-7, -37); c.lineTo(-7, -27); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(0, -32); c.lineTo(7, -37); c.lineTo(7, -27); c.closePath(); c.fill(); circle(c, 0, -32, 2.5); c.fill();
    }
    c.restore();
  }

  function drawHairBack(c, look, hc) {
    c.fillStyle = hc;
    const hs = look.hairStyle;
    if (hs === 1) { rr(c, -21, -64, 42, 46, 14); c.fill(); }
    else if (hs === 2) {
      for (const s of [-1, 1]) { circle(c, s * 22, -52, 7); c.fill(); rr(c, s * 22 - 5, -52, 10, 28, 5); c.fill(); }
    } else if (hs === 5) { rr(c, -22, -66, 44, 34, 16); c.fill(); }
  }
  function drawHairFront(c, look, hc) {
    c.fillStyle = hc;
    const hs = look.hairStyle;
    // mũ tóc trùm đỉnh đầu
    c.beginPath(); c.arc(0, -58, 21.5, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
    if (hs === 4) { // gai
      for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(i * 6 - 5, -74); c.lineTo(i * 6, -90 + Math.abs(i) * 3); c.lineTo(i * 6 + 5, -74); c.closePath(); c.fill(); }
    }
    if (hs === 3) { circle(c, 0, -82, 9); c.fill(); }
    // mái
    c.beginPath();
    if (hs === 0 || hs === 4) { c.moveTo(-21, -58); c.lineTo(-14, -52); c.lineTo(-7, -60); c.lineTo(2, -52); c.lineTo(10, -61); c.lineTo(21, -56); c.lineTo(21, -62); c.lineTo(-21, -62); }
    else if (hs === 5) { c.moveTo(-21, -52); c.lineTo(21, -52); c.lineTo(21, -66); c.lineTo(-21, -66); }
    else { c.moveTo(-21, -58); c.quadraticCurveTo(-8, -46, 0, -58); c.quadraticCurveTo(10, -46, 21, -58); c.lineTo(21, -62); c.lineTo(-21, -62); }
    c.closePath(); c.fill();
  }

  function drawFace(c, look, o, P) {
    const eyeC = '#222';
    const open = o.dance && Math.sin(o.beat * TAU * 2) > 0;
    // má hồng
    c.fillStyle = 'rgba(255,90,110,.28)'; c.beginPath(); c.ellipse(-12, -50, 4.5, 3, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(12, -50, 4.5, 3, 0, 0, TAU); c.fill();
    const blink = (o.time * 0.7 + (o.seed || 0)) % 4 > 3.85;
    for (const s of [-1, 1]) {
      const ex = s * 8, ey = -57;
      c.fillStyle = eyeC; c.strokeStyle = eyeC; c.lineWidth = 2; c.lineCap = 'round';
      if (blink || look.eyes === 1 || (o.dance && look.eyes === 0 && open && false)) {
        c.beginPath(); c.arc(ex, ey + 1, 4, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      } else if (look.eyes === 0) {
        c.beginPath(); c.ellipse(ex, ey, 3.2, 4.2, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; circle(c, ex + 1, ey - 1.5, 1.3); c.fill();
      } else if (look.eyes === 2) {
        c.beginPath(); c.ellipse(ex, ey, 4, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; circle(c, ex + 1.2, ey - 2, 1.7); c.fill(); circle(c, ex - 1.3, ey + 1.5, 0.9); c.fill();
      } else { // ngầu
        c.beginPath(); c.ellipse(ex, ey + 1, 3.4, 2.6, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(ex - 5, ey - 4 + (s > 0 ? 0 : 1)); c.lineTo(ex + 5, ey - 4 + (s > 0 ? 1 : 0)); c.stroke();
      }
    }
    // miệng
    c.strokeStyle = '#a8324a'; c.lineWidth = 1.8;
    if (o.dance && open) { c.fillStyle = '#7a1d33'; c.beginPath(); c.ellipse(0, -46, 4.2, 3.6, 0, 0, TAU); c.fill(); c.fillStyle = '#ff7b95'; c.beginPath(); c.ellipse(0, -44.5, 2.6, 1.6, 0, 0, TAU); c.fill(); }
    else { c.beginPath(); c.arc(0, -47, 4, 0.2, Math.PI - 0.2); c.stroke(); }
    // vật phẩm mặt
    const f = look.face;
    if (f === 'face_sun') {
      c.fillStyle = '#111'; rr(c, -17, -62, 15, 9, 3); c.fill(); rr(c, 2, -62, 15, 9, 3); c.fill(); c.fillRect(-3, -60, 6, 2);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-14, -61, 5, 2); c.fillRect(5, -61, 5, 2);
    } else if (f === 'face_star') {
      c.fillStyle = '#ffd43b'; c.strokeStyle = '#c99700'; c.lineWidth = 1;
      starPath(c, -9, -57, 10, 5); c.fill(); c.stroke(); starPath(c, 9, -57, 10, 5); c.fill(); c.stroke();
      c.fillRect(-3, -58, 6, 1.5);
    } else if (f === 'face_heart') {
      c.fillStyle = '#ff4d6d'; heartPath(c, -14, -49, 2.6); c.fill(); heartPath(c, 14, -49, 2.6); c.fill();
    } else if (f === 'face_glitter') {
      for (let i = 0; i < 10; i++) {
        const a = i * 2.4, rx = Math.cos(a) * (6 + (i % 4) * 3), ry = -50 + Math.sin(a) * 6;
        const tw = 0.5 + 0.5 * Math.sin(o.time * 6 + i);
        c.fillStyle = `rgba(255,255,255,${0.4 + tw * 0.6})`; starPath(c, rx, ry, 2 + tw * 1.4, 0.8, 4); c.fill();
      }
    } else if (f === 'face_mask') {
      c.fillStyle = '#7048e8'; c.beginPath(); c.moveTo(-20, -60); c.quadraticCurveTo(0, -68, 20, -60); c.lineTo(18, -52); c.quadraticCurveTo(10, -51, 4, -56); c.lineTo(-4, -56); c.quadraticCurveTo(-10, -51, -18, -52); c.closePath(); c.fill();
      c.strokeStyle = '#ffd43b'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = eyeC; circle(c, -8, -57, 2.4); c.fill(); circle(c, 8, -57, 2.4); c.fill();
    }
  }

  function drawHat(c, id, o) {
    const it = SHARED.ITEM_BY_ID[id]; if (!it) return;
    const [c1, c2] = it.c;
    if (id === 'hat_cap') {
      c.fillStyle = c1; c.beginPath(); c.arc(0, -66, 20, Math.PI, TAU); c.closePath(); c.fill();
      rr(c, -4, -70, 26, 6, 3); c.fillStyle = shade(c1, -30); c.fill();
      c.fillStyle = c2; circle(c, 0, -80, 2.5); c.fill();
    } else if (id === 'hat_headband') {
      c.fillStyle = c1; c.fillRect(-21, -68, 42, 6);
      c.fillStyle = c2; for (let i = -18; i < 20; i += 9) c.fillRect(i, -68, 4, 6);
      c.save(); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(0, -65, 1, 0, -65, 14); g.addColorStop(0, '#ffefa0'); g.addColorStop(1, 'rgba(255,80,0,0)'); c.fillStyle = g; c.fillRect(-16, -80, 32, 30); c.restore();
    } else if (id === 'hat_bunny') {
      for (const s of [-1, 1]) {
        c.save(); c.translate(s * 9, -76); c.rotate(s * 0.15 + Math.sin(o.time * 3 + s) * 0.05);
        c.fillStyle = c1; c.beginPath(); c.ellipse(0, -14, 6, 17, 0, 0, TAU); c.fill();
        c.fillStyle = c2; c.beginPath(); c.ellipse(0, -13, 3, 12, 0, 0, TAU); c.fill(); c.restore();
      }
    } else if (id === 'hat_cat') {
      for (const s of [-1, 1]) {
        c.fillStyle = c1; c.beginPath(); c.moveTo(s * 20, -66); c.lineTo(s * 17, -88); c.lineTo(s * 3, -74); c.closePath(); c.fill();
        c.fillStyle = c2; c.beginPath(); c.moveTo(s * 16, -70); c.lineTo(s * 15, -83); c.lineTo(s * 7, -74); c.closePath(); c.fill();
      }
    } else if (id === 'hat_cowboy') {
      c.fillStyle = c1; c.beginPath(); c.ellipse(0, -68, 32, 7, 0, 0, TAU); c.fill();
      rr(c, -14, -88, 28, 22, 7); c.fill(); c.fillStyle = c2; c.fillRect(-14, -72, 28, 4);
    } else if (id === 'hat_halo') {
      const bob = Math.sin(o.time * 3) * 2;
      c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = c1; c.lineWidth = 8; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(0, -87 + bob, 17, 5, 0, 0, TAU); c.stroke(); c.restore();
      c.strokeStyle = c1; c.lineWidth = 3.5; c.beginPath(); c.ellipse(0, -87 + bob, 17, 5, 0, 0, TAU); c.stroke();
    } else if (id === 'hat_crown') {
      c.fillStyle = c1; c.beginPath(); c.moveTo(-15, -70); c.lineTo(-17, -90); c.lineTo(-8, -80); c.lineTo(0, -93); c.lineTo(8, -80); c.lineTo(17, -90); c.lineTo(15, -70); c.closePath(); c.fill();
      c.fillStyle = c2; circle(c, 0, -77, 2.5); c.fill(); circle(c, -9, -75, 2); c.fill(); circle(c, 9, -75, 2); c.fill();
    }
  }

  // o: { x,y,scale,time,beat,dance,sitting,moving,flip,accent,pulse,seed,alpha,noGlow,mic }
  function draw(c, look, o) {
    const P = pose(o);
    c.save();
    c.translate(o.x, o.y); c.scale(o.scale || 1, o.scale || 1);
    if (o.alpha != null) c.globalAlpha = o.alpha;
    // bóng
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 1, 17 - P.jump * 0.2, 5, 0, 0, TAU); c.fill();

    const sit = o.sitting;
    c.translate(0, -P.jump + (sit ? 9 : 0) + P.bob);
    c.save(); c.translate(0, -14); c.rotate(P.lean); c.translate(0, 14); // nghiêng quanh hông

    if (look.back) drawBack(c, look.back, P, o);

    // chân
    const pants = '#2d2f4a';
    if (sit) {
      c.fillStyle = pants; rr(c, -11, -18, 10, 9, 3); c.fill(); rr(c, 1, -18, 10, 9, 3); c.fill();
      c.fillStyle = '#fff'; rr(c, -12, -10, 11, 6, 3); c.fill(); rr(c, 1, -10, 11, 6, 3); c.fill();
    } else {
      for (const s of [-1, 1]) {
        const sw = P.legs * s * 5;
        c.fillStyle = pants; rr(c, s * 6 - 4 + sw * 0.5, -16, 8, 13 - Math.max(0, -sw) * 0.4, 3); c.fill();
        c.fillStyle = '#f4f4f8'; rr(c, s * 6 - 5 + sw, -5 - Math.max(0, sw) * 0.3, 10, 6, 3); c.fill();
      }
    }
    // tay trái (phía sau thân)
    const sh = (s) => [s * 11, -35];
    const arm = (s, ang) => {
      const [sx, sy] = sh(s);
      const d1 = dir(ang[0], s), d2 = dir(ang[0] + ang[1] * 1, s);
      const ex = sx + d1[0] * L1, ey = sy + d1[1] * L1;
      const hx = ex + d2[0] * L2, hy = ey + d2[1] * L2;
      return { sx, sy, ex, ey, hx, hy, a: ang[0] + ang[1] };
    };
    const aL = arm(-1, P.L), aR = arm(1, P.R);
    const skin = SHARED.SKINS[look.skin];
    const sleeve = look.top ? SHARED.ITEM_BY_ID[look.top].c[0] : SHARED.SHIRTS[look.shirt];
    const drawArm = (a) => {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = sleeve; c.lineWidth = 7; c.beginPath(); c.moveTo(a.sx, a.sy); c.lineTo(a.ex, a.ey); c.stroke();
      c.strokeStyle = skin; c.lineWidth = 6; c.beginPath(); c.moveTo(a.ex, a.ey); c.lineTo(a.hx, a.hy); c.stroke();
      c.fillStyle = skin; circle(c, a.hx, a.hy, 3.8); c.fill();
    };
    drawArm(aL);
    drawTop(c, look, o);
    drawArm(aR);

    // lightstick tay phải; mic của người biểu diễn; tay trái cũng cầm khi giơ cao (điệu 1,3,5)
    const stickId = o.mic ? 'mic' : look.stick || 'stick_basic';
    const angR = Math.atan2(aR.hx - aR.ex, -(aR.hy - aR.ey));
    drawStick(c, stickId, aR.hx, aR.hy, angR, o);
    if (!o.mic && o.dance && (o.dance === 1 || o.dance === 3 || o.dance === 5)) {
      const angL = Math.atan2(aL.hx - aL.ex, -(aL.hy - aL.ey));
      drawStick(c, stickId, aL.hx, aL.hy, angL, o);
    }
    if (P.clap) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = '#fff6a8'; starPath(c, 0, -27, 9, 3.5, 6); c.fill(); c.restore(); }

    // đầu
    c.save(); c.translate(0, -36 + P.headDy); c.rotate(P.head); c.translate(0, 36);
    const hc = SHARED.HAIRS[look.hairColor];
    drawHairBack(c, look, hc);
    c.fillStyle = skin; rr(c, -4, -42, 8, 8, 2); c.fill(); // cổ
    circle(c, 0, -57, 20); c.fillStyle = skin; c.fill();
    drawFace(c, look, o, P);
    drawHairFront(c, look, hc);
    if (look.hat) drawHat(c, look.hat, o);
    c.restore();

    c.restore(); // lean
    c.restore();
  }

  // Ghế khán đài
  function drawChair(c, x, y, taken, col) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 3, 26, 7, 0, 0, TAU); c.fill();
    const body = col || '#3b2a5c';
    rr(c, -20, -50, 40, 34, 9); c.fillStyle = shade(body, -10); c.fill(); // lưng ghế
    rr(c, -22, -18, 44, 18, 7); c.fillStyle = body; c.fill(); // mặt ghế
    c.fillStyle = 'rgba(255,255,255,.12)'; rr(c, -17, -47, 34, 5, 3); c.fill();
    rr(c, -26, -30, 6, 26, 3); c.fillStyle = shade(body, -35); c.fill(); rr(c, 20, -30, 6, 26, 3); c.fill();
    c.restore();
  }

  function drawStar(c, x, y, gold, t) {
    const bob = Math.sin(t * 3 + x) * 4;
    const R = gold ? 17 : 12;
    c.save(); c.translate(x, y - 16 + bob);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(0, 0, 2, 0, 0, R * 2.4); g.addColorStop(0, gold ? 'rgba(255,220,80,.8)' : 'rgba(120,230,255,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(-R * 2.4, -R * 2.4, R * 4.8, R * 4.8);
    c.globalCompositeOperation = 'source-over';
    c.rotate(Math.sin(t * 2 + x) * 0.3);
    c.fillStyle = gold ? '#ffd23f' : '#8be9ff'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    starPath(c, 0, 0, R, R * 0.48); c.fill(); c.stroke();
    c.restore();
  }

  return { draw, drawChair, drawStar, shade, circle, rr, starPath, heartPath };
})();
