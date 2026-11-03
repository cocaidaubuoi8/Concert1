// Màn hình sân khấu phát YouTube (IFrame Player API), đồng bộ theo giờ server.
// Nếu không tải được YouTube (bị chặn mạng, trình duyệt cũ...) thì trả về trạng thái 'failed'
// để game dùng màn LED vẽ sẵn + nhạc tổng hợp.
const Screen = (() => {
  const R = SHARED.SCREEN;
  let wrap, prompt, player = null, ready = false, state = 'loading'; // loading | ok | failed
  let want = null, getNow = Date.now, muted = false, visible = false, shown = false, placeKey = '';
  let onEnd = () => {}, onFail = () => {}, onState = () => {};
  let promptTimer = null, driftTimer = null, curId = null;

  function init(opts) {
    onEnd = opts.onEnd; onFail = opts.onFail; onState = opts.onState; getNow = opts.now;
    wrap = document.getElementById('screen'); prompt = document.getElementById('btnPlayVideo');
    prompt.onclick = () => { if (!player) return; try { player.playVideo(); if (!muted) player.unMute(); } catch (e) {} prompt.hidden = true; };
    if (window.YT && YT.Player) return create();
    window.onYouTubeIframeAPIReady = create;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = fail; document.head.appendChild(s);
    setTimeout(() => { if (!ready) fail(); }, 9000);
  }
  function fail() {
    if (state === 'failed') return;
    state = 'failed'; shown = false; wrap.hidden = true; onState('failed');
  }
  function create() {
    try {
      player = new YT.Player('ytp', {
        width: '100%', height: '100%',
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3, fs: 0, enablejsapi: 1, origin: location.origin },
        events: {
          onReady() { ready = true; state = 'ok'; onState('ok'); if (want) play(); },
          onStateChange(e) {
            if (e.data === 0 && want) onEnd(want.id);
            if (e.data === 1) prompt.hidden = true;
          },
          onError() { if (want) onFail(want.id); },
          onAutoplayBlocked() { prompt.hidden = false; },
        },
      });
    } catch (e) { fail(); }
  }
  function play() {
    if (!ready || !want) return;
    const elapsed = Math.max(0, Math.floor((getNow() - want.start) / 1000));
    curId = want.id;
    try {
      player.loadVideoById({ videoId: want.id, startSeconds: elapsed });
      muted ? player.mute() : player.unMute();
    } catch (e) { return; }
    clearTimeout(promptTimer);
    promptTimer = setTimeout(() => { try { if (visible && player.getPlayerState() !== 1) prompt.hidden = false; } catch (e) {} }, 3500);
    clearInterval(driftTimer);
    driftTimer = setInterval(drift, 10000);
  }
  // giữ mọi người xem cùng một đoạn: lệch quá 3s thì tua lại
  function drift() {
    if (!ready || !want || !visible) return;
    try {
      if (player.getPlayerState() !== 1) return;
      const dur = player.getDuration();
      if (!dur) return; // phát trực tiếp: không cần tua
      const exp = (getNow() - want.start) / 1000;
      if (exp < dur - 2 && Math.abs(player.getCurrentTime() - exp) > 3) player.seekTo(exp, true);
    } catch (e) {}
  }

  return {
    init,
    state: () => state,
    set(v) { // v = {id, start} hoặc null
      want = v;
      if (!v) { shown = false; if (ready) try { player.stopVideo(); } catch (e) {} return; }
      shown = true;
      if (ready) play();
    },
    stop() { want = null; shown = false; curId = null; clearInterval(driftTimer); if (wrap) wrap.hidden = true; if (prompt) prompt.hidden = true; try { player && player.stopVideo(); } catch (e) {} },
    setMuted(m) { muted = m; try { if (ready) m ? player.mute() : player.unMute(); } catch (e) {} },
    title() { try { return (ready && player.getVideoData().title) || ''; } catch (e) { return ''; } },
    // đặt khung video đúng chỗ trên màn hình (gọi mỗi khung hình)
    place(ox, oy, sc, show) {
      visible = !!show;
      if (!wrap) return;
      const on = visible && shown && state !== 'failed';
      wrap.hidden = !on;
      if (!on) return;
      const key = [ox, oy, sc].join('|');
      if (key === placeKey) return; placeKey = key;
      wrap.style.left = ox + R.x * sc + 'px'; wrap.style.top = oy + R.y * sc + 'px';
      wrap.style.width = R.w * sc + 'px'; wrap.style.height = R.h * sc + 'px';
    },
  };
})();
