// Client: kết nối, điều khiển, render, menu nhân vật & cửa hàng
(() => {
  const S = SHARED;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const PSCALE = 0.88; // tỉ lệ nhân vật ngoài khán đài

  /* ================= Trạng thái ================= */
  let ws = null, token = null;
  try { token = localStorage.getItem('concert_token'); } catch (e) {}
  let profile = null, draft = null, mode = 'menu', previewDance = 0;
  let myId = null, me = null;
  const players = new Map(), stars = new Map(), floats = [];
  let theme = { idx: Math.floor(Math.random() * S.THEMES.length), start: Date.now(), dur: S.THEME_DURATION };
  let offset = 0, offsetInit = false;
  const sNow = () => Date.now() + offset;
  ConcertAudio.init(sNow);
  let video = null, queueN = 0; // video YouTube đang phát trên màn hình sân khấu
  let W = 0, H = 0, DPR = 1, SC = 1, OX = 0, OY = 0;

  /* ================= Tiện ích UI ================= */
  function toast(text, cls) {
    const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = text;
    $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  }
  const send = (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ================= Kết nối ================= */
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { $('conn').hidden = true; send({ k: 'hello', token }); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } onMsg(m); };
    ws.onclose = () => {
      $('conn').hidden = false;
      if (mode === 'world') leaveWorldUI();
      $('btnEnter').disabled = true; $('btnEnter').textContent = 'Đang kết nối…';
      setTimeout(connect, 2000);
    };
    ws.onerror = () => {};
  }

  function onMsg(m) {
    switch (m.k) {
      case 'welcome': {
        token = m.token; try { localStorage.setItem('concert_token', token); } catch (e) {}
        profile = m.profile;
        if (!draft) { draft = S.sanitizeLook(profile.look, null); $('nameInput').value = profile.name; }
        refreshPts(); buildMenu();
        $('btnEnter').disabled = false; $('btnEnter').textContent = '🎉 THAM GIA CONCERT';
        break;
      }
      case 'profile': {
        profile = m.profile; refreshPts();
        if (m.bought) {
          const it = S.ITEM_BY_ID[m.bought]; draft[it.slot] = it.id; ConcertAudio.resume(); ConcertAudio.sfx('buy');
          toast('Đã mua: ' + it.name + ' 🎉', 'gain');
        }
        buildMenu();
        break;
      }
      case 'joined': {
        players.clear(); stars.clear(); floats.length = 0;
        offset = m.now - Date.now(); offsetInit = true;
        theme = m.theme; Scene.setTheme(theme.idx, false);
        m.players.forEach(addPlayer);
        m.stars.forEach((s) => stars.set(s.id, s));
        myId = m.id; me = players.get(myId); me.mine = true;
        me.target = { x: S.WORLD.w / 2 + (Math.random() * 40 - 20), y: 700 };
        mode = 'world';
        $('menu').hidden = true; $('hud').hidden = false;
        $('hudName').textContent = me.name;
        ConcertAudio.resume(); handleVideo(m.video, m.queue);
        toast('Chào mừng đến concert! Nhấn 1–5 để quẩy 🎶');
        break;
      }
      case 'pj': addPlayer(m.p); break;
      case 'pl': players.delete(m.id); break;
      case 'look': { const p = players.get(m.id); if (p) { p.look = m.look; p.name = m.name; if (p === me) $('hudName').textContent = m.name; } break; }
      case 's': {
        const off = m.now - Date.now();
        offset = offsetInit ? offset * 0.95 + off * 0.05 : off; offsetInit = true;
        for (const [id, x, y, seat, dance] of m.p) {
          const p = players.get(id); if (!p) continue;
          if (p === me) continue;
          p.tx = x; p.ty = y; p.seat = seat; p.dance = dance;
        }
        break;
      }
      case 'sit': {
        const p = players.get(m.id); if (!p) break;
        p.seat = m.seat;
        if (m.seat >= 0) { p.x = p.tx = m.x; p.y = p.ty = m.y; if (p.mine) { p.target = null; p.goSeat = -1; } }
        break;
      }
      case 'chat': { const p = players.get(m.id); if (p) p.chat = { text: m.text, until: performance.now() + 5500 }; break; }
      case 'theme': {
        theme = m.theme; offset = m.now - Date.now();
        Scene.setTheme(theme.idx, true);
        syncAudio(); ConcertAudio.sfx('cheer');
        $('bannerName').textContent = S.THEMES[theme.idx].name;
        const b = $('banner'); b.hidden = true; void b.offsetWidth; b.hidden = false; setTimeout(() => (b.hidden = true), 4300);
        break;
      }
      case 'video': offset = m.now - Date.now(); handleVideo(m.v, m.q); toast('🎵 Bài mới trên màn hình sân khấu'); break;
      case 'queue': queueN = m.n; updateMusicUI(); if (m.by) toast(m.by + ' vừa thêm một bài vào hàng chờ 🎵'); break;
      case 'vfail': toast('Video này không cho phép nhúng – đã chuyển sang bài khác', 'err'); break;
      case 'star': stars.set(m.s.id, m.s); break;
      case 'starx': {
        const st = stars.get(m.id); stars.delete(m.id);
        if (st && m.by === myId) ConcertAudio.sfx('star');
        break;
      }
      case 'pts': {
        profile.points = m.total; refreshPts();
        if (me) floats.push({ x: me.x, y: me.y - 110, text: '+' + m.n + ' ⭐', life: 0, color: '#ffd23f' });
        toast(`+${m.n} ⭐  ${m.why || ''}`, 'gain'); ConcertAudio.sfx('coin');
        break;
      }
      case 'err': toast(m.msg, 'err'); ConcertAudio.resume(); ConcertAudio.sfx('err'); break;
    }
  }

  function addPlayer(p) {
    players.set(p.id, {
      id: p.id, name: p.name, look: p.look, x: p.x, y: p.y, tx: p.x, ty: p.y, seat: p.seat, dance: p.dance,
      moving: false, chat: null, target: null, goSeat: -1, mine: false, danceUntil: 0, lastSent: 0, sx: p.x, sy: p.y,
    });
  }
  function leaveWorldUI() {
    mode = 'menu'; me = null; myId = null; players.clear(); stars.clear();
    $('hud').hidden = true; $('menu').hidden = false; setMenuMode(false);
    ConcertAudio.stop(); Screen.stop(); video = null; theme = { idx: theme.idx, start: sNow(), dur: S.THEME_DURATION };
  }
  function refreshPts() {
    if (!profile) return;
    $('menuPts').textContent = '⭐ ' + profile.points; $('hudPts').textContent = '⭐ ' + profile.points;
  }

  /* ================= Menu nhân vật & cửa hàng ================= */
  let shopCat = 'hat';
  function swatches(key, list) {
    const row = document.createElement('div'); row.className = 'row';
    list.forEach((col, i) => {
      const b = document.createElement('button'); b.className = 'sw' + (draft[key] === i ? ' on' : ''); b.style.background = col;
      b.onclick = () => { draft[key] = i; buildMenu(); }; row.appendChild(b);
    });
    return row;
  }
  function chips(key, list) {
    const row = document.createElement('div'); row.className = 'row';
    list.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'chip' + (draft[key] === i ? ' on' : ''); b.textContent = t;
      b.onclick = () => { draft[key] = i; buildMenu(); }; row.appendChild(b);
    });
    return row;
  }
  function opt(title, node) { const d = document.createElement('div'); d.className = 'opt'; const h = document.createElement('h3'); h.textContent = title; d.append(h, node); return d; }

  function itemThumb(it) {
    const c = document.createElement('canvas'); c.width = c.height = 168;
    const g = c.getContext('2d'); g.scale(2, 2);
    const look = Object.assign(S.defaultLook(), { hairStyle: 4, hairColor: 5, skin: 1, [it.slot]: it.id });
    const P = { hat: [1.55, 138], face: [1.9, 150], top: [1.7, 88], stick: [1.15, 98], back: [0.95, 82] }[it.slot];
    Char.draw(g, look, { x: 42, y: P[1], scale: P[0], time: 1, beat: it.slot === 'stick' ? 0.25 : 0.1, dance: it.slot === 'stick' ? 2 : 0, accent: '#ff7be5', pulse: 1 });
    return c;
  }

  function buildMenu() {
    if (!profile || !draft) return;
    // Tab nhân vật
    const tl = $('tab-look'); tl.innerHTML = '';
    tl.append(opt('Màu da', swatches('skin', S.SKINS)), opt('Kiểu tóc', chips('hairStyle', S.HAIR_STYLES)), opt('Màu tóc', swatches('hairColor', S.HAIRS)),
      opt('Ánh mắt', chips('eyes', S.EYES)), opt('Màu áo', swatches('shirt', S.SHIRTS)));
    // Cửa hàng
    const cats = $('cats'); cats.innerHTML = '';
    for (const [slot, name] of Object.entries(S.SLOTS)) {
      const b = document.createElement('button'); b.textContent = name; b.className = shopCat === slot ? 'on' : '';
      b.onclick = () => { shopCat = slot; buildMenu(); }; cats.appendChild(b);
    }
    const grid = $('grid'); grid.innerHTML = '';
    if (shopCat !== 'stick') {
      const card = document.createElement('div'); card.className = 'card' + (draft[shopCat] ? '' : ' eq');
      const none = document.createElement('div'); none.className = 'nm'; none.textContent = 'Không dùng';
      const bt = document.createElement('button'); bt.textContent = draft[shopCat] ? 'Bỏ món này' : 'Đang trống'; bt.className = draft[shopCat] ? '' : 'on';
      bt.onclick = () => { draft[shopCat] = null; buildMenu(); };
      const ph = document.createElement('canvas'); ph.width = ph.height = 168; card.append(ph, none, bt); grid.appendChild(card);
    }
    S.ITEMS.filter((i) => i.slot === shopCat).forEach((it) => {
      const owned = profile.owned.includes(it.id), eq = draft[it.slot] === it.id;
      const card = document.createElement('div'); card.className = 'card' + (eq ? ' eq' : '');
      const cv = itemThumb(it); cv.title = 'Bấm để thử đồ';
      cv.onclick = () => { draft[it.slot] = it.id; buildMenu(); };
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name;
      const bt = document.createElement('button');
      if (!owned) {
        bt.className = 'buy' + (profile.points < it.price ? ' poor' : ''); bt.textContent = `Mua ⭐ ${it.price}`;
        bt.onclick = () => { ConcertAudio.resume(); send({ k: 'buy', id: it.id }); };
      } else if (eq) { bt.className = 'on'; bt.textContent = 'Đang dùng ✓'; bt.onclick = () => { if (it.slot !== 'stick') { draft[it.slot] = null; buildMenu(); } }; }
      else { bt.className = 'use'; bt.textContent = it.price ? 'Dùng' : 'Dùng (miễn phí)'; bt.onclick = () => { draft[it.slot] = it.id; buildMenu(); }; }
      card.append(cv, nm, bt); grid.appendChild(card);
    });
    // nút điệu xem thử
    const pd = $('previewDance');
    if (!pd.children.length) {
      ['⏹', '1', '2', '3', '4', '5'].forEach((t, i) => {
        const b = document.createElement('button'); b.textContent = t; b.title = i ? S.DANCES[i] : 'Đứng yên';
        b.onclick = () => { previewDance = i; [...pd.children].forEach((c, j) => c.classList.toggle('on', j === i)); }; pd.appendChild(b);
      });
      pd.children[0].classList.add('on');
    }
  }
  document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $('tab-look').hidden = b.dataset.tab !== 'look'; $('tab-shop').hidden = b.dataset.tab !== 'shop';
  }));

  function setMenuMode(inWorld) {
    $('btnEnter').hidden = inWorld; $('btnResume').hidden = !inWorld; $('btnLeave').hidden = !inWorld;
  }
  function saveLook() {
    const look = S.sanitizeLook(draft, profile.owned);
    const stripped = S.ITEMS.some((i) => draft[i.slot] === i.id && look[i.slot] !== i.id);
    if (stripped) toast('Món chưa mua không được lưu – hãy mua để dùng nhé!', 'err');
    draft = Object.assign({}, look);
    send({ k: 'save', name: $('nameInput').value, look });
    return look;
  }
  $('btnEnter').onclick = () => { ConcertAudio.resume(); saveLook(); send({ k: 'enter' }); $('btnEnter').disabled = true; setTimeout(() => ($('btnEnter').disabled = !profile), 1500); };
  $('btnResume').onclick = () => { saveLook(); $('menu').hidden = true; };
  $('btnLeave').onclick = () => { send({ k: 'leave' }); leaveWorldUI(); };
  $('btnWardrobe').onclick = () => { draft = Object.assign({}, me ? me.look : draft); setMenuMode(true); buildMenu(); $('menu').hidden = false; };

  /* ================= HUD: thanh điệu nhảy ================= */
  const db = $('dancebar');
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button'); b.className = 'dbtn'; b.dataset.m = i; b.innerHTML = `<b>${i}</b><span>${S.DANCES[i]}</span>`;
    b.onclick = () => doDance(i); db.appendChild(b);
  }
  function doDance(m) {
    if (!me || mode !== 'world') return;
    ConcertAudio.resume();
    if (me.dance === m) m = 0;
    me.dance = m; me.danceUntil = performance.now() + 10000;
    send({ k: 'dance', m });
  }
  $('btnSound').onclick = toggleSound;
  function toggleSound() { const v = !ConcertAudio.isMuted(); ConcertAudio.setMuted(v); Screen.setMuted(v); $('btnSound').textContent = v ? '🔇' : '🔊'; }

  /* ================= Điều khiển ================= */
  const keys = {};
  function typing() { return document.activeElement && document.activeElement.tagName === 'INPUT'; }
  addEventListener('keydown', (e) => {
    if (mode !== 'world') return;
    if (typing()) { if (e.key === 'Escape') document.activeElement.blur(); return; }
    if (!$('menu').hidden) return;
    const k = e.key.toLowerCase();
    if (k >= '0' && k <= '5' && k.length === 1) return doDance(+k);
    if (k === 'enter') { e.preventDefault(); $('chatInput').focus(); return; }
    if (k === 'e') return toggleSeat();
    if (k === 'm') return toggleSound();
    const map = { arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd' };
    if (map[k]) { keys[map[k]] = true; e.preventDefault(); }
  });
  addEventListener('keyup', (e) => {
    const map = { arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd' };
    const k = map[e.key.toLowerCase()]; if (k) keys[k] = false;
  });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  $('chatForm').onsubmit = (e) => { e.preventDefault(); const t = $('chatInput').value.trim(); if (t) send({ k: 'chat', text: t }); $('chatInput').value = ''; $('chatInput').blur(); };

  const seatOwner = () => { const m = new Map(); players.forEach((p) => { if (p.seat >= 0) m.set(p.seat, p); }); return m; };
  function toggleSeat() {
    if (!me) return;
    if (me.seat >= 0) { send({ k: 'stand' }); me.seat = -1; return; }
    const owners = seatOwner(); let best = null, bd = 130;
    for (const s of S.SEATS) { if (owners.has(s.id)) continue; const d = Math.hypot(s.x - me.x, s.y - me.y); if (d < bd) { bd = d; best = s; } }
    if (best) goToSeat(best); else toast('Không có ghế trống gần đây', 'err');
  }
  function goToSeat(s) { me.target = { x: s.x, y: s.y }; me.goSeat = s.id; }

  canvas.addEventListener('pointerdown', (e) => {
    if (mode !== 'world' || !me || !$('menu').hidden) return;
    const wx = (e.clientX - OX) / SC, wy = (e.clientY - OY) / SC;
    // bấm vào ghế
    const owners = seatOwner();
    for (const s of S.SEATS) {
      if (Math.abs(wx - s.x) < 28 && wy > s.y - 55 && wy < s.y + 12) {
        const o = owners.get(s.id);
        if (o && o !== me) return toast('Ghế này đã có người ngồi', 'err');
        if (o === me) return;
        return goToSeat(s);
      }
    }
    me.goSeat = -1;
    const [tx, ty] = S.clampPos(wx, wy); me.target = { x: tx, y: ty };
  });

  /* ================= Cập nhật ================= */
  function updatePlayers(dt) {
    const now = performance.now();
    for (const p of players.values()) {
      if (p.mine) {
        let dx = (keys.r ? 1 : 0) - (keys.l ? 1 : 0), dy = (keys.d ? 1 : 0) - (keys.u ? 1 : 0);
        let vx = 0, vy = 0;
        if (dx || dy) { const l = Math.hypot(dx, dy); vx = (dx / l) * S.SPEED; vy = (dy / l) * S.SPEED; p.target = null; p.goSeat = -1; }
        else if (p.target) {
          const ddx = p.target.x - p.x, ddy = p.target.y - p.y, d = Math.hypot(ddx, ddy);
          if (d < 4) {
            p.x = p.target.x; p.y = p.target.y; p.target = null;
            if (p.goSeat >= 0) { sendPos(true); send({ k: 'sit', seat: p.goSeat }); p.goSeat = -1; }
          } else { vx = (ddx / d) * S.SPEED; vy = (ddy / d) * S.SPEED; }
        }
        p.moving = !!(vx || vy);
        if (p.moving) {
          if (p.seat >= 0) { send({ k: 'stand' }); p.seat = -1; }
          [p.x, p.y] = S.clampPos(p.x + vx * dt, p.y + vy * dt);
          if (now - p.lastSent > 80) sendPos();
        }
        if (p.danceUntil && now > p.danceUntil) { p.dance = 0; p.danceUntil = 0; }
        p.vx = p.x; p.vy = p.y;
      } else {
        const px = p.vx === undefined ? p.tx : p.vx, py = p.vy === undefined ? p.ty : p.vy;
        const k = Math.min(1, dt * 11);
        p.vx = px + (p.tx - px) * k; p.vy = py + (p.ty - py) * k;
        p.moving = Math.hypot(p.tx - p.vx, p.ty - p.vy) > 6 && p.seat < 0;
      }
    }
    for (const f of floats) { f.life += dt; f.y -= 40 * dt; }
    for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life > 1.6) floats.splice(i, 1);
  }
  function sendPos(force) {
    if (!me) return; const now = performance.now();
    if (!force && now - me.lastSent < 70) return; me.lastSent = now;
    send({ k: 'move', x: Math.round(me.x), y: Math.round(me.y) });
  }

  /* ================= Vẽ ================= */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    SC = Math.min(W / S.WORLD.w, H / S.WORLD.h); OX = (W - S.WORLD.w * SC) / 2; OY = (H - S.WORLD.h * SC) / 2;
  }
  addEventListener('resize', resize); resize();

  function roundRect(c, x, y, w, h, r) { Char.rr(c, x, y, w, h, r); }
  function drawLabel(c, p, t) {
    const sit = p.seat >= 0;
    const x = p.vx, y = p.vy + (sit ? 9 * PSCALE : 0) - 102 * PSCALE;
    c.font = '600 13px "Segoe UI", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const w = c.measureText(p.name).width + 14;
    c.fillStyle = p.mine ? 'rgba(255,210,63,.92)' : 'rgba(10,6,24,.72)'; roundRect(c, x - w / 2, y - 10, w, 20, 10); c.fill();
    c.fillStyle = p.mine ? '#2a1a00' : '#fff'; c.fillText(p.name, x, y + 1);
    if (p.chat && t < p.chat.until) {
      const txt = p.chat.text; c.font = '14px "Segoe UI", system-ui, sans-serif';
      const bw = Math.min(260, c.measureText(txt).width + 20), by = y - 34;
      c.fillStyle = 'rgba(255,255,255,.95)'; roundRect(c, x - bw / 2, by - 15, bw, 30, 12); c.fill();
      c.beginPath(); c.moveTo(x - 6, by + 14); c.lineTo(x, by + 22); c.lineTo(x + 6, by + 14); c.fill();
      c.fillStyle = '#20143a'; c.save(); c.beginPath(); c.rect(x - bw / 2 + 6, by - 15, bw - 12, 30); c.clip(); c.fillText(txt, x, by + 1); c.restore();
    }
  }

  function currentState(time) {
    const th = S.THEMES[theme.idx];
    const el = Math.max(0, (sNow() - theme.start) / 1000), beat = (el * th.bpm) / 60;
    return { theme: th, themeIdx: theme.idx, time, beat, bass: Math.exp(-(beat % 1) * 5) };
  }

  function drawWorld(c, st, dt, nowMs) {
    Scene.update(dt, st);
    Scene.drawBack(c, st);
    Scene.drawLights(c, st);
    const items = [];
    const owners = seatOwner();
    const chairCols = [Char.shade(st.theme.palette[0], -95), Char.shade(st.theme.palette[2], -95), Char.shade(st.theme.palette[2], -95)];
    for (const s of S.SEATS) items.push({ y: s.y, d: () => Char.drawChair(c, s.x, s.y, owners.has(s.id), chairCols[s.stand]) });
    for (const p of players.values()) {
      const seat = p.seat >= 0 ? S.SEATS[p.seat] : null;
      if (seat && !p.mine) { p.vx = seat.x; p.vy = seat.y; }
      if (seat && p.mine) { p.x = seat.x; p.y = seat.y; p.vx = seat.x; p.vy = seat.y; }
      items.push({ y: (seat ? seat.y + 0.5 : p.vy), d: () => Char.draw(c, p.look, {
        x: p.vx, y: p.vy, scale: PSCALE, time: st.time + p.id, beat: st.beat, dance: p.dance, sitting: !!seat, moving: p.moving && !seat,
        accent: st.theme.palette[p.id % 4], pulse: st.bass, seed: p.id,
      }) });
    }
    for (const s of stars.values()) items.push({ y: s.y, d: () => Char.drawStar(c, s.x, s.y, s.gold, st.time) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.d();
    if (mode === 'world') for (const p of players.values()) drawLabel(c, p, nowMs);
    // điểm bay
    for (const f of floats) { c.globalAlpha = Math.max(0, 1 - f.life / 1.6); c.font = '900 24px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#000'; c.strokeText(f.text, f.x, f.y); c.fillStyle = f.color; c.fillText(f.text, f.x, f.y); c.globalAlpha = 1; }
    Scene.drawFront(c, st);
  }

  // Xem trước nhân vật trong menu
  const pc = $('preview'), pctx = pc.getContext('2d');
  function drawPreview(t) {
    pctx.clearRect(0, 0, 300, 340);
    const g = pctx.createRadialGradient(150, 120, 20, 150, 200, 260); g.addColorStop(0, 'rgba(255,61,154,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    pctx.fillStyle = g; pctx.fillRect(0, 0, 300, 340);
    pctx.fillStyle = 'rgba(255,255,255,.07)'; pctx.beginPath(); pctx.ellipse(150, 312, 90, 16, 0, 0, Math.PI * 2); pctx.fill();
    Char.draw(pctx, draft, { x: 150, y: 308, scale: 2.5, time: t, beat: t * 2, dance: previewDance, sitting: false, moving: false, accent: '#ff7be5', pulse: Math.exp(-((t * 2) % 1) * 5), seed: 1 });
  }

  let last = performance.now(), hudT = 0;
  function frame(nowMs) {
    const dt = Math.min(0.05, (nowMs - last) / 1000); last = nowMs;
    const time = nowMs / 1000;
    if (mode === 'menu' && sNow() - theme.start > theme.dur) theme = { idx: (theme.idx + 1) % S.THEMES.length, start: sNow(), dur: S.THEME_DURATION };
    updatePlayers(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05030c'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(DPR * SC, 0, 0, DPR * SC, OX * DPR, OY * DPR);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S.WORLD.w, S.WORLD.h); ctx.clip();
    drawWorld(ctx, currentState(time), dt, nowMs);
    ctx.restore();
    Screen.place(OX, OY, SC, mode === 'world');
    if (!$('menu').hidden && draft) drawPreview(time);
    // HUD văn bản
    if (mode === 'world' && nowMs - hudT > 250) {
      hudT = nowMs;
      $('hudTheme').textContent = S.THEMES[theme.idx].name;
      $('hudTimer').textContent = 'Đổi chủ đề sau ' + fmtTime(Math.max(0, theme.dur - (sNow() - theme.start)) / 1000);
      $('hudNow').textContent = video ? '♪ ' + (Screen.title() || 'Đang tải video…') : '';
      $('hudOnline').textContent = '👥 ' + players.size;
      document.querySelectorAll('.dbtn').forEach((b) => b.classList.toggle('on', me && me.dance === +b.dataset.m));
    }
    requestAnimationFrame(frame);
  }
  /* ================= Màn hình YouTube & nhạc ================= */
  function wantSynth() { return !video || Screen.state() === 'failed'; }
  function syncAudio() {
    if (mode !== 'world') return;
    if (wantSynth()) ConcertAudio.setTheme(S.THEMES[theme.idx], theme.start); else ConcertAudio.stop();
  }
  function handleVideo(v, q) { video = v || null; if (q != null) queueN = q; Screen.set(video); syncAudio(); updateMusicUI(); }
  function updateMusicUI() { $('queueInfo').textContent = queueN ? `Hàng chờ: ${queueN} bài` : 'Hàng chờ trống – dán link để thêm bài'; }
  $('btnMusic').onclick = () => { $('musicPanel').hidden = !$('musicPanel').hidden; if (!$('musicPanel').hidden) $('ytUrl').focus(); };
  $('musicForm').onsubmit = (e) => { e.preventDefault(); const u = $('ytUrl').value.trim(); if (u) { send({ k: 'vadd', url: u }); $('ytUrl').value = ''; } };
  $('btnSkip').onclick = () => send({ k: 'vskip' });
  Screen.init({
    now: sNow,
    onEnd: (id) => send({ k: 'vend', id }),
    onFail: (id) => send({ k: 'vfail', id }),
    onState: (s) => { if (s === 'failed') syncAudio(); },
  });
  updateMusicUI();

  requestAnimationFrame(frame);
  connect();

  // phục vụ kiểm thử
  window.__game = { forceTheme(i) { theme = { idx: i, start: sNow(), dur: S.THEME_DURATION }; Scene.setTheme(i, true); }, get me() { return me; }, players, doDance, goToSeat, get mode() { return mode; } };
})();
