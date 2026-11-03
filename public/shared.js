// Dữ liệu dùng chung giữa server (Node) và client (trình duyệt)
const SHARED = (() => {
  const WORLD = { w: 1920, h: 1080 };
  const CX = WORLD.w / 2;
  const BOUNDS = { x1: 20, x2: 1900, y1: 576, y2: 1066 };
  const GATE = { x: CX, y: 1062 };
  const SPEED = 210;
  const MAX_PLAYERS_PER_ROOM = 80;
  const THEME_DURATION = 150000; // 2,5 phút / chủ đề

  // Màn LED lớn của sân khấu và khung video YouTube (16:9) nằm giữa màn LED
  const WALL = { x: 480, y: 62, w: 960, h: 340 };
  const SCREEN = { x: CX - 267, y: 80, w: 534, h: 300 };

  // Hàng rào trước sân khấu: người chơi không đi lên sân khấu
  const FENCE_Y = 566;
  function stageFrontY() { return FENCE_Y; }
  function clampPos(x, y) {
    x = Math.max(BOUNDS.x1, Math.min(BOUNDS.x2, x));
    y = Math.max(BOUNDS.y1, Math.min(BOUNDS.y2, y));
    return [x, y];
  }

  // ---- Khán đài ----
  // A: hình chữ nhật dưới giữa (4 hàng, lối thảm đỏ ở giữa).
  // B, C: hình chữ nhật xoay chéo, các hàng ghế quay mặt về phía sân khấu.
  const SEATS = [], STANDS = [];
  const addSeat = (x, y, row, stand) => SEATS.push({ id: SEATS.length, x, y, row, stand });
  const rowsA = [806, 868, 930, 992];
  rowsA.forEach((y, row) => {
    for (let i = 0; i < 6; i++) { addSeat(884 - 56 * i, y, row, 0); addSeat(WORLD.w - (884 - 56 * i), y, row, 0); }
  });
  STANDS.push({
    name: 'A', poly: [[580, 750], [1340, 750], [1340, 1012], [580, 1012]],
    tiers: rowsA.map((y) => [[580, y + 6], [1340, y + 6]]), label: [CX, 736],
  });
  const L = 200, D = 128, TARGET = [CX, 520];
  function rotStand(name, idx, cx, cy, mirror) {
    // hướng nhìn f (về phía sân khấu) và hướng hàng r (vuông góc f)
    let fx = TARGET[0] - cx, fy = TARGET[1] - cy; const n = Math.hypot(fx, fy); fx /= n; fy /= n;
    let rx = -fy, ry = fx;
    const pt = (u, v) => [cx + u * rx + v * fx, cy + u * ry + v * fy];
    const mx = (p) => (mirror ? [WORLD.w - p[0], p[1]] : p);
    for (let k = 0; k < 4; k++) {
      const v = 96 - 64 * k;
      for (let j = 0; j < 7; j++) { const p = mx(pt(-168 + 56 * j, v)); addSeat(Math.round(p[0]), Math.round(p[1]), k, idx); }
    }
    STANDS.push({
      name, poly: [pt(-L, -D), pt(L, -D), pt(L, D), pt(-L, D)].map(mx),
      tiers: [0, 1, 2, 3].map((k) => [mx(pt(-L, 96 - 64 * k - 34)), mx(pt(L, 96 - 64 * k - 34))]),
      label: mx(pt(0, D + 84)),
    });
  }
  rotStand('B', 1, 330, 820, false);
  rotStand('C', 2, 330, 820, true);

  const SKINS = ['#ffe0c7', '#f6caa4', '#e5a97b', '#c98a5b', '#8d5a3b', '#5e3a28'];
  const HAIRS = ['#1b1b2f', '#4a2c1a', '#8b5a2b', '#e8c27a', '#ff5d8f', '#6c5ce7', '#00b4d8', '#2ec4b6', '#f1f3f5', '#ff7b00'];
  const SHIRTS = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#9775fa', '#f783ac', '#e9ecef', '#343a40'];
  const HAIR_STYLES = ['Ngắn', 'Dài', 'Hai bím', 'Búi tó', 'Tóc gai', 'Bob'];
  const EYES = ['Tròn', 'Cười', 'Lấp lánh', 'Ngầu'];

  const THEMES = [
    { id: 'neon', name: 'Neon Pop', bpm: 118, palette: ['#ff2e93', '#00e5ff', '#b967ff', '#ffe600'] },
    { id: 'rock', name: 'Rock Lửa', bpm: 140, palette: ['#ff3d00', '#ff9100', '#ffd600', '#ff1744'] },
    { id: 'edm', name: 'EDM Laser', bpm: 128, palette: ['#00ff85', '#7c4dff', '#00e5ff', '#ff00e6'] },
    { id: 'sakura', name: 'Sakura K-Pop', bpm: 108, palette: ['#ff8fb8', '#ffc2d9', '#c3a6ff', '#fff1a8'] },
    { id: 'ballad', name: 'Đêm Sao Ballad', bpm: 76, palette: ['#5b8cff', '#ffd166', '#9b8cff', '#7de2ff'] },
    { id: 'disco', name: 'Disco 80s', bpm: 116, palette: ['#ffc400', '#ff2d95', '#26c6da', '#ffffff'] },
  ];

  // slot: hat | top | face | stick | back
  const ITEMS = [
    { id: 'hat_cap', slot: 'hat', name: 'Mũ lưỡi trai', price: 40, c: ['#ff4d6d', '#ffffff'] },
    { id: 'hat_headband', slot: 'hat', name: 'Băng đô lửa', price: 60, c: ['#ffd23f', '#ff3b3b'] },
    { id: 'hat_bunny', slot: 'hat', name: 'Tai thỏ', price: 80, c: ['#ffffff', '#ffb3c6'] },
    { id: 'hat_cat', slot: 'hat', name: 'Tai mèo', price: 80, c: ['#2b2b3a', '#ff8fab'] },
    { id: 'hat_cowboy', slot: 'hat', name: 'Mũ cao bồi', price: 150, c: ['#8b5a2b', '#d9a066'] },
    { id: 'hat_halo', slot: 'hat', name: 'Vòng thiên thần', price: 200, c: ['#ffe066', '#fff3b0'] },
    { id: 'hat_crown', slot: 'hat', name: 'Vương miện', price: 300, c: ['#ffd700', '#ff4d6d'] },

    { id: 'top_tee', slot: 'top', name: 'Áo concert đỏ', price: 60, c: ['#e8274b', '#ffffff'] },
    { id: 'top_hoodie', slot: 'top', name: 'Hoodie tím', price: 100, c: ['#5b5bd6', '#ffffff'] },
    { id: 'top_jersey', slot: 'top', name: 'Áo đội tuyển', price: 120, c: ['#14a38b', '#ffffff'] },
    { id: 'top_sequin', slot: 'top', name: 'Áo kim tuyến', price: 200, c: ['#b266ff', '#ffd6ff'] },
    { id: 'top_jacket', slot: 'top', name: 'Áo khoác da', price: 250, c: ['#1f1f26', '#ff4d6d'] },
    { id: 'top_idol', slot: 'top', name: 'Đồ idol', price: 350, c: ['#ffffff', '#4cc9f0'] },

    { id: 'face_heart', slot: 'face', name: 'Vẽ tim má', price: 40, c: ['#ff4d6d'] },
    { id: 'face_sun', slot: 'face', name: 'Kính râm', price: 50, c: ['#111111'] },
    { id: 'face_star', slot: 'face', name: 'Kính ngôi sao', price: 60, c: ['#ffd43b'] },
    { id: 'face_glitter', slot: 'face', name: 'Nhũ lấp lánh', price: 70, c: ['#ffffff'] },
    { id: 'face_mask', slot: 'face', name: 'Mặt nạ dạ hội', price: 90, c: ['#7048e8'] },

    { id: 'stick_basic', slot: 'stick', name: 'Lightstick cơ bản', price: 0, c: ['#ffffff'] },
    { id: 'stick_heart', slot: 'stick', name: 'Lightstick trái tim', price: 80, c: ['#ff4d8d'] },
    { id: 'stick_star', slot: 'stick', name: 'Lightstick ngôi sao', price: 100, c: ['#ffd43b'] },
    { id: 'stick_bear', slot: 'stick', name: 'Lightstick gấu', price: 150, c: ['#c98a5b'] },
    { id: 'stick_sword', slot: 'stick', name: 'Lightstick kiếm', price: 200, c: ['#4dd0ff'] },
    { id: 'stick_rainbow', slot: 'stick', name: 'Lightstick cầu vồng', price: 300, c: ['#ffffff'] },

    { id: 'back_cape', slot: 'back', name: 'Áo choàng', price: 180, c: ['#d6336c', '#ffd43b'] },
    { id: 'back_wings', slot: 'back', name: 'Cánh thiên thần', price: 250, c: ['#ffffff', '#cfe8ff'] },
    { id: 'back_bat', slot: 'back', name: 'Cánh dơi', price: 250, c: ['#3b1f5e', '#9c36b5'] },
  ];
  const ITEM_BY_ID = {};
  ITEMS.forEach((i) => (ITEM_BY_ID[i.id] = i));
  const SLOTS = { hat: 'Mũ', top: 'Áo concert', face: 'Mặt', stick: 'Lightstick', back: 'Lưng' };
  const DANCES = ['', 'Nhảy bật', 'Vẫy lightstick', 'Lắc lư', 'Vỗ tay', 'Headbang'];
  const FREE_ITEMS = ['stick_basic'];

  function defaultLook() {
    return {
      skin: 1, hairStyle: 0, hairColor: 4, eyes: 0, shirt: 5,
      hat: null, top: null, face: null, stick: 'stick_basic', back: null,
    };
  }

  const clampInt = (v, max) => Math.max(0, Math.min(max - 1, v | 0));

  // owned: mảng id đã sở hữu; null = không kiểm tra (dùng cho xem thử ở client)
  function sanitizeLook(l, owned) {
    l = l || {};
    const out = {
      skin: clampInt(l.skin, SKINS.length),
      hairStyle: clampInt(l.hairStyle, HAIR_STYLES.length),
      hairColor: clampInt(l.hairColor, HAIRS.length),
      eyes: clampInt(l.eyes, EYES.length),
      shirt: clampInt(l.shirt, SHIRTS.length),
      hat: null, top: null, face: null, stick: 'stick_basic', back: null,
    };
    for (const slot of Object.keys(SLOTS)) {
      const it = ITEM_BY_ID[l[slot]];
      if (it && it.slot === slot && (!owned || owned.includes(it.id))) out[slot] = it.id;
    }
    return out;
  }

  function sanitizeName(n) {
    n = String(n == null ? '' : n).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
    return n;
  }

  return {
    WORLD, BOUNDS, GATE, SPEED, MAX_PLAYERS_PER_ROOM, THEME_DURATION, SEATS, STANDS, SCREEN, WALL, FENCE_Y, stageFrontY, clampPos,
    SKINS, HAIRS, SHIRTS, HAIR_STYLES, EYES, THEMES, ITEMS, ITEM_BY_ID, SLOTS, DANCES, FREE_ITEMS,
    defaultLook, sanitizeLook, sanitizeName,
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SHARED;
