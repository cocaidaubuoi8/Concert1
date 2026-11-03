// Bản chơi thử: giả lập server ngay trong trang (có 7 người chơi máy)
(() => {
  const S = SHARED, rnd = (a, b) => a + Math.random() * (b - a), pick = (a) => a[(Math.random() * a.length) | 0];
  class MockSocket {
    constructor() {
      this.readyState = 0; this.world = null;
      this.profile = { name: 'Khách' + ((1000 + Math.random() * 9000) | 0), look: S.defaultLook(), points: 100, owned: [...S.FREE_ITEMS] };
      setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 50);
    }
    emit(m) { const d = JSON.stringify(m); setTimeout(() => this.onmessage && this.onmessage({ data: d }), 0); }
    close() {}
    send(raw) {
      const m = JSON.parse(raw), P = this.profile, w = this.world;
      switch (m.k) {
        case 'hello': return this.emit({ k: 'welcome', token: 'demo', profile: P, online: 8 });
        case 'save': {
          const n = S.sanitizeName(m.name); if (n) P.name = n;
          P.look = S.sanitizeLook(m.look, P.owned); this.emit({ k: 'profile', profile: P });
          if (w) { w.me.look = P.look; w.me.name = P.name; this.emit({ k: 'look', id: 1, name: P.name, look: P.look }); }
          return;
        }
        case 'buy': {
          const it = S.ITEM_BY_ID[m.id]; if (!it || P.owned.includes(it.id)) return;
          if (P.points < it.price) return this.emit({ k: 'err', msg: 'Chưa đủ điểm – quẩy thêm để kiếm điểm nhé!' });
          P.points -= it.price; P.owned.push(it.id); return this.emit({ k: 'profile', profile: P, bought: it.id });
        }
        case 'enter': return this.enter();
        case 'leave': return this.stop();
      }
      if (!w) return;
      const me = w.me;
      if (m.k === 'move') {
        const [x, y] = S.clampPos(+m.x, +m.y);
        if (me.seat >= 0 && Math.hypot(x - me.x, y - me.y) > 6) this.stand(me);
        me.x = x; me.y = y;
      } else if (m.k === 'sit') this.sit(me, m.seat | 0);
      else if (m.k === 'stand') this.stand(me);
      else if (m.k === 'dance') { me.dance = m.m | 0; me.until = Date.now() + 10000; if (!m.m) me.acc = 0; }
      else if (m.k === 'chat') {
        const t = String(m.text || '').slice(0, 60); if (!t) return;
        this.emit({ k: 'chat', id: 1, text: t });
        setTimeout(() => { const b = pick(w.bots); this.emit({ k: 'chat', id: b.id, text: pick(['Quẩy lên nào! 🔥', 'Bài này đỉnh quá!', 'Ai nhặt được sao vàng chưa?', 'Hello bạn mới!', 'Lightstick đẹp ghê 😍']) }); }, 1200);
      }
    }
    stand(p) { if (p.seat >= 0) { this.world.seats[p.seat] = null; p.seat = -1; this.emit({ k: 'sit', id: p.id, seat: -1 }); } }
    sit(p, id) {
      const s = S.SEATS[id], w = this.world; if (!s) return;
      if (w.seats[id] && w.seats[id] !== p.id) { if (p.id === 1) this.emit({ k: 'err', msg: 'Ghế này đã có người ngồi rồi!' }); return; }
      if (Math.hypot(p.x - s.x, p.y - s.y) > 140) return;
      if (p.seat >= 0) w.seats[p.seat] = null;
      w.seats[id] = p.id; p.seat = id; p.x = s.x; p.y = s.y; this.emit({ k: 'sit', id: p.id, seat: id, x: s.x, y: s.y });
    }
    pub(p) { return { id: p.id, name: p.name, look: p.look, x: p.x | 0, y: p.y | 0, seat: p.seat, dance: p.dance }; }
    enter() {
      if (this.world) return;
      const names = ['Mai Linh', 'Bảo An', 'Khánh Vy', 'Đức Minh', 'Thu Hà', 'Quốc Việt', 'Ngọc Trâm'];
      const w = this.world = { seats: new Array(S.SEATS.length).fill(null), stars: new Map(), starSeq: 1, theme: { idx: (Math.random() * 6) | 0, start: Date.now(), dur: S.THEME_DURATION }, t: 0 };
      w.me = { id: 1, name: this.profile.name, look: this.profile.look, x: S.GATE.x + rnd(-40, 40), y: S.GATE.y, seat: -1, dance: 0, until: 0, acc: 0, pend: 0, why: '' };
      const toy = [{ hat: 'hat_bunny' }, { hat: 'hat_crown', top: 'top_idol', stick: 'stick_star' }, { face: 'face_sun', top: 'top_jacket', stick: 'stick_sword' }, { hat: 'hat_cat', back: 'back_wings' }, { top: 'top_sequin', stick: 'stick_heart' }, { hat: 'hat_cowboy', stick: 'stick_bear' }, { back: 'back_cape', stick: 'stick_rainbow', face: 'face_heart' }];
      w.bots = names.map((n, i) => {
        const look = Object.assign(S.sanitizeLook({ skin: (Math.random() * 6) | 0, hairStyle: (Math.random() * 6) | 0, hairColor: (Math.random() * 10) | 0, eyes: (Math.random() * 4) | 0, shirt: (Math.random() * 10) | 0 }, null), toy[i]);
        const b = { id: 100 + i, name: n, look, x: rnd(250, 1670), y: rnd(620, 760), seat: -1, dance: 0, until: 0, tx: 0, ty: 0, wait: rnd(0, 3) };
        if (i % 3 === 2) { const s = S.SEATS[(Math.random() * S.SEATS.length) | 0]; if (!w.seats[s.id]) { w.seats[s.id] = b.id; b.seat = s.id; b.x = s.x; b.y = s.y; } }
        b.tx = b.x; b.ty = b.y; return b;
      });
      this.emit({ k: 'joined', id: 1, room: 1, now: Date.now(), theme: w.theme, players: [w.me, ...w.bots].map((p) => this.pub(p)), stars: [] });
      this.tick100 = setInterval(() => this.snap(), 100);
      this.tick1000 = setInterval(() => this.second(), 1000);
    }
    stop() { clearInterval(this.tick100); clearInterval(this.tick1000); this.world = null; }
    snap() {
      const w = this.world; if (!w) return; const now = Date.now();
      for (const b of w.bots) {
        if (b.seat < 0) { const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy); if (d > 3) { b.x += (dx / d) * 120 * 0.1; b.y += (dy / d) * 120 * 0.1; } }
        b.wait -= 0.1;
        if (b.wait <= 0) {
          b.wait = rnd(3, 9);
          const r = Math.random();
          if (r < 0.2 && b.seat < 0) { const free = S.SEATS.filter((s) => !w.seats[s.id]); const s = pick(free); if (s) { b.x = s.x; b.y = s.y + 8; this.sit(b, s.id); } }
          else if (r < 0.35 && b.seat >= 0) this.stand(b);
          else if (b.seat < 0) { b.tx = rnd(560, 1360); b.ty = rnd(620, 780); }
          if (Math.random() < 0.7) { b.dance = 1 + ((Math.random() * 5) | 0); b.until = now + rnd(5000, 12000); }
        }
        if (b.dance && now > b.until) b.dance = 0;
      }
      if (w.me.dance && now > w.me.until) w.me.dance = 0;
      const arr = [w.me, ...w.bots].map((p) => [p.id, p.x | 0, p.y | 0, p.seat, p.dance]);
      this.emit({ k: 's', now, p: arr });
      for (const st of [...w.stars.values()]) if (Math.hypot(w.me.x - st.x, w.me.y - st.y) < 38) {
        w.stars.delete(st.id); const n = st.gold ? 15 : 5; this.profile.points += n;
        this.emit({ k: 'starx', id: st.id, by: 1 }); this.emit({ k: 'pts', n, why: st.gold ? 'Sao vàng!' : 'Nhặt sao', total: this.profile.points });
      }
    }
    second() {
      const w = this.world; if (!w) return; const now = Date.now(); w.t++;
      if (now - w.theme.start >= S.THEME_DURATION) {
        w.theme = { idx: (w.theme.idx + 1 + ((Math.random() * 5) | 0)) % 6, start: now, dur: S.THEME_DURATION };
        this.emit({ k: 'theme', theme: w.theme, now }); w.me.pend += 15; w.me.why = 'Chủ đề mới – cả khán đài bùng nổ!';
      }
      const me = w.me, cnt = w.bots.filter((b) => b.dance === me.dance && b.dance).length + 1;
      if (me.dance && now <= me.until && ++me.acc >= 3) { me.acc = 0; me.pend += 1; me.why = 'Quẩy hết mình'; if (cnt >= 3) { me.pend += 1; me.why = 'Đồng điệu x' + cnt; } }
      if (w.t % 20 === 0) { me.pend += 1; me.why = 'Có mặt tại concert'; }
      if (me.pend) { this.profile.points += me.pend; this.emit({ k: 'pts', n: me.pend, why: me.why, total: this.profile.points }); me.pend = 0; }
      if (w.t % 6 === 0 && w.stars.size < 6) {
        const st = { id: w.starSeq++, x: Math.round(rnd(80, 1840)), y: 0, gold: Math.random() < 0.2 };
        st.y = Math.round(rnd(600, 790)); w.stars.set(st.id, st); this.emit({ k: 'star', s: st });
        setTimeout(() => { if (w.stars.delete(st.id)) this.emit({ k: 'starx', id: st.id }); }, 30000);
      }
    }
  }
  window.WebSocket = MockSocket;
})();
