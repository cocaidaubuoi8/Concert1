// Nhạc concert tổng hợp bằng WebAudio – mỗi chủ đề một thể loại.
// Mọi client dùng chung đồng hồ server nên nhạc và nhịp nhảy khớp nhau.
const ConcertAudio = (() => {
  let ctx = null, master, comp, delay, delayGain, noiseBuf, distCurve;
  let muted = false, vol = 0.6;
  let theme = null, themeStart = 0, nextStep = 0, timer = null, getNow = () => Date.now();

  const PENT_MIN = [0, 3, 5, 7, 10], PENT_MAJ = [0, 2, 4, 7, 9];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

  // Cấu hình nhạc từng chủ đề
  const MUS = {
    neon: { root: 45, pent: PENT_MIN, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.x.x.x.x.x.xx.x', lead: 0.32, leadWave: 'sawtooth', style: 'synth' },
    rock: { root: 40, pent: PENT_MIN, chords: [[0, 7, 12], [-2, 5, 10], [-4, 3, 8], [-2, 5, 10]], kick: 'x...x.x.x...x.xx', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', bass: 'x.x.x.x.x.x.x.x.', lead: 0.22, leadWave: 'sawtooth', style: 'rock' },
    edm: { root: 43, pent: PENT_MIN, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: '..x...x...x...x.', lead: 0.6, leadWave: 'sawtooth', style: 'edm' },
    sakura: { root: 48, pent: PENT_MAJ, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], kick: 'x.......x.x.....', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.....x.x.....x.', lead: 0.5, leadWave: 'triangle', style: 'pop' },
    ballad: { root: 50, pent: PENT_MAJ, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], kick: 'x.......x.......', snare: '........x.......', hat: '....x.......x...', bass: 'x.......x.......', lead: 0.28, leadWave: 'triangle', style: 'ballad' },
    disco: { root: 45, pent: PENT_MIN, chords: [[0, 3, 7, 10], [5, 9, 12, 15], [-2, 2, 5, 9], [3, 7, 10, 14]], kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', bass: 'x.xxx.xxx.xxx.xx', lead: 0.22, leadWave: 'square', style: 'disco' },
  };

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : vol;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    master.connect(comp); comp.connect(ctx.destination);
    delay = ctx.createDelay(1); delay.delayTime.value = 0.28;
    delayGain = ctx.createGain(); delayGain.gain.value = 0.25;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(delayGain); delayGain.connect(master);
    const len = ctx.sampleRate * 1;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; distCurve[i] = Math.tanh(x * 4); }
    return true;
  }

  /* ---- nhạc cụ ---- */
  function env(g, t, a, peak, d, end = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
  function osc(type, f, t, dur, peak, dest, a = 0.005, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (opts.detune) o.detune.value = opts.detune;
    env(g, t, a, peak, dur);
    let node = o;
    if (opts.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opts.lp; o.connect(lp); node = lp; }
    node.connect(g); g.connect(dest || master);
    if (opts.send) { const s = ctx.createGain(); s.gain.value = opts.send; g.connect(s); s.connect(delay); }
    o.start(t); o.stop(t + dur + a + 0.05);
  }
  function noise(t, dur, peak, type, freq, dest) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); env(g, t, 0.002, peak, dur);
    s.connect(f); f.connect(g); g.connect(dest || master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function kick(t, v = 1) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  }
  const snare = (t, v = 1) => { noise(t, 0.16, 0.45 * v, 'bandpass', 1800, master); osc('triangle', 190, t, 0.1, 0.35 * v); };
  const clap = (t) => { for (let i = 0; i < 3; i++) noise(t + i * 0.012, 0.09, 0.3, 'bandpass', 1500, master); };
  const hat = (t, open, v = 1) => noise(t, open ? 0.2 : 0.045, 0.16 * v, 'highpass', 7500, master);

  /* ---- một bước 16 ---- */
  function playStep(step, t, m, idx) {
    const s = step % 16, bar = Math.floor(step / 16);
    const chord = m.chords[bar % m.chords.length];
    const on = (str) => str[s] === 'x';
    const style = m.style;
    const stepDur = 60 / theme.bpm / 4;
    const sidechain = style === 'edm' || style === 'disco';

    if (on(m.kick)) kick(t, style === 'ballad' ? 0.55 : 1);
    if (on(m.snare)) { if (style === 'edm' || style === 'disco') clap(t); else snare(t, style === 'ballad' ? 0.5 : 1); }
    if (on(m.hat)) hat(t, (style === 'edm' || style === 'disco') && s % 4 === 2, style === 'ballad' ? 0.5 : 1);
    if (style === 'rock' && s === 0 && bar % 4 === 0) noise(t, 0.9, 0.2, 'highpass', 5000, master);
    if (style === 'rock' || style === 'pop') { if (s % 2 === 1) hat(t, false, 0.35); }

    // bass
    if (on(m.bass)) {
      let n = m.root + chord[0];
      if (style === 'disco') n += (s % 4 === 0 || s === 11 ? 0 : 12);
      const dur = style === 'ballad' ? stepDur * 7 : stepDur * (style === 'edm' ? 1.7 : 1.5);
      osc(style === 'ballad' || style === 'pop' ? 'sine' : 'sawtooth', mtof(n), t, dur, style === 'ballad' ? 0.3 : 0.28, master, 0.005, { lp: style === 'edm' ? 420 : 700 });
    }
    // hợp âm
    if (style === 'rock') {
      if ('x..x..x.x..x..x.'[s] === 'x') {
        for (const iv of chord) { const o = ctx.createOscillator(), g = ctx.createGain(), ws = ctx.createWaveShaper(); ws.curve = distCurve; o.type = 'sawtooth'; o.frequency.value = mtof(m.root + 12 + iv); env(g, t, 0.004, 0.07, stepDur * 2.2); o.connect(ws); ws.connect(g); g.connect(master); o.start(t); o.stop(t + stepDur * 2.4); }
      }
    } else if (style === 'disco') {
      if ('x..x..x.....x...'[s] === 'x') for (const iv of chord) osc('square', mtof(m.root + 24 + iv), t, stepDur * 1.2, 0.05, master, 0.003, { lp: 3000 });
    } else if (style === 'ballad' || style === 'pop') {
      if (s === 0) for (const iv of chord) { osc('sawtooth', mtof(m.root + 12 + iv), t, stepDur * 16, 0.045, master, 0.4, { lp: 900, detune: -6 }); osc('sawtooth', mtof(m.root + 12 + iv), t, stepDur * 16, 0.04, master, 0.4, { lp: 900, detune: 6 }); }
      // arpeggio piano/chuông
      if (s % 2 === 0) {
        const seq = [0, 1, 2, 1], iv = chord[seq[(s / 2) % 4] % chord.length];
        osc(style === 'ballad' ? 'triangle' : 'sine', mtof(m.root + 24 + iv), t, stepDur * (style === 'ballad' ? 4 : 2.5), style === 'ballad' ? 0.12 : 0.09, master, 0.004, { send: 0.5 });
      }
    } else if (style === 'edm') {
      if (s === 0) for (const iv of chord) osc('sawtooth', mtof(m.root + 12 + iv), t, stepDur * 16, 0.04, master, 0.02, { lp: 1400, detune: 7 });
      // arp 16
      const iv = chord[(s + bar) % chord.length];
      if (s % 2 === 0 || hash(step) < 0.4) osc('sawtooth', mtof(m.root + 24 + iv + (s % 8 > 3 ? 12 : 0)), t, stepDur * 0.9, 0.07, master, 0.003, { lp: 2600, send: 0.4 });
    }

    // giai điệu chính: lặp lại mỗi 4 ô nhịp, xác định theo seed => mọi client nghe giống nhau
    const key = (bar % 4) * 16 + s, seed = idx * 977 + key;
    if (style !== 'ballad' && hash(seed) < m.lead && (style === 'edm' ? s % 2 === 1 : true)) {
      const deg = Math.floor(hash(seed + 5000) * 5), up = hash(seed + 9000) < 0.35 ? 12 : 0;
      osc(m.leadWave, mtof(m.root + 24 + m.pent[deg] + up), t, stepDur * (1.5 + hash(seed + 33) * 2), style === 'rock' ? 0.07 : 0.085, master, 0.004, { lp: 3500, send: 0.45 });
    } else if (style === 'ballad' && s % 4 === 2 && hash(seed) < 0.5) {
      osc('sine', mtof(m.root + 36 + m.pent[Math.floor(hash(seed + 7) * 5)]), t, stepDur * 6, 0.07, master, 0.01, { send: 0.7 });
    }
    // sidechain bơm giả
    if (sidechain && on(m.kick)) { master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(muted ? 0 : vol * 0.55, t); master.gain.linearRampToValueAtTime(muted ? 0 : vol, t + 0.2); }
  }

  function tick() {
    if (!ctx || !theme || ctx.state !== 'running') return;
    const m = MUS[theme.id];
    const stepMs = 60000 / theme.bpm / 4;
    const nowMs = getNow(), el = nowMs - themeStart;
    if (nextStep * stepMs < el - 400) nextStep = Math.floor(el / stepMs) + 1; // bị trễ: nhảy tới
    const ahead = 220;
    const idx = SHARED.THEMES.findIndex((x) => x.id === theme.id);
    while (nextStep * stepMs - el < ahead) {
      const t = ctx.currentTime + (nextStep * stepMs - el) / 1000;
      if (t > ctx.currentTime) playStep(nextStep, t, m, idx);
      nextStep++;
    }
  }

  return {
    init(nowFn) { getNow = nowFn; },
    resume() { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); if (!timer) timer = setInterval(tick, 50); },
    setTheme(th, startMs) { theme = th; themeStart = startMs; nextStep = 0; },
    stop() { theme = null; },
    setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : vol; },
    isMuted: () => muted,
    // hiệu ứng âm thanh
    sfx(name) {
      if (!ctx || ctx.state !== 'running' || muted) return;
      const t = ctx.currentTime;
      if (name === 'coin') { osc('square', 988, t, 0.08, 0.08, master, 0.002); osc('square', 1319, t + 0.07, 0.18, 0.08, master, 0.002); }
      else if (name === 'star') { [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, t + i * 0.06, 0.25, 0.12, master, 0.002, { send: 0.4 })); }
      else if (name === 'buy') { [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.07, 0.3, 0.14, master, 0.002)); }
      else if (name === 'err') { osc('sawtooth', 160, t, 0.18, 0.12, master, 0.002, { lp: 600 }); }
      else if (name === 'cheer') { noise(t, 1.6, 0.35, 'bandpass', 1400, master); noise(t + 0.1, 1.4, 0.25, 'bandpass', 2600, master); }
    },
  };
})();
