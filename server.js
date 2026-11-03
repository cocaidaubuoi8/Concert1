// Server Concert Online: HTTP tĩnh + WebSocket realtime
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const S = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'profiles.json');

/* ---------------- Hồ sơ người chơi (lưu file JSON) ---------------- */
let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { profiles = {}; }
let dirty = false;
function saveProfiles() {
  if (!dirty) return;
  dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(profiles));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) { console.error('Lỗi lưu hồ sơ', e.message); }
}
setInterval(saveProfiles, 5000);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveProfiles(); process.exit(0); });

function getProfile(token) {
  if (token && profiles[token]) return [token, profiles[token]];
  token = crypto.randomBytes(16).toString('hex');
  profiles[token] = {
    name: 'Khách' + Math.floor(1000 + Math.random() * 9000),
    look: S.defaultLook(),
    points: 100, // điểm khởi đầu để mua món đầu tiên
    owned: [...S.FREE_ITEMS],
    created: Date.now(),
  };
  dirty = true;
  return [token, profiles[token]];
}

/* ---------------- Phòng concert ---------------- */
// Danh sách phát mặc định (có thể sửa). Video không cho nhúng sẽ tự bị bỏ qua.
const DEFAULT_PLAYLIST = ['bM7SZ5SBzyY', '3nQNiWdeH2Q', 'EP625xQIGzs', 'TW9d8vYrVFQ'];
function ytId(s) {
  s = String(s || '').trim().slice(0, 200);
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})(?![\w-])/);
  if (m) return m[1];
  return /^[\w-]{11}$/.test(s) ? s : null;
}
class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.seats = new Array(S.SEATS.length).fill(null);
    this.stars = new Map();
    this.starSeq = 1;
    this.themeIdx = Math.floor(Math.random() * S.THEMES.length);
    this.themeStart = Date.now();
    this.lastStar = Date.now();
    this.playIdx = Math.floor(Math.random() * DEFAULT_PLAYLIST.length);
    this.video = { id: DEFAULT_PLAYLIST[this.playIdx], start: Date.now(), by: '' };
    this.queue = [];
    this.lastSkip = 0;
  }
  get count() { return this.players.size; }
  broadcast(msg, except) {
    const str = JSON.stringify(msg);
    for (const p of this.players.values()) if (p !== except && p.ws.readyState === 1) p.ws.send(str);
  }
  themeInfo() { return { idx: this.themeIdx, start: this.themeStart, dur: S.THEME_DURATION }; }
  publicPlayer(p) {
    return { id: p.id, name: p.profile.name, look: p.look, x: p.x | 0, y: p.y | 0, seat: p.seat, dance: p.dance, g: p.gold };
  }
  addPlayer(p) {
    p.room = this;
    if (this.players.size === 0) { this.video.start = Date.now(); this.themeStart = Date.now(); }
    p.x = S.GATE.x + (Math.random() * 80 - 40);
    p.y = S.GATE.y;
    p.seat = -1; p.dance = 0; p.danceUntil = 0; p.lastMove = Date.now();
    this.players.set(p.id, p);
    send(p.ws, {
      k: 'joined', id: p.id, room: this.id, now: Date.now(),
      theme: this.themeInfo(), video: this.video, queue: this.queue.length,
      players: [...this.players.values()].map((q) => this.publicPlayer(q)),
      stars: [...this.stars.values()],
    });
    this.broadcast({ k: 'pj', p: this.publicPlayer(p) }, p);
  }
  removePlayer(p) {
    if (!this.players.has(p.id)) return;
    this.standUp(p);
    this.players.delete(p.id);
    p.room = null;
    this.broadcast({ k: 'pl', id: p.id });
  }
  standUp(p) {
    if (p.seat >= 0) { this.seats[p.seat] = null; p.seat = -1; this.broadcast({ k: 'sit', id: p.id, seat: -1 }); }
  }
  sit(p, seatId) {
    seatId = seatId | 0;
    const seat = S.SEATS[seatId];
    if (!seat) return;
    if (this.seats[seatId] && this.seats[seatId] !== p.id) return send(p.ws, { k: 'err', msg: 'Ghế này đã có người ngồi rồi!' });
    if (Math.hypot(p.x - seat.x, p.y - seat.y) > 140) return;
    if (p.seat >= 0) this.seats[p.seat] = null;
    this.seats[seatId] = p.id;
    p.seat = seatId; p.x = seat.x; p.y = seat.y;
    this.broadcast({ k: 'sit', id: p.id, seat: seatId, x: seat.x, y: seat.y });
  }
  changeTheme(withPts) {
    const now = Date.now();
    let n; do { n = Math.floor(Math.random() * S.THEMES.length); } while (n === this.themeIdx && S.THEMES.length > 1);
    this.themeIdx = n; this.themeStart = now;
    this.broadcast({ k: 'theme', theme: this.themeInfo(), now });
    if (withPts) for (const p of this.players.values()) this.addPts(p, 15, 'Chủ đề mới – cả khán đài bùng nổ!');
  }
  nextVideo() {
    const nx = this.queue.shift();
    if (nx) this.video = { id: nx.id, start: Date.now(), by: nx.by };
    else { this.playIdx = (this.playIdx + 1) % DEFAULT_PLAYLIST.length; this.video = { id: DEFAULT_PLAYLIST[this.playIdx], start: Date.now(), by: '' }; }
    this.broadcast({ k: 'video', v: this.video, q: this.queue.length, now: Date.now() });
    this.changeTheme(false);
  }
  addPts(p, n, why) {
    p.pend += n; p.pendWhy = why || p.pendWhy;
  }

  // Mỗi 100ms: gửi snapshot vị trí
  snapshot() {
    const now = Date.now();
    const arr = [];
    for (const p of this.players.values()) {
      if (p.dance && now > p.danceUntil) p.dance = 0;
      arr.push([p.id, p.x | 0, p.y | 0, p.seat, p.dance]);
    }
    this.broadcast({ k: 's', now, p: arr });
  }

  // Mỗi 1s: tính điểm, đổi chủ đề, sinh sao
  second() {
    const now = Date.now();
    // đổi chủ đề theo giờ
    if (now - this.themeStart >= S.THEME_DURATION) this.changeTheme(true);
    // đếm số người cùng điệu để thưởng "đồng điệu"
    const cnt = [0, 0, 0, 0, 0, 0];
    for (const p of this.players.values()) if (p.dance && now <= p.danceUntil) cnt[p.dance]++;
    for (const p of this.players.values()) {
      p.t++;
      if (p.dance && now <= p.danceUntil) {
        p.danceAcc++;
        if (p.danceAcc >= 3) {
          p.danceAcc = 0;
          this.addPts(p, 1, 'Quẩy hết mình');
          if (cnt[p.dance] >= 3) this.addPts(p, 1, 'Đồng điệu x' + cnt[p.dance]);
        }
      }
      if (p.t % 20 === 0) this.addPts(p, 1, 'Có mặt tại concert');
      if (p.pend > 0) {
        p.profile.points += p.pend; dirty = true;
        send(p.ws, { k: 'pts', n: p.pend, why: p.pendWhy, total: p.profile.points });
        p.pend = 0;
      }
    }
    // sao rơi (nhặt để lấy điểm)
    if (this.count > 0 && now - this.lastStar > 6000 && this.stars.size < 6) {
      this.lastStar = now;
      const st = {
        id: this.starSeq++,
        x: Math.round(S.BOUNDS.x1 + 80 + Math.random() * (S.BOUNDS.x2 - S.BOUNDS.x1 - 160)),
        y: 0,
        gold: Math.random() < 0.2,
      };
      st.y = Math.round(S.BOUNDS.y1 + 25 + Math.random() * 215);
      this.stars.set(st.id, st);
      this.broadcast({ k: 'star', s: st });
    }
    // hết hạn sao (30s)
    for (const st of this.stars.values()) {
      if (!st.born) st.born = now;
      if (now - st.born > 30000) { this.stars.delete(st.id); this.broadcast({ k: 'starx', id: st.id }); }
    }
  }
  collectStars() {
    for (const st of this.stars.values()) {
      for (const p of this.players.values()) {
        if (Math.hypot(p.x - st.x, p.y - st.y) < 38) {
          this.stars.delete(st.id);
          const n = st.gold ? 15 : 5;
          p.profile.points += n; dirty = true;
          this.broadcast({ k: 'starx', id: st.id, by: p.id });
          send(p.ws, { k: 'pts', n, why: st.gold ? 'Sao vàng!' : 'Nhặt sao', total: p.profile.points });
          break;
        }
      }
    }
  }
}

const rooms = [];
function findRoom() {
  for (const r of rooms) if (r.count < S.MAX_PLAYERS_PER_ROOM) return r;
  const r = new Room(rooms.length + 1);
  rooms.push(r);
  return r;
}
setInterval(() => rooms.forEach((r) => { r.collectStars(); r.snapshot(); }), 100);
setInterval(() => rooms.forEach((r) => r.second()), 1000);

/* ---------------- HTTP tĩnh ---------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/healthz') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

/* ---------------- WebSocket ---------------- */
const wss = new WebSocketServer({ server, maxPayload: 4096 });
let nextId = 1;
function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

wss.on('connection', (ws) => {
  const p = {
    id: nextId++, ws, token: null, profile: null, look: null, room: null,
    x: 0, y: 0, seat: -1, dance: 0, danceUntil: 0, danceAcc: 0, t: 0, pend: 0, pendWhy: '',
    lastMove: 0, lastChat: 0, bucket: 40, bucketT: Date.now(), alive: true, gold: false,
  };
  ws.on('pong', () => (p.alive = true));

  ws.on('message', (raw) => {
    // giới hạn tốc độ tin nhắn
    const now = Date.now();
    p.bucket = Math.min(40, p.bucket + ((now - p.bucketT) / 1000) * 30);
    p.bucketT = now;
    if (--p.bucket < 0) return;

    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.k !== 'string') return;

    if (m.k === 'hello') {
      const [token, prof] = getProfile(typeof m.token === 'string' ? m.token : null);
      p.token = token; p.profile = prof; p.look = S.sanitizeLook(prof.look, prof.owned);
      return send(ws, { k: 'welcome', token, profile: prof, online: wss.clients.size });
    }
    if (!p.profile) return;

    switch (m.k) {
      case 'save': { // lưu tên + ngoại hình
        const name = S.sanitizeName(m.name);
        if (name) p.profile.name = name;
        p.profile.look = S.sanitizeLook(m.look, p.profile.owned);
        p.look = p.profile.look; dirty = true;
        send(ws, { k: 'profile', profile: p.profile });
        if (p.room) p.room.broadcast({ k: 'look', id: p.id, name: p.profile.name, look: p.look });
        break;
      }
      case 'buy': {
        const it = S.ITEM_BY_ID[m.id];
        if (!it) return;
        if (p.profile.owned.includes(it.id)) return send(ws, { k: 'err', msg: 'Bạn đã có món này rồi.' });
        if (p.profile.points < it.price) return send(ws, { k: 'err', msg: 'Chưa đủ điểm – quẩy thêm để kiếm điểm nhé!' });
        p.profile.points -= it.price; p.profile.owned.push(it.id); dirty = true;
        send(ws, { k: 'profile', profile: p.profile, bought: it.id });
        break;
      }
      case 'enter': {
        if (p.room) return;
        findRoom().addPlayer(p);
        break;
      }
      case 'leave': if (p.room) p.room.removePlayer(p); break;
      case 'move': {
        const r = p.room; if (!r) return;
        let x = +m.x, y = +m.y;
        if (!isFinite(x) || !isFinite(y)) return;
        [x, y] = S.clampPos(x, y);
        const dt = Math.min(1000, now - p.lastMove); p.lastMove = now;
        const maxd = (S.SPEED * dt) / 1000 * 1.6 + 24;
        const d = Math.hypot(x - p.x, y - p.y);
        if (d > maxd) { x = p.x + ((x - p.x) * maxd) / d; y = p.y + ((y - p.y) * maxd) / d; }
        if (p.seat >= 0 && d > 6) r.standUp(p);
        p.x = x; p.y = y;
        break;
      }
      case 'sit': if (p.room) p.room.sit(p, m.seat); break;
      case 'stand': if (p.room) p.room.standUp(p); break;
      case 'dance': {
        if (!p.room) return;
        const d = m.m | 0;
        if (d < 0 || d > 5) return;
        p.dance = d; p.danceUntil = now + 10000; if (!d) p.danceAcc = 0;
        break;
      }
      case 'vadd': { // thêm bài YouTube vào hàng chờ
        const r = p.room; if (!r) return;
        const id = ytId(m.url);
        if (!id) return send(ws, { k: 'err', msg: 'Link YouTube không hợp lệ.' });
        if (now - (p.lastVadd || 0) < 8000) return send(ws, { k: 'err', msg: 'Thêm bài hơi nhanh, đợi vài giây nhé.' });
        if (r.queue.length >= 8) return send(ws, { k: 'err', msg: 'Hàng chờ đã đầy (8 bài).' });
        p.lastVadd = now;
        r.queue.push({ id, by: p.profile.name });
        r.broadcast({ k: 'queue', n: r.queue.length, by: p.profile.name });
        break;
      }
      case 'vskip': {
        const r = p.room; if (!r) return;
        if (now - r.lastSkip < 15000) return send(ws, { k: 'err', msg: 'Vừa chuyển bài xong, đợi một chút nhé.' });
        r.lastSkip = now; r.nextVideo();
        break;
      }
      case 'vend': case 'vfail': {
        const r = p.room; if (!r || m.id !== r.video.id) return;
        if (m.k === 'vend' && now - r.video.start < 5000) return;
        if (m.k === 'vfail') r.broadcast({ k: 'vfail', id: r.video.id });
        r.nextVideo();
        break;
      }
      case 'chat': {
        if (!p.room || now - p.lastChat < 800) return;
        const text = String(m.text || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
        if (!text) return;
        p.lastChat = now;
        p.room.broadcast({ k: 'chat', id: p.id, text });
        break;
      }
    }
  });

  ws.on('close', () => { if (p.room) p.room.removePlayer(p); });
  ws.on('error', () => {});
});

setInterval(() => {
  wss.clients.forEach((ws) => ws.ping());
}, 30000);

server.listen(PORT, () => console.log(`🎤 Concert Online chạy tại http://localhost:${PORT}`));
