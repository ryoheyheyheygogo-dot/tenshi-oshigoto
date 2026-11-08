/* てんしの おしごと（モンテッソーリの教具あそび）
 * 画面：タイトル → たな（おしごとを えらぶ）→ ピンクタワー
 * 1280x720 を基準に作り、画面の大きさに合わせて拡大縮小する。
 *
 * モンテッソーリの考え方にそって作る：
 *  - 点数・ごほうび・時間制限は なし。できたら、しずかに音が鳴るだけ
 *  - 「誤りの訂正」：小さい立方体の上に大きい立方体は乗らず、すべり落ちる。子どもが自分で気づける
 *  - 「困難の孤立化」：ちがうのは大きさだけ（色・形は すべて同じ）
 *  - 一度に運ぶのは1こだけ。いちばん上の立方体しか取れない（本物と同じ）
 */
'use strict';

// LINE の中の ブラウザで開いた時は、Safari・Chrome で 開きなおす（写真の保存などが うまく動かないため）
if (/ Line\//i.test(navigator.userAgent) && location.search.indexOf('openExternalBrowser=1') < 0) {
  location.replace(location.pathname + (location.search ? location.search + '&' : '?') + 'openExternalBrowser=1' + location.hash);
}

const BASE_W = 1280, BASE_H = 720;
const TEST = /[?&]test=1/.test(location.search);   // 動作の たしかめ用（ふだんは つかわない）
const IMG_DIR = 'assets/img/';
const IMAGES = ['title_logo.png', 'icon_home.png', 'icon_again.png', 'title_bg.jpg',
  'classroom_bg.webp', 'work_mat.webp', 'mat_tile.webp', 'pink_cube.png', 'button_home.png', 'button_hint.png', 'button_restart.png',
  'title_banner.png', 'feedback_success.png', 'feedback_great.png', 'anniversary_badge.png'];

// ======================= 共通の道具 =======================
const stage = document.getElementById('stage');
const view = { w: BASE_W, h: BASE_H, scale: 1 };
const IMG = {};
let cur = null, token = 0;

function px(v) { return v + 'px'; }
function el(tag, cls, style, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (style && style.inset !== undefined) {   // 古い iPhone（iOS 14.4 まで）は inset が きかないので、上下左右に わける
    const v = style.inset;
    style = Object.assign({}, style, { top: v, right: v, bottom: v, left: v });
    delete style.inset;
  }
  if (style) Object.assign(e.style, style);
  if (parent) parent.appendChild(e);
  return e;
}
function pic(name, cls, style, parent) {
  const e = el('img', cls, style, parent);
  e.src = IMG[name] ? IMG[name].src : IMG_DIR + name + (/\.(png|jpg|webp)$/.test(name) ? '' : '.png'); e.draggable = false; e.alt = '';
  return e;
}
/** ふちどり文字：うしろに ふちの文字、前に ふつうの文字を重ねる（どの ブラウザ でも 同じに 見える。古い Android の Chrome は paint-order が きかないため） */
function outlineText(parent, text, w, c) {
  parent.textContent = '';
  const wrap = el('span', 'olw', null, parent);
  const back = el('span', 'olb', { WebkitTextStroke: w + ' ' + c, color: c }, wrap);
  back.textContent = text;
  const front = el('span', 'olf', null, wrap);
  front.textContent = text;
  return wrap;
}
function label(text, size, color, style, parent) {
  style = Object.assign({}, style || {});
  const sw = style.WebkitTextStrokeWidth || px(Math.round(size * 0.3)), sc = style.WebkitTextStrokeColor || '#fff';
  delete style.WebkitTextStrokeWidth; delete style.WebkitTextStrokeColor;
  const e = el('div', 'lbl', Object.assign({ fontSize: px(size), color: color }, style), parent);
  outlineText(e, text, sw, sc);
  return e;
}
function later(ms, f) { const t = token; setTimeout(() => { if (t === token) f(); }, ms); }
function rand(a, b) { return a + Math.random() * (b - a); }
function onTap(e, fn) {
  let downId = null;
  e.addEventListener('pointerdown', (ev) => { downId = ev.pointerId; });
  e.addEventListener('pointercancel', () => { downId = null; });
  e.addEventListener('pointerup', (ev) => {
    if (ev.pointerId !== downId) return;
    downId = null; ev.stopPropagation(); fn(ev);
  });
}
function bounce(e) { e.classList.remove('bounce'); void e.offsetWidth; e.classList.add('bounce'); }
// 絵の ボタン（ホーム・もういちど・ヒント）。さわれる 大きさは 絵より すこし 広め
const BTN_ART = { icon_home: ['button_home', 'ホームへ もどる'], icon_again: ['button_restart', 'はじめから'], hint: ['button_hint', 'おてほんを みる'] };
function iconButton(parent, icon, d, color, pos, action) {
  const art = BTN_ART[icon];
  if (art) {
    d = Math.max(d, 88);
    const b = el('div', 'btn artbtn', Object.assign({ width: px(d), height: px(d) }, pos), parent);
    b.setAttribute('role', 'button'); b.setAttribute('aria-label', art[1]);
    pic(art[0], null, null, b);
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    onTap(b, () => { bounce(b); sound.click(); action(); });
    return b;
  }
  const b = el('div', 'btn', Object.assign({ width: px(d), height: px(d), background: color }, pos), parent);
  pic(icon, null, null, b);
  b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  onTap(b, () => { bounce(b); sound.click(); action(); });
  return b;
}

// ---------- 画面の大きさ ----------
// iPhone の切りかき（ノッチ）や 角の丸みに、ボタンが かくれないよう、その分を あけて表示する
const safeProbe = (() => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(d);
  return d;
})();
let lastLayoutKey = '';
function layout() {
  // 文字を入力している間は、キーボードで画面の高さが変わっても 大きさを変えない（Android は キーボードで画面が ちぢむ）
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const cs = getComputedStyle(safeProbe);
  const it = parseFloat(cs.paddingTop) || 0, ir = parseFloat(cs.paddingRight) || 0, ib = parseFloat(cs.paddingBottom) || 0, il = parseFloat(cs.paddingLeft) || 0;
  const vw = window.innerWidth - il - ir, vh = window.innerHeight - it - ib;
  // たて向きの間は「よこに してね」が 出ているので、ならべなおさない（板や 円柱が うごいてしまうため）
  if (vh > vw && lastLayoutKey) return;
  const key = [vw, vh, il, it].join(',');
  if (key === lastLayoutKey) return;   // 大きさが かわっていない時は なにもしない
  lastLayoutKey = key;
  view.ox = il; view.oy = it;
  stage.style.left = px(il); stage.style.top = px(it);
  const s = Math.min(vw / BASE_W, vh / BASE_H);
  view.scale = s; view.w = vw / s; view.h = vh / s;
  stage.style.width = px(view.w); stage.style.height = px(view.h);
  stage.style.transform = 'scale(' + s + ')';
  if (cur && cur.onResize) cur.onResize();
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', () => { setTimeout(layout, 200); setTimeout(layout, 700); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
// iPhone は、向きを かえた時や 全画面の切りかえで、resize が おくれたり 来なかったりする。ときどき 大きさを たしかめる
setInterval(layout, 600);
let curFn = null;
function go(screenFn, arg) {
  token++;
  if (cur && cur.dispose) cur.dispose();
  // iPhone は、絵（canvas）の メモリに上限がある。画面を かえる時に すぐ かえす
  stage.querySelectorAll('canvas').forEach((c) => { c.width = 0; c.height = 0; });
  stage.innerHTML = '';
  curFn = screenFn;
  const root = el('div', 'screen', null, stage);
  cur = screenFn(root, arg) || {};
  if (isEvening()) eveningLayer(root, false);
}
/** 画面の座標（拡大縮小する前の 1280x720 基準） */
function local(ev) { return [(ev.clientX - (view.ox || 0)) / view.scale, (ev.clientY - (view.oy || 0)) / view.scale]; }

// ---------- 音（木のやさしい音を その場で作る。音のファイルは使わない） ----------
const sound = (() => {
  let ac = null, stuckSince = 0;
  function ctx() {
    // iPhone の マナーモードでも、Android と同じように 音量ボタンの大きさで鳴らす
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* なにもしない */ }
    // 一度 止まった音（画面を とじた・電話・ほかのアプリ）が もどらない時は、作りなおす（iPhone で 2回目から 鳴らなくなるのを ふせぐ）
    if (ac && (ac.state === 'closed' || (ac.state !== 'running' && stuckSince && performance.now() - stuckSince > 800))) {
      try { ac.close(); } catch (e) { /* なにもしない */ }
      ac = null; stuckSince = 0;
    }
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
    }
    if (ac && ac.state !== 'running') {
      if (!stuckSince) stuckSince = performance.now();
      try { const p = ac.resume(); if (p && p.then) p.then(() => { if (ac && ac.state === 'running') stuckSince = 0; }).catch(() => {}); } catch (e) { /* なにもしない */ }
    } else stuckSince = 0;
    return ac;
  }
  // 音が 止まっている時は、うごき出してから 鳴らす（さわった その時の 音も 消えないように）
  function whenRunning(f) {
    const a = ac;
    if (!a) return;   // まだ 一度も さわっていない時は 鳴らさない
    if (a.state === 'running') { f(a); return; }
    const t0 = performance.now();
    try { a.resume().then(() => { if (a === ac && a.state === 'running' && performance.now() - t0 < 400) f(a); }).catch(() => {}); } catch (e) { /* なにもしない */ }
  }
  function tone(freq, dur, vol, type, when) { whenRunning((a) => toneNow(a, freq, dur, vol, type, when)); }
  function toneNow(a, freq, dur, vol, type, when) {
    const t = a.currentTime + (when || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq) { whenRunning((a) => noiseNow(a, dur, vol, freq)); }
  function noiseNow(a, dur, vol, freq) {
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 2; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start();
  }
  // ド レ ミ ファ ソ ラ シ ド レ ミ（いちばん大きい立方体が いちばん低い音）
  const SCALE = [261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3, 587.3, 659.3];
  return {
    unlock() { ctx(); },
    /** 立方体を置いた「コトッ」。大きいほど低い */
    knock(n) { const f = 160 + (11 - n) * 55; tone(f, 0.16, 0.22, 'triangle'); noise(0.05, 0.25, f * 3); },
    lift() { tone(520, 0.08, 0.05, 'sine'); },
    slide() { noise(0.25, 0.12, 900); tone(240, 0.25, 0.06, 'triangle'); },
    click() { ctx(); tone(660, 0.07, 0.08, 'sine'); },
    /** できた時：下から上へ、しずかに音が上がっていく */
    chime(i, when) { tone(SCALE[i], 1.2, 0.12, 'sine', when); tone(SCALE[i] * 2, 0.8, 0.03, 'sine', when); },
    /** 音の 高さを 直接（はめこみえんちゅうの 音階など） */
    note(freq, when, dur) { tone(freq, dur || 1.0, 0.13, 'sine', when); tone(freq * 2, (dur || 1.0) * 0.6, 0.025, 'sine', when); },
    /** 鐘（園章） */
    bell(when) { tone(784, 2.2, 0.10, 'sine', when); tone(784 * 2.76, 1.2, 0.03, 'sine', when); tone(784 * 5.4, 0.6, 0.012, 'sine', when); },
    /** 小鳥の 声（チチッ） */
    bird(when) {
      whenRunning((a) => {
        const t0 = a.currentTime + (when || 0);
        for (let k = 0; k < 3; k++) {
          const t = t0 + k * 0.16, o = a.createOscillator(), g = a.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(2900, t); o.frequency.exponentialRampToValueAtTime(4300, t + 0.05); o.frequency.exponentialRampToValueAtTime(3100, t + 0.1);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
          o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.13);
        }
      });
    },
  };
})();
document.addEventListener('pointerdown', () => sound.unlock(), true);
document.addEventListener('touchend', () => sound.unlock(), true);   // iPhone は 指を はなした時に 音が出せるようになる
document.addEventListener('visibilitychange', () => { if (!document.hidden) sound.unlock(); });
// 全画面（Android など。ぬりえと同じ。iPhone は「ホーム画面に追加」で全画面）
document.addEventListener('pointerup', () => {
  if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) return;
  const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(d, { navigationUI: 'hide' });
    if (p && p.then) p.then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
  } catch (e) { /* 対応していない */ }
}, true);

// 声は使わない（モンテッソーリにあわせて、先生は 言葉なしで 見守る。音は 木の音と、できた時の しずかな音だけ）

document.addEventListener('contextmenu', (e) => e.preventDefault());
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });

// ======================= 先生の おてほん（提示） =======================
// モンテッソーリでは、先生が言葉を使わずに、ゆっくりやって見せる。
// はじめて その おしごとを開いた時に、手が ゆっくり2〜3回やって見せて、あとは子どもにまかせる。
// 右上の「手」のボタンで、いつでも もう一度 見られる。さわると、おてほんは とちゅうで おわる。
const HAND_SVG = '<svg viewBox="0 0 100 110" width="100%" height="100%">' +
  '<path d="M30 8 c0-7 12-7 12 0 v38 h2 v-30 c0-7 12-7 12 0 v30 h2 v-24 c0-7 12-7 12 0 v28 h2 v-16 c0-7 12-7 12 0 v40 c0 26-16 40-36 40 c-16 0-26-8-34-22 l-14-24 c-4-7 5-13 11-7 l11 12 z" ' +
  'fill="#ffe0c8" stroke="#c98a6a" stroke-width="4" stroke-linejoin="round"/></svg>';
function seenKey(id) { return 'oshigoto_seen_' + id; }
function wasSeen(id) { try { return !!localStorage.getItem(seenKey(id)); } catch (e) { return true; } }
function markSeen(id) { try { localStorage.setItem(seenKey(id), '1'); } catch (e) { /* なにもしない */ } }

// ======================= かくし（しずかな 発見） =======================
// 点数や ごほうびでは なく、「ていねいに した子が 気づく」 小さな 変化だけ
const PROG_KEY = 'oshigoto_prog_v1';
function loadProg() { try { return JSON.parse(localStorage.getItem(PROG_KEY)) || {}; } catch (e) { return {}; } }
function saveProg(o) { try { localStorage.setItem(PROG_KEY, JSON.stringify(o)); } catch (e) { /* なにもしない */ } }
let sessionDone = 0;   // この ひらいている あいだに できた 回数（5回で 夕方に なる）
const EVENING_AT = 5;
function isEvening() { return sessionDone >= EVENING_AT; }
// かくし 10こ（見つけた ものを おぼえておく。10こ そろうと おいわいと パーティの ごあんない）
const SECRETS = ['flowers', 'quiet', 'evening', 'stair', 'star', 'colors4', 'wave', 'golden', 'scale', 'crest'];
function secretsGot() { return loadProg().secrets || {}; }
function allSecrets() { const g = secretsGot(); return SECRETS.every((k) => g[k]); }
function secretFound(id, root, delay) {
  const pr = loadProg();
  pr.secrets = pr.secrets || {};
  if (pr.secrets[id]) return;
  pr.secrets[id] = Date.now();
  const all = SECRETS.every((k) => pr.secrets[k]);
  if (all && !pr.allAt) pr.allAt = Date.now();
  saveProg(pr);
  if (all && root) { const t = token; setTimeout(() => { if (t === token && root.isConnected) secretFinale(root); }, delay || 4500); }
}
/** 10この かくしを ぜんぶ 見つけた：しずかな おいわいと、とうじつの パーティの ごあんない（うけつけで 見せる） */
function secretFinale(root) {
  if (root.querySelector('.finale')) return;
  const W = view.w, H = view.h;
  const layer = el('div', 'finale', { position: 'absolute', inset: '0', zIndex: '3000', overflow: 'hidden' }, root);
  const bg = el('div', null, { position: 'absolute', inset: '0', background: 'radial-gradient(circle at 50% 35%, #fff8e8 0%, #f6e2c4 60%, #e8c9a0 100%)' }, layer);
  bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1200, fill: 'both' });
  // ゆっくり ふる 花びら
  const PET = ['#f4a3b8', '#f7d36b', '#9cc7f2', '#b7d99a', '#f9c9a5'];
  for (let i = 0; i < 36; i++) {
    const pe = el('div', null, { position: 'absolute', left: (Math.random() * 100) + '%', top: '-30px', width: px(rand(12, 20)), height: px(rand(9, 14)), borderRadius: '60% 40% 60% 40%',
      background: PET[i % PET.length], opacity: '0.85', pointerEvents: 'none' }, layer);
    const dur = rand(7000, 11000);
    pe.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(' + px(rand(-120, 120)) + ',' + px(H + 60) + ') rotate(' + rand(200, 600) + 'deg)' }],
      { duration: dur, delay: rand(0, 6000) + 600, iterations: Infinity, easing: 'linear' });
  }
  // 園章（しずかに 光る）
  const L = Math.min(170, H * 0.24);
  const logo = pic('title_logo', null, { position: 'absolute', left: px(W / 2 - L / 2), top: px(H * 0.05), width: px(L), height: px(L) }, layer);
  logo.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1200, delay: 500, easing: 'ease-out', fill: 'both' });
  logo.animate([{ filter: 'drop-shadow(0 0 0 rgba(255,214,100,0))' }, { filter: 'drop-shadow(0 0 26px rgba(255,214,100,0.9))' }], { duration: 1800, delay: 1700, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
  // しずかな 音（上へ）
  [0, 2, 4, 7, 9].forEach((k, i) => sound.chime(Math.min(9, k), 0.8 + i * 0.35));
  const t1 = label('10この ひみつ、ぜんぶ みつけたね', Math.min(52, H * 0.075), '#6b5030', { left: '0', right: '0', top: px(H * 0.05 + L + 14) }, layer);
  const t2 = label('ていねいな おしごと、すてきでした', Math.min(34, H * 0.05), '#8a6a3a', { left: '0', right: '0', top: px(H * 0.05 + L + 14 + Math.min(52, H * 0.075) * 1.4) }, layer);
  [t1, t2].forEach((t, i) => t.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 900, delay: 1600 + i * 600, easing: 'ease-out', fill: 'both' }));
  // パーティの ごあんない カード
  const CW = Math.min(980, W - 40), CH = Math.min(230, H * 0.34);
  const card = el('div', null, { position: 'absolute', left: px((W - CW) / 2), bottom: '22px', width: px(CW), height: px(CH), borderRadius: '28px', boxSizing: 'border-box',
    background: '#fffdf7', border: '6px solid #c9935f', boxShadow: '0 0 0 4px #fff, 0 10px 24px rgba(90,55,25,0.25)', pointerEvents: 'none' }, layer);
  card.animate([{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 900, delay: 3000, easing: 'ease-out', fill: 'both' });
  const fz = (n) => Math.round(n * CH / 230);
  label('75しゅうねん おめでとう！', fz(34), '#c45d7a', { left: '0', right: '0', top: px(fz(14)) }, card);
  label('とうじつは 75しゅうねんの パーティを するよ', fz(36), '#6b5030', { left: '0', right: '0', top: px(fz(64)) }, card);
  label('この がめんを うけつけの ひとに みせてね', fz(42), '#b3541e', { left: '0', right: '0', top: px(fz(116)) }, card);
  const at = new Date(loadProg().allAt || Date.now());
  label('ひみつ 10/10　' + at.getFullYear() + '.' + (at.getMonth() + 1) + '.' + at.getDate(), fz(22), '#8a7a66', { left: '0', right: '0', top: px(fz(176)) }, card);
  later(3000, () => sound.bell(0));
  const hint = label('さわると もどるよ', 22, '#8a7a66', { right: '18px', top: '12px' }, layer);
  hint.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 5000, fill: 'both' });
  let closable = false;
  setTimeout(() => { closable = true; }, 4500);
  layer.addEventListener('pointerdown', (ev) => ev.stopPropagation(), true);
  layer.addEventListener('pointerup', (ev) => {
    ev.stopPropagation();
    if (!closable) return;
    sound.click();
    layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' }).onfinish = () => layer.remove();
  });
}
/** おしごとが できた時に よぶ。work：tower/tablets/cylinders */
function workDone(work, root) {
  const pr = loadProg();
  pr.works = pr.works || {};
  pr.works[work] = true;
  saveProg(pr);
  sessionDone++;
  if (sessionDone === EVENING_AT && root && root.isConnected) { eveningLayer(root, true); secretFound('evening', root, 6000); }
}
/** 夕方の 光（部屋が やさしい 夕焼け色に） */
function eveningLayer(root, fadeIn) {
  if (root.querySelector('.evening')) return;
  const e = el('div', 'evening', { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '1500', mixBlendMode: 'multiply',
    background: 'linear-gradient(rgba(255,170,110,0.30), rgba(255,200,150,0.16) 60%, rgba(240,150,120,0.22))' }, root);
  if (fadeIn) e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 4000, easing: 'ease-in-out', fill: 'both' });
}
const ANGEL_SVG = '<svg viewBox="0 0 40 54" width="100%" height="100%">' +
  '<ellipse cx="20" cy="5" rx="9" ry="3" fill="none" stroke="#f2c94c" stroke-width="2.4"/>' +
  '<path d="M14 24 C2 18 0 30 6 36 C9 33 12 31 15 30 Z" fill="#fff" stroke="#c9b8a0" stroke-width="1.6"/>' +
  '<path d="M26 24 C38 18 40 30 34 36 C31 33 28 31 25 30 Z" fill="#fff" stroke="#c9b8a0" stroke-width="1.6"/>' +
  '<path d="M20 22 L31 51 H9 Z" fill="#fff" stroke="#c9b8a0" stroke-width="1.8" stroke-linejoin="round"/>' +
  '<circle cx="20" cy="16" r="7" fill="#ffe0c8" stroke="#c98a6a" stroke-width="1.6"/></svg>';
const STAR_SVG = '<svg viewBox="0 0 40 40" width="100%" height="100%"><path d="M20 2 L25 15 L39 15 L28 24 L32 38 L20 30 L8 38 L12 24 L1 15 L15 15 Z" fill="#ffe27a" stroke="#d9a400" stroke-width="2.4" stroke-linejoin="round"/></svg>';
const BUTTERFLY_SVG = '<svg viewBox="0 0 40 30" width="100%" height="100%"><g class="bw"><path d="M20 15 C12 0 0 2 4 12 C6 16 14 17 20 15 Z" fill="#f6b6c8" stroke="#c97b93" stroke-width="1.2"/>' +
  '<path d="M20 15 C14 26 4 28 6 20 C8 17 14 16 20 15 Z" fill="#f9d48a" stroke="#c99a4a" stroke-width="1.2"/></g>' +
  '<g class="bw2"><path d="M20 15 C28 0 40 2 36 12 C34 16 26 17 20 15 Z" fill="#f6b6c8" stroke="#c97b93" stroke-width="1.2"/>' +
  '<path d="M20 15 C26 26 36 28 34 20 C32 17 26 16 20 15 Z" fill="#f9d48a" stroke="#c99a4a" stroke-width="1.2"/></g>' +
  '<rect x="19" y="9" width="2" height="13" rx="1" fill="#6b5030"/></svg>';
/** 手と、おてほんの進め方。steps は async 関数の配列（ひとつずつ順に） */
function makeDemo(root, id) {
  const hand = el('div', null, { position: 'absolute', width: '120px', height: '132px', left: '0', top: '0', zIndex: '2000', pointerEvents: 'none', opacity: '0',
    transformOrigin: '30% 5%', filter: 'drop-shadow(0 8px 8px rgba(0,0,0,0.18))' }, root);
  hand.innerHTML = HAND_SVG;
  const d = { running: false, cancel: false, x: view.w + 100, y: view.h * 0.6 };
  function put() { hand.style.left = px(d.x - 30); hand.style.top = px(d.y - 4); }   // 指先が (x, y)
  put();
  /** 0→1 をなめらかに。とちゅうで やめた時は、すぐ最後まで */
  d.tween = (ms, fn) => new Promise((ok) => {
    const t0 = performance.now();
    const step = (now) => {
      const k = d.cancel ? 1 : Math.min(1, (now - t0) / ms);
      fn(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
      if (k < 1) requestAnimationFrame(step); else ok();
    };
    requestAnimationFrame(step);
  });
  d.wait = (ms) => new Promise((ok) => { const t0 = performance.now(); const f = () => (d.cancel || performance.now() - t0 >= ms) ? ok() : requestAnimationFrame(f); f(); });
  d.at = (x, y) => { d.x = x; d.y = y; put(); };
  d.handTo = (x, y, ms) => { const fx = d.x, fy = d.y; return d.tween(ms, (k) => { d.x = fx + (x - fx) * k; d.y = fy + (y - fy) * k; put(); }); };
  d.press = () => hand.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.88)' }], { duration: 180, fill: 'forwards' });
  d.open = () => hand.animate([{ transform: 'scale(0.88)' }, { transform: 'scale(1)' }], { duration: 180, fill: 'forwards' });
  d.run = async (steps) => {
    if (d.running) return;
    d.running = true; d.cancel = false;
    markSeen(id);   // 見はじめた時点で「見た」にする（色や まい数を かえるたびに、また はじまらないように）
    d.x = view.w + 100; d.y = view.h * 0.55; put();
    hand.style.transition = 'opacity 0.4s'; hand.style.opacity = '1';
    try {
      for (const st of steps) { if (d.cancel) break; await st(); }
      await d.handTo(view.w + 120, d.y - 60, 900);
    } catch (e) { /* とちゅうで こまっても、おてほんは かならず おわる */ }
    hand.style.opacity = '0';
    d.running = false; d.cancel = false;
    markSeen(id);
  };
  // さわったら、おてほんは おわり（子どもが やりたくなったら すぐ できるように）。
  // ボタン（ホーム・色・まい数）は、おてほんの とちゅうでも そのまま 押せる
  root.addEventListener('pointerdown', (ev) => {
    if (!d.running) return;
    d.cancel = true;
    const onButton = ev.target && ev.target.closest && ev.target.closest('.btn, .pickbtn');
    if (!onButton) ev.stopPropagation();
  }, true);
  // 右上：もう一度 おてほんを見る
  const b = el('div', 'btn handbtn', { width: '88px', height: '88px', right: '118px', top: '14px' }, root);
  b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'おてほんを みる');
  const ic = el('div', null, { width: '58%', height: '58%' }, b);
  ic.innerHTML = HAND_SVG;
  b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
  d.button = b;
  return d;
}

// ======================= 立方体の絵 =======================
const DEPTH = 0.33;   // おくゆき（斜めに見える面）の大きさ（立方体の 絵に あわせる）
/** 立方体1こ。10この 立方体は ぜんぶ 同じ 絵を 1〜10 の 大きさに ちぢめて つかう（大きさの 比は きっちり 1:2:…:10）。x, y は 正面の左下 */
function makeCube(parent, s) {
  const d = s * DEPTH;
  const c = el('div', 'cube', { width: px(s + d), height: px(s + d) }, parent);
  pic('pink_cube', null, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' }, c);
  return c;
}
function placeEl(c, x, y, s) { c.style.left = px(x); c.style.top = px(y - s - s * DEPTH); }
/** かざり用：大きい順に積んだ タワー（cx：まん中、floorY：ゆか）。できた立方体の配列を返す */
function staticTower(parent, U, cx, floorY) {
  const out = [];
  let x = 0, y = floorY, ps = 0, pd = 0;
  for (let n = 10; n >= 1; n--) {
    const s = n * U, d = s * DEPTH;
    if (n === 10) { x = cx - (s + d) / 2; y = floorY; } else { x = x + (ps - s) / 2 + (pd - d) / 2; y = y - ps - (pd - d) / 2; }
    const c = makeCube(parent, s);
    placeEl(c, x, y, s);
    out.push(c);
    ps = s; pd = d;
  }
  return out;
}

// ======================= へやの 絵・マット・題・できた ======================
/** モンテッソーリの へや（かべ・たな・まど）。veil：うすく する 強さ（あそぶ 画面は 教具が 見やすいよう うすく） */
function roomBg(root, veil) {
  const bg = el('div', null, { position: 'absolute', inset: '0', background: 'linear-gradient(#f7ecdf 0%, #f3e3cf 55%, #e9c79c 56%, #dcb27e 100%)' }, root);
  const im = pic('classroom_bg', null, { position: 'absolute', left: '50%', top: '0', height: '62%', width: 'auto', transform: 'translateX(-50%)', minWidth: '100%', objectFit: 'cover' }, bg);
  el('div', null, { position: 'absolute', left: '0', right: '0', top: '61%', bottom: '0', background: 'linear-gradient(#e7c08f, #d9ab74)' }, bg);
  if (veil) el('div', null, { position: 'absolute', inset: '0', background: 'rgba(255,248,236,' + veil + ')' }, bg);
  return bg;
}
/** 緑の フェルトの マット（ふちの 点線は のばさない） */
function workMat(style, root) {
  return el('div', null, Object.assign({ position: 'absolute', boxSizing: 'border-box', borderStyle: 'solid', borderWidth: '26px',
    background: 'url(' + IMG.mat_tile.src + ') 0 0 / 400px 140px repeat, #9dbb66', backgroundClip: 'padding-box', backgroundOrigin: 'padding-box',
    borderImage: 'url(' + IMG.work_mat.src + ') 44 / 26px stretch', filter: 'drop-shadow(0 6px 6px rgba(90,60,30,0.18))' }, style), root);
}
/** 題（リボンの 絵に 文字を 重ねる） */
function banner(text, w, top, root, size) {
  const h = w * 154 / 634;
  const b = el('div', null, { position: 'absolute', left: '50%', top: px(top), width: px(w), height: px(h), marginLeft: px(-w / 2), pointerEvents: 'none' }, root);
  pic('title_banner', null, { position: 'absolute', inset: '0', width: '100%', height: '100%' }, b);
  label(text, size || Math.round(h * 0.34), '#6b4524', { left: '0', right: '0', top: px(h * 0.27), WebkitTextStrokeColor: '#fff8ea' }, b);
  return b;
}
/** できた！（やさしく ふくらんで、しずかに きえる。さわる じゃまを しない） */
function showDone(root, text, kind) {
  const W = 300, H = 126;
  const f = el('div', null, { position: 'absolute', left: '50%', top: '120px', width: px(W), height: px(H), marginLeft: px(-W / 2), pointerEvents: 'none', zIndex: '1800' }, root);
  pic(kind === 'great' ? 'feedback_great' : 'feedback_success', null, { position: 'absolute', inset: '0', width: '100%', height: '100%' }, f);
  label(text || 'できた！', 44, '#6b4524', { left: '70px', right: '20px', top: '32px', WebkitTextStrokeColor: '#fff8ea' }, f);
  f.animate([{ opacity: 0, transform: 'translateY(16px) scale(0.85)' }, { opacity: 1, transform: 'translateY(0) scale(1.04)', offset: 0.35 }, { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.45 },
    { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.85 }, { opacity: 0, transform: 'translateY(-10px) scale(1)' }], { duration: 3200, easing: 'ease-out', fill: 'forwards' }).onfinish = () => f.remove();
  // やわらかい 光の つぶ
  for (let i = 0; i < 10; i++) {
    const sp = el('div', null, { position: 'absolute', left: px(view.w / 2 + rand(-160, 160)), top: px(185 + rand(-40, 40)), width: '12px', height: '12px', borderRadius: '50%',
      background: 'radial-gradient(circle, #fff9d8, rgba(255,230,140,0))', pointerEvents: 'none', zIndex: '1799' }, root);
    sp.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'translateY(-24px) scale(1.6)', offset: 0.4 }, { opacity: 0, transform: 'translateY(-60px) scale(0.6)' }],
      { duration: 1800, delay: 200 + i * 90, easing: 'ease-out', fill: 'both' }).onfinish = () => sp.remove();
  }
}

// ======================= タイトル =======================
function titleScreen(root) {
  // タイトルの 絵（1536x1024）。画面いっぱいに（はみ出た 所は 切る）。スタートは 絵の ボタンの 上に 見えない ボタン
  const IW = 1536, IH = 1024;
  const box = el('div', null, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none' }, root);
  pic('title_bg', null, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' }, box);
  const start = el('div', null, { position: 'absolute', borderRadius: '999px', cursor: 'pointer' }, root);
  const glow = el('div', null, { position: 'absolute', inset: '0', borderRadius: '999px', pointerEvents: 'none',
    boxShadow: '0 0 0 0 rgba(255,255,255,0.0)' }, start);
  glow.animate([{ boxShadow: '0 0 0 0 rgba(255,246,220,0.75)' }, { boxShadow: '0 0 0 22px rgba(255,246,220,0)' }], { duration: 1800, iterations: Infinity, easing: 'ease-out' });
  // 園章（左上に 小さく。かくし：7回 → 5回）
  const logo = pic('title_logo', null, { position: 'absolute', left: '16px', top: '14px', width: '96px', height: '96px', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.18))' }, root);
  const logoHit = el('div', null, { position: 'absolute', left: '8px', top: '6px', width: '112px', height: '112px', borderRadius: '50%', cursor: 'pointer' }, root);
  function place() {
    const s = Math.max(view.w / IW, view.h / IH), w = IW * s, h = IH * s, x = (view.w - w) / 2, y = (view.h - h) * 0.12;   // 横長の 画面では 上の 題が 切れないよう、下を 多めに 切る
    Object.assign(box.style, { left: px(x), top: px(y), width: px(w), height: px(h) });
    Object.assign(start.style, { left: px(x + 520 * s), top: px(y + 500 * s), width: px(495 * s), height: px(165 * s) });
  }
  place();
  onTap(start, () => {
    sound.click();
    start.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.92)' }, { transform: 'scale(1)' }], { duration: 180 });
    box.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.08)' }, { filter: 'brightness(1)' }], { duration: 200 });
    later(180, () => go(shelfScreen));
  });
  let lgGroups = [], lgLast = 0, lgBusy = false;
  logoHit.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation();
    if (lgBusy) return;
    const now = performance.now();
    if (now - lgLast > 800) { lgGroups.push(0); if (lgGroups.length > 2) lgGroups.shift(); }
    lgLast = now;
    lgGroups[lgGroups.length - 1]++;
    const n = lgGroups[lgGroups.length - 1];
    sound.click();
    logo.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.92)' }, { transform: 'scale(1)' }], { duration: 160 });
    if (lgGroups.length === 2 && lgGroups[0] === 7 && n === 5) {
      lgGroups = []; lgBusy = true;
      secretFound('crest', root, 9500);
      for (let i = 0; i < 7; i++) sound.bell(0.6 + i * 0.55);
      for (let i = 0; i < 5; i++) sound.bell(0.6 + 7 * 0.55 + 1.0 + i * 0.55);
      logo.animate([{ filter: 'drop-shadow(0 0 0 rgba(255,220,120,0))' }, { filter: 'drop-shadow(0 0 22px rgba(255,214,100,0.95))' }, { filter: 'drop-shadow(0 0 0 rgba(255,220,120,0))' }],
        { duration: 2400, delay: 500, iterations: 3, easing: 'ease-in-out' });
      later(8000, () => { lgBusy = false; });
    }
  });
  return { onResize: place };
}

// ======================= たな（おしごとを えらぶ） =======================
const WORKS = [
  { id: 'tower', name: 'ピンクタワー', ready: true },
  { id: 'tablets', name: 'いろいた', ready: true },
  { id: 'cylinders', name: 'はめこみえんちゅう', ready: true },
];
function shelfScreen(root) {
  roomBg(root, 0.35);
  banner('どの おしごとを する？', 560, 6, root, 34);
  iconButton(root, 'icon_home', 96, '#e98aa3', { left: '20px', top: '14px' }, () => go(titleScreen));
  // 75しゅうねん きねん（右上）
  const badge = el('div', null, { position: 'absolute', right: '18px', top: '8px', width: '104px', height: '113px', pointerEvents: 'none' }, root);
  pic('anniversary_badge', null, { position: 'absolute', inset: '0', width: '100%', height: '100%' }, badge);
  label('75', 34, '#6b4524', { left: '0', right: '0', top: '18px', WebkitTextStrokeColor: '#fff8ea' }, badge);
  label('しゅうねん', 15, '#6b4524', { left: '0', right: '0', top: '58px', WebkitTextStrokeColor: '#fff8ea' }, badge);
  const items = [];
  const SW = 1000, sx = () => (view.w - SW) / 2;
  const panelBg = el('div', null, { position: 'absolute', width: px(SW), height: '350px', borderRadius: '22px', background: 'rgba(255,250,240,0.93)', boxShadow: '0 6px 16px rgba(90,60,30,0.12)' }, root);
  const board = el('div', 'shelf-board', { width: px(SW), height: '26px' }, root);
  const sideL = el('div', 'shelf-board', { width: '26px', height: '360px' }, root);
  const sideR = el('div', 'shelf-board', { width: '26px', height: '360px' }, root);
  // まど（そとの 光）
  const win = el('div', null, { position: 'absolute', top: '96px', width: '150px', height: '112px', display: 'none' }, root);   // まどは へやの 絵に ある
  el('div', null, { position: 'absolute', left: '50%', top: '0', bottom: '0', width: '6px', marginLeft: '-3px', background: '#c9935f' }, win);
  // 花びん（おしごとが できるたびに 花が 1本 ふえる。3本 そろうと ひらく）
  const pr = loadProg(), works = pr.works || {};
  const nDone = WORKS.filter((w) => works[w.id]).length;
  const shown = pr.flowersShown || 0;
  const vase = el('div', null, { position: 'absolute', width: '80px', height: '170px', pointerEvents: 'none' }, root);
  const FL = [{ c: '#f4a3b8', x: 40, h: 120, a: -14 }, { c: '#f7d36b', x: 40, h: 140, a: 0 }, { c: '#9cc7f2', x: 40, h: 118, a: 14 }];
  WORKS.forEach((w, i) => {
    if (!works[w.id]) return;
    const f = FL[[...WORKS.filter((q) => works[q.id])].indexOf(w)];
    const st = el('div', null, { position: 'absolute', left: px(f.x - 2), bottom: '52px', width: '4px', height: px(f.h - 52), background: '#7aa35a', borderRadius: '2px',
      transformOrigin: '50% 100%', transform: 'rotate(' + f.a + 'deg)' }, vase);
    const head = el('div', null, { position: 'absolute', left: '50%', top: '-14px', width: '0', height: '0' }, st);
    if (nDone === 3) {   // ひらいた 花
      for (let k = 0; k < 5; k++) el('div', null, { position: 'absolute', left: '-8px', top: '-16px', width: '16px', height: '16px', borderRadius: '50%', background: f.c,
        transformOrigin: '8px 16px', transform: 'rotate(' + (k * 72) + 'deg)' }, head);
      el('div', null, { position: 'absolute', left: '-6px', top: '-6px', width: '12px', height: '12px', borderRadius: '50%', background: '#fff2b8' }, head);
    } else {   // つぼみ
      el('div', null, { position: 'absolute', left: '-8px', top: '-12px', width: '16px', height: '22px', borderRadius: '50% 50% 45% 45%', background: f.c }, head);
    }
    const order = [...WORKS.filter((q) => works[q.id])].indexOf(w);
    if (order >= shown) st.animate([{ transform: 'rotate(' + f.a + 'deg) scaleY(0)' }, { transform: 'rotate(' + f.a + 'deg) scaleY(1)' }], { duration: 1600, delay: 400, easing: 'ease-out', fill: 'both' });
  });
  el('div', null, { position: 'absolute', left: '14px', bottom: '0', width: '52px', height: '60px', borderRadius: '14px 14px 20px 20px', background: 'linear-gradient(90deg, #e8eef2, #ffffff 40%, #d9e3ea)',
    border: '3px solid #b9c7d1', boxSizing: 'border-box' }, vase);
  if (nDone > shown) { pr.flowersShown = nDone; saveProg(pr); }
  if (nDone === 3) secretFound('flowers', root, 4000);
  if (allSecrets()) {   // ぜんぶ 見つけた しるし：花びんの よこに 小さな 金の 鐘。おすと また ごあんないが 出る
    const bellMark = el('div', null, { position: 'absolute', width: '64px', height: '64px', cursor: 'pointer', zIndex: '20' }, root);
    bellMark.innerHTML = '<svg viewBox="0 0 40 40" width="100%" height="100%"><path d="M20 4 C12 4 9 11 9 18 V25 L5 30 H35 L31 25 V18 C31 11 28 4 20 4 Z" fill="#f2c94c" stroke="#a8780a" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="33" r="3.6" fill="#a8780a"/></svg>';
    bellMark.animate([{ transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }], { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    bellMark.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    onTap(bellMark, () => { sound.bell(0); secretFinale(root); });
    vase.bell = bellMark;
  }
  WORKS.forEach((w, i) => {
    const it = el('div', 'shelf-item', { width: '280px', height: '330px' }, root);
    const art = el('div', null, { position: 'absolute', left: '0', right: '0', top: '0', height: '250px' }, it);
    if (w.id === 'tower') {
      staticTower(art, 4.2, 140, 250);
    } else if (w.id === 'tablets') {
      ['#3b5fc4', '#5677d1', '#7591dc', '#97ade6', '#b9c9f0', '#dbe4f8'].forEach((c, k) => {
        el('div', null, { position: 'absolute', left: px(40 + k * 34), top: '170px', width: '30px', height: '70px', borderRadius: '5px', background: c, boxShadow: '0 3px 0 rgba(0,0,0,0.15)' }, art);
      });
    } else {
      // 本物と おなじ：左が いちばん 太い穴、右へ だんだん 細く
      el('div', null, { position: 'absolute', left: '0px', top: '186px', width: '280px', height: '60px', borderRadius: '10px', background: '#d9b27a', boxShadow: '0 4px 0 rgba(0,0,0,0.18)' }, art);
      const ds = [44, 38, 32, 26, 20], gap = (280 - ds.reduce((a, b) => a + b, 0)) / (ds.length + 1);
      let hx = gap;
      ds.forEach((d) => {
        el('div', null, { position: 'absolute', left: px(hx), top: px(186 + (60 - d) / 2), width: px(d), height: px(d), borderRadius: '50%', background: '#7a5530' }, art);
        hx += d + gap;
      });
    }
    label(w.name, Math.min(34, Math.floor(250 / w.name.length)), '#6b5030', { left: '0', right: '0', top: px(262 + (34 - Math.min(34, Math.floor(250 / w.name.length))) / 2), whiteSpace: 'nowrap' }, it);
    if (!w.ready) {
      it.style.opacity = '0.45';
      const tp = el('div', 'tape', null, it); tp.textContent = 'じゅんびちゅう';
    }
    onTap(it, () => {
      if (!w.ready) {
        it.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(0)' }], { duration: 250 });
        return;
      }
      bounce(it); sound.click();
      later(150, () => go({ tower: towerScreen, tablets: tabletsScreen, cylinders: cylindersScreen }[w.id]));
    });
    items.push(it);
  });
  function place() {
    const x0 = sx(), floorY = Math.min(view.h - 70, 560);
    board.style.left = px(x0); board.style.top = px(floorY);
    panelBg.style.left = px(x0); panelBg.style.top = px(floorY - 330);
    sideL.style.left = px(x0); sideL.style.top = px(floorY - 334);
    sideR.style.left = px(x0 + SW - 26); sideR.style.top = px(floorY - 334);
    items.forEach((it, i) => { it.style.left = px(x0 + 40 + i * 320); it.style.top = px(floorY - 330 + 10); });
    vase.style.left = px(Math.max(8, x0 - 92)); vase.style.top = px(floorY + 26 - 170);
    if (vase.bell) { vase.bell.style.left = px(Math.max(8, x0 - 92) + 8); vase.bell.style.top = px(floorY + 26 - 250); }
    win.style.left = px(view.w - 150 - Math.max(30, x0 - 120));
  }
  place();
  // かくし：しずかに する ゲーム（20びょう なにも さわらないと、小鳥の 声と ちょうちょ）
  let quietFrom = performance.now(), flying = false;
  root.addEventListener('pointerdown', () => { quietFrom = performance.now(); }, true);
  const myToken = token;
  const qt = setInterval(() => {
    if (myToken !== token) { clearInterval(qt); return; }
    if (flying || performance.now() - quietFrom < 20000) return;
    flying = true; quietFrom = performance.now();
    secretFound('quiet', root, 12000);
    sound.bird(0); sound.bird(1.4); sound.bird(3.2);
    const bf = el('div', null, { position: 'absolute', width: '62px', height: '46px', left: '0', top: '0', pointerEvents: 'none', zIndex: '50' }, root);
    bf.innerHTML = BUTTERFLY_SVG;
    bf.querySelectorAll('.bw, .bw2').forEach((g, k) => g.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0.35)' }],
      { duration: 260, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }));
    bf.querySelector('.bw').style.transformOrigin = '20px 15px'; bf.querySelector('.bw2').style.transformOrigin = '20px 15px';
    const y0 = view.h * 0.28, kf = [];
    for (let k = 0; k <= 12; k++) kf.push({ transform: 'translate(' + px(-60 + (view.w + 120) * k / 12) + ',' + px(y0 + Math.sin(k * 1.1) * 60 - k * 6) + ') rotate(' + (Math.sin(k) * 10) + 'deg)' });
    bf.animate(kf, { duration: 11000, easing: 'linear' }).onfinish = () => { bf.remove(); flying = false; quietFrom = performance.now(); };
  }, 500);
  return { onResize: place, dispose() { clearInterval(qt); } };
}

// ======================= ピンクタワー =======================
function towerScreen(root) {
  roomBg(root, 0.55);
  const floorBg = el('div', null, { position: 'absolute', left: '0', right: '0', bottom: '0', display: 'none' }, root);
  banner('ピンクタワー', 300, 4, root, 30);
  const rug = workMat({ left: '20px', right: '20px' }, root);
  const layer = el('div', null, { position: 'absolute', inset: '0' }, root);
  iconButton(root, 'icon_home', 90, '#e98aa3', { left: '20px', top: '14px' }, () => go(shelfScreen));
  // くずして、はじめから（いつでも）
  const againBtn = iconButton(root, 'icon_again', 76, '#b7c79a', { right: '22px', top: '20px' }, () => { againBtn.classList.remove('invite'); scatter(true); });

  let FLOOR = 0, U = 11;
  const cubes = [];
  for (let n = 1; n <= 10; n++) cubes.push({ n: n, s: 0, d: 0, x: 0, y: 0, below: null, above: null, el: null });
  function sizes() {
    FLOOR = view.h - 56;
    U = Math.min(11, (FLOOR - 40) / (55 + 0.3));
    rug.style.top = px(FLOOR - 70); rug.style.bottom = '16px';
    floorBg.style.top = px(FLOOR - 150);
    cubes.forEach((c) => {
      c.s = c.n * U; c.d = c.s * DEPTH;
      if (!c.el) c.el = makeCube(layer, c.s);
      else {
        c.el.remove(); c.el = makeCube(layer, c.s);
      }
    });
  }
  function level(c) { let k = 0; while (c.below) { c = c.below; k++; } return k; }
  function base(c) { while (c.below) c = c.below; return c; }
  function render(c) { placeEl(c.el, c.x, c.y, c.s); c.el.style.zIndex = String(10 + level(c)); }
  /** 下の立方体の上に、まん中をそろえて乗せた時の位置 */
  function seatOn(c, b) {
    c.x = b.x + (b.s - c.s) / 2 + (b.d - c.d) / 2;
    c.y = b.y - b.s - (b.d - c.d) / 2;
  }
  function relayoutStack(b) {
    let c = b;
    while (c.above) { seatOn(c.above, c); c = c.above; }
  }
  function floorBases(except) { return cubes.filter((c) => !c.below && c !== except && c.y === FLOOR && !c.dragging); }
  /** ゆかの、あいている場所をさがす（ほかの立方体と重ならない所） */
  function freeX(c, want) {
    const lo = 44, hi = view.w - 44 - c.s - c.d, gap = 14;
    const occ = floorBases(c).map((b) => [b.x - gap, b.x + b.s + b.d + gap]);
    const ok = (x) => occ.every((o) => x + c.s + c.d < o[0] || x > o[1]);
    want = Math.max(lo, Math.min(hi, want));
    for (let k = 0; k < 400; k++) {
      const a = want + k * 6, b = want - k * 6;
      if (a <= hi && ok(a)) return a;
      if (b >= lo && ok(b)) return b;
    }
    return want;
  }
  function animateTo(c, x, y, dur, easing, done) {
    const fx = c.x, fy = c.y;
    c.x = x; c.y = y;
    const a = c.el.animate([{ left: px(fx), top: px(fy - c.s - c.d) }, { left: px(x), top: px(y - c.s - c.d) }], { duration: dur, easing: easing || 'ease-in' });
    render(c);
    if (done) a.onfinish = done;
  }

  // はじめ：立方体を ラグの上に ばらばらに置く
  let completeShown = false;
  let star = null, stairShown = false, starTap = false;
  function clearStar() { if (star) { star.remove(); star = null; } }
  function scatter(anim) {
    completeShown = false; stairShown = false; clearStar();
    const order = cubes.slice().sort(() => Math.random() - 0.5);
    cubes.forEach((c) => { c.below = null; c.above = null; c.y = FLOOR; c.x = -9999; });
    const total = order.reduce((a, c) => a + c.s + c.d, 0);
    const room = view.w - 88 - total;
    const gaps = []; let left = room;
    for (let i = 0; i <= order.length; i++) { const g = i === order.length ? left : Math.min(left, rand(14, Math.max(16, room / order.length * 1.6))); gaps.push(g); left -= g; }
    let x = 44 + gaps[0] * 0.5;
    order.forEach((c, i) => {
      const fx = c.x;
      c.x = x; c.y = FLOOR;
      x += c.s + c.d + gaps[i + 1];
      if (anim && fx > -9999) {
        c.el.animate([{ transform: 'translateY(-' + px(rand(80, 160)) + ') rotate(' + rand(-20, 20) + 'deg)', opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 450, delay: i * 50, easing: 'ease-in' });
      }
      render(c);
    });
    if (anim) later(450, () => sound.knock(5));
  }
  sizes();
  cubes.forEach((c) => { c.x = 0; c.y = FLOOR; });
  scatter(false);

  // ---------- 先生の おてほん：いちばん大きい立方体を まん中に、その上に つぎ、つぎ…… ----------
  const demo = makeDemo(root, 'tower');
  function cubeGrab(c) { return [c.x + (c.s + c.d) / 2, c.y - c.s - c.d * 0.5]; }
  async function carry(c, tx, ty) {
    const g = cubeGrab(c);
    await demo.handTo(g[0], g[1], 900);
    await demo.wait(200);
    demo.press();
    if (c.below) { c.below.above = null; c.below = null; }
    c.dragging = true; c.el.classList.add('lift'); c.el.style.zIndex = '1000';
    sound.lift();
    const fx = c.x, fy = c.y, liftY = Math.min(fy, ty) - 60;
    await demo.tween(450, (k) => { c.y = fy + (liftY - fy) * k; placeEl(c.el, c.x, c.y, c.s); const q = cubeGrab(c); demo.at(q[0], q[1]); });
    await demo.tween(1200, (k) => { c.x = fx + (tx - fx) * k; c.y = liftY + (ty - liftY) * k; placeEl(c.el, c.x, c.y, c.s); const q = cubeGrab(c); demo.at(q[0], q[1]); });
    c.dragging = false; c.el.classList.remove('lift');
    demo.open();
    drop(c);
    await demo.wait(700);
  }
  function startDemo() {
    const C = (n) => cubes[n - 1];
    demo.run([
      async () => { await demo.wait(500); const c = C(10); await carry(c, freeX(c, view.w / 2 - (c.s + c.d) / 2), FLOOR - 40); },
      async () => { const c = C(9), b = C(10); await carry(c, b.x + (b.s - c.s) / 2 + (b.d - c.d) / 2, b.y - b.s - 30); },
      async () => { const c = C(8), b = C(9); await carry(c, b.x + (b.s - c.s) / 2 + (b.d - c.d) / 2, b.y - b.s - 30); },
    ]);
  }
  onTap(demo.button, () => { bounce(demo.button); sound.click(); if (!demo.running) startDemo(); });
  if (!wasSeen('tower')) later(600, startDemo);

  // ---------- ゆびで運ぶ（一度に1こ。いちばん上だけ取れる） ----------
  let drag = null;
  function hit(p) {
    let best = null, bestD = 1e9;
    cubes.forEach((c) => {
      const pad = Math.max(0, (78 - c.s) / 2);
      const x0 = c.x - pad, x1 = c.x + c.s + c.d + pad, y0 = c.y - c.s - c.d - pad, y1 = c.y + pad;
      if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) return;
      const cx = c.x + (c.s + c.d) / 2, cy = c.y - (c.s + c.d) / 2;
      const d = Math.hypot(p[0] - cx, p[1] - cy) - (c.above ? 0 : 1000);   // 上が空いている立方体を優先
      if (d < bestD) { bestD = d; best = c; }
    });
    return best;
  }
  root.addEventListener('pointerdown', (ev) => {
    if (drag) return;
    const p = local(ev), c = hit(p);
    if (!c) return;
    if (c.above) {   // 上に乗っている時は取れない：いちばん上が、ちょっとゆれて知らせる
      let t = c; while (t.above) t = t.above;
      t.el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(0)' }], { duration: 300 });
      return;
    }
    const wasComplete = completeShown;
    if (c.below) { c.below.above = null; c.below = null; }
    drag = { c: c, id: ev.pointerId, ox: p[0] - c.x, oy: p[1] - c.y, sx: p[0], sy: p[1], t0: performance.now(), wasComplete: wasComplete, moved: 0 };
    c.dragging = true;
    clearStar(); stairShown = false;
    c.el.classList.add('lift');
    c.el.style.zIndex = '1000';
    try { root.setPointerCapture(ev.pointerId); } catch (e) { /* なにもしない */ }
    if (completeShown) completeShown = false;
    againBtn.classList.remove('invite');
    sound.lift();
  });
  root.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const p = local(ev), c = drag.c;
    drag.moved = Math.max(drag.moved, Math.hypot(p[0] - drag.sx, p[1] - drag.sy));
    c.x = p[0] - drag.ox; c.y = Math.min(FLOOR, p[1] - drag.oy);
    placeEl(c.el, c.x, c.y, c.s);
  });
  function release(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const c = drag.c;
    // かくし：できあがった タワーの てっぺん（いちばん 小さい 立方体）を そっと さわると、星が のる
    if (drag.wasComplete && c.n === 1 && drag.moved < 10 && performance.now() - drag.t0 < 450) starTap = true;
    drag = null;
    c.dragging = false;
    c.el.classList.remove('lift');
    drop(c);
  }
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  root.addEventListener('lostpointercapture', release);   // 指を はなした しらせが 来なかった時も、かならず はなす

  /** はなした所から、まっすぐ下に落ちる。最初にぶつかった面に乗る */
  function drop(c) {
    const cx = c.x + c.s / 2 + c.d / 2;
    let sup = null;
    cubes.forEach((t) => {
      if (t === c || t.above || t.dragging) return;
      // 小さい子でも乗せやすいよう、上の面より少し広めに受けとめる（小さい立方体ほど広めに）
      const tol = Math.max(14, (96 - t.s) / 2);
      const tl = t.x + t.d / 2 - tol, tr = t.x + t.s + t.d / 2 + tol;
      const top = t.y - t.s;
      if (cx < tl || cx > tr) return;            // まん中が その立方体の上にない
      if (top < c.y - 40 - c.s) return;           // その面より ずっと下に はなした
      if (!sup || top < sup.y - sup.s) sup = t;   // いちばん高い面
    });
    if (!sup) {   // ゆかへ
      const x = freeX(c, c.x);
      const dist = Math.max(0, FLOOR - c.y);
      animateTo(c, x, FLOOR, 140 + Math.sqrt(dist) * 14, 'ease-in', () => { sound.knock(c.n); squash(c); check(); });
      return;
    }
    if (c.s < sup.s) {   // 小さいので乗る
      const fx = c.x, fy = c.y;
      seatOn(c, sup);
      const x = c.x, y = c.y;
      c.x = fx; c.y = fy;
      c.below = sup; sup.above = c;
      const dist = Math.max(0, y - fy);
      animateTo(c, x, y, 120 + Math.sqrt(dist) * 12, 'ease-in', () => { sound.knock(c.n); squash(c); check(); });
      return;
    }
    // 大きいので乗らない：ぐらっとして、すべり落ちる（誤りの訂正）
    const fx = c.x, fy = c.y;
    const y = sup.y - sup.s;
    const side = cx < sup.x + sup.s / 2 ? -1 : 1;
    const x = sup.x + (sup.s - c.s) / 2 + side * Math.min(c.s * 0.35, 30);
    c.x = fx; c.y = fy;
    animateTo(c, x, y, 120 + Math.sqrt(Math.max(0, y - fy)) * 12, 'ease-in', () => {
      sound.knock(c.n);
      c.el.style.zIndex = '900';
      const wob = c.el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(' + (side * 7) + 'deg)' }, { transform: 'rotate(' + (-side * 4) + 'deg)' }, { transform: 'rotate(' + (side * 12) + 'deg)' }],
        { duration: 650, easing: 'ease-in-out', fill: 'forwards' });
      wob.onfinish = () => {
        sound.slide();
        const tx = freeX(c, side < 0 ? sup.x - c.s - c.d - 20 : sup.x + sup.s + sup.d + 20);
        const a = c.el.animate([{ transform: 'rotate(' + (side * 12) + 'deg)' }, { transform: 'rotate(0)' }], { duration: 420, easing: 'ease-in' });
        animateTo(c, tx, FLOOR, 420, 'ease-in', () => { sound.knock(c.n); squash(c); });
        a.onfinish = () => wob.cancel();
      };
    });
  }
  function squash(c) {
    c.el.animate([{ transform: 'scale(1.06,0.94)' }, { transform: 'scale(1,1)' }], { duration: 160, easing: 'ease-out' });
  }

  if (TEST) { window.__secretFinale = () => secretFinale(root); window.__secretFound = (id) => secretFound(id, root, 500); }
  if (TEST) window.__tower = { cubes: cubes, check: check, render: render, seatOn: seatOn, floor: () => FLOOR, setComplete: (v) => { completeShown = v; } };
  /** かくし：ゆかに 小さい順に 横 1れつ（かいだん）→ 小さな 天使が 1だんずつ のぼる */
  function checkStair() {
    if (stairShown) return;
    if (cubes.some((c) => c.below || c.above || c.dragging || c.y !== FLOOR)) return;
    const row = cubes.slice().sort((a, b) => a.x - b.x).map((c) => c.n);
    const up = row.every((n, i) => n === i + 1), down = row.every((n, i) => n === 10 - i);
    if (!up && !down) return;
    stairShown = true;
    secretFound('stair', root, 9000);
    const steps = cubes.slice().sort((a, b) => a.n - b.n);   // 小さい 立方体から
    const AW = 46, AH = 62;
    const ang = el('div', null, { position: 'absolute', width: px(AW), height: px(AH), left: '0', top: '0', zIndex: '1200', pointerEvents: 'none',
      filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.15))' }, layer);
    ang.innerHTML = ANGEL_SVG;
    const pos = (c) => [c.x + (c.s + c.d) / 2 - AW / 2, c.y - c.s - c.d * 0.5 - AH + 4];
    const first = steps[0], dir = up ? -1 : 1;
    let px0 = first.x + (dir < 0 ? -30 : first.s + first.d + 30), py0 = FLOOR - AH;
    ang.style.transform = 'translate(' + px(px0) + ',' + px(py0) + ')';
    ang.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'both' });
    let t = 700;
    steps.forEach((c, i) => {
      const [x, y] = pos(c), fx = px0, fy = py0;
      later(t, () => {
        ang.animate([{ transform: 'translate(' + px(fx) + ',' + px(fy) + ')' }, { transform: 'translate(' + px((fx + x) / 2) + ',' + px(Math.min(fy, y) - 26) + ')' },
          { transform: 'translate(' + px(x) + ',' + px(y) + ')' }], { duration: 420, easing: 'ease-in-out', fill: 'forwards' });
        later(420, () => sound.chime(i, 0));
      });
      px0 = x; py0 = y; t += 620;
    });
    later(t + 400, () => {
      ang.animate([{ filter: 'drop-shadow(0 0 0 #fff6c8)' }, { filter: 'drop-shadow(0 0 14px #fff6c8)' }, { filter: 'drop-shadow(0 0 0 #fff6c8)' }], { duration: 1200 });
      ang.animate([{ opacity: 1, transform: 'translate(' + px(px0) + ',' + px(py0) + ')' }, { opacity: 0, transform: 'translate(' + px(px0) + ',' + px(py0 - 60) + ')' }],
        { duration: 1800, delay: 1200, fill: 'forwards' }).onfinish = () => ang.remove();
    });
  }
  /** 10こ全部、大きい順に積めたか */
  function check() {
    checkStair();
    if (completeShown) return;
    const b = cubes.find((c) => !c.below && c.n === 10 && c.y === FLOOR);
    if (!b) { starTap = false; return; }
    let c = b, k = 10;
    while (c && c.n === k) { c = c.above; k--; }
    if (k !== 0) { starTap = false; return; }
    completeShown = true;
    if (starTap) {   // てっぺんを そっと さわった：星が のる（音は 小さく 1つ）
      starTap = false;
      const top = cubes[0];
      clearStar();
      secretFound('star', root, 3000);
      star = el('div', null, { position: 'absolute', width: '34px', height: '34px', zIndex: '1100', pointerEvents: 'none',
        left: px(top.x + (top.s + top.d) / 2 - 17), top: px(top.y - top.s - top.d - 30) }, layer);
      star.innerHTML = STAR_SVG;
      star.animate([{ transform: 'translateY(-40px) scale(0.4)', opacity: 0 }, { transform: 'translateY(0) scale(1)', opacity: 1 }], { duration: 700, easing: 'ease-out' });
      star.animate([{ filter: 'drop-shadow(0 0 0 #fff6c8)' }, { filter: 'drop-shadow(0 0 8px #fff6c8)' }], { duration: 1400, iterations: Infinity, direction: 'alternate' });
      sound.chime(9, 0.1);
      return;
    }
    workDone('tower', root);
    later(2600, () => showDone(root));
    later(2600, () => { if (completeShown) againBtn.classList.add('invite'); });
    // できた：下から上へ、ひとつずつ ほんのり光って、音が上がっていく（ごほうびではなく、しずかな「できた」）
    let t = b, i = 0;
    later(350, () => {
      while (t) {
        const cc = t, w = i * 0.22;
        sound.chime(i, w);
        later(w * 1000, () => cc.el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.25) drop-shadow(0 0 10px #fff6c8)' }, { filter: 'brightness(1)' }], { duration: 700 }));
        t = t.above; i++;
      }
    });
  }

  return {
    onResize() {
      const old = cubes.map((c) => ({ c: c, rx: c.x / Math.max(1, view.w), base: base(c) }));
      if (drag) { const c = drag.c; drag = null; c.dragging = false; c.el.classList.remove('lift'); }   // 運んでいる とちゅうなら、いったん はなす
      sizes();
      cubes.filter((c) => !c.below).forEach((c) => { c.y = FLOOR; });
      old.forEach((o) => { if (!o.c.below) { o.c.x = freeX(o.c, o.rx * view.w); } });
      cubes.filter((c) => !c.below).forEach((c) => relayoutStack(c));
      cubes.forEach(render);
    },
  };
}

// ======================= いろいた（色の こい順に ならべる） =======================
// 色板の箱3：同じ色の 7だんかいの こさ。こい → うすい（または うすい → こい）の順に ならべる。
// 7つの場所が ぜんぶ うまって、順番が ちがう時は、ちがう板が すこし かたむく（自分で気づける）。
const TAB_HUES = [
  { id: 'red', h: 0, s: 72 }, { id: 'blue', h: 214, s: 62 }, { id: 'yellow', h: 46, s: 92 }, { id: 'green', h: 132, s: 48 },
];
const TAB_COUNTS = [3, 5, 7];   // 小さい子は少ない まい数から（3さい：3まい → 5まい → 7まい）
function shade(hue, k, n) {   // k = 0（いちばん こい）〜 n-1（いちばん うすい）
  const L = 26 + k * (66 / (n - 1));
  return 'hsl(' + hue.h + ',' + hue.s + '%,' + L.toFixed(1) + '%)';
}
function tabletsScreen(root, arg) {
  const hue = TAB_HUES.find((q) => q.id === ((arg && arg.hue) || 'red')) || TAB_HUES[0];
  const TAB_N = (arg && arg.n) || 5;
  roomBg(root, 0.6);
  const rug = workMat({ left: '30px', right: '30px', top: '112px', bottom: '16px' }, root);
  // かくし：赤・青・黄・緑を ぜんぶ できると、ラグの ふちに 4色の 細い 線
  function colorFrame(fadeIn) {
    if (rug.querySelector('.cframe')) return;
    const f = el('div', 'cframe', { position: 'absolute', left: '10px', right: '10px', top: '10px', bottom: '10px', borderRadius: '12px', borderStyle: 'solid', borderWidth: '5px',
      borderTopColor: shade(TAB_HUES[0], 1, 5), borderRightColor: shade(TAB_HUES[1], 1, 5), borderBottomColor: shade(TAB_HUES[2], 1, 5), borderLeftColor: shade(TAB_HUES[3], 1, 5),
      pointerEvents: 'none', opacity: '0.85' }, rug);
    if (fadeIn) f.animate([{ opacity: 0 }, { opacity: 0.85 }], { duration: 2500, delay: 1200, easing: 'ease-in-out', fill: 'both' });
  }
  const colorsDone = () => { const c = loadProg().colors || {}; return TAB_HUES.every((q) => c[q.id]); };
  if (colorsDone()) colorFrame(false);
  iconButton(root, 'icon_home', 90, '#e98aa3', { left: '20px', top: '14px' }, () => go(shelfScreen));
  const againBtn = iconButton(root, 'icon_again', 76, '#b7c79a', { right: '22px', top: '20px' }, () => go(tabletsScreen, { hue: hue.id, n: TAB_N }));
  // 色をえらぶ（左上）
  const pick = el('div', null, { position: 'absolute', left: '134px', top: '24px', width: '300px', height: '72px', display: 'flex', justifyContent: 'space-between' }, root);
  TAB_HUES.forEach((q) => {
    const b = el('div', 'pickbtn', { width: '68px', height: '68px', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, rgba(255,255,255,0.35), rgba(255,255,255,0) 45%), ' + shade(q, 1, 5), boxSizing: 'border-box', cursor: 'pointer',
      border: q.id === hue.id ? '8px solid #fff' : '4px solid rgba(255,255,255,0.7)', boxShadow: q.id === hue.id ? '0 0 0 4px #8a6a3a' : '0 3px 0 rgba(0,0,0,0.15)' }, pick);
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    onTap(b, () => { sound.click(); if (q.id !== hue.id) go(tabletsScreen, { hue: q.id, n: TAB_N }); });
  });
  // まい数をえらぶ（右上：小さい板が 3・5・7まい ならんだ ボタン）
  const cnt = el('div', null, { position: 'absolute', right: '206px', top: '24px', width: '270px', height: '72px', display: 'flex', justifyContent: 'space-between' }, root);
  TAB_COUNTS.forEach((n) => {
    const b = el('div', 'pickbtn', { width: '84px', height: '72px', borderRadius: '16px', background: '#fff8ec', boxSizing: 'border-box', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px',
      border: n === TAB_N ? '6px solid #fff' : '3px solid rgba(255,255,255,0.7)', boxShadow: n === TAB_N ? '0 0 0 4px #8a6a3a' : '0 3px 0 rgba(0,0,0,0.15)' }, cnt);
    for (let k = 0; k < n; k++) el('div', null, { width: px(n === 7 ? 7 : 10), height: '30px', borderRadius: '2px', background: shade(hue, k, n) }, b);
    b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    onTap(b, () => { sound.click(); if (n !== TAB_N) go(tabletsScreen, { hue: hue.id, n: n }); });
  });
  // 板・円柱の層は、指をさえぎらない（下のボタンが押せるように。運ぶ操作は画面全体で受けとる）
  const layer = el('div', null, { position: 'absolute', inset: '0', pointerEvents: 'none' }, root);
  const TW = 100, TH = 146, GAP = 22;   // 子どもの 指で もちやすい 大きさ
  banner('いろいた', 300, 4, root, 30);
  const tray = el('div', 'tray', { position: 'absolute', height: px(TH + 36), borderRadius: '20px', pointerEvents: 'none',
    background: 'linear-gradient(#f3d3a2, #e2b47a)', boxShadow: 'inset 0 4px 0 rgba(255,250,235,0.7), inset 0 -6px 0 rgba(150,95,40,0.25), 0 6px 10px rgba(90,60,30,0.2)' }, root);
  root.insertBefore(tray, layer);   // 板と 置き場所の 下に
  const slots = [];
  for (let k = 0; k < TAB_N; k++) {
    const sl = { k: k, x: 0, y: 0, t: null, el: el('div', 'slot', { position: 'absolute', width: px(TW), height: px(TH), borderRadius: '12px', border: '4px dashed rgba(120,80,40,0.55)',
      background: 'rgba(255,250,236,0.6)', boxSizing: 'border-box', transition: 'background 0.15s, box-shadow 0.15s' }, layer) };
    slots.push(sl);
  }
  const tabs = [];
  for (let k = 0; k < TAB_N; k++) {
    // 色は プログラムの 値（shade）。上下は 木の わく（本物の 色板と 同じ つくり）
    const e = el('div', null, { position: 'absolute', width: px(TW), height: px(TH), borderRadius: '10px', overflow: 'hidden', background: shade(hue, k, TAB_N),
      boxShadow: '0 4px 0 rgba(90,55,25,0.25), 0 6px 8px rgba(0,0,0,0.12)', transformOrigin: '50% 50%' }, layer);
    el('div', null, { position: 'absolute', inset: '0', background: 'linear-gradient(100deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.05) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.08) 100%)' }, e);
    const wood = 'linear-gradient(#f6cf93, #e0a660 55%, #c98a45)';
    el('div', null, { position: 'absolute', left: '0', right: '0', top: '0', height: '22px', background: wood, boxShadow: 'inset 0 2px 0 rgba(255,245,220,0.8), 0 2px 2px rgba(90,55,25,0.25)' }, e);
    el('div', null, { position: 'absolute', left: '0', right: '0', bottom: '0', height: '22px', background: wood, boxShadow: 'inset 0 2px 0 rgba(255,245,220,0.8), inset 0 -3px 0 rgba(150,95,40,0.35)' }, e);
    tabs.push({ k: k, x: 0, y: 0, rot: 0, slot: null, el: e });
  }
  function render(t) { t.el.style.left = px(t.x); t.el.style.top = px(t.y); t.el.style.transform = 'rotate(' + t.rot + 'deg)'; }
  function slotsPlace() {
    const total = TAB_N * TW + (TAB_N - 1) * GAP, x0 = (view.w - total) / 2, y = view.h - 24 - 40 - TH;
    slots.forEach((sl, i) => { sl.x = x0 + i * (TW + GAP); sl.y = y; sl.el.style.left = px(sl.x); sl.el.style.top = px(sl.y); });
    tray.style.left = px(x0 - 22); tray.style.width = px(total + 44); tray.style.top = px(y - 18);
  }
  slotsPlace();
  // 上の方に ばらばらに置く
  function freeSpot() {
    const x0 = 80, x1 = view.w - 80 - TW, y0 = 150, y1 = Math.max(y0 + 10, slots[0].y - TH - 40);
    for (let tries = 0; tries < 200; tries++) {
      const x = rand(x0, x1), y = rand(y0, y1);
      if (tabs.every((o) => o.slot || o.x < -999 || Math.abs(o.x - x) > TW + 16 || Math.abs(o.y - y) > TH + 10)) return [x, y];
    }
    return [rand(x0, x1), rand(y0, y1)];
  }
  tabs.forEach((t) => { t.x = -9999; });
  tabs.slice().sort(() => Math.random() - 0.5).forEach((t) => { const p = freeSpot(); t.x = p[0]; t.y = p[1]; t.rot = rand(-14, 14); render(t); });

  function moveTo(t, x, y, rot, ms) {
    const fx = t.x, fy = t.y, fr = t.rot;
    t.x = x; t.y = y; t.rot = rot;
    t.el.animate([{ left: px(fx), top: px(fy), transform: 'rotate(' + fr + 'deg)' }, { left: px(x), top: px(y), transform: 'rotate(' + rot + 'deg)' }], { duration: ms || 220, easing: 'ease-out' });
    render(t);
  }
  let done = false, wave = false;
  const dirs = {};
  if (TEST) window.__tabs = { tabs: tabs, slots: slots, placeIn: (t, sl) => placeIn(t, sl) };
  function tap(k) { sound.knock(4 + k * 0.6); }
  function placeIn(t, sl) {
    if (sl.t && sl.t !== t) {   // もう板があれば、その板は 動かした板が もといた所へ
      const o = sl.t;
      o.slot = null; sl.t = null;
      if (t.prevSlot) { t.prevSlot.t = o; o.slot = t.prevSlot; moveTo(o, o.slot.x, o.slot.y, 0); }
      else moveTo(o, t.px, t.py, rand(-10, 10));
    }
    sl.t = t; t.slot = sl;
    moveTo(t, sl.x, sl.y, 0, 160);
    tap(t.k);
    check();
  }
  function check() {
    slots.forEach((sl) => { if (sl.t) sl.t.el.style.filter = ''; });
    if (slots.some((sl) => !sl.t)) { done = false; return; }
    const asc = slots.filter((sl) => sl.t.k === sl.k).length, desc = slots.filter((sl) => sl.t.k === TAB_N - 1 - sl.k).length;
    if (asc === TAB_N || desc === TAB_N) {
      if (done) return;
      done = true;
      const dir = asc === TAB_N ? 'asc' : 'desc';
      workDone('tablets', root);
      later(1400, () => showDone(root));
      const pr = loadProg(); pr.colors = pr.colors || {};
      const before = colorsDone();
      pr.colors[hue.id] = true; saveProg(pr);
      if (!before && colorsDone()) { colorFrame(true); secretFound('colors4', root, 5000); }
      // かくし：こい順と うすい順の 両方で ならべると、板が 順番に ふわっと 光る（行って 帰る）
      dirs[dir] = true;
      if (dirs.asc && dirs.desc && !wave) {
        wave = true;
        secretFound('wave', root, 6000);
        const seq = slots.map((sl, i) => i).concat(slots.map((sl, i) => TAB_N - 1 - i));
        seq.forEach((i, k) => later(1800 + k * 160, () => {
          const t = slots[i].t; if (!t) return;
          t.el.animate([{ filter: 'brightness(1)', transform: 'translateY(0)' }, { filter: 'brightness(1.18) drop-shadow(0 0 12px #fff6c8)', transform: 'translateY(-10px)' },
            { filter: 'brightness(1)', transform: 'translateY(0)' }], { duration: 600, easing: 'ease-in-out' });
        }));
        later(1800, () => slots.forEach((sl, i) => sound.chime(Math.min(9, i + 2), i * 0.16 + 0.6)));
      }
      later(2600, () => { if (done) againBtn.classList.add('invite'); });
      later(300, () => slots.forEach((sl, i) => {
        sound.chime(asc === TAB_N ? i + 2 : TAB_N - i + 1, i * 0.2);
        later(i * 200, () => sl.t.el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.2) drop-shadow(0 0 10px #fff6c8)' }, { filter: 'brightness(1)' }], { duration: 700 }));
      }));
      return;
    }
    // ならびが ちがう板は、すこし かたむく（多く合っている向きで くらべる）
    const up = asc >= desc;
    later(250, () => slots.forEach((sl) => {
      const ok = up ? sl.t.k === sl.k : sl.t.k === TAB_N - 1 - sl.k;
      if (!ok) {
        sl.t.rot = sl.k % 2 ? 6 : -6;
        sl.t.el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(' + (sl.t.rot * 1.6) + 'deg)' }, { transform: 'rotate(' + sl.t.rot + 'deg)' }], { duration: 450, easing: 'ease-out' });
        render(sl.t);
      }
    }));
  }
  function release(t) {
    const cx = t.x + TW / 2, cy = t.y + TH / 2;
    let best = null, bd = 1e9;
    slots.forEach((sl) => { const d = Math.hypot(sl.x + TW / 2 - cx, sl.y + TH / 2 - cy); if (d < bd) { bd = d; best = sl; } });
    if (best && bd < 80) { placeIn(t, best); return; }
    const x = Math.max(60, Math.min(view.w - 60 - TW, t.x)), y = Math.max(140, Math.min(view.h - 40 - TH, t.y));
    moveTo(t, x, y, rand(-8, 8), 160);
    tap(t.k);
    check();
  }
  // ゆびで運ぶ
  let drag = null;
  root.addEventListener('pointerdown', (ev) => {
    if (drag || demo.running) return;
    const p = local(ev);
    let t = null;
    for (let i = layer.children.length - 1; i >= 0 && !t; i--) {
      const q = tabs.find((o) => o.el === layer.children[i]);
      if (q && p[0] > q.x - 10 && p[0] < q.x + TW + 10 && p[1] > q.y - 10 && p[1] < q.y + TH + 10) t = q;
    }
    if (!t) return;
    t.px = t.x; t.py = t.y; t.prevSlot = t.slot;
    if (t.slot) { t.slot.t = null; t.slot = null; }
    t.rot = 0; t.el.style.filter = '';
    layer.appendChild(t.el);
    t.el.style.boxShadow = '0 16px 14px rgba(0,0,0,0.22)';
    drag = { t: t, id: ev.pointerId, ox: p[0] - t.x, oy: p[1] - t.y };
    try { root.setPointerCapture(ev.pointerId); } catch (e) { /* なにもしない */ }
    sound.lift();
    render(t);
  });
  root.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const p = local(ev);
    drag.t.x = p[0] - drag.ox; drag.t.y = p[1] - drag.oy; render(drag.t);
    // ちかくの 置き場所を ふんわり 光らせる（どこに 置けるか わかるように）
    const cx = drag.t.x + TW / 2, cy = drag.t.y + TH / 2;
    slots.forEach((sl) => { const on = Math.hypot(sl.x + TW / 2 - cx, sl.y + TH / 2 - cy) < 80; sl.el.style.background = on ? 'rgba(255,246,200,0.95)' : 'rgba(255,250,236,0.6)';
      sl.el.style.boxShadow = on ? '0 0 0 6px rgba(255,236,160,0.7)' : 'none'; });
  });
  const up = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const t = drag.t; drag = null;
    slots.forEach((sl) => { sl.el.style.background = 'rgba(255,250,236,0.6)'; sl.el.style.boxShadow = 'none'; });
    t.el.style.boxShadow = '0 4px 0 rgba(90,55,25,0.25), 0 6px 8px rgba(0,0,0,0.12)';
    release(t);
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('lostpointercapture', up);   // 指を はなした しらせが 来なかった時も、かならず はなす

  // 先生の おてほん：いちばん こい板を はじに、つぎに こい板を となりに
  const demo = makeDemo(root, 'tablets');
  async function carry(t, sl) {
    await demo.handTo(t.x + TW / 2, t.y + TH / 2, 900);
    await demo.wait(200); demo.press(); sound.lift();
    t.px = t.x; t.py = t.y; t.prevSlot = null;
    layer.appendChild(t.el); t.el.style.boxShadow = '0 16px 14px rgba(0,0,0,0.22)';
    const fx = t.x, fy = t.y, fr = t.rot;
    await demo.tween(1300, (k) => { t.x = fx + (sl.x - fx) * k; t.y = fy + (sl.y - fy) * k; t.rot = fr * (1 - k); render(t); demo.at(t.x + TW / 2, t.y + TH / 2); });
    t.el.style.boxShadow = '0 4px 0 rgba(90,55,25,0.25), 0 6px 8px rgba(0,0,0,0.12)';
    demo.open();
    placeIn(t, sl);
    await demo.wait(700);
  }
  function startDemo() {
    demo.run([
      async () => { await demo.wait(500); if (!tabs[0].slot && !slots[0].t) await carry(tabs[0], slots[0]); },
      async () => { if (!tabs[1].slot && !slots[1].t) await carry(tabs[1], slots[1]); },
      async () => { if (TAB_N > 3 && !tabs[2].slot && !slots[2].t) await carry(tabs[2], slots[2]); },   // 3まいの時は2まいだけ（さいごは子どもが）
    ]);
  }
  onTap(demo.button, () => { bounce(demo.button); sound.click(); if (!demo.running) startDemo(); });
  if (!wasSeen('tablets')) later(600, startDemo);
  return {
    onResize() {
      slotsPlace();
      slots.forEach((sl) => { if (sl.t) { sl.t.x = sl.x; sl.t.y = sl.y; render(sl.t); } });
      // ならべていない板が 画面の外に 出たら、なかに もどす
      const yMax = Math.max(150, slots[0].y - TH - 10);
      tabs.forEach((t) => {
        if (t.slot || (drag && drag.t === t)) return;
        if (t.x < 40 || t.x > view.w - 40 - TW || t.y < 120 || t.y > yMax) {
          t.x = -9999;   // 自分は よけて、あいている所を さがす
          const p = freeSpot(); t.x = p[0]; t.y = p[1];
          render(t);
        }
      });
    },
  };
}

// ======================= はめこみえんちゅう =======================
// 木のブロックに、太さのちがう10この穴。円柱を、ぴったりの穴に もどす。
// 大きすぎる円柱は 穴に入らず、ころがり落ちる。小さい円柱は入るけれど すきまが見える。
// さいごに入らない円柱が出てきたら、どこかが ちがう（自分で気づける）。
function cylindersScreen(root) {
  roomBg(root, 0.6);
  workMat({ left: '30px', right: '30px', top: '106px', bottom: '16px' }, root);
  banner('はめこみえんちゅう', 460, 2, root, 27);
  iconButton(root, 'icon_home', 90, '#e98aa3', { left: '20px', top: '14px' }, () => go(shelfScreen));
  const againBtn = iconButton(root, 'icon_again', 76, '#b7c79a', { right: '22px', top: '20px' }, () => go(cylindersScreen));
  const N = 10, GAP = 20;
  const D = (i) => 86 - i * 7;   // 穴と円柱の直径（0 がいちばん太い）
  const blockW = Array.from({ length: N }, (_, i) => D(i)).reduce((a, b) => a + b, 0) + GAP * (N + 1), blockH = 130;
  const block = el('div', null, { position: 'absolute', width: px(blockW), height: px(blockH), borderRadius: '14px',
    background: 'repeating-linear-gradient(92deg, rgba(160,100,40,0) 0px, rgba(160,100,40,0.07) 3px, rgba(160,100,40,0) 9px, rgba(255,240,210,0.08) 17px, rgba(160,100,40,0) 26px), linear-gradient(#f6d29c, #e8b674 45%, #d9a05a)',
    boxShadow: 'inset 0 4px 0 rgba(255,248,226,0.8), inset 0 -8px 0 rgba(150,95,40,0.28), 0 8px 0 #b97b3c, 0 16px 16px rgba(0,0,0,0.18)' }, root);
  const holes = [];
  let hx = GAP;
  for (let i = 0; i < N; i++) {
    const d = D(i);
    const h = { i: i, d: d, cx: 0, cy: 0, c: null, ox: hx + d / 2 };
    h.el = el('div', null, { position: 'absolute', left: px(hx), top: px((blockH - d) / 2), width: px(d), height: px(d), borderRadius: '50%',
      background: 'radial-gradient(circle at 50% 62%, #8a5a2b 0%, #6a4019 45%, #4a2a0e 100%)',
      boxShadow: 'inset 0 7px 9px rgba(40,20,5,0.65), 0 2px 0 rgba(255,246,222,0.85), 0 -1px 0 rgba(150,95,40,0.4)' }, block);
    holes.push(h);
    hx += d + GAP;
  }
  // 板・円柱の層は、指をさえぎらない（下のボタンが押せるように。運ぶ操作は画面全体で受けとる）
  const layer = el('div', null, { position: 'absolute', inset: '0', pointerEvents: 'none' }, root);
  function blockPlace() {
    const bx = (view.w - blockW) / 2, by = 150;
    block.style.left = px(bx); block.style.top = px(by);
    holes.forEach((h) => { h.cx = bx + h.ox; h.cy = by + blockH / 2; });
  }
  blockPlace();
  const cyls = [];
  for (let i = 0; i < N; i++) {
    const d = D(i);
    // 円柱：上から 見た 木の 円と、つまみ（大きさは D(i) で 穴と 同じ 値）
    const e = el('div', null, { position: 'absolute', width: px(d), height: px(d), borderRadius: '50%', touchAction: 'none',
      background: 'radial-gradient(circle at 38% 32%, #ffe6bd 0%, #f6cf93 30%, #e6ad68 70%, #cf9049 100%)', boxShadow: '0 6px 0 #b97b3c, 0 9px 10px rgba(0,0,0,0.2)',
      transition: 'transform 0.18s ease-out, box-shadow 0.18s ease-out' }, layer);
    el('div', null, { position: 'absolute', inset: '7%', borderRadius: '50%', border: '1.5px solid rgba(170,110,50,0.25)', pointerEvents: 'none' }, e);
    const kn = Math.max(14, Math.round(d * 0.26));
    el('div', null, { position: 'absolute', left: '50%', top: '50%', width: px(kn), height: px(kn), margin: px(-kn / 2) + ' 0 0 ' + px(-kn / 2), borderRadius: '50%',
      background: 'radial-gradient(circle at 36% 30%, #ffe2b3, #e2a560 55%, #b97636)', boxShadow: '0 3px 0 #8f5a26, 0 4px 4px rgba(0,0,0,0.2)' }, e);
    cyls.push({ i: i, d: d, cx: 0, cy: 0, hole: null, el: e });
  }
  function render(c) { c.el.style.left = px(c.cx - c.d / 2); c.el.style.top = px(c.cy - c.d / 2); }
  function setIn(c, inHole) {
    c.el.style.boxShadow = inHole ? 'inset 0 0 0 2px rgba(90,55,25,0.35), 0 0 0 2px rgba(255,246,222,0.5)' : '0 6px 0 #b97b3c, 0 9px 10px rgba(0,0,0,0.2)';
    c.el.style.transform = inHole ? 'scale(0.96)' : '';
  }
  // ブロックの下に ばらばらに置く
  const areaTop = () => 150 + blockH + 40;
  function freeSpot(c, wx, wy) {
    const x0 = 80 + c.d / 2, x1 = view.w - 80 - c.d / 2, y0 = areaTop() + c.d / 2, y1 = view.h - 40 - c.d / 2;
    const ok = (x, y) => cyls.every((o) => o === c || o.hole || o.cx < -999 || Math.hypot(o.cx - x, o.cy - y) > (o.d + c.d) / 2 + 12);
    if (wx !== undefined) {
      wx = Math.max(x0, Math.min(x1, wx)); wy = Math.max(y0, Math.min(y1, wy));
      for (let r = 0; r < 600; r += 8) for (let a = 0; a < 12; a++) {
        const x = wx + Math.cos(a / 12 * 6.283) * r, y = wy + Math.sin(a / 12 * 6.283) * r;
        if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && ok(x, y)) return [x, y];
      }
    }
    for (let tries = 0; tries < 300; tries++) { const x = rand(x0, x1), y = rand(y0, y1); if (ok(x, y)) return [x, y]; }
    return [rand(x0, x1), rand(y0, y1)];
  }
  cyls.forEach((c) => { c.cx = -9999; });
  cyls.slice().sort(() => Math.random() - 0.5).forEach((c) => { const p = freeSpot(c); c.cx = p[0]; c.cy = p[1]; render(c); });
  function moveTo(c, x, y, ms) {
    const fx = c.cx, fy = c.cy;
    c.cx = x; c.cy = y;
    c.el.animate([{ left: px(fx - c.d / 2), top: px(fy - c.d / 2) }, { left: px(x - c.d / 2), top: px(y - c.d / 2) }], { duration: ms || 220, easing: 'ease-out' });
    render(c);
  }
  let done = false, mistakes = 0, orderNext = 0;
  // 太い順に 入れると 1つずつ 音階（ラ シ ド レ ミ ファ ソ ラ シ ド）。さいごは「ド」
  const ORDER_NOTES = [220.0, 246.9, 261.6, 293.7, 329.6, 349.2, 392.0, 440.0, 493.9, 523.3];
  function golden() {   // かくし：一度も まちがえずに できたら、木の ブロックが ほんのり 金色の つや
    block.style.background = 'linear-gradient(#f0cf8a, #d6a65e)';
    const sh = el('div', null, { position: 'absolute', top: '0', bottom: '0', width: '60px', left: '-80px', pointerEvents: 'none', borderRadius: '14px',
      background: 'linear-gradient(90deg, rgba(255,250,220,0), rgba(255,250,220,0.75), rgba(255,250,220,0))' }, block);
    block.style.overflow = 'hidden';
    sh.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + px(blockW + 160) + ')' }], { duration: 2200, delay: 1800, iterations: 3, easing: 'ease-in-out' });
  }
  if (TEST) window.__cyl = { cyls: cyls, holes: holes, release: (c) => release(c), mistakes: () => mistakes, order: () => orderNext };
  function check() {
    if (done || !holes.every((h) => h.c && h.c.d === h.d)) return;
    done = true;
    workDone('cylinders', root);
    later(2200, () => showDone(root, null, mistakes === 0 ? 'great' : null));
    if (mistakes === 0) { golden(); secretFound('golden', root, 6000); }
    if (orderNext === N) secretFound('scale', root, 6000);
    if (orderNext === N) later(200, () => { sound.note(261.6, 0.1, 1.6); sound.note(329.6, 0.1, 1.6); sound.note(392.0, 0.1, 1.6); });
    later(2600, () => { if (done) againBtn.classList.add('invite'); });
    later(300, () => holes.forEach((h, k) => {
      sound.chime(9 - k, k * 0.18);
      later(k * 180, () => h.c.el.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(1.25) drop-shadow(0 0 8px #fff6c8)' }, { filter: 'brightness(1)' }], { duration: 700 }));
    }));
  }
  function release(c) {
    let h = null, hd = 1e9;
    holes.forEach((q) => { const dd = Math.hypot(q.cx - c.cx, q.cy - c.cy); if (dd < Math.max(q.d / 2, 34) && dd < hd) { hd = dd; h = q; } });
    const onBlock = c.cy > 150 - c.d / 2 && c.cy < 150 + blockH + c.d / 2 && c.cx > holes[0].cx - holes[0].d && c.cx < holes[N - 1].cx + 60;
    if (h && !h.c && c.d <= h.d) {   // 入る（ぴったり、または すきまあり）
      h.c = c; c.hole = h;
      moveTo(c, h.cx, h.cy, 260);
      layer.insertBefore(c.el, layer.firstChild);
      setIn(c, true);
      if (c.d === h.d) c.el.animate([{ transform: 'scale(1.1)' }, { transform: 'scale(1.02)', offset: 0.5 }, { transform: 'scale(0.92)', offset: 0.8 }, { transform: 'scale(0.96)' }],
        { duration: 420, easing: 'ease-out' });   // すっと しずんで、ぴたっと おさまる
      if (c.d < h.d) mistakes++;   // すきまが ある（ちがう 穴）
      if (c.d === h.d && c.i === orderNext) { sound.note(ORDER_NOTES[orderNext], 0, 0.9); orderNext++; }
      else { orderNext = -1; sound.knock(3 + (9 - c.i) * 0.5); }
      check();
      return;
    }
    if (h || onBlock) {   // 大きすぎる・穴がふさがっている：のっかって、ころがり落ちる
      mistakes++; orderNext = -1;
      const tx = h ? h.cx : c.cx, ty = h ? h.cy : c.cy;
      moveTo(c, tx, ty, 140);
      sound.knock(2);
      c.el.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(6px,-3px)' }, { transform: 'translate(-6px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(0,0)' }], { duration: 450, delay: 140 });
      later(620, () => { sound.slide(); const p = freeSpot(c, tx, areaTop() + c.d / 2 + 10); moveTo(c, p[0], p[1], 420); });
      return;
    }
    const p = freeSpot(c, c.cx, c.cy);
    moveTo(c, p[0], p[1], 160);
    sound.knock(5);
  }
  // ゆびで運ぶ（つまみを持つように）
  let drag = null;
  root.addEventListener('pointerdown', (ev) => {
    if (drag || demo.running) return;
    const p = local(ev);
    let c = null, bd = 1e9;
    cyls.forEach((q) => { const dd = Math.hypot(q.cx - p[0], q.cy - p[1]); if (dd < Math.max(q.d / 2 + 6, 38) && dd < bd) { bd = dd; c = q; } });
    if (!c) return;
    if (c.hole) { c.hole.c = null; c.hole = null; done = false; againBtn.classList.remove('invite'); orderNext = -1; }
    setIn(c, false);
    layer.appendChild(c.el);
    c.el.style.boxShadow = '0 8px 0 #b97b3c, 0 26px 18px rgba(60,35,10,0.32)';
    c.el.style.transform = 'scale(1.1) translateY(-6px)';   // もちあげた（すこし 大きく、かげが はなれる）
    drag = { c: c, id: ev.pointerId, ox: p[0] - c.cx, oy: p[1] - c.cy };
    try { root.setPointerCapture(ev.pointerId); } catch (e) { /* なにもしない */ }
    sound.lift();
  });
  root.addEventListener('pointermove', (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const p = local(ev);
    drag.c.cx = p[0] - drag.ox; drag.c.cy = p[1] - drag.oy; render(drag.c);
  });
  const up = (ev) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const c = drag.c; drag = null;
    setIn(c, false);
    release(c);
  };
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('lostpointercapture', up);   // 指を はなした しらせが 来なかった時も、かならず はなす

  // 先生の おてほん：いちばん太い円柱を いちばん太い穴へ、つぎを つぎの穴へ
  const demo = makeDemo(root, 'cylinders');
  async function carry(c, h) {
    await demo.handTo(c.cx, c.cy, 900);
    await demo.wait(200); demo.press(); sound.lift();
    layer.appendChild(c.el);
    c.el.style.boxShadow = '0 14px 0 rgba(156,106,53,0.6), 0 20px 16px rgba(0,0,0,0.25)';
    const fx = c.cx, fy = c.cy;
    await demo.tween(1300, (k) => { c.cx = fx + (h.cx - fx) * k; c.cy = fy + (h.cy - fy) * k - Math.sin(k * Math.PI) * 50; render(c); demo.at(c.cx, c.cy); });
    demo.open();
    setIn(c, false);
    release(c);
    await demo.wait(700);
  }
  function startDemo() {
    demo.run([
      async () => { await demo.wait(500); if (!cyls[0].hole && !holes[0].c) await carry(cyls[0], holes[0]); },
      async () => { if (!cyls[1].hole && !holes[1].c) await carry(cyls[1], holes[1]); },
      async () => { if (!cyls[2].hole && !holes[2].c) await carry(cyls[2], holes[2]); },
    ]);
  }
  onTap(demo.button, () => { bounce(demo.button); sound.click(); if (!demo.running) startDemo(); });
  if (!wasSeen('cylinders')) later(600, startDemo);
  return {
    onResize() {
      blockPlace();
      holes.forEach((h) => { if (h.c) { h.c.cx = h.cx; h.c.cy = h.cy; render(h.c); } });
      // 穴に入っていない円柱が 画面の外に 出たら、なかに もどす
      cyls.forEach((c) => {
        if (c.hole || (drag && drag.c === c)) return;
        const r = c.d / 2;
        if (c.cx < 80 + r || c.cx > view.w - 80 - r || c.cy < areaTop() + r || c.cy > view.h - 40 - r) {
          const p = freeSpot(c, c.cx, c.cy); c.cx = p[0]; c.cy = p[1]; render(c);
        }
      });
    },
  };
}

// ======================= はじめる =======================
function backTarget() {
  if (curFn === towerScreen || curFn === tabletsScreen || curFn === cylindersScreen) return () => go(shelfScreen);
  if (curFn === shelfScreen) return () => go(titleScreen);
  return null;   // タイトルでは、ふつうに ページを もどる
}
// Android の「もどる」ボタンや iPhone の スワイプで、まちがって ゲームから出ないよう、1つ前の画面に もどる
function setupBack() {
  try { history.pushState({ tenshi: 1 }, ''); } catch (e) { return; }
  window.addEventListener('popstate', () => {
    const t = backTarget();
    if (t) { try { history.pushState({ tenshi: 1 }, ''); } catch (e) { /* なにもしない */ } t(); }
    else history.back();
  });
}
async function boot() {
  setupBack();
  layout();
  await Promise.all(IMAGES.map((f) => new Promise((ok) => {
    const im = new Image(); im.onload = () => { IMG[f.replace(/\.(png|jpg|webp)$/, '')] = im; ok(); }; im.onerror = ok; im.src = IMG_DIR + f;
  })).concat([document.fonts ? document.fonts.load('40px Nurie').catch(() => {}) : Promise.resolve()]));
  go(titleScreen);
}
boot();
