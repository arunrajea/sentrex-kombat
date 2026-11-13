(() => {
'use strict';

/* ------------------------------------------------------------------ setup */
const W = 960, H = 540, GROUND = 468;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const ROSTER = window.ROSTER, TITLE = window.GAME_TITLE || 'SENTREX KOMBAT';
const FONT = 'Impact, "Arial Black", sans-serif';
const BUILD = 'version 1';   // shown on the title screen so you can tell which copy is loaded
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
document.title = TITLE;



const shadeCache = new Map();
function shade(hex, k) {
  const key = hex + k; let v = shadeCache.get(key);
  if (!v) { v = shadeRaw(hex, k); shadeCache.set(key, v); }
  return v;
}
function shadeRaw(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ------------------------------------------------------------------ input */
const keys = {}, pressed = {};
// Four limb buttons, Tekken style: lp/rp = left/right punch, lk/rk = left/right kick.
const K1 = { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], lp: ['KeyF'], rp: ['KeyG'], lk: ['KeyV'], rk: ['KeyB'], special: ['KeyH'] };
const K2 = { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], lp: ['KeyI', 'Numpad4'], rp: ['KeyO', 'Numpad5'], lk: ['KeyK', 'Numpad1'], rk: ['KeyL', 'Numpad2'], special: ['KeyP', 'Numpad6'] };
const BLOCKED = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Slash', 'Enter', 'Quote']);
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  audio();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (BLOCKED.has(e.code)) e.preventDefault();
  if (G.scene === 'online' && net.ui === 'typing') {          // typing a room code
    if (/^Key[A-Z]$/.test(e.code) && net.code.length < 4) net.code += e.code[3];
    else if (e.code === 'Backspace') net.code = net.code.slice(0, -1);
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && net.code.length === 4) joinGame(net.code);
  }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
cv.addEventListener('pointerdown', audio);
cv.addEventListener('pointerup', () => { if (G.scene === 'online' && net.ui === 'hosting') shareInvite(); });

/* --------------------------------------------------------- touch controls */
// On-screen pad and buttons simply press the same keys as Player 1's keyboard.
const touchUI = document.getElementById('touch'), padEl = document.getElementById('pad'), stickEl = document.getElementById('stick');
const codeBox = document.getElementById('codebox'), codeIn = document.getElementById('code');
let touch = false;
function enableTouch() { if (!touch) { touch = true; touchUI.hidden = false; } }
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) enableTouch();
addEventListener('touchstart', enableTouch, { passive: true });
const press = c => { audio(); if (!keys[c]) pressed[c] = true; keys[c] = true; };
const release = c => { keys[c] = false; };
touchUI.querySelectorAll('button[data-k]').forEach(b => {
  const c = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } press(c); b.classList.add('on'); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { release(c); b.classList.remove('on'); });
});
let padId = null;
function padMove(e) {
  const r = padEl.getBoundingClientRect(), dx = (e.clientX - r.left) / r.width - .5, dy = (e.clientY - r.top) / r.height - .5;
  const set = (c, on) => on ? press(c) : release(c);
  set('KeyA', dx < -.13); set('KeyD', dx > .13); set('KeyW', dy < -.2); set('KeyS', dy > .18);
  stickEl.style.transform = `translate(${clamp(dx, -.32, .32) * r.width}px, ${clamp(dy, -.32, .32) * r.height}px)`;
}
padEl.addEventListener('pointerdown', e => { e.preventDefault(); padId = e.pointerId; try { padEl.setPointerCapture(padId); } catch (err) { /* ok */ } padMove(e); });
padEl.addEventListener('pointermove', e => { if (e.pointerId === padId) padMove(e); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) padEl.addEventListener(ev, e => {
  if (e.pointerId !== padId) return;
  padId = null; ['KeyA', 'KeyD', 'KeyW', 'KeyS'].forEach(release); stickEl.style.transform = '';
});
document.getElementById('fs').addEventListener('pointerup', () => {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen();
  else if (el.requestFullscreen) el.requestFullscreen().then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
});
addEventListener('contextmenu', e => e.preventDefault());
// Stop the phone browser's own gestures (double-tap zoom, pinch zoom, page drag) from
// hijacking fast button presses. The room-code box keeps normal behaviour so it can be typed in.
const inCodeBox = e => e.target && e.target.closest && e.target.closest('#codebox');
for (const ev of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(ev, e => { if (!inCodeBox(e) && e.cancelable) e.preventDefault(); }, { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) document.addEventListener(ev, e => e.preventDefault(), { passive: false });
codeIn.addEventListener('input', () => { codeIn.value = net.code = codeIn.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
codeBox.addEventListener('submit', e => { e.preventDefault(); if (net.code.length === 4) { codeIn.blur(); joinGame(net.code); } });

const held = (maps, k) => maps.some(m => m[k].some(c => keys[c]));
const hit = (maps, k) => maps.some(m => m[k].some(c => pressed[c]));
const EMPTY = { l: 0, r: 0, u: 0, d: 0, lp: 0, rp: 0, lk: 0, rk: 0, s: 0 };
function readInput(maps) {
  return { l: held(maps, 'left'), r: held(maps, 'right'), u: held(maps, 'up'), d: held(maps, 'down'),
           lp: hit(maps, 'lp'), rp: hit(maps, 'rp'), lk: hit(maps, 'lk'), rk: hit(maps, 'rk'), s: hit(maps, 'special') };
}
function nav(maps) {
  return { up: hit(maps, 'up'), down: hit(maps, 'down'), left: hit(maps, 'left'), right: hit(maps, 'right'),
           ok: hit(maps, 'lp') };
}
const anyOk = () => pressed.Enter || pressed.NumpadEnter || pressed.Space;

/* ------------------------------------------------------------------ audio */
let AC = null, muted = false;
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
  if (AC && AC.state === 'suspended') AC.resume();
}
function tone(f, d, type = 'square', v = .1, slide = 0, delay = 0) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + .02);
}
function noise(d, v = .3, fq = 1200) {
  if (!AC || muted) return;
  const n = AC.sampleRate * d | 0, b = AC.createBuffer(1, n, AC.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = AC.createBufferSource(); s.buffer = b;
  const fl = AC.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = fq;
  const g = AC.createGain(); g.gain.value = v;
  s.connect(fl).connect(g).connect(AC.destination); s.start();
}
const sfx = {
  hit: h => { noise(h ? .22 : .12, h ? .5 : .35, h ? 900 : 1600); tone(h ? 90 : 140, h ? .2 : .1, 'sine', .4, -50); },
  block: () => { noise(.06, .25, 3000); tone(320, .06, 'square', .06); },
  swing: () => noise(.07, .08, 2500),
  special: () => tone(220, .3, 'sawtooth', .08, 500),
  jump: () => tone(260, .1, 'sine', .06, 200),
  ko: () => { tone(200, .8, 'sawtooth', .15, -160); noise(.5, .5, 600); },
  move: () => tone(520, .04, 'square', .04),
  ok: () => { tone(660, .07, 'square', .05); tone(990, .1, 'square', .05, 0, .07); },
  back: () => tone(300, .08, 'square', .05, -100),
};
function sayRaw(t) {
  if (muted || !window.speechSynthesis) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t); u.rate = 1; u.pitch = .4; speechSynthesis.speak(u);
  } catch (e) { /* no speech */ }
}
// Online: the host plays sounds and forwards them; the guest only plays what the host sends.
const sfxRaw = Object.assign({}, sfx);
for (const k in sfx) sfx[k] = a => { if (net.role === 'guest') return; sfxRaw[k](a); record([k, a]); };
function say(t) { if (net.role === 'guest') return; sayRaw(t); record(['say', t]); }

/* ------------------------------------------------------------------ poses */
// Angles are measured from "straight down"; positive swings toward the opponent.
const LEG = 40, TORSO = 58, ARM = 30, HEAD = 26;
const CL = { lf: [1.25, -.2], lb: [.55, -1.1] };   // crouching legs
const P = {
  idle:   { lean: .12, af: [.7, 2.4], ab: [.35, 2.2], lf: [.38, -.02], lb: [-.25, -.6] },
  crouch: { lean: .3, af: [.8, 2.4], ab: [.5, 2.2], ...CL },
  jump:   { lean: .1, af: [.5, 1.6], ab: [-.3, .9], lf: [1.0, -.5], lb: [.3, -1.2] },
  punch:  { lean: .28, af: [1.5, 1.58], ab: [.2, 2.3], lf: [.55, 0], lb: [-.5, -.75] },
  kick:   { lean: -.4, af: [.3, 1.9], ab: [-.7, .6], lf: [1.5, 1.56], lb: [-.05, -.2] },
  cpunch: { lean: .4, af: [1.45, 1.55], ab: [.3, 2.2], ...CL },
  sweep:  { lean: -.35, af: [.2, 1.4], ab: [-.9, -.2], lf: [.95, -1.35], lb: [1.42, 1.5] },
  cross:  { lean: .38, af: [.3, 2.3], ab: [1.5, 1.58], lf: [.6, 0], lb: [-.55, -.8] },
  hkick:  { lean: -.5, af: [.4, 1.9], ab: [-.6, .7], lf: [-.08, -.2], lb: [1.8, 1.85] },
  cupper: { lean: .05, af: [.4, 2.2], ab: [2.4, 3.0], lf: [.7, -.2], lb: [.1, -.6] },
  lowkick: { lean: -.1, af: [.8, 2.4], ab: [.5, 2.2], lf: [1.3, 1.4], lb: [.55, -1.1] },
  jpunch: { lean: .5, af: [1.0, 1.05], ab: [.2, 2.0], lf: [.9, -.6], lb: [.2, -1.3] },
  jkick:  { lean: -.2, af: [.4, 1.8], ab: [-.5, .8], lf: [1.05, 1.1], lb: [.7, -1.3] },
  block:  { lean: -.06, af: [1.15, 3.0], ab: [.95, 2.85], lf: [.3, -.05], lb: [-.35, -.65] },
  cblock: { lean: .15, af: [1.15, 3.0], ab: [.95, 2.85], ...CL },
  hit:    { lean: -.45, af: [-.2, .7], ab: [-.9, -.3], lf: [.3, -.2], lb: [-.3, -.7] },
  fall:   { rot: -.9, lean: -.2, af: [.6, 1.2], ab: [-.5, .2], lf: [.7, .2], lb: [.2, -.4] },
  lying:  { rot: -1.5, lean: 0, af: [-.4, -.2], ab: [-.9, -.7], lf: [.25, .1], lb: [0, -.15] },
  cast:   { lean: .3, af: [1.5, 1.6], ab: [1.35, 1.7], lf: [.6, 0], lb: [-.55, -.8] },
  raise:  { lean: -.1, af: [2.8, 3.1], ab: [2.6, 2.9], lf: [.3, -.05], lb: [-.3, -.6] },
  slam:   { lean: .75, af: [.7, .8], ab: [.5, .6], ...CL },
  dash:   { lean: .7, af: [1.5, 1.56], ab: [-.6, .3], lf: [1.0, .2], lb: [-.8, -.95] },
  upper:  { lean: -.12, af: [2.85, 3.05], ab: [.1, 1.6], lf: [.95, -.4], lb: [-.05, -.25] },
  win:    { lean: -.05, af: [2.8, 3.2], ab: [2.6, 3.0], lf: [.2, 0], lb: [-.2, -.3] },
};
// Kicks move through three shapes instead of swinging a straight leg:
// chamber (knee up, shin folded) -> extended with a slight whip -> back to chamber.
Object.assign(P, {
  chamberF: { lean: -.2, af: [.5, 2.2], ab: [-.3, 1.4], lf: [1.35, -.35], lb: [-.05, -.25] },
  kick:     { lean: -.38, af: [.35, 2.0], ab: [-.8, .4], lf: [1.42, 1.64], lb: [-.08, -.3] },
  chamberB: { lean: -.3, af: [.6, 2.3], ab: [-.6, .9], lf: [-.05, -.3], lb: [1.5, -.5] },
  hkick:    { lean: -.62, af: [.5, 2.0], ab: [-1.0, -.1], lf: [-.12, -.34], lb: [1.78, 2.04] },
  chamberL: { lean: -.05, af: [.8, 2.4], ab: [.5, 2.2], lf: [1.2, -.3], lb: [.55, -1.1] },
  lowkick:  { lean: -.12, af: [.8, 2.4], ab: [.4, 2.0], lf: [1.28, 1.46], lb: [.55, -1.1] },
  sweep:    { lean: -.38, af: [.2, 1.4], ab: [-1.0, -.3], lf: [.95, -1.35], lb: [1.4, 1.56] },
  jkick:    { lean: -.25, af: [.4, 1.8], ab: [-.6, .7], lf: [1.02, 1.2], lb: [.7, -1.3] },
});
const clonePose = p => ({ lean: p.lean, rot: p.rot || 0, af: [...p.af], ab: [...p.ab], lf: [...p.lf], lb: [...p.lb] });
function mixPose(p, t, k) {
  p.lean = lerp(p.lean, t.lean, k); p.rot = lerp(p.rot, t.rot || 0, k);
  for (const key of ['af', 'ab', 'lf', 'lb']) {
    p[key][0] = lerp(p[key][0], t[key][0], k); p[key][1] = lerp(p[key][1], t[key][1], k);
  }
}
function skel(p) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const R = q => [q[0] * c - q[1] * s, q[0] * s + q[1] * c];
  const seg = (o, a, l) => [o[0] + Math.sin(a) * l, o[1] + Math.cos(a) * l];
  const neck = [Math.sin(p.lean) * TORSO, -Math.cos(p.lean) * TORSO];
  const head = [neck[0] + Math.sin(p.lean) * (HEAD - 2), neck[1] - Math.cos(p.lean) * (HEAD - 2)];
  const sh = [neck[0] * .86, neck[1] * .86];
  const eF = seg(sh, p.af[0], ARM), hF = seg(eF, p.af[1], ARM);
  const eB = seg(sh, p.ab[0], ARM), hB = seg(eB, p.ab[1], ARM);
  const kF = seg([0, 0], p.lf[0], LEG), fF = seg(kF, p.lf[1], LEG);
  const kB = seg([0, 0], p.lb[0], LEG), fB = seg(kB, p.lb[1], LEG);
  const S = { hip: [0, 0], neck: R(neck), head: R(head), sh: R(sh), eF: R(eF), hF: R(hF), eB: R(eB), hB: R(hB), kF: R(kF), fF: R(fF), kB: R(kB), fB: R(fB) };
  S.low = Math.max(S.fF[1] + 7, S.fB[1] + 7, S.kF[1] + 7, S.kB[1] + 7, 16, S.head[1] + HEAD, S.neck[1] + 14);
  return S;
}

/* ------------------------------------------------------------------ moves */
// su = startup, ac = active, rc = recovery (frames @60fps). h = hit level.
const MOVES = {
  lpunch: { su: 4, ac: 3, rc: 8, dmg: 4, reach: 78, hy: -120, hh: 30, kb: 5, stun: 21, pose: 'punch', h: 'high' },      // left jab
  rpunch: { su: 7, ac: 3, rc: 12, dmg: 8, reach: 86, hy: -118, hh: 34, kb: 7, stun: 24, pose: 'cross', h: 'high' },     // right cross
  lkick:  { su: 6, ac: 4, rc: 14, dmg: 7, reach: 100, hy: -85, hh: 40, kb: 8, stun: 22, pose: 'kick', h: 'mid' },       // left front kick
  rkick:  { su: 11, ac: 4, rc: 18, dmg: 12, reach: 108, hy: -125, hh: 44, kb: 11, stun: 26, pose: 'hkick', h: 'high' }, // right high kick
  cupper: { su: 7, ac: 5, rc: 16, dmg: 9, reach: 66, hy: -115, hh: 110, kb: 4, stun: 0, pose: 'cupper', h: 'mid', knock: true, launch: -11, duck: true },
  lowkick: { su: 6, ac: 3, rc: 12, dmg: 5, reach: 92, hy: -25, hh: 30, kb: 4, stun: 17, pose: 'lowkick', h: 'low', duck: true },
  cpunch: { su: 4, ac: 3, rc: 9, dmg: 4, reach: 74, hy: -70, hh: 30, kb: 4, stun: 18, pose: 'cpunch', h: 'mid', duck: true },
  sweep:  { su: 9, ac: 4, rc: 20, dmg: 8, reach: 108, hy: -16, hh: 30, kb: 5, stun: 0, pose: 'sweep', h: 'low', knock: true, duck: true },
  jpunch: { su: 4, ac: 12, rc: 4, dmg: 7, reach: 70, hy: -70, hh: 60, kb: 6, stun: 20, pose: 'jpunch', h: 'over', air: true },
  jkick:  { su: 5, ac: 14, rc: 4, dmg: 9, reach: 95, hy: -45, hh: 60, kb: 8, stun: 22, pose: 'jkick', h: 'over', air: true },
};
const SPECIALS = {
  fireball: { label: 'ENERGY BLAST', su: 14, ac: 2, rc: 22, pose: 'cast', special: true,
    frame(f) { if (f.stateT === this.su) spawnProj(f, 'ball'); } },
  quake: { label: 'GROUND QUAKE', su: 18, ac: 2, rc: 26, pre: 'raise', pose: 'slam', special: true, duck: true,
    frame(f) { if (f.stateT === this.su) { spawnProj(f, 'wave'); fight.shake = 9; noise(.3, .4, 300); } } },
  dash: { label: 'RUSH STRIKE', su: 8, ac: 14, rc: 16, pre: 'crouch', pose: 'dash', special: true, keepVx: true,
    dmg: 14, reach: 72, hy: -95, hh: 80, kb: 10, knock: true, h: 'mid',
    frame(f) { const t = f.stateT; if (t >= this.su && t < this.su + this.ac) f.vx = f.facing * 13; else f.vx *= .7; } },
  uppercut: { label: 'RISING UPPERCUT', su: 5, ac: 14, rc: 22, pre: 'crouch', pose: 'upper', special: true, keepVx: true,
    dmg: 15, reach: 66, hy: -120, hh: 150, kb: 5, knock: true, launch: -13, h: 'mid',
    frame(f) { const t = f.stateT; if (t === 1) f.invuln = 14; if (t === this.su) { f.vy = -13; f.y -= 1; f.vx = f.facing * 3; } } },
  teleport: { label: 'SHADOW STEP', su: 20, ac: 5, rc: 16, pre: 'cast', pose: 'punch', special: true,
    dmg: 11, reach: 88, hy: -105, hh: 70, kb: 8, knock: true, h: 'mid',
    frame(f, o) {
      const t = f.stateT;
      if (t === 1) f.invuln = 16;
      if (t < 12) f.alpha = 1 - t / 12;
      else if (t === 12) { f.x = clamp(o.x + f.facing * 75, 40, W - 40); f.facing = o.x >= f.x ? 1 : -1; burst(f.x, f.y - 90, f.def.accent, 10); }
      else f.alpha = Math.min(1, (t - 12) / 6);
    } },
};

Object.assign(MOVES.lkick, { pre: 'chamberF', post: 'chamberF', trail: 'F' });
Object.assign(MOVES.rkick, { pre: 'chamberB', post: 'chamberB', trail: 'B' });     // the roundhouse
Object.assign(MOVES.lowkick, { pre: 'chamberL', post: 'chamberL', trail: 'F' });
Object.assign(MOVES.sweep, { trail: 'B' });
Object.assign(MOVES.jkick, { trail: 'F' });
const STAND = { lp: 'lpunch', rp: 'rpunch', lk: 'lkick', rk: 'rkick' };
const DUCK = { lp: 'cpunch', rp: 'cupper', lk: 'lowkick', rk: 'sweep' };
const AIR = { lp: 'jpunch', rp: 'jpunch', lk: 'jkick', rk: 'jkick' };
for (const k in MOVES) MOVES[k].name = k;
for (const k in SPECIALS) SPECIALS[k].name = k;

/* ---------------------------------------------------------------- fighter */
// A fight holds 2 to 6 fighters. n = how many are in this fight.
function mkFighter(def, side, n = 2) {
  const hp = 70 + def.health * 10;
  const x = n === 2 ? (side ? 660 : 300) : 100 + side * (760 / (n - 1));
  return { def, side, x, y: GROUND, nx: x, ny: GROUND, vx: 0, vy: 0, facing: x < W / 2 ? 1 : -1,
    speed: 3 + def.speed * .5, power: .7 + def.power * .1, maxHp: hp, hp, lagHp: hp, energy: 50,
    state: 'idle', stateT: 0, move: null, hits: [], stun: 0, invuln: 0, alpha: 1,
    combo: 0, comboT: 0, buf: null, inp: EMPTY, backHeld: false, threat: false, crouchB: false,
    walkT: 0, downT: 0, flash: 0, fresh: true, gone: false, out: false, tgt: null, pose: clonePose(P.idle) };
}
const controllable = f => f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'block';
const isCrouch = f => f.state === 'crouch' || (f.state === 'block' && f.crouchB) || (f.state === 'attack' && f.move.duck && f.y >= GROUND);
function setState(f, s) { if (f.state !== s) { f.state = s; f.stateT = 0; } f.alpha = 1; }
function startMove(f, name) {
  const m = MOVES[name] || SPECIALS[name];
  f.state = 'attack'; f.stateT = 0; f.move = m; f.hits = []; f.buf = null;
  if (f.y >= GROUND) f.vx = 0;
  if (m.special) { sfx.special(); burst(f.x, f.y - 90, f.def.accent, 8); } else sfx.swing();
}
function hurtBox(f) {
  const h = isCrouch(f) ? 100 : f.y < GROUND ? 140 : 165;
  return { x1: f.x - 24, x2: f.x + 24, y1: f.y - h, y2: f.y };
}
// The fighter each one faces: the closest opponent still standing.
function nearest(f) {
  let best = null, bd = 1e9;
  for (const o of fight.f) {
    if (o === f) continue;
    const d = Math.abs(o.x - f.x) + (o.hp <= 0 ? 5000 : 0);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function threatTo(f) {
  if (fight.f.some(o => o !== f && o.state === 'attack' && Math.abs(o.x - f.x) < 260)) return true;
  return fight.proj.some(p => p.owner !== f && Math.abs(p.x - f.x) < 220);
}

function applyHit(att, def, m, dir, px, py) {
  if (def.invuln > 0 || def.state === 'down' || def.state === 'getup') return false;
  const cr = isCrouch(def);
  // blocking only works against attacks coming from the front
  const canBlock = controllable(def) && def.backHeld && def.y >= GROUND && dir * def.facing < 0 &&
    (m.h === 'low' ? cr : m.h === 'over' ? !cr : true);
  if (canBlock) {
    def.hp = Math.max(1, def.hp - m.dmg * .08);
    def.state = 'block'; def.stateT = 0; def.crouchB = cr; def.stun = 13; def.vx = dir * 4;
    att.energy = Math.min(100, att.energy + 3);
    sfx.block(); burst(px, py, '#9cf', 6);
    return true;
  }
  att.combo = def.state === 'hit' ? att.combo + 1 : 1; att.comboT = 100;
  const dmg = m.dmg * att.power * Math.max(.4, 1 - .12 * (att.combo - 1));
  def.hp = Math.max(0, def.hp - dmg);
  att.energy = Math.min(100, att.energy + 8); def.energy = Math.min(100, def.energy + 5);
  def.move = null; def.alpha = 1; def.flash = 6; def.buf = null;
  if (m.knock || def.y < GROUND || def.hp <= 0) {
    def.state = 'down'; def.stateT = 0; def.downT = 0;
    def.vy = m.launch || -8; def.vx = dir * (m.kb + 1); def.y = Math.min(def.y, GROUND - 1);
  } else {
    def.state = 'hit'; def.stateT = 0; def.stun = m.stun; def.vx = dir * m.kb;
    // cornered defender: push the attacker back instead so jabs can't loop forever
    if ((dir > 0 && def.x > W - 70) || (dir < 0 && def.x < 70)) att.vx = -dir * m.kb;
  }
  const heavy = m.dmg > 9, brawl = fight.n > 2;
  // the brief freeze on impact is kept very short in a brawl so six fighters don't stutter
  fight.hitstop = Math.max(fight.hitstop, brawl ? (heavy ? 3 : 1) : (heavy ? 7 : 4));
  fight.shake = Math.max(fight.shake, heavy ? 10 : 4);
  sfx.hit(heavy); burst(px, py, heavy ? att.def.accent : '#fff', heavy ? 14 : 8); ring(px, py, heavy ? 46 : 28);
  return true;
}

function updateFighter(f, o) {
  const inp = f.inp;
  f.stateT++;
  f.energy = Math.min(100, f.energy + .09);
  if (f.invuln > 0) f.invuln--;
  if (f.flash > 0) f.flash--;
  if (f.comboT > 0 && --f.comboT === 0) f.combo = 0;
  const btn = inp.s ? 's' : inp.rp ? 'rp' : inp.lp ? 'lp' : inp.rk ? 'rk' : inp.lk ? 'lk' : null;
  if (btn) f.buf = { k: btn, t: 8 };
  else if (f.buf && --f.buf.t <= 0) f.buf = null;
  let want = f.buf && f.buf.k;
  if (want === 's' && f.energy < 50) { want = null; f.buf = null; }

  if (controllable(f)) {
    if (f.stun > 0) { f.stun--; f.vx *= .8; f.backHeld = f.facing > 0 ? inp.l : inp.r; }
    else {
      f.facing = o.x >= f.x ? 1 : -1;
      const fwd = f.facing > 0 ? inp.r : inp.l, back = f.facing > 0 ? inp.l : inp.r;
      f.backHeld = back; f.threat = back && threatTo(f);
      if (want === 's') { f.energy -= 50; startMove(f, f.def.special); }
      else if (want) startMove(f, (inp.d ? DUCK : STAND)[want]);
      else if (inp.u) {
        setState(f, 'jump'); f.vy = -15.5; f.y -= 1; sfx.jump();
        f.vx = (fwd ? 1 : back ? -1 : 0) * f.facing * f.speed * 1.15;
      }
      else if (inp.d) { setState(f, 'crouch'); f.vx = 0; }
      else if (back) {
        if (f.threat) { setState(f, 'block'); f.crouchB = false; f.vx = 0; }
        else { setState(f, 'walk'); f.vx = -f.facing * f.speed * .8; f.walkT--; }
      }
      else if (fwd) { setState(f, 'walk'); f.vx = f.facing * f.speed; f.walkT++; }
      else { setState(f, 'idle'); f.vx = 0; }
    }
  } else if (f.state === 'jump') {
    if (want && want !== 's') startMove(f, AIR[want]);
  } else if (f.state === 'attack') {
    const m = f.move, t = f.stateT;
    if (m.frame) m.frame(f, o);
    if (f.y >= GROUND && !m.keepVx) f.vx *= .7;
    if (m.reach && t >= m.su && t < m.su + m.ac) {
      const x1 = Math.min(f.x, f.x + f.facing * m.reach), x2 = Math.max(f.x, f.x + f.facing * m.reach);
      const y1 = f.y + m.hy - m.hh / 2, y2 = f.y + m.hy + m.hh / 2;
      for (const d of fight.f) {                       // an attack can catch every opponent in reach, once each
        if (d === f || f.hits.includes(d.side)) continue;
        const hb = hurtBox(d);
        if (x1 < hb.x2 && x2 > hb.x1 && y1 < hb.y2 && y2 > hb.y1) {
          const px = clamp(f.x + f.facing * m.reach, hb.x1, hb.x2), py = clamp((y1 + y2) / 2, hb.y1 + 10, hb.y2 - 10);
          if (applyHit(f, d, m, f.facing, px, py)) f.hits.push(d.side);
        }
      }
    }
    if (f.state === 'attack' && !m.air && t >= m.su + m.ac + m.rc && f.y >= GROUND) setState(f, 'idle');
  } else if (f.state === 'hit') {
    f.vx *= .85;
    if (--f.stun <= 0) setState(f, 'idle');
  } else if (f.state === 'down') {
    if (f.y >= GROUND) {
      f.vx *= .8; f.downT++;
      if (f.downT > 34 && f.hp > 0) { setState(f, 'getup'); f.invuln = 26; }
    }
  } else if (f.state === 'getup') {
    f.vx = 0;
    if (f.stateT > 16) setState(f, 'idle');
  } else if (f.state === 'win') f.vx = 0;

  // physics
  if (f.y < GROUND || f.vy < 0) f.vy += .85;
  f.x += f.vx; f.y += f.vy;
  if (f.y >= GROUND) {
    f.y = GROUND;
    if (f.vy > 0) {
      f.vy = 0;
      if (f.state === 'jump' || (f.state === 'attack' && f.move.air)) { setState(f, 'idle'); f.vx = 0; }
      else if (f.state === 'down') { fight.shake = Math.max(fight.shake, 5); noise(.1, .25, 400); }
    }
  }
  f.x = clamp(f.x, 40, W - 40);
}

const poseRate = f => f.state === 'attack' && f.move && f.move.post && f.stateT >= f.move.su - 2 && f.stateT < f.move.su + f.move.ac ? .62 : .4;
function targetPose(f) {
  const t = fight.tick;
  switch (f.state) {
    case 'idle': { const b = Math.sin(t * .09 + f.side * 2) * .04;
      return { lean: .12 + b, af: [.7 + b, 2.4], ab: [.35 - b, 2.2], lf: P.idle.lf, lb: P.idle.lb }; }
    case 'walk': { const a = Math.sin(f.walkT * .28) * .55;
      return { lean: .14, af: [.7, 2.4], ab: [.35, 2.2], lf: [a + .1, a - .2], lb: [-a + .1, -a - .2] }; }
    case 'crouch': return f.threat ? P.cblock : P.crouch;
    case 'block': return f.crouchB ? P.cblock : P.block;
    case 'jump': return P.jump;
    case 'attack': {
      const m = f.move, t = f.stateT;
      if (!m) return P.idle;
      if (!m.post) return P[t < m.su ? (m.pre || m.pose) : m.pose];
      if (t < m.su - 2) return P[m.pre];                          // wind up
      if (t < m.su + m.ac + 2) return P[m.pose];                  // snap out
      return t < m.su + m.ac + m.rc * .6 ? P[m.post] : P.idle;    // pull back, then settle
    }
    case 'hit': return P.hit;
    case 'down': return f.y < GROUND ? P.fall : P.lying;
    case 'getup': return P.crouch;
    case 'win': return P.win;
  }
  return P.idle;
}

/* ------------------------------------------------------------ projectiles */
function spawnProj(f, kind) {
  const c = f.def.accent;
  if (kind === 'ball') fight.proj.push({ kind, x: f.x + f.facing * 60, y: f.y - 115, vx: f.facing * 9, r: 15, owner: f, color: c, life: 200, t: 0,
    m: { dmg: 11, h: 'mid', kb: 7, stun: 22 } });
  else fight.proj.push({ kind, x: f.x + f.facing * 50, y: GROUND - 14, vx: f.facing * 8, r: 16, owner: f, color: c, life: 70, t: 0,
    m: { dmg: 11, h: 'low', kb: 5, knock: true, launch: -10 } });
}
function updateProj() {
  const F = fight;
  for (const p of F.proj) {
    p.x += p.vx; p.t++; p.life--;
    if (p.x < -40 || p.x > W + 40) p.life = 0;
    for (const o of F.f) {
      if (o === p.owner || p.life <= 0) continue;
      const hb = hurtBox(o);
      if (p.x - p.r < hb.x2 && p.x + p.r > hb.x1 && p.y - p.r < hb.y2 && p.y + p.r > hb.y1) {
        if (applyHit(p.owner, o, p.m, Math.sign(p.vx), p.x, p.y)) p.life = 0;
      }
    }
  }
  for (const a of F.proj) for (const b of F.proj) {
    if (a !== b && a.owner !== b.owner && a.life > 0 && b.life > 0 && Math.abs(a.x - b.x) < 30 && Math.abs(a.y - b.y) < 40) {
      a.life = b.life = 0; burst((a.x + b.x) / 2, a.y, '#fff', 14); sfx.block();
    }
  }
  F.proj = F.proj.filter(p => p.life > 0);
}
// Hit sparks. Online, the host only tells the other players "a burst happened here";
// each screen draws its own particles, which keeps the messages small.
function spawnBurst(x, y, color, n) {
  if (!fight) return;
  if (fight.sparks.length > 140) return;
  for (let i = 0; i < n; i++) {
    const a = rand(Math.PI * 2), s = rand(2, 8);
    fight.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: rand(10, 22) | 0, max: 22, color, size: rand(2, 5) });
  }
}
function spawnRing(x, y, size) { if (fight) fight.sparks.push({ ring: true, x, y, life: 12, max: 12, color: '#fff', size }); }
function burst(x, y, color, n) { record(['b', x | 0, y | 0, color, n]); spawnBurst(x, y, color, n); }
function ring(x, y, size) { record(['r', x | 0, y | 0, size]); spawnRing(x, y, size); }
function updateSparks() {
  for (const s of fight.sparks) { if (!s.ring) { s.x += s.vx; s.y += s.vy; s.vy += .3; } s.life--; }
  fight.sparks = fight.sparks.filter(s => s.life > 0);
}

/* --------------------------------------------------------------------- AI */
function aiInput(f, o, ai) {
  const inp = { l: 0, r: 0, u: 0, d: 0, lp: 0, rp: 0, lk: 0, rk: 0, s: 0 };
  const sk = ai.skill, dx = o.x - f.x, dist = Math.abs(dx), tw = dx > 0 ? 'r' : 'l', aw = dx > 0 ? 'l' : 'r';
  const sp = f.def.special, canSp = f.energy >= 50;
  if (ai.seq.length) {                       // running a combo string
    if (controllable(f) && f.stun <= 0) { inp[ai.seq.shift()] = 1; if (o.state !== 'hit' && o.state !== 'block') ai.seq.length = 0; }
    return inp;
  }
  if (--ai.t <= 0) {
    ai.t = (22 - 14 * sk + rand(8)) | 0;
    const r = Math.random(), r2 = Math.random();
    const blockP = .15 + .7 * sk, aggro = .4 + .5 * sk;
    const shot = fight.proj.find(p => p.owner !== f && Math.abs(p.x - f.x) < 260 && Math.sign(p.vx) === Math.sign(f.x - p.x));
    const oppAtk = o.state === 'attack' && dist < 190;
    if ((shot || oppAtk) && r < blockP) {
      const lvl = shot ? shot.m.h : (o.move && o.move.h);
      ai.act = lvl === 'low' ? (shot && r2 < .5 ? 'jump' : 'cblock') : (shot && r2 < .35 ? 'crouch' : 'block');
      ai.t = 16;
    } else if (o.y < GROUND - 40 && dist < 130 && sp === 'uppercut' && canSp && r < aggro) ai.act = 'special';
    else if (o.y < GROUND - 40 && dist < 110 && r < aggro * .6) ai.act = 'cupper';
    else if (o.state === 'down' || o.state === 'getup') ai.act = dist < 140 ? 'back' : 'idle';
    else if (dist > 300) {
      ai.act = (sp === 'fireball' || sp === 'quake') && canSp && r < aggro * .6 ? 'special' : r < .85 ? 'fwd' : 'idle';
    } else if (dist > 120) {
      if (canSp && (sp === 'dash' || sp === 'teleport') && r < aggro * .35) ai.act = 'special';
      else if (canSp && (sp === 'fireball' || sp === 'quake') && r < aggro * .2) ai.act = 'special';
      else if (r < aggro * .22) ai.act = 'jumpin';
      else if (r < aggro + .15) ai.act = 'fwd';
      else ai.act = r < .94 ? 'idle' : 'back';
    } else {
      if (r < aggro) {
        if (r2 < .3) { ai.act = 'idle'; ai.seq = sk > .35 ? ['lp', 'rp', 'lk'] : ['lp', 'rp']; }
        else if (r2 < .44) ai.act = 'kick';
        else if (r2 < .58) ai.act = 'hkick';
        else if (r2 < .72) ai.act = 'sweep';
        else if (r2 < .86 && canSp && sp !== 'fireball' && sp !== 'quake') ai.act = 'special';
        else ai.act = 'cpunch';
      } else ai.act = r < aggro + .15 ? 'back' : 'block';
      ai.t = Math.min(ai.t, 12);
    }
  }
  switch (ai.act) {
    case 'fwd': inp[tw] = 1; break;
    case 'back': case 'block': inp[aw] = 1; break;
    case 'cblock': inp[aw] = 1; inp.d = 1; break;
    case 'crouch': inp.d = 1; break;
    case 'jump': inp.u = 1; ai.act = 'idle'; break;
    case 'jumpin': inp.u = 1; inp[tw] = 1; ai.act = 'air'; ai.airT = 15 + (rand(6) | 0); ai.t = 30; break;
    case 'air': inp[tw] = 1; if (--ai.airT <= 0) { inp.rk = 1; ai.act = 'idle'; } break;
    case 'kick': inp.lk = 1; ai.act = 'idle'; break;
    case 'hkick': inp.rk = 1; ai.act = 'idle'; break;
    case 'sweep': inp.rk = 1; inp.d = 1; ai.act = 'crouch'; ai.t = 4; break;
    case 'cpunch': inp[Math.random() < .5 ? 'lp' : 'lk'] = 1; inp.d = 1; ai.act = 'crouch'; ai.t = 4; break;
    case 'cupper': inp.rp = 1; inp.d = 1; ai.act = 'crouch'; ai.t = 4; break;
    case 'special': inp.s = 1; ai.act = 'idle'; break;
  }
  return inp;
}

/* ------------------------------------------------------------ game state */
const DIFF = ['EASY', 'NORMAL', 'HARD'];
const MAXP = 6;                                                  // most players in one online brawl
const PCOL = ['#ff6b6b', '#5ee7ff', '#c6ff00', '#ffb74d', '#ea80fc', '#ffffff'];   // player colours
// sel.c / sel.lock / picks / pids all have one entry per player.
const G = { scene: 'title', mode: 'arcade', diff: 1, menu: 0, t: 0, cd: 0, sel: { c: [0, 4], lock: [false, false] },
            ladder: [], ladderI: 0, picks: [null, null], pids: ['p1', 'p2'] };
let fight = null;

/* ----------------------------------------------------------------- online */
// One player hosts and runs the game. Up to five friends join; each sends its
// button presses to the host and draws what the host sends back.
// Two links are used: a direct browser-to-browser link (fast), and a public
// relay for players whose network blocks the direct link (mobile data etc).
const EDGES = ['lp', 'rp', 'lk', 'rk', 's', 'nl', 'nr', 'nu', 'nd', 'ok'];
const NOREMOTE = () => ({ l: 0, r: 0, u: 0, d: 0, lp: 0, rp: 0, lk: 0, rk: 0, s: 0, nl: 0, nr: 0, nu: 0, nd: 0, ok: 0 });
const net = { role: null, peer: null, conn: null, guests: [], relays: [], myId: 'h', ids: ['h'], ui: 'menu', menu: 0, code: '', msg: '',
              evD: [], evR: [], lastSent: '', copied: 0, joinId: 0, lastRx: 0, via: '', tick: 0 };
const ROOM = 'sentrexkombat-v1-';
const PEER_LIB = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const MQTT_LIB = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
const topic = (code, dir) => `sentrexkombat/v1/${code}/${dir}`;
const round2 = (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v;
const now = () => performance.now();
const parse = raw => { try { return JSON.parse(raw.toString()); } catch (e) { return null; } };
const uid = () => (Math.random() * 1e9 | 0).toString(36);
const lobbyIds = () => ['h', ...net.guests.map(g => g.id)];
const pkIdx = () => G.picks.length && G.picks.every(Boolean) ? G.picks.map(d => ROSTER.indexOf(d)) : null;
// Sounds and sparks the host produced this tick, to be replayed on every other screen.
function record(e) { if (net.role === 'host' && net.guests.length) { net.evD.push(e); net.evR.push(e); } }
function loadScript(url, ready, cb, fail) {
  if (ready()) return cb();
  const s = document.createElement('script');
  s.src = url; s.onload = cb; s.onerror = fail || (() => {});
  document.head.appendChild(s);
}
const loadPeer = (cb, fail) => loadScript(PEER_LIB, () => !!window.Peer, cb, fail);
const loadMqtt = (cb, fail) => loadScript(MQTT_LIB, () => !!window.mqtt, cb, fail);
const endClient = c => { try { c.end(true); } catch (e) { /* already closed */ } };
const shut = c => { try { c.close(); } catch (e) { /* already closed */ } };
function relayConn(client, pub) {
  return { relay: true, client, send(o) { client.publish(pub, typeof o === 'string' ? o : JSON.stringify(o), { qos: 0 }); }, close() { endClient(client); } };
}
function netClose() {
  voiceStop();
  const p = net.peer, c = net.conn, rs = net.relays, gs = net.guests;
  net.joinId++; net.peer = null; net.conn = null; net.role = null; net.guests = []; net.relays = [];
  net.evD = []; net.evR = []; net.ids = ['h']; net.myId = 'h';
  if (c) shut(c);
  gs.forEach(g => { if (g.conn) shut(g.conn); });
  rs.forEach(endClient);
  if (p) { try { p.destroy(); } catch (e) { /* already gone */ } }
}
function netFail(m) { netClose(); fight = null; net.ui = 'error'; net.msg = m; G.scene = 'online'; }

/* ---- voice chat ---- */
// Every pair of players with a direct link shares an audio call. Everyone can listen;
// the microphone button decides whether your own voice is sent. Players on the relay
// have no direct link, so they cannot take part in voice.
const voice = { tick: 0, on: false, mic: null, silent: null, calls: {}, tries: {}, err: '' };
const micBtn = document.getElementById('mic');
const voiceBase = () => ROOM + net.code;
function outStream() {
  if (voice.on && voice.mic) return voice.mic;
  if (!voice.silent) { audio(); if (!AC) return null; voice.silent = AC.createMediaStreamDestination().stream; }   // a silent track: listen only
  return voice.silent;
}
function dropCall(id) {
  const c = voice.calls[id];
  if (!c) return;
  delete voice.calls[id];
  try { c.call.close(); } catch (e) { /* already closed */ }
  if (c.el) { c.el.srcObject = null; c.el = null; }
}
function attachCall(call, id) {
  dropCall(id);
  const c = voice.calls[id] = { call, t0: now(), live: false, el: null };
  call.on('stream', st => {
    if (voice.calls[id] !== c) return;
    c.live = true;
    if (!c.el) { c.el = new Audio(); c.el.autoplay = true; }
    c.el.srcObject = st; c.el.play().catch(() => {});
  });
  const gone = () => { if (voice.calls[id] === c) dropCall(id); };
  call.on('close', gone); call.on('error', gone);
}
function onCall(call) {
  const base = voiceBase(), id = call.peer === base ? 'h' : call.peer.startsWith(base + '-') ? call.peer.slice(base.length + 1) : null;
  const st = outStream();
  if (!id || !st) return shut(call);
  call.answer(st); attachCall(call, id);
}
// Keep one call open with every other player in the room.
function voiceSync() {
  const p = net.peer;
  if (!p || p.destroyed || !p.open) return;
  const ids = (net.role === 'host' ? lobbyIds() : net.ids).filter(i => i !== net.myId);
  for (const id in voice.calls) if (!ids.includes(id)) dropCall(id);
  for (const id of ids) {
    const c = voice.calls[id];
    if (c) { if (!c.live && now() - c.t0 > 9000) dropCall(id); continue; }
    if (net.myId < id && (voice.tries[id] || 0) < 4) {       // the "smaller" id places the call, so each pair gets exactly one
      const st = outStream();
      if (!st) return;
      voice.tries[id] = (voice.tries[id] || 0) + 1;
      const call = p.call(voiceBase() + (id === 'h' ? '' : '-' + id), st);
      if (call) attachCall(call, id);
    }
  }
}
function sendTrack() {
  const st = outStream(), t = st && st.getAudioTracks()[0];
  if (!t) return;
  for (const id in voice.calls) {
    const pc = voice.calls[id].call.peerConnection;
    if (pc) pc.getSenders().forEach(sn => { if (!sn.track || sn.track.kind === 'audio') sn.replaceTrack(t).catch(() => {}); });
  }
}
async function toggleMic() {
  if (!net.role || !net.peer) return;
  if (voice.on) { voice.on = false; sendTrack(); return; }
  try {
    if (!voice.mic) voice.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    voice.on = true; voice.err = ''; sendTrack();
  } catch (e) { voice.err = 'MICROPHONE BLOCKED'; }
}
function voiceStop() {
  for (const id in voice.calls) dropCall(id);
  if (voice.mic) { voice.mic.getTracks().forEach(t => t.stop()); voice.mic = null; }
  voice.on = false; voice.tries = {}; voice.err = '';
}
if (micBtn) micBtn.addEventListener('pointerup', e => { e.preventDefault(); toggleMic(); });

/* ---- host side ---- */
function addGuest(id, kind, conn, client) {
  let g = net.guests.find(x => x.id === id);
  if (g) {                                   // the same player switching from the direct link to the relay
    if (g.conn && g.conn !== conn) { const old = g.conn; g.conn = null; shut(old); }
    g.kind = kind; g.conn = conn; g.client = client; g.lastRx = now();
    return g;
  }
  if (net.guests.length >= MAXP - 1) return null;
  g = { id, kind, conn, client, remote: NOREMOTE(), lastRx: now() };
  net.guests.push(g); sfxRaw.ok();
  if (G.scene === 'online') gotoSelect();                                  // first friend arrived: open the lobby
  else if (G.scene === 'select') { G.sel.c.push((net.guests.length * 3) % ROSTER.length); G.sel.lock.push(false); G.cd = 0; }
  return g;                                  // joined mid-fight: they watch, and play from the next character select
}
function removeGuest(g) {
  const i = net.guests.indexOf(g);
  if (i < 0) return;
  net.guests.splice(i, 1);
  if (g.conn) { const c = g.conn; g.conn = null; shut(c); }
  if (G.scene === 'select') { G.sel.c.splice(i + 1, 1); G.sel.lock.splice(i + 1, 1); G.cd = 0; }
  if (!net.guests.length && (G.scene === 'select' || G.scene === 'vs')) { G.scene = 'online'; net.ui = 'hosting'; }
}
function guestMsg(g, m) {
  if (typeof m === 'string') m = parse(m);
  if (!m) return;
  g.lastRx = now();
  if (m.t === 'i' && Array.isArray(m.h) && Array.isArray(m.e)) {
    const R = g.remote;
    [R.l, R.r, R.u, R.d] = m.h;
    EDGES.forEach((k, i) => { if (m.e[i]) R[k] = 1; });
  }
}
function hostGame() {
  netClose();
  const id = net.joinId, code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[rand(24) | 0]).join('');
  const ready = () => {
    if (net.joinId !== id || net.ui !== 'wait') return;
    net.code = code; net.ui = 'hosting'; net.role = 'host'; net.myId = 'h'; G.mode = 'online';
  };
  net.ui = 'wait'; net.msg = 'Creating room…'; net.code = '';
  loadPeer(() => {                                            // direct links
    if (net.joinId !== id) return;
    const p = net.peer = new window.Peer(ROOM + code);
    p.on('open', ready);
    p.on('call', onCall);
    p.on('connection', c => c.on('open', () => {
      if (net.joinId !== id) return shut(c);
      const g = addGuest((c.metadata && c.metadata.id) || uid(), 'direct', c, null);
      if (!g) { try { c.send(JSON.stringify({ t: 'full' })); } catch (e) { /* closing */ } setTimeout(() => shut(c), 600); return; }
      c.on('data', d => { if (g.conn === c) guestMsg(g, d); });
      c.on('close', () => { if (g.conn === c) removeGuest(g); });
    }));
    p.on('error', e => { if (net.peer === p && e.type === 'unavailable-id') netFail('Room code clash. Please try again.'); });
  });
  loadMqtt(() => BROKERS.forEach(url => {                     // relay links
    if (net.joinId !== id) return;
    const c = window.mqtt.connect(url, { clientId: `sb-h-${code}-${uid()}`, clean: true, connectTimeout: 8000, reconnectPeriod: 3000 });
    net.relays.push(c);
    c.on('error', () => {});
    c.on('connect', () => c.subscribe(topic(code, 'up'), err => { if (!err) ready(); }));
    c.on('message', (t, raw) => {
      const m = parse(raw);
      if (!m || !m.id || net.joinId !== id) return;
      if (m.t === 'hello') {
        const g = addGuest(m.id, 'relay', null, c);
        c.publish(topic(code, 'down'), JSON.stringify({ t: g ? 'welcome' : 'full', id: m.id }), { qos: 0 });
        return;
      }
      const g = net.guests.find(x => x.id === m.id);
      if (g && g.client === c) guestMsg(g, m);
    });
  }));
  setTimeout(() => { if (net.joinId === id && net.ui === 'wait') netFail('Could not create a room. Check your internet connection.'); }, 20000);
}
// What every other player needs to draw the current frame. Kept small: poses and
// particles are worked out on each screen instead of being sent.
function snapshot(ev) {
  const F = fight;
  return { t: 's', pk: pkIdx(), ids: F.pid, lob: lobbyIds(), ev,
    F: { round: F.round, phase: F.phase, timer: F.timer, tick: F.tick, stage: F.stage, banner: F.banner, menu: F.menu, shake: F.shake, wins: F.wins, hitstop: F.hitstop },
    f: F.f.map(f => ({ x: f.x, y: f.y, vx: f.vx, vy: f.vy, facing: f.facing, state: f.state, stateT: f.stateT, mv: f.move ? f.move.name : 0,
      hp: f.hp, energy: f.energy, alpha: f.alpha, flash: f.flash, combo: f.combo, crouchB: +f.crouchB, threat: +f.threat, walkT: f.walkT })),
    proj: F.proj.map(p => ({ kind: p.kind, x: p.x, y: p.y, vx: p.vx, color: p.color, life: p.life, t: p.t })) };
}
function hostSend() {
  net.tick++;
  const dG = net.guests.filter(g => g.kind === 'direct' && g.conn), rG = net.guests.filter(g => g.kind === 'relay' && g.client);
  const pack = ev => JSON.stringify(G.scene === 'fight' && fight ? snapshot(ev)
    : { t: 'g', scene: G.scene, T: G.t, cd: G.cd, sel: G.sel, ids: lobbyIds(), pk: pkIdx(), code: net.code, ev }, round2);
  if (dG.length && net.tick % 2 === 0) {                      // direct: 30 updates a second
    const s = pack(net.evD); net.evD = [];
    for (const g of dG) { try { g.conn.send(s); } catch (e) { /* closing */ } }
  }
  if (rG.length && net.tick % 3 === 0) {                      // relay: 20 updates a second, one message for everybody
    const s = pack(net.evR); net.evR = [];
    for (const c of new Set(rG.map(g => g.client))) c.publish(topic(net.code, 'down'), s, { qos: 0 });
  }
  if (!dG.length) net.evD = [];
  if (!rG.length) net.evR = [];
  for (const g of net.guests) for (const k of EDGES) g.remote[k] = 0;
}

/* ---- guest side ---- */
function joinGame(code) {
  netClose();
  const id = net.joinId, gid = uid(); let relayStarted = false;
  const live = () => net.joinId === id && !net.conn;
  net.myId = gid; net.code = code; net.ui = 'wait'; net.msg = `Connecting to room ${code}…`;
  const connected = c => {
    net.conn = c; net.role = 'guest'; net.lastSent = ''; net.tick = 0; net.lastRx = now(); net.via = c.relay ? 'relay' : 'direct';
    net.ids = ['h', gid]; G.mode = 'online'; G.scene = 'select'; G.sel = { c: [0, 3], lock: [false, false] }; G.t = 0; G.cd = 0; fight = null;
    sfxRaw.ok();
  };
  const tryBroker = i => {
    if (!live() || i >= BROKERS.length) return;
    const c = window.mqtt.connect(BROKERS[i], { clientId: `sb-g-${code}-${uid()}`, clean: true, connectTimeout: 6000, reconnectPeriod: 0 });
    let moved = false;
    const next = () => { if (moved || (net.conn && net.conn.client === c)) return; moved = true; endClient(c); tryBroker(i + 1); };
    const giveUp = setTimeout(next, 9000);                    // no answer through this relay: try the next one
    c.on('error', next);
    c.on('connect', () => c.subscribe(topic(code, 'down'), () => {
      const hello = JSON.stringify({ t: 'hello', id: gid });
      const iv = setInterval(() => {
        if (moved || !live()) { clearInterval(iv); if (!net.conn || net.conn.client !== c) endClient(c); return; }
        c.publish(topic(code, 'up'), hello);
      }, 700);
    }));
    c.on('message', (t, raw) => {
      const m = parse(raw);
      if (!m || net.joinId !== id || (m.id && m.id !== gid)) return;      // messages addressed to another player
      if (net.conn && net.conn.client === c) onData(m);
      else if (live() && !moved && m.t === 'welcome') { clearTimeout(giveUp); connected(relayConn(c, topic(code, 'up'))); }
      else if (live() && m.t === 'full') netFail('That room is full (6 players).');
    });
  };
  const startRelay = () => {
    if (relayStarted || !live()) return;
    relayStarted = true;
    const p = net.peer; net.peer = null;
    if (p) { try { p.destroy(); } catch (e) { /* already gone */ } }
    net.msg = `Still connecting to room ${code} (using relay)…`;
    loadMqtt(() => tryBroker(0));
  };
  loadPeer(() => {                                            // try the direct link first
    if (!live() || relayStarted) return;
    const p = net.peer = new window.Peer(ROOM + code + '-' + gid);
    p.on('call', onCall);
    p.on('open', () => {
      if (net.peer !== p) return;
      const c = p.connect(ROOM + code, { reliable: true, serialization: 'json', metadata: { id: gid } });
      c.on('open', () => {
        if (!live() || net.peer !== p || relayStarted) return shut(c);
        connected(c);
        c.on('data', onData);
        c.on('close', () => { if (net.conn === c) netFail('The connection to the host was closed.'); });
      });
    });
    p.on('error', () => { if (net.peer === p) startRelay(); });
  }, startRelay);
  setTimeout(startRelay, 4000);                               // direct link not up after 4 s: use the relay
  setTimeout(() => {
    if (live()) netFail(`Could not reach room ${code}. Check the code, and that the host's game is still open.`);
  }, 30000);
}
function playEvents(ev) {
  for (const e of ev || []) {
    const k = e[0];
    if (k === 'say') sayRaw(e[1]);
    else if (k === 'b') spawnBurst(e[1], e[2], e[3], e[4]);
    else if (k === 'r') spawnRing(e[1], e[2], e[3]);
    else if (sfxRaw[k]) sfxRaw[k](e[1]);
  }
}
function onData(m) {
  if (typeof m === 'string') m = parse(m);
  if (!m || net.role !== 'guest') return;
  net.lastRx = now();
  if (m.t === 'full') return netFail('That room is full (6 players).');
  if (m.pk) G.picks = m.pk.map(i => ROSTER[i]);
  if (m.lob) net.ids = m.lob;
  if (m.t === 'g') { G.scene = m.scene; G.t = m.T; G.cd = m.cd; G.sel = m.sel; net.ids = m.ids; fight = null; }
  else if (m.t === 's' && m.pk) {
    const key = m.pk.join() + '|' + m.ids.join();
    if (!fight || fight.key !== key) { startFight(G.picks, m.ids); fight.key = key; }
    const F = fight;
    if (F.round !== m.F.round) { F.f = F.defs.map((d, i) => mkFighter(d, i, F.n)); F.sparks = []; }
    Object.assign(F, m.F);
    m.f.forEach((o, i) => {
      const f = F.f[i];
      if (!f) return;
      const nx = o.x, ny = o.y, mv = o.mv;
      delete o.x; delete o.y; delete o.mv;
      Object.assign(f, o);
      f.move = mv ? (MOVES[mv] || SPECIALS[mv]) : null;
      f.nx = nx; f.ny = ny;
      if (f.fresh || Math.abs(nx - f.x) > 110) { f.x = nx; f.y = ny; }   // first sight, or a teleport: jump straight there
      f.fresh = false;
    });
    F.proj = m.proj; G.scene = 'fight';
  }
  playEvents(m.ev);
}
function guestUpdate() {
  const both = [K1, K2], i = readInput(both), n = nav(both);
  const m = { t: 'i', id: net.myId, h: [+i.l, +i.r, +i.u, +i.d], e: [+i.lp, +i.rp, +i.lk, +i.rk, +i.s, +n.left, +n.right, +n.up, +n.down, +(n.ok || !!anyOk())] };
  const key = JSON.stringify(m);
  if (key !== net.lastSent || m.e.some(Boolean) || ++net.tick % 45 === 0) { try { net.conn.send(key); } catch (e) { /* closing */ } net.lastSent = key; }
  if (pressed.Escape && (G.scene !== 'fight' || (fight && fight.phase === 'matchend'))) { netClose(); gotoTitle(); }
}
// Between the host's updates each guest keeps its own picture moving: fighters glide
// toward their latest known position and animate locally, so play looks smooth at 60 fps.
function guestTick() {
  const F = fight;
  if (G.scene !== 'fight' || !F) return;
  F.tick++;
  if (F.shake > 0) F.shake *= .85;
  updateSparks();
  const frozen = F.hitstop > 0 || F.phase === 'matchend';
  if (F.hitstop > 0) F.hitstop--;
  for (const f of F.f) {
    if (!frozen) {
      f.nx = clamp(f.nx + f.vx, 40, W - 40);
      if (f.ny < GROUND || f.vy < 0) { f.vy += .85; f.ny = Math.min(GROUND, f.ny + f.vy); }
      f.stateT++;
      if (f.state === 'walk') f.walkT += Math.sign(f.vx * f.facing);
    }
    f.x += (f.nx - f.x) * .45; f.y += (f.ny - f.y) * .6;
    if (f.flash > 0) f.flash--;
    mixPose(f.pose, targetPose(f), poseRate(f)); f.lagHp = Math.max(f.hp, f.lagHp - .35);
  }
  if (!frozen) for (const p of F.proj) { p.x += p.vx; p.t++; }
}
function inviteLink() {
  if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return null;
  return location.origin + location.pathname + '?join=' + net.code;
}
function shareInvite() {
  const link = inviteLink(), done = () => { net.copied = 120; };
  if (touch && link && navigator.share) navigator.share({ title: TITLE, text: `Join my ${TITLE} room ${net.code}`, url: link }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(link || net.code).then(done, () => {});
}
function updateOnline() {
  const n = nav([K1, K2]);
  if (net.copied > 0) net.copied--;
  if (pressed.Escape) { sfxRaw.back(); const wasMenu = net.ui === 'menu'; netClose(); net.ui = 'menu'; if (wasMenu) gotoTitle(); return; }
  if (net.ui === 'menu') {
    if (n.up || n.down) { net.menu ^= 1; sfxRaw.move(); }
    if (n.ok || anyOk()) { sfxRaw.ok(); if (net.menu === 0) hostGame(); else { net.ui = 'typing'; net.code = ''; codeIn.value = ''; } }
  } else if (net.ui === 'hosting') {
    if (pressed.KeyC) shareInvite();
  } else if (net.ui === 'error') {
    if (n.ok || anyOk()) { net.ui = 'menu'; sfxRaw.ok(); }
  }
}
// Which fighter / cursor belongs to this screen's player (-1 when only watching).
function mySide() {
  if (G.mode !== 'online' || !net.role) return 0;
  const ids = G.scene === 'fight' && fight ? fight.pid : net.role === 'host' ? lobbyIds() : net.ids;
  return ids.indexOf(net.myId);
}

/* ------------------------------------------------------------- match flow */
function startFight(defs, pids) {
  const n = defs.length, seen = [];
  const vd = defs.map(d => {                  // two players on the same fighter: the later ones get alternate colours
    const k = seen.filter(x => x === d).length; seen.push(d);
    return k === 0 ? d : Object.assign({}, d, k % 2 ? { shirt: d.accent, accent: d.shirt } : { shirt: d.pants, pants: d.shirt });
  });
  const skill = clamp(G.diff * .3 + (G.mode === 'arcade' ? G.ladderI * .05 : .1), 0, 1);
  fight = { defs: vd, pid: pids || ['p1', 'p2'], n, f: vd.map((d, i) => mkFighter(d, i, n)), wins: Array(n).fill(0), round: 1, phase: 'intro', phaseT: 0,
    timer: n > 2 ? 90 : 60, tick: 0, proj: [], sparks: [], stage: (rand(STAGES.length)) | 0, banner: null, paused: false, menu: 0,
    hitstop: 0, shake: 0, winner: -1, ai: { t: 20, act: 'idle', seq: [], skill, airT: 0 } };
  G.scene = 'fight';
}
function newRound() {
  const F = fight;
  F.f = F.defs.map((d, i) => mkFighter(d, i, F.n));
  F.phase = 'intro'; F.phaseT = 0; F.timer = F.n > 2 ? 90 : 60; F.proj = []; F.sparks = []; F.winner = -1; F.banner = null;
  F.ai.t = 20; F.ai.act = 'idle'; F.ai.seq = [];
}
function banner(s, sub, dur = 90) { fight.banner = { s, sub, t0: fight.tick, dur }; }
function endOpts() {
  if (G.mode === 'online') return ['REMATCH', 'CHARACTER SELECT', 'LEAVE GAME'];
  if (G.mode === 'versus') return ['REMATCH', 'CHARACTER SELECT', 'MAIN MENU'];
  if (fight.wins[0] >= 2) return [G.ladderI >= G.ladder.length - 1 ? 'CLAIM THE TITLE' : 'NEXT FIGHT', 'MAIN MENU'];
  return ['RETRY', 'MAIN MENU'];
}
function gotoTitle() { G.scene = 'title'; G.menu = 0; fight = null; }
function gotoSelect() {
  fight = null; G.t = 0; G.cd = 0;
  const old = G.sel.c;
  if (G.mode === 'online') {
    if (!net.guests.length) { G.scene = 'online'; net.ui = 'hosting'; return; }      // nobody else here yet
    const n = 1 + net.guests.length;
    G.sel = { c: Array.from({ length: n }, (_, i) => old[i] != null ? old[i] : (i * 3) % ROSTER.length), lock: Array(n).fill(false) };
  } else G.sel = { c: [old[0] || 0, old[1] != null ? old[1] : 4], lock: [false, false] };
  G.scene = 'select';
}
function gotoVs() {
  G.scene = 'vs'; G.t = 0;
  say(G.picks.length > 2 ? `${G.picks.length} player brawl` : `${G.picks[0].name} versus ${G.picks[1].name}`);
}

/* ----------------------------------------------------------- fight update */
function updateFight() {
  const F = fight, both = [K1, K2], onl = G.mode === 'online';
  if (F.phase === 'matchend') {
    const n = nav(both), opts = endOpts();
    if (n.up) { F.menu = (F.menu + opts.length - 1) % opts.length; sfx.move(); }
    if (n.down) { F.menu = (F.menu + 1) % opts.length; sfx.move(); }
    if (n.ok || anyOk()) {
      sfx.ok();
      const o = opts[F.menu];
      if (o === 'RETRY') startFight(G.picks, G.pids);
      else if (o === 'REMATCH') { if (!onl || lobbyIds().join() === F.pid.join()) startFight(G.picks, F.pid); else gotoSelect(); }
      else if (o === 'CHARACTER SELECT') gotoSelect();
      else if (o === 'LEAVE GAME') { netClose(); gotoTitle(); }
      else if (o === 'MAIN MENU') gotoTitle();
      else if (o === 'NEXT FIGHT') { G.ladderI++; G.picks[1] = G.ladder[G.ladderI]; gotoVs(); }
      else { G.scene = 'champion'; G.t = 0; say(`${G.picks[0].name} is the champion`); }
      return;
    }
    F.tick++; updateSparks();
    return;
  }
  if (!onl && pressed.Escape) { F.paused = !F.paused; F.menu = 0; sfx.move(); }
  if (F.paused) {
    const n = nav(both);
    if (n.up || n.down) { F.menu ^= 1; sfx.move(); }
    if (n.ok || anyOk()) { if (F.menu === 0) F.paused = false; else gotoTitle(); sfx.ok(); }
    return;
  }
  F.tick++;
  if (F.shake > 0) F.shake *= .85;
  if (F.hitstop > 0) { F.hitstop--; updateSparks(); return; }
  F.phaseT++;
  if (F.phase === 'ko' && F.phaseT < 80 && F.phaseT % 3) return;   // slow motion

  const fs = F.f, live = F.phase === 'fight';
  fs.forEach((f, i) => {                      // who controls each fighter this tick
    f.tgt = nearest(f);
    let inp = EMPTY;
    if (live && f.hp > 0) {
      if (G.mode === 'arcade') inp = i === 0 ? readInput(both) : aiInput(f, f.tgt, F.ai);
      else if (G.mode === 'versus') inp = readInput([i ? K2 : K1]);
      else if (F.pid[i] === net.myId) inp = readInput(both);
      else { const g = net.guests.find(x => x.id === F.pid[i]); if (g) inp = Object.assign({}, g.remote); else f.gone = true; }
    }
    f.inp = inp;
  });
  if (live) for (const f of fs) if (f.gone && f.hp > 0) {          // a player who left the room is knocked out
    f.hp = 0; f.state = 'down'; f.stateT = 0; f.downT = 0; f.move = null; f.vy = -6; f.y = Math.min(f.y, GROUND - 1);
  }
  for (const f of fs) updateFighter(f, f.tgt);
  for (let k = 0; k < 2; k++) for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {   // keep fighters from overlapping
    const a = fs[i], b = fs[j];
    if (Math.abs(a.y - b.y) >= 70 || a.state === 'down' || b.state === 'down') continue;
    const dx = b.x - a.x, ov = 50 - Math.abs(dx);
    if (ov <= 0) continue;
    const s = dx >= 0 ? 1 : -1;
    a.x = clamp(a.x - s * ov / 2, 40, W - 40); b.x = clamp(b.x + s * ov / 2, 40, W - 40);
  }
  updateProj(); updateSparks();
  for (const f of fs) { mixPose(f.pose, targetPose(f), poseRate(f)); f.lagHp = Math.max(f.hp, f.lagHp - .35); }

  if (F.phase === 'intro') {
    if (F.phaseT === 1) { banner(`ROUND ${F.round}`, null, 65); say(`Round ${F.round}`); }
    if (F.phaseT === 70) { banner(F.n > 2 ? 'BRAWL!' : 'FIGHT!', null, 45); say(F.n > 2 ? 'Brawl!' : 'Fight!'); tone(440, .3, 'sawtooth', .08, 400); }
    if (F.phaseT >= 80) { F.phase = 'fight'; F.phaseT = 0; }
  } else if (F.phase === 'fight') {
    if (F.phaseT % 60 === 0 && F.timer > 0) F.timer--;
    const alive = fs.filter(f => f.hp > 0);
    if (F.n > 2) for (const f of fs) if (f.hp <= 0 && !f.out) {    // brawl: call out each knockout, the round goes on
      f.out = true;
      if (alive.length > 1) { banner(`${f.def.name} IS OUT!`, null, 55); sfx.ko(); }
    }
    if (alive.length <= 1) {                  // last one standing takes the round
      F.winner = alive.length ? alive[0].side : -1;
      F.phase = 'ko'; F.phaseT = 0; banner(alive.length ? 'K.O.' : 'DOUBLE K.O.', null, 110); sfx.ko(); say('K O');
    } else if (F.timer <= 0) {                // time up: most health left wins
      let best = -1, br = -1, tie = false;
      for (const f of alive) { const r = f.hp / f.maxHp; if (r > br) { br = r; best = f.side; tie = false; } else if (r === br) tie = true; }
      F.winner = tie ? -1 : best;
      F.phase = 'ko'; F.phaseT = 80; banner('TIME UP', null, 60); say('Time up');
    }
  } else if (F.phase === 'ko') {
    const w = fs[F.winner];
    if (F.phaseT >= 130 && w && w.state !== 'win' && controllable(w)) {
      w.state = 'win'; w.stateT = 0;
      banner(`${w.def.name} WINS`, w.hp >= w.maxHp ? 'PERFECT!' : null, 130);
      say(`${w.def.name} wins${w.hp >= w.maxHp ? '. Perfect!' : ''}`);
    }
    if (F.phaseT >= 130 && F.winner < 0 && !F.drawn) { F.drawn = true; banner('DRAW', null, 120); }
    if (F.phaseT >= 290) {
      F.drawn = false;
      if (F.winner >= 0) F.wins[F.winner]++;
      if (F.wins.some(v => v >= 2)) { F.phase = 'matchend'; F.menu = 0; F.banner = null; }
      else { F.round++; newRound(); }
    }
  }
}

/* ----------------------------------------------------------- menu update */
function updateTitle() {
  const n = nav([K1, K2]), N = 5;
  if (n.up) { G.menu = (G.menu + N - 1) % N; sfx.move(); }
  if (n.down) { G.menu = (G.menu + 1) % N; sfx.move(); }
  if (G.menu === 3 && (n.left || n.right)) { G.diff = (G.diff + (n.right ? 1 : 2)) % 3; sfx.move(); }
  if (n.ok || anyOk()) {
    sfx.ok();
    if (G.menu === 0) { G.mode = 'arcade'; gotoSelect(); }
    else if (G.menu === 1) { G.mode = 'versus'; gotoSelect(); }
    else if (G.menu === 2) { G.scene = 'online'; net.ui = 'menu'; net.menu = 0; }
    else if (G.menu === 3) G.diff = (G.diff + 1) % 3;
    else G.scene = 'howto';
  }
}
function updateSelect() {
  const S = G.sel, n = ROSTER.length, cols = 5, onl = G.mode === 'online', arc = G.mode === 'arcade', both = [K1, K2];
  G.t++;
  if (pressed.Escape) {
    sfx.back();
    if (onl) { netClose(); gotoTitle(); }
    else if (S.lock.some(Boolean)) S.lock = S.lock.map(() => false); else gotoTitle();
    return;
  }
  const mine = nav(both), hostOk = mine.ok || anyOk();
  // one set of menu buttons per player: this screen's own, plus each online friend's
  const navs = arc ? [mine]
    : onl ? [mine, ...net.guests.map(g => ({ up: g.remote.nu, down: g.remote.nd, left: g.remote.nl, right: g.remote.nr, ok: g.remote.ok }))]
    : [nav([K1]), nav([K2])];
  navs.forEach((v, i) => {
    if (S.lock[i]) return;
    let c = S.c[i];
    if (v.left) c = c % cols === 0 ? c + cols - 1 : c - 1;
    if (v.right) c = c % cols === cols - 1 ? c - cols + 1 : c + 1;
    if (v.up || v.down) c = (c + cols) % n;
    c = clamp(c, 0, n - 1);
    if (c !== S.c[i]) { S.c[i] = c; sfx.move(); }
    const ok = v.ok || (arc || (onl && i === 0) ? anyOk() : onl ? false : i === 0 ? pressed.Space : (pressed.Enter || pressed.NumpadEnter));
    if (ok) { S.lock[i] = true; sfx.ok(); say(ROSTER[c].name); }
  });
  const start = () => { G.picks = S.c.map(c => ROSTER[c]); G.pids = onl ? lobbyIds() : ['p1', 'p2']; G.cd = 0; gotoVs(); };
  if (arc) {
    if (S.lock[0]) {
      const me = ROSTER[S.c[0]];
      G.ladder = ROSTER.filter(d => d !== me).sort(() => Math.random() - .5);
      G.ladderI = 0; G.picks = [me, G.ladder[0]]; G.pids = ['p1', 'cpu']; gotoVs();
    }
  } else if (S.lock.length >= 2 && S.lock.every(Boolean)) {
    if (!onl) start();
    else if (++G.cd > 300 || (G.cd > 25 && hostOk)) start();   // online: 5 second countdown so late friends can still join
  } else G.cd = 0;
}
function update() {
  const typing = G.scene === 'online' && net.ui === 'typing', both = [K1, K2];
  if (pressed.KeyT && !typing) toggleMic();
  if (net.role && net.peer && ++voice.tick % 60 === 0) voiceSync();
  if (pressed.KeyM && !typing) { muted = !muted; if (muted && window.speechSynthesis) speechSynthesis.cancel(); }
  if (net.role === 'guest' && net.conn) {
    if (now() - net.lastRx > 15000) netFail('The connection to the host was lost.');
    else { guestUpdate(); guestTick(); }
  } else {
    if (net.role === 'host') for (const g of [...net.guests]) if (now() - g.lastRx > 15000) removeGuest(g);   // a friend dropped out
    switch (G.scene) {
      case 'title': G.t++; updateTitle(); break;
      case 'howto': if (anyOk() || pressed.Escape || nav(both).ok) { sfx.back(); G.scene = 'title'; } break;
      case 'online': updateOnline(); break;
      case 'select': updateSelect(); break;
      case 'vs': if (++G.t > 150 || (G.t > 20 && (anyOk() || nav(both).ok))) startFight(G.picks, G.pids); break;
      case 'fight': updateFight(); break;
      case 'champion': if (++G.t > 60 && (anyOk() || nav(both).ok)) gotoTitle(); break;
    }
    if (net.role === 'host' && net.guests.length) hostSend();
  }
  for (const k in pressed) delete pressed[k];
}

/* ---------------------------------------------------------------- drawing */
function text(s, x, y, size, color = '#fff', align = 'center', stroke = '#000') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
// Costume parts. sleeves: none|short|long. legs: long|shorts|boots|bare. torso: shirt|bare|crop.
const COSTUMES = {
  gi:       { sleeves: 'short', legs: 'long', torso: 'shirt', belt: 1, lapel: 1, band: 1, barefoot: 1, hands: 1 },
  boxer:    { sleeves: 'none', legs: 'shorts', torso: 'bare', bigGloves: 1, waist: 1 },
  ninja:    { sleeves: 'long', legs: 'long', torso: 'shirt', belt: 1, scarf: 1 },
  commando: { sleeves: 'none', legs: 'boots', torso: 'shirt', belt: 1, band: 1, straps: 1 },
  suit:     { sleeves: 'long', legs: 'long', torso: 'shirt', tie: 1, hands: 1, darkShoes: 1 },
  hoodie:   { sleeves: 'long', legs: 'long', torso: 'shirt', hood: 1, hands: 1, pocket: 1 },
  dress:    { sleeves: 'none', legs: 'bare', torso: 'shirt', skirt: 1, belt: 1, hands: 1 },
  athlete:  { sleeves: 'none', legs: 'long', torso: 'crop', band: 1, waist: 1 },
  biker:    { sleeves: 'long', legs: 'boots', torso: 'shirt', lapel: 1, belt: 1 },
  armor:    { sleeves: 'none', legs: 'boots', torso: 'shirt', skirt: 1, pads: 1, cape: 1, belt: 1 },
};
/* ---------------------------------------------------------------- avatars */
// Each fighter's face is drawn from the "face" settings in roster.js (hair, beard,
// glasses and so on). It is drawn once per size onto a small off-screen canvas and
// then stamped each frame, which keeps six detailed heads cheap to draw.
// Coordinates: the head is about 50 units in radius, looking toward +x.
function drawFace(c, d) {
  const F = d.face || {}, fem = d.gender === 'f', C = COSTUMES[d.costume] || COSTUMES.gi;
  const skin = d.skin, hair = d.hair, INK = '#111';
  const headPath = () => {
    c.beginPath(); c.moveTo(-40, -8);
    c.bezierCurveTo(-42, -54, 34, -60, 40, -12); c.bezierCurveTo(44, 10, 37, 34, 21, 46);
    c.bezierCurveTo(10, 55, -8, 55, -20, 44); c.bezierCurveTo(-34, 32, -40, 12, -40, -8); c.closePath();
  };
  const blob = (list, fill) => {                       // overlapping circles: outline all, then fill all
    c.lineWidth = 4; c.strokeStyle = INK;
    for (const [x, y, r] of list) { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); }
    c.fillStyle = fill;
    for (const [x, y, r] of list) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  };
  const shape = (fill, lw = 4) => { c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); } };
  c.lineJoin = 'round'; c.lineCap = 'round';

  // ear and head
  c.beginPath(); c.ellipse(-37, 4, 8, 12, 0, 0, 7); shape(shade(skin, -.12));
  headPath(); c.fillStyle = skin; c.fill();
  c.save(); headPath(); c.clip();
  c.fillStyle = 'rgba(0,0,0,.13)'; c.beginPath(); c.ellipse(-46, 6, 26, 60, 0, 0, 7); c.fill();          // shade toward the back
  c.beginPath(); c.ellipse(4, 62, 44, 16, 0, 0, 7); c.fill();                                             // and under the jaw
  c.fillStyle = 'rgba(255,255,255,.10)'; c.beginPath(); c.ellipse(16, -30, 18, 9, -.1, 0, 7); c.fill();   // light on the forehead
  // beard, clipped to the head so it follows the jaw line
  const beard = (pts, alpha) => {
    c.globalAlpha = alpha; c.fillStyle = hair; c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.globalAlpha = 1;
  };
  const LOW = [[-44, 8], [-30, 8], [-20, 24], [-4, 31], [34, 29], [44, 24], [46, 62], [-46, 62]];
  if (F.beard === 'full') beard([[-44, 0], [-30, 0], [-22, 15], [-6, 22], [4, 19], [16, 17], [30, 19], [38, 15], [46, 18], [46, 62], [-46, 62]], .96);
  else if (F.beard === 'short') beard(LOW, .82);
  else if (F.beard === 'stubble') beard(LOW, .26);
  else if (F.beard === 'goatee') { c.globalAlpha = .9; c.fillStyle = hair; c.beginPath(); c.ellipse(17, 44, 15, 10, 0, 0, 7); c.fill(); c.globalAlpha = 1; }
  c.restore();
  headPath(); c.lineWidth = 4.5; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.moveTo(-40, 0); c.quadraticCurveTo(-34, 4, -38, 10); c.lineWidth = 2; c.strokeStyle = shade(skin, -.4); c.stroke();   // ear fold

  // eyes
  const eye = (x, y, rx) => {
    c.beginPath(); c.ellipse(x, y, rx, 4.8, 0, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.arc(x + 1.5, y + .3, 3.8, 0, 7); c.fillStyle = '#3b2414'; c.fill();
    c.beginPath(); c.arc(x + 1.7, y + .3, 1.8, 0, 7); c.fillStyle = '#000'; c.fill();
    c.beginPath(); c.arc(x + 2.9, y - 1.3, 1, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.moveTo(x - rx - 1, y - .3); c.quadraticCurveTo(x, y - 8, x + rx + 1, y - .3);
    c.lineWidth = fem ? 3 : 2.4; c.strokeStyle = INK; c.stroke();
    if (fem) { c.beginPath(); c.moveTo(x - rx - 1, y - .5); c.lineTo(x - rx - 4.5, y - 3.5); c.lineWidth = 2; c.stroke(); }
    c.beginPath(); c.moveTo(x - rx, y + 3.6); c.quadraticCurveTo(x, y + 6.4, x + rx, y + 3.6); c.lineWidth = 1.2; c.strokeStyle = shade(skin, -.35); c.stroke();
  };
  eye(4, -4, 7.6); eye(29, -4, 6);
  // brows: fighters who are not smiling get a fiercer tilt
  const tilt = F.smile ? 0 : 3.2, bw = F.brows === 'thick' ? 5 : fem ? 2.8 : 4;
  c.strokeStyle = shade(hair, -.2); c.lineWidth = bw;
  c.beginPath(); c.moveTo(-7, -16.5); c.quadraticCurveTo(3, -19 + tilt * .4, 13, -14.5 + tilt); c.stroke();
  c.beginPath(); c.moveTo(22, -14.5 + tilt); c.quadraticCurveTo(30, -18.5 + tilt * .4, 36, -16); c.stroke();
  // nose
  c.beginPath(); c.moveTo(21, -5); c.quadraticCurveTo(30, 8, 27, 13); c.quadraticCurveTo(22, 17, 17, 14);
  c.lineWidth = 2.4; c.strokeStyle = shade(skin, -.42); c.stroke();
  // mouth
  if (F.smile === 'teeth') {
    c.beginPath(); c.moveTo(3, 23); c.quadraticCurveTo(18, 27, 33, 22); c.quadraticCurveTo(20, 41, 3, 23); c.closePath();
    c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = fem ? '#9c3f4c' : '#6b2a24'; c.stroke();
  } else {
    if (F.lips) { c.beginPath(); c.moveTo(5, 27); c.quadraticCurveTo(18, 22.5, 31, 26); c.quadraticCurveTo(18, 35.5, 5, 27); c.closePath(); c.fillStyle = '#a8505c'; c.fill(); }
    c.beginPath(); c.moveTo(5, 27); c.quadraticCurveTo(18, F.smile ? 32.5 : 29.5, 31, 26);
    c.lineWidth = 2.6; c.strokeStyle = '#5e2b25'; c.stroke();
  }
  if (F.moustache) {
    c.globalAlpha = F.moustache === 'thin' ? .7 : .95;
    c.beginPath(); c.moveTo(1, 21.5); c.quadraticCurveTo(17, 13, 34, 21); c.quadraticCurveTo(26, 25.5, 17.5, 21.5); c.quadraticCurveTo(9, 25.5, 1, 21.5); c.closePath();
    c.fillStyle = hair; c.fill(); c.globalAlpha = 1;
  }
  if (F.bindi) { c.beginPath(); c.arc(17, -19.5, 2, 0, 7); c.fillStyle = '#3a0d0d'; c.fill(); }
  if (F.nosePin) { c.beginPath(); c.arc(25.5, 11, 1.5, 0, 7); c.fillStyle = '#e6c35c'; c.fill(); }

  // hair on top
  const top = (pts, scaleY = 1) => {
    c.save(); c.translate(0, -34); c.scale(1, scaleY); c.translate(0, 34);
    c.beginPath(); c.moveTo(pts[0], pts[1]); c.lineTo(pts[2], pts[3]);
    for (let i = 4; i < pts.length; i += 6) c.bezierCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 4], pts[i + 5]);
    c.closePath(); c.restore();
  };
  const QUIFF = [-34, 2, -42, -2, -56, -46, -22, -78, 18, -73, 42, -71, 52, -52, 42, -32, 32, -46, 10, -46, -4, -38, -16, -32, -24, -18, -26, 0];
  const SHORT = [-34, 2, -42, -2, -52, -44, -18, -68, 16, -64, 38, -62, 46, -46, 40, -30, 28, -42, 8, -44, -6, -36, -18, -30, -24, -16, -26, 0];
  const PART = [-36, 14, -44, 6, -58, -56, -8, -74, 22, -66, 42, -60, 48, -40, 42, -24, 34, -44, 16, -54, 4, -52, -10, -46, -22, -30, -28, 12];
  const shine = (x1, y1, cx, cy, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); c.lineWidth = 3; c.strokeStyle = shade(hair, .22); c.stroke(); };
  switch (F.hair) {
    case 'quiff':
      top(QUIFF, F.tall || 1); shape(hair); shine(-26, -52, -4, -72, 24, -66); shine(-10, -46, 10, -58, 34, -50);
      if (F.grey) { c.strokeStyle = 'rgba(210,210,215,.55)'; c.lineWidth = 2.4; for (const o of [0, 9, 18]) { c.beginPath(); c.moveTo(-16 + o, -70); c.quadraticCurveTo(2 + o, -84, 22 + o * .6, -74); c.stroke(); } }
      break;
    case 'swept':
      blob([[-44, -22, 15], [-40, -2, 10]], hair); top(QUIFF, .86); shape(hair); shine(-24, -48, -2, -64, 26, -58);
      break;
    case 'messy':
      top(SHORT); shape(hair); blob([[-34, -44, 13], [-16, -62, 14], [6, -68, 14], [26, -62, 13], [40, -46, 11]], hair);
      c.fillStyle = hair; c.beginPath(); c.ellipse(4, -50, 36, 16, 0, 0, 7); c.fill(); shine(-14, -62, 4, -74, 22, -64);
      break;
    case 'curly':
      top(SHORT); shape(hair);
      blob([[-42, -6, 12], [-46, -26, 13], [-38, -46, 13], [-22, -60, 13], [-2, -67, 13], [18, -64, 13], [34, -54, 12], [44, -38, 11], [-46, 14, 12], [-44, 34, 11]], hair);
      c.fillStyle = hair; c.beginPath(); c.ellipse(2, -50, 36, 15, 0, 0, 7); c.fill();
      c.strokeStyle = shade(hair, .25); c.lineWidth = 2.2; for (const [x, y] of [[-30, -44], [-10, -60], [12, -62], [32, -50]]) { c.beginPath(); c.arc(x, y, 5, 3.4, 5.6); c.stroke(); }
      break;
    case 'parted':
      top(PART); shape(hair); shine(-30, -40, -14, -66, 16, -62);
      c.beginPath(); c.moveTo(-30, -6); c.quadraticCurveTo(-40, 20, -34, 46); c.lineWidth = 13; c.strokeStyle = INK; c.stroke(); c.lineWidth = 9; c.strokeStyle = hair; c.stroke();
      break;
    case 'beanie': {
      blob([[-34, -62, 17]], '#1d1d1f');
      c.beginPath(); c.moveTo(-49, -16); c.bezierCurveTo(-60, -82, 52, -88, 47, -22); c.closePath(); shape('#1d1d1f');
      c.beginPath(); c.moveTo(-51, -30); c.quadraticCurveTo(0, -46, 49, -36); c.lineTo(49, -15); c.quadraticCurveTo(0, -25, -51, -9); c.closePath(); shape('#2b2b2e');
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; for (let x = -42; x <= 42; x += 9) { c.beginPath(); c.moveTo(x, -33 - (1 - Math.abs(x) / 50) * 8); c.lineTo(x, -13 - (1 - Math.abs(x) / 50) * 8); c.stroke(); }
      c.beginPath(); c.moveTo(-31, -8); c.quadraticCurveTo(-40, 20, -34, 46); c.lineWidth = 13; c.strokeStyle = INK; c.stroke(); c.lineWidth = 9; c.strokeStyle = hair; c.stroke();
      break; }
    case 'bald': break;
    default: top(SHORT); shape(hair); shine(-24, -44, -4, -58, 20, -54);
  }
  if (C.band && F.hair !== 'beanie') {                 // costume headband sits over the hair
    c.beginPath(); c.moveTo(-41, -19); c.quadraticCurveTo(2, -37, 41, -25);
    c.lineWidth = 11; c.strokeStyle = INK; c.stroke(); c.lineWidth = 7.5; c.strokeStyle = d.accent; c.stroke();
  }
  if (F.clip) blob([[-22, -58, 4.5], [-15, -62, 4.5], [-19, -53, 4.5]], '#fafafa');

  // glasses and jewellery
  if (F.glasses) {
    const thick = F.glasses === 'thick';
    const lens = (x, y, w, h) => {
      c.beginPath(); c.moveTo(x + 4, y); c.arcTo(x + w, y, x + w, y + h, 4); c.arcTo(x + w, y + h, x, y + h, 4); c.arcTo(x, y + h, x, y, 4); c.arcTo(x, y, x + w, y, 4); c.closePath();
      c.fillStyle = 'rgba(190,225,255,.2)'; c.fill(); c.stroke();
    };
    c.strokeStyle = thick ? '#141414' : '#4a4a4a'; c.lineWidth = thick ? 3.6 : 2.2;
    lens(-9, -12, 24, 16); lens(20.5, -12, 17.5, 16);
    c.beginPath(); c.moveTo(15, -6); c.lineTo(20.5, -6); c.moveTo(-9, -7); c.lineTo(-35, -3); c.stroke();
  }
  if (F.earrings === 'hoop') { c.beginPath(); c.arc(-37, 21, 6.5, 0, 7); c.lineWidth = 2.4; c.strokeStyle = '#e6c35c'; c.stroke(); }
  else if (F.earrings === 'rect') { c.lineWidth = 2; c.strokeStyle = '#d8d8d8'; c.strokeRect(-41.5, 15, 8, 17); }
  else if (F.earrings === 'stud') { c.beginPath(); c.arc(-37, 14, 2.2, 0, 7); c.fillStyle = '#e6c35c'; c.fill(); }
}
const headCache = new WeakMap();
function headSprite(d, r) {
  let m = headCache.get(d);
  if (!m) { m = new Map(); headCache.set(d, m); }
  const key = Math.round(r * 2);
  let sp = m.get(key);
  if (!sp) {
    const S = Math.ceil(r * 4.6);
    sp = document.createElement('canvas'); sp.width = sp.height = S;
    const c = sp.getContext('2d');
    c.translate(S / 2, S / 2); c.scale(r / 50, r / 50);
    drawFace(c, d);
    m.set(key, sp);
  }
  return sp;
}
// Head = the moving parts behind it (hood, long hair, headband tails), then the face stamp.
function drawHead(d, r, sway = 0, drag = 0, plain = false) {
  const C = COSTUMES[d.costume] || COSTUMES.gi, F = d.face || {}, k = r / 22, sw = sway * k, dg = drag * k;
  ctx.save();
  ctx.lineWidth = Math.max(2, r * .09); ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
  if (plain) {                                         // hit flash: a plain white silhouette
    ctx.beginPath(); ctx.ellipse(0, -r * .08, r * .92, r * 1.12, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  if (C.hood) { ctx.fillStyle = d.shirt; ctx.beginPath(); ctx.arc(-r * .3, -r * .1, r * 1.2, 0, 7); ctx.fill(); ctx.stroke(); }
  if (d.hairStyle === 'long') {
    ctx.fillStyle = d.hair; ctx.beginPath(); ctx.ellipse(-r * .45 - dg * .15, r * .5, r * .85, r * 1.45, .15 + dg * .01, 0, 7); ctx.fill(); ctx.stroke();
  } else if (d.hairStyle === 'wavy') {
    const curls = [];
    for (let i = 0; i < 6; i++) curls.push([-r * (.55 + (i % 2) * .28) - dg * .03 * i, -r * .35 + i * r * .4 + (i > 3 ? sw * .3 : 0), r * (.62 - i * .03)]);
    for (const [x, y, cr] of curls) { ctx.beginPath(); ctx.arc(x, y, cr, 0, 7); ctx.stroke(); }
    ctx.fillStyle = d.hair;
    for (const [x, y, cr] of curls) { ctx.beginPath(); ctx.arc(x, y, cr, 0, 7); ctx.fill(); }
  } else if (d.hairStyle === 'ponytail') {
    ctx.beginPath(); ctx.moveTo(-r * .8, -r * .35); ctx.quadraticCurveTo(-r * 1.9 - dg, -r * .3, -r * 1.55 - dg, r * 1.15 + sw);
    ctx.lineWidth = r * .5 + 4; ctx.stroke(); ctx.strokeStyle = d.hair; ctx.lineWidth = r * .5; ctx.stroke();
  } else if (d.hairStyle === 'bun') {
    ctx.fillStyle = d.hair; ctx.beginPath(); ctx.arc(-r * .65, -r * .95, r * .45, 0, 7); ctx.fill(); ctx.stroke();
  }
  if (C.band && F.hair !== 'beanie') {
    for (const [ex, ey] of [[-r * 1.75 - dg, -r * .2 + sw], [-r * 1.6 - dg, r * .25 - sw]]) {
      ctx.beginPath(); ctx.moveTo(-r * .8, -r * .4); ctx.quadraticCurveTo(-r * 1.3, -r * .45, ex, ey);
      ctx.strokeStyle = '#111'; ctx.lineWidth = r * .2 + 3; ctx.stroke(); ctx.strokeStyle = d.accent; ctx.lineWidth = r * .2; ctx.stroke();
    }
  }
  const sp = headSprite(d, r);
  ctx.drawImage(sp, -sp.width / 2, -sp.height / 2);
  ctx.restore();
}
function face(d, x, y, r, flip) { ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); drawHead(d, r); ctx.restore(); }

// A limb segment: a capsule that tapers from width w1 at a to w2 at b.
function capsule(a, b, w1, w2) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  ctx.beginPath();
  ctx.arc(a[0], a[1], w1 / 2, ang + Math.PI / 2, ang - Math.PI / 2);
  ctx.arc(b[0], b[1], w2 / 2, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}
// Segment with a muscle bulge at fraction t along it.
function muscle(p, q, wa, wb, t, extra, pad) {
  const m = [lerp(p[0], q[0], t), lerp(p[1], q[1], t)], wm = lerp(wa, wb, t) + extra;
  capsule(p, m, wa + pad, wm + pad); ctx.fill(); capsule(m, q, wm + pad, wb + pad); ctx.fill();
}
// Two-segment limb (arm or leg): outline, colour, then light and shadow for volume.
function limb(a, b, c, w0, w1, w2, colU, colL, plain) {
  ctx.fillStyle = '#111'; muscle(a, b, w0, w1, .45, 1.5, 4); muscle(b, c, w1, w2, .3, 2, 4);
  ctx.fillStyle = colL; muscle(b, c, w1, w2, .3, 2, 0);
  ctx.fillStyle = colU; muscle(a, b, w0, w1, .45, 1.5, 0);
  if (plain) return;
  ctx.lineCap = 'round';
  for (const [p, q, w] of [[a, b, (w0 + w1) / 2], [b, c, (w1 + w2) / 2]]) {
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w * .25, ny = dx / l * w * .25;
    const at = (t, s) => [lerp(p[0], q[0], t) + nx * s, lerp(p[1], q[1], t) + ny * s];
    ctx.lineWidth = w * .24;
    let u = at(.12, -1), v = at(.78, -1);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(u[0], u[1]); ctx.lineTo(v[0], v[1]); ctx.stroke();
    u = at(.1, 1); v = at(.9, 1);
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.moveTo(u[0], u[1]); ctx.lineTo(v[0], v[1]); ctx.stroke();
  }
}
function rrect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Clenched fist at the wrist, pointing along the forearm. glove: 0 bare, 1 glove with cuff.
function fist(wrist, elbow, r, col, glove, cuff) {
  ctx.save(); ctx.translate(wrist[0], wrist[1]); ctx.rotate(Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]));
  ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round';
  rrect(-r * .25, -r, r * 2, r * 2, r * (glove ? .9 : .55)); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
  if (glove) { rrect(-r * .75, -r * .82, r * .6, r * 1.64, 2); ctx.fillStyle = cuff; ctx.fill(); ctx.stroke(); }
  else {
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 1; i < 4; i++) { ctx.moveTo(r * .85, -r + i * r * .5); ctx.lineTo(r * 1.7, -r + i * r * .5); }
    ctx.stroke(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
  }
  ctx.beginPath(); ctx.ellipse(r * .75, r * .72, r * .6, r * .32, -.25, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.stroke();   // thumb
  if (glove) { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r * .9, -r * .1, r * .6, -2.2, -.9); ctx.stroke(); }
  ctx.restore();
}
// Foot at the ankle. planted feet sit flat on the floor, others follow the shin.
function foot(ankle, knee, col, bare, planted, sole) {
  ctx.save(); ctx.translate(ankle[0], ankle[1]);
  if (!planted) ctx.rotate(Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]) - Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-8, 5); ctx.quadraticCurveTo(-8, 8, -4, 8); ctx.lineTo(17, 8);
  ctx.quadraticCurveTo(24, 8, 21, 2.5); ctx.quadraticCurveTo(14, -3, 6, -6); ctx.closePath();
  ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.lineJoin = 'round'; ctx.stroke();
  if (bare) {
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 3; i++) { ctx.moveTo(13 + i * 3, 3); ctx.lineTo(14 + i * 3, 7); }
    ctx.stroke();
  } else {
    ctx.strokeStyle = sole; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, 7); ctx.lineTo(19, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(13, 1); ctx.stroke();
  }
  ctx.restore();
}
function strokeLine(a, b, w, col) {
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
}
function knob(p, r, col) {
  ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fillStyle = col; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#111'; ctx.stroke();
}
function drawFighter(f) {
  const d = f.def, S = skel(f.pose), hipY = f.y - S.low;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  const sw = 46 - Math.min(26, (GROUND - f.y) * .12);
  ctx.beginPath(); ctx.ellipse(f.x, GROUND + 6, sw, 8, 0, 0, 7); ctx.fill();
  const tr = f.trail || (f.trail = []), mv = f.move;
  const foot0 = f.state === 'attack' && mv && mv.trail && f.stateT >= mv.su - 3 && f.stateT < mv.su + mv.ac + 3 ? (mv.trail === 'B' ? S.fB : S.fF) : null;
  if (foot0) tr.push([f.x + f.facing * foot0[0], hipY + foot0[1]]); else if (tr.length) tr.splice(0, 2);
  if (tr.length > 8) tr.shift();
  if (tr.length > 1) {                                  // the arc the foot has just travelled
    ctx.lineCap = 'round';
    for (let q = 1; q < tr.length; q++) {
      ctx.strokeStyle = `rgba(255,255,255,${(.1 + .45 * q / tr.length).toFixed(2)})`; ctx.lineWidth = 3 + q * 2.4;
      ctx.beginPath(); ctx.moveTo(tr[q - 1][0], tr[q - 1][1]); ctx.lineTo(tr[q][0], tr[q][1]); ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(f.x, hipY); ctx.scale(f.facing, 1); ctx.globalAlpha = f.alpha;
  const white = f.flash > 3;
  const C = COSTUMES[d.costume] || COSTUMES.gi, fem = d.gender === 'f', bl = d.build || 1;
  // body measurements: hips, waist, chest; arm and leg widths at each joint
  const HW = (fem ? 29 : 30) * bl, WW = (fem ? 21 : 27) * bl, CW = (fem ? 29 : 38) * bl;
  const A = (fem ? [11.5, 9, 7.5] : [15, 11.5, 9]).map(v => v * bl), L = (fem ? [17.5, 12.5, 8.5] : [20, 14.5, 10]).map(v => v * bl);
  const FR = (fem ? 6.5 : 7.5) * (C.bigGloves ? 1.45 : 1) * (C.hands ? 1 : 1.1);
  // paint(colour, darken, isBackLimb)
  const paint = (c, k = 0, back) => white ? '#fff' : shade(c, back ? k - .3 * (1 + k) : k);
  const sway = Math.sin(fight.tick * .15 + f.side * 2) * 4, drag = clamp(f.vx * f.facing * 3, -22, 22);
  const armU = C.sleeves === 'none' ? d.skin : d.shirt, armL = C.sleeves === 'long' ? d.shirt : d.skin;
  const legU = C.legs === 'bare' ? d.skin : d.pants;
  const legL = C.legs === 'long' ? [d.pants, 0] : C.legs === 'boots' ? [d.accent, -.5] : [d.skin, 0];
  const shoe = C.barefoot ? [d.skin, 0] : C.darkShoes ? ['#222222', 0] : C.legs === 'boots' ? [d.accent, -.5] : [d.accent, 0];
  const hand = C.hands ? d.skin : d.accent;
  // torso axis: pt(along, sideways) with sideways > 0 pointing toward the opponent
  const tx = S.sh[0], ty = S.sh[1] + 4, tl = Math.hypot(tx, ty), ux = tx / tl, uy = ty / tl;
  const pt = (a, s) => [a * ux - s * uy, -4 + a * uy + s * ux];
  const prof = [[-5, HW * .85], [0, HW], [tl * .42, WW], [tl * .82, CW], [tl + 5, CW * .7]];
  const wAt = a => {
    for (let i = 1; i < prof.length; i++) if (a <= prof[i][0]) {
      const p = prof[i - 1], q = prof[i], t = clamp((a - p[0]) / (q[0] - p[0]), 0, 1);
      return lerp(p[1], q[1], t * t * (3 - 2 * t));
    }
    return prof[prof.length - 1][1];
  };
  const bust = a => fem ? 4.5 * Math.exp(-(((a - tl * .68) / 7) ** 2)) : 0;
  const body = (a0, a1, fill, outline, s0 = -.5, s1 = .5) => {
    const n = 10, lft = [], rgt = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n), w = wAt(a); lft.push(pt(a, w * s0)); rgt.push(pt(a, w * s1 + (s1 === .5 ? bust(a) : 0))); }
    ctx.beginPath(); lft.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    rgt.reverse().forEach(p => ctx.lineTo(p[0], p[1])); ctx.closePath();
    if (outline) { ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  };
  const poly = (pts, fill) => {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.stroke();
  };
  const upright = f.pose.rot * f.pose.rot < .04, planted = p => upright && p[1] > S.low - 15;
  const shF = [S.sh[0] - uy * 4, S.sh[1] + ux * 4], shB = [S.sh[0] + uy * 5, S.sh[1] - ux * 5];
  const sole = white ? '#fff' : C.barefoot ? '#000' : 'rgba(255,255,255,.55)';
  ctx.lineCap = 'round';
  if (C.cape) poly([pt(tl, 2), pt(tl - 2, -CW / 2 - 4), [S.sh[0] - 34 - drag, S.sh[1] + 48 + sway], [-36 - drag, 30 - sway], pt(10, -WW / 2)], paint(d.accent, -.25));
  if (C.scarf) for (const [ex, ey] of [[-38 - drag, 2 + sway], [-30 - drag, 16 - sway]]) {
    ctx.beginPath(); ctx.moveTo(S.neck[0], S.neck[1] + 4); ctx.quadraticCurveTo(S.neck[0] - 16, S.neck[1] - 4, S.neck[0] + ex, S.neck[1] + ey);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = paint(d.accent); ctx.lineWidth = 6; ctx.stroke();
  }
  // far arm and far leg
  limb(shB, S.eB, S.hB, A[0], A[1], A[2], paint(armU, 0, 1), paint(armL, 0, 1), white);
  fist(S.hB, S.eB, FR * .95, paint(hand, 0, 1), !C.hands, paint(d.shirt === hand ? d.pants : d.shirt, -.2, 1));
  limb(S.hip, S.kB, S.fB, L[0], L[1], L[2], paint(legU, 0, 1), paint(legL[0], legL[1], 1), white);
  foot(S.fB, S.kB, paint(shoe[0], shoe[1], 1), C.barefoot, planted(S.fB), sole);
  // torso
  body(-5, tl + 5, paint(C.torso === 'shirt' ? d.shirt : d.skin), true);
  if (C.torso === 'crop') body(tl * .5, tl + 5, paint(d.shirt));
  if (C.waist) body(-5, 7, paint(d.pants));
  if (!white) {
    body(-5, tl + 5, 'rgba(0,0,0,.16)', false, -.5, -.2);                       // shadow down the back
    body(tl * .3, tl * .95, 'rgba(255,255,255,.1)', false, .15, .42);            // light on the chest
    if (C.torso !== 'shirt') {                                                   // muscle definition on bare skin
      ctx.lineCap = 'round';
      if (!fem) strokeLine(pt(tl * .62, 1), pt(tl * .6, CW * .4), 1.6, 'rgba(0,0,0,.3)');
      strokeLine(pt(tl * (C.torso === 'crop' ? .12 : .2), WW * .14), pt(tl * (C.torso === 'crop' ? .42 : .52), WW * .16), 1.6, 'rgba(0,0,0,.25)');
    }
  }
  ctx.lineCap = 'butt';
  if (C.pocket) strokeLine(pt(12, 3), pt(24, 3), WW * .55, paint(d.shirt, -.15));
  if (C.straps) { strokeLine(pt(tl - 4, -CW / 2 + 5), pt(10, WW / 2 - 4), 5, paint(d.accent, -.45)); strokeLine(pt(tl - 4, CW / 2 - 5), pt(10, -WW / 2 + 4), 5, paint(d.accent, -.45)); }
  if (C.lapel) { strokeLine(pt(tl - 2, CW / 2 - 6), pt(12, 3), 3, paint(d.shirt, -.35)); strokeLine(pt(tl - 2, -CW / 2 + 9), pt(12, 3), 3, paint(d.shirt, -.35)); }
  if (C.tie) { strokeLine(pt(tl + 2, 6), pt(tl * .4, 6), 10, paint('#ffffff')); strokeLine(pt(tl - 2, 6), pt(tl * .3, 6), 4, paint(d.accent)); }
  if (C.belt) strokeLine(pt(7, -wAt(7) / 2 - 1), pt(7, wAt(7) / 2 + 1), 7, paint(d.accent));
  if (C.skirt) poly([pt(9, -wAt(9) / 2 - 1), pt(9, wAt(9) / 2 + 1), pt(-19, HW / 2 + 9), pt(-19, -HW / 2 - 7)], paint(C.pads ? d.pants : d.shirt, C.pads ? 0 : -.1));
  // neck and head
  ctx.fillStyle = '#111'; capsule(pt(tl - 2, 1), S.head, 15, 14); ctx.fill();
  ctx.fillStyle = paint(d.skin, -.12); capsule(pt(tl - 2, 1), S.head, 11, 10); ctx.fill();
  ctx.save(); ctx.translate(S.head[0], S.head[1]); ctx.rotate(f.pose.rot + f.pose.lean * .5);
  drawHead(d, HEAD, sway, drag, white);
  ctx.restore();
  // near leg and near arm
  limb(S.hip, S.kF, S.fF, L[0], L[1], L[2], paint(legU), paint(legL[0], legL[1]), white);
  foot(S.fF, S.kF, paint(shoe[0], shoe[1]), C.barefoot, planted(S.fF), sole);
  limb(shF, S.eF, S.hF, A[0], A[1], A[2], paint(armU), paint(armL), white);
  fist(S.hF, S.eF, FR, paint(hand), !C.hands, paint(d.shirt === hand ? d.pants : d.shirt, -.2));
  if (C.pads) knob(shF, 10 * bl, paint(d.accent));
  ctx.restore();
}

function drawProj(p) {
  ctx.save();
  if (p.kind === 'ball') {
    for (let i = 3; i >= 0; i--) {
      ctx.globalAlpha = .9 - i * .22;
      const g = ctx.createRadialGradient(p.x - p.vx * i * 1.6, p.y, 2, p.x - p.vx * i * 1.6, p.y, 22 - i * 3);
      g.addColorStop(0, '#fff'); g.addColorStop(.4, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x - p.vx * i * 1.6, p.y, 24 - i * 3, 0, 7); ctx.fill();
    }
  } else {
    ctx.globalAlpha = Math.min(1, p.life / 15);
    for (let i = 0; i < 4; i++) {
      const x = p.x - Math.sign(p.vx) * i * 16, h = (38 - i * 8) * (.8 + .2 * Math.sin(p.t * .8 + i));
      ctx.beginPath(); ctx.moveTo(x - 10, GROUND + 6); ctx.lineTo(x + Math.sign(p.vx) * 4, GROUND + 6 - h); ctx.lineTo(x + 10, GROUND + 6); ctx.closePath();
      ctx.fillStyle = i ? p.color : '#fff'; ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  ctx.restore();
}

/* ----------------------------------------------------------------- stages */
function mkStage(i) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); let seed = 7 + i * 13;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const grad = (y1, y2, stops) => { const gr = g.createLinearGradient(0, y1, 0, y2); stops.forEach((s, k) => gr.addColorStop(k / (stops.length - 1), s)); return gr; };
  const FY = GROUND - 26;
  if (i === 0) {                                   // sunset dojo
    g.fillStyle = grad(0, FY, ['#2b1055', '#b0306a', '#f9a03f']); g.fillRect(0, 0, W, FY);
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(480, 300, 95, 0, 7); g.fill();
    g.fillStyle = '#4a1942'; g.beginPath(); g.moveTo(0, FY);
    for (let x = 0; x <= W; x += 80) g.lineTo(x, 300 + rnd() * 90 - (x % 160 ? 60 : 0)); g.lineTo(W, FY); g.fill();
    g.fillStyle = '#1d0b24';
    for (const px of [150, 800]) for (let k = 0; k < 4; k++) {
      const w = 120 - k * 22, y = FY - 40 - k * 46;
      g.beginPath(); g.moveTo(px - w / 2 - 18, y + 14); g.lineTo(px - w / 2 + 8, y - 6); g.lineTo(px + w / 2 - 8, y - 6); g.lineTo(px + w / 2 + 18, y + 14); g.fill();
      g.fillRect(px - w / 2 + 12, y + 12, w - 24, 36);
    }
    g.fillStyle = grad(FY, H, ['#7a4a2a', '#3b2212']); g.fillRect(0, FY, W, H - FY);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
    for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(480 + k * 70, FY); g.lineTo(480 + k * 190, H); g.stroke(); }
  } else if (i === 1) {                            // neon city
    g.fillStyle = grad(0, FY, ['#04041a', '#1b1464', '#4a1a6b']); g.fillRect(0, 0, W, FY);
    g.fillStyle = '#fff'; for (let k = 0; k < 70; k++) g.fillRect(rnd() * W, rnd() * 220, 1.5, 1.5);
    g.fillStyle = '#e8e8ff'; g.beginPath(); g.arc(780, 90, 42, 0, 7); g.fill();
    for (let x = -10; x < W; ) {
      const w = 50 + rnd() * 70, h = 110 + rnd() * 220; g.fillStyle = '#0a0a22'; g.fillRect(x, FY - h, w, h);
      for (let wy = FY - h + 10; wy < FY - 14; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 14) {
        if (rnd() < .45) { g.fillStyle = rnd() < .5 ? '#ffd86b' : '#5ee7ff'; g.fillRect(wx, wy, 7, 9); }
      }
      x += w + 4;
    }
    g.fillStyle = grad(FY, H, ['#22223a', '#0b0b16']); g.fillRect(0, FY, W, H - FY);
    g.fillStyle = '#ff2e88'; g.fillRect(0, FY, W, 4); g.fillStyle = '#19e6ff'; g.fillRect(0, FY + 6, W, 2);
    g.strokeStyle = 'rgba(25,230,255,.18)'; g.lineWidth = 2;
    for (let k = -6; k <= 6; k++) { g.beginPath(); g.moveTo(480 + k * 70, FY + 8); g.lineTo(480 + k * 190, H); g.stroke(); }
  } else {                                         // arena
    g.fillStyle = grad(0, FY, ['#0c0c12', '#2a2a3a']); g.fillRect(0, 0, W, FY);
    for (const sx of [160, 480, 800]) {
      const gr = g.createLinearGradient(sx, 0, sx, FY); gr.addColorStop(0, 'rgba(255,255,220,.35)'); gr.addColorStop(1, 'rgba(255,255,220,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(sx - 14, 0); g.lineTo(sx + 14, 0); g.lineTo(sx + 170, FY); g.lineTo(sx - 170, FY); g.fill();
    }
    for (let row = 0; row < 5; row++) for (let x = (row % 2) * 14; x < W; x += 28) {
      const y = 250 + row * 26 + rnd() * 6;
      g.fillStyle = `hsl(${rnd() * 360 | 0},${20 + row * 6}%,${12 + row * 4}%)`;
      g.beginPath(); g.arc(x, y, 10, 0, 7); g.fill(); g.fillRect(x - 12, y + 8, 24, 30);
    }
    g.fillStyle = '#15151d'; g.fillRect(0, FY - 46, W, 46);
    g.strokeStyle = '#d33'; g.lineWidth = 4;
    for (const y of [FY - 70, FY - 48, FY - 26]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = '#ddd'; g.fillRect(8, FY - 84, 14, 84); g.fillRect(W - 22, FY - 84, 14, 84);
    g.fillStyle = grad(FY, H, ['#3d5a80', '#1d2d44']); g.fillRect(0, FY, W, H - FY);
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 3; g.beginPath(); g.ellipse(480, GROUND + 22, 220, 34, 0, 0, 7); g.stroke();
  }
  return c;
}
const STAGES = [0, 1, 2].map(mkStage);

/* ------------------------------------------------------------------- HUD */
function drawBanner() {
  const F = fight;
  if (!F.banner) return;
  const age = F.tick - F.banner.t0;
  if (age > F.banner.dur || age < 0) { F.banner = null; return; }
  const sc = 1 + Math.max(0, 8 - age) * .2;
  ctx.save(); ctx.translate(W / 2, 220); ctx.scale(sc, sc);
  ctx.globalAlpha = Math.min(1, (F.banner.dur - age) / 10);
  text(F.banner.s, 0, 0, F.banner.s.length > 12 ? 64 : 90, '#ffd23f');
  if (F.banner.sub) text(F.banner.sub, 0, 70, 44, '#fff');
  ctx.restore();
}
// Two fighters: the classic pair of long health bars.
function drawHudDuel() {
  const F = fight, me = mySide();
  F.f.forEach((f, i) => {
    const bw = 360, x0 = i ? W - 40 - bw : 40, y = 28, r = clamp(f.hp / f.maxHp, 0, 1), lr = clamp(f.lagHp / f.maxHp, 0, 1);
    ctx.fillStyle = '#111'; ctx.fillRect(x0 - 4, y - 4, bw + 8, 30);
    ctx.fillStyle = '#5a0d0d'; ctx.fillRect(x0, y, bw, 22);
    const fill = (rr, col) => { ctx.fillStyle = col; ctx.fillRect(i ? x0 : x0 + bw * (1 - rr), y, bw * rr, 22); };
    fill(lr, '#fff'); fill(r, r > .3 ? '#ffd23f' : '#ff5a36');
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x0, y, bw, 7);
    text(f.def.name + (G.mode === 'online' && i === me ? '  (YOU)' : ''), i ? W - 40 : 40, 70, 22, '#fff', i ? 'right' : 'left');
    for (let k = 0; k < 2; k++) {
      const px = i ? W / 2 + 52 + k * 22 : W / 2 - 52 - k * 22;
      ctx.beginPath(); ctx.arc(px, 70, 7, 0, 7); ctx.fillStyle = k < F.wins[i] ? '#ffd23f' : '#333'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke();
    }
    const ew = 150, ex = i ? W - 40 - ew : 40, ey = 88, er = f.energy / 100;
    ctx.fillStyle = '#111'; ctx.fillRect(ex - 3, ey - 3, ew + 6, 16);
    ctx.fillStyle = f.energy >= 50 ? f.def.accent : '#666'; ctx.fillRect(i ? ex + ew * (1 - er) : ex, ey, ew * er, 10);
    ctx.fillStyle = '#111'; ctx.fillRect(ex + ew / 2 - 1, ey, 2, 10);
    text(f.energy >= 50 ? 'SPECIAL READY' : 'SPECIAL', i ? ex - 10 : ex + ew + 10, ey + 5, 13, f.energy >= 50 ? '#fff' : '#999', i ? 'right' : 'left');
    if (f.combo > 1) text(`${f.combo} HIT COMBO!`, i ? W - 60 : 60, 140, 30, '#ffd23f', i ? 'right' : 'left');
  });
  text(String(F.timer).padStart(2, '0'), W / 2, 40, 44, F.timer <= 10 ? '#ff5a36' : '#fff');
}
// Three to six fighters: one compact card each across the top.
function drawHudBrawl() {
  const F = fight, n = F.n, pw = (W - 16) / n, me = mySide();
  F.f.forEach((f, i) => {
    const x = 8 + i * pw, dead = f.hp <= 0, bw = pw - 54, r = clamp(f.hp / f.maxHp, 0, 1), lr = clamp(f.lagHp / f.maxHp, 0, 1);
    ctx.globalAlpha = dead ? .45 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x + 2, 6, pw - 4, 50);
    ctx.strokeStyle = i === me ? '#ffd23f' : PCOL[i]; ctx.lineWidth = i === me ? 3 : 1.5; ctx.strokeRect(x + 2, 6, pw - 4, 50);
    face(f.def, x + 24, 31, 17);
    text(i === me ? 'YOU' : f.def.name, x + 46, 18, 14, i === me ? '#ffd23f' : PCOL[i], 'left');
    for (let k = 0; k < 2; k++) {
      ctx.beginPath(); ctx.arc(x + pw - 12 - k * 11, 18, 4, 0, 7); ctx.fillStyle = k < F.wins[i] ? '#ffd23f' : '#333'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#000'; ctx.stroke();
    }
    ctx.fillStyle = '#5a0d0d'; ctx.fillRect(x + 46, 29, bw, 10);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 46, 29, bw * lr, 10);
    ctx.fillStyle = r > .3 ? '#ffd23f' : '#ff5a36'; ctx.fillRect(x + 46, 29, bw * r, 10);
    ctx.fillStyle = '#222'; ctx.fillRect(x + 46, 43, bw, 5);
    ctx.fillStyle = f.energy >= 50 ? f.def.accent : '#777'; ctx.fillRect(x + 46, 43, bw * f.energy / 100, 5);
    if (dead) text('OUT', x + pw / 2 + 20, 31, 20, '#ff5a36');
  });
  ctx.globalAlpha = 1;
  text(String(F.timer).padStart(2, '0'), W / 2, 84, 34, F.timer <= 10 ? '#ff5a36' : '#fff');
  const mf = F.f[me];
  if (mf && mf.combo > 1) text(`${mf.combo} HIT COMBO!`, W / 2, 124, 26, '#ffd23f');
}
function drawMenuBox(title, opts, sel, sub) {
  ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(0, 0, W, H);
  text(title, W / 2, 150, title.length > 14 ? 54 : 72, '#ffd23f');
  if (sub) text(sub, W / 2, 210, 24, '#fff');
  opts.forEach((o, i) => text((i === sel ? '▶ ' : '') + o, W / 2, 280 + i * 50, 34, i === sel ? '#fff' : '#888'));
}
function renderFight() {
  const F = fight, brawl = F.n > 2, me = mySide();
  ctx.save();
  if (F.shake > .5) ctx.translate(rand(-F.shake, F.shake), rand(-F.shake, F.shake));
  ctx.drawImage(STAGES[F.stage], 0, 0);
  // knocked-out fighters at the back, whoever is attacking in front
  const rank = f => f.hp <= 0 ? 0 : f.state === 'attack' ? 2 : 1;
  for (const f of [...F.f].sort((a, b) => rank(a) - rank(b))) {
    const al = f.alpha;
    if (brawl && f.hp <= 0 && f.y >= GROUND) f.alpha = .4;
    drawFighter(f); f.alpha = al;
  }
  if (brawl) F.f.forEach((f, i) => {            // name tag over each fighter so you can find yourself in the crowd
    if (f.hp <= 0) return;
    text(i === me ? '▼ YOU' : f.def.name, f.x, f.y - 214, i === me ? 15 : 12, i === me ? '#ffd23f' : PCOL[i]);
  });
  F.proj.forEach(drawProj);
  for (const s of F.sparks) {
    ctx.globalAlpha = clamp(s.life / s.max, 0, 1);
    if (s.ring) { ctx.strokeStyle = s.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (1.2 - s.life / s.max), 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = s.color; ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size); }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (brawl) drawHudBrawl(); else drawHudDuel();
  drawBanner();
  if (F.paused) drawMenuBox('PAUSED', ['RESUME', 'QUIT TO MENU'], F.menu);
  if (F.phase === 'matchend') {
    const w = Math.max(0, F.wins.findIndex(v => v >= 2)), guest = net.role === 'guest';
    drawMenuBox(`${F.defs[w].name} WINS!`, guest ? ['WAITING FOR THE HOST…'] : endOpts(), guest ? -1 : F.menu,
      G.mode === 'arcade' ? (w === 0 ? `Opponent ${G.ladderI + 1} of ${G.ladder.length} defeated` : 'You were defeated')
        : G.mode === 'online' ? (w === me ? 'You win the match!' : me < 0 ? 'Match over' : 'Better luck next match')
        : `Player ${w + 1} takes the match`);
  }
}

function renderOnline() {
  bg();
  text('ONLINE MATCH', W / 2, 70, 64, '#ffd23f');
  const small = (s, y, c = '#cbb') => text(s, W / 2, y, 18, c, 'center', null);
  if (net.ui === 'menu') {
    ['HOST A GAME', 'JOIN A GAME'].forEach((o, i) => text((i === net.menu ? '▶ ' : '') + o, W / 2, 220 + i * 56, 38, i === net.menu ? '#fff' : '#9a8fa8'));
    small('One player hosts and shares the room code. Up to 5 friends join with it.', 370);
    small('2 players is a one-on-one fight. 3 to 6 players is a free-for-all brawl.', 398);
    small(touch ? 'Voice chat: tap the microphone button once you are in a room.' : 'Voice chat: press T or click the microphone button once you are in a room.', 426);
    small(touch ? 'LP to choose  ·  ☰ to go back' : 'ENTER to choose  ·  ESC to go back', 500);
  } else if (net.ui === 'wait') {
    text(net.msg + ' '.repeat((performance.now() / 400 | 0) % 3), W / 2, 260, 30, '#fff');
    small('ESC to cancel', 500);
  } else if (net.ui === 'hosting') {
    small('Your room code', 150, '#fff');
    text(net.code.split('').join(' '), W / 2, 230, 110, '#fff');
    const link = inviteLink();
    if (link) { small('Send your friends this link — it joins your room automatically:', 320, '#fff'); text(link, W / 2, 350, 20, '#5ee7ff'); }
    else small('Friends open the game, choose ONLINE → JOIN A GAME and type this code.', 330, '#fff');
    small(net.copied ? 'Copied!' : touch ? `Tap the screen to share the ${link ? 'link' : 'code'}` : `Press C to copy the ${link ? 'link' : 'code'}`, 395, net.copied ? '#c6ff00' : '#cbb');
    text('Waiting for friends (up to 6 players)' + '.'.repeat((performance.now() / 400 | 0) % 4), W / 2, 450, 26, '#ffd23f');
    small('Keep this tab open and visible while you play  ·  ESC to cancel', 505);
  } else if (net.ui === 'typing') {
    small(touch ? 'Tap the box, type the 4-letter room code, then JOIN' : 'Type the 4-letter room code your friend gave you', 110, '#fff');
    for (let i = 0; i < 4 && !touch; i++) {
      const x = W / 2 - 165 + i * 110;
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x - 45, 200, 90, 110);
      ctx.strokeStyle = i === net.code.length ? '#ffd23f' : '#666'; ctx.lineWidth = 4; ctx.strokeRect(x - 45, 200, 90, 110);
      if (net.code[i]) text(net.code[i], x, 258, 84, '#fff');
    }
    if (!touch) small(net.code.length === 4 ? 'Press ENTER to join' : 'BACKSPACE to correct', 360, net.code.length === 4 ? '#ffd23f' : '#cbb');
    small(touch ? '☰ to go back' : 'ESC to go back', 500);
  } else {
    text(net.msg, W / 2, 250, 26, '#ff8a80');
    small(touch ? 'Press LP' : 'Press ENTER', 330, '#ffd23f');
  }
}

/* ----------------------------------------------------------- menu scenes */
function bg() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0a2e'); g.addColorStop(1, '#5c1a1a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(performance.now() / 9000); ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(900, -110); ctx.lineTo(900, 110); ctx.fill(); }
  ctx.restore();
}
function renderTitle() {
  bg();
  text(BUILD, W - 12, 14, 12, '#a99', 'right', null);
  ROSTER.forEach((d, i) => face(d, 66 + i * 92, 500 + Math.sin(G.t * .05 + i) * 4, 30, i >= ROSTER.length / 2));
  ctx.save(); ctx.translate(W / 2, 120); ctx.rotate(-.04);
  text(TITLE, 4, 5, 108, '#000', 'center', null); text(TITLE, 0, 0, 108, '#ffd23f');
  ctx.restore();
  const opts = ['ARCADE  ·  1 PLAYER', 'VERSUS  ·  2 PLAYERS, SAME KEYBOARD', 'ONLINE  ·  PLAY A FRIEND', `DIFFICULTY:  ◀ ${DIFF[G.diff]} ▶`, 'HOW TO PLAY'];
  opts.forEach((o, i) => text((i === G.menu ? '▶ ' : '') + o, W / 2, 222 + i * 44, 30, i === G.menu ? '#fff' : '#9a8fa8'));
  text(touch ? 'Use the pad to choose  ·  LP to confirm' : 'W/S or ↑/↓ to choose  ·  ENTER to confirm  ·  M to mute', W / 2, 444, 16, '#cbb', 'center', null);
}
function renderHowto() {
  bg();
  text('HOW TO PLAY', W / 2, 40, 48, '#ffd23f');
  const rows = [['', 'PLAYER 1', 'PLAYER 2', 'PHONE'],
    ['Move / Jump / Crouch', 'A D / W / S', '← → / ↑ / ↓', 'Pad'],
    ['Left punch  ·  Right punch', 'F  ·  G', 'I  ·  O', 'LP  ·  RP'],
    ['Left kick  ·  Right kick', 'V  ·  B', 'K  ·  L', 'LK  ·  RK'],
    ['Special (needs half bar)', 'H', 'P', 'SP']];
  rows.forEach((r, i) => {
    const y = 88 + i * 34, c = i ? '#fff' : '#ffd23f';
    text(r[0], 330, y, 20, '#cbb', 'right'); text(r[1], 460, y, 22, c); text(r[2], 640, y, 22, c); text(r[3], 820, y, 22, c);
  });
  const tips = ['LEFT PUNCH is a fast jab, RIGHT PUNCH a harder cross. LEFT KICK is quick, RIGHT KICK a big high kick.',
    'Hold DOWN for low attacks: crouch jab, rising uppercut (launches), shin kick and a sweep that knocks down.',
    'BLOCK by holding away from your opponent. Crouch + away blocks low. Jump attacks must be blocked standing.',
    'High punches, high kicks and energy blasts miss a crouching fighter.',
    'Try the combo  LEFT PUNCH → RIGHT PUNCH → LEFT KICK.',
    'Arcade and Online accept either key set (WASD + I O K L works well). Player 2 can also use the numpad.',
    'Win 2 rounds to take the match.  ESC or ☰ pauses.  M mutes.'];
  tips.forEach((t, i) => text(t, W / 2, 278 + i * 29, 16, '#fff', 'center', null));
  text(touch ? 'Press LP to go back' : 'Press ENTER to go back', W / 2, 512, 18, '#ffd23f');
}
function statBars(d, x, y, align) {
  [['SPD', d.speed], ['POW', d.power], ['HP', d.health]].forEach(([l, v], i) => {
    const yy = y + i * 18, bx = align === 'left' ? x + 40 : x - 40 - 100;
    text(l, x, yy, 14, '#cbb', align, null);
    for (let k = 0; k < 5; k++) { ctx.fillStyle = k < v ? d.accent : '#333'; ctx.fillRect(bx + k * 20, yy - 5, 17, 10); }
  });
}
function previewPanel(d, side, label, locked, col) {
  const x = side ? W - 140 : 140, al = side ? 'right' : 'left', tx = side ? W - 30 : 30;
  ctx.fillStyle = d ? shade(d.shirt, -.4) : '#222'; ctx.beginPath(); ctx.arc(x, 120, 88, 0, 7); ctx.fill();
  if (d) face(d, x, 120, 78, side); else text('?', x, 120, 110, '#666');
  text(label, tx, 22, 18, col, al);
  if (!d) return;
  text(d.name, tx, 226, 34, locked ? '#ffd23f' : '#fff', al);
  text(d.title, tx, 254, 15, '#cbb', al, null);
  text(SPECIALS[d.special].label, tx, 274, 15, d.accent, al);
}
function renderSelect() {
  bg();
  const S = G.sel, arc = G.mode === 'arcade', onl = G.mode === 'online';
  const me = onl ? Math.max(0, mySide()) : 0, n = arc ? 1 : S.c.length;
  text('CHOOSE YOUR FIGHTER', W / 2, 40, 44, '#ffd23f');
  if (onl) text(`ROOM ${net.code}   ·   ${n} PLAYER${n > 1 ? 'S' : ''}   ·   ${n < MAXP ? 'friends can still join' : 'room is full'}`, W / 2, 78, 16, '#5ee7ff', 'center', null);
  // left: this screen's player.  right: the opponent, or the list of everyone in a brawl
  const dl = ROSTER[S.c[me]] || ROSTER[0];
  previewPanel(dl, 0, arc || onl ? 'YOU' : 'PLAYER 1', S.lock[me], PCOL[me]);
  statBars(dl, 300, 118, 'left');
  if (arc) previewPanel(null, 1, 'CPU', false, PCOL[1]);
  else if (n <= 2) {
    const o = onl ? 1 - me : 1, d2 = S.c[o] != null ? ROSTER[S.c[o]] : null;
    previewPanel(d2, 1, d2 ? (onl ? 'FRIEND' : 'PLAYER 2') : 'WAITING…', S.lock[o], PCOL[o]);
    if (d2) statBars(d2, W - 300, 118, 'right');
  } else S.c.forEach((c, p) => {
    const y = 34 + p * 40, d = ROSTER[c];
    face(d, W - 36, y, 16, true);
    text(`${p === me ? 'YOU' : 'P' + (p + 1)}   ${d.name}${S.lock[p] ? '  ✓' : ''}`, W - 62, y, 18, S.lock[p] ? '#ffd23f' : PCOL[p], 'right');
  });
  const cw = 104, x0 = W / 2 - cw * 2.5, y0 = 300;
  ROSTER.forEach((d, i) => {
    const x = x0 + (i % 5) * cw, y = y0 + (i / 5 | 0) * cw;
    ctx.fillStyle = shade(d.shirt, -.5); ctx.fillRect(x + 4, y + 4, cw - 8, cw - 8);
    face(d, x + cw / 2, y + cw / 2 - 6, 36);
    text(d.name, x + cw / 2, y + cw - 14, 14, '#fff');
    S.c.forEach((c, p) => {                    // one coloured cursor per player
      if ((arc && p > 0) || c !== i) return;
      const pulse = S.lock[p] ? 0 : Math.sin(G.t * .2) * 2, inset = p * 3;
      ctx.strokeStyle = PCOL[p]; ctx.lineWidth = 4;
      ctx.strokeRect(x + 3 + inset - pulse, y + 3 + inset - pulse, cw - 6 - inset * 2 + pulse * 2, cw - 6 - inset * 2 + pulse * 2);
      text(arc || (onl && p === me) ? 'YOU' : `P${p + 1}`, x + 20 + (p % 3) * 32, y + 14 + (p > 2 ? 16 : 0), 14, PCOL[p]);
    });
  });
  if (onl && G.cd > 0) {
    text(`STARTING IN ${Math.max(1, Math.ceil((300 - G.cd) / 60))}`, W / 2, 222, 34, '#c6ff00');
    text(net.role === 'host' ? (touch ? 'press LP to start now' : 'press ENTER to start now') : 'everyone is ready', W / 2, 256, 15, '#cbb', 'center', null);
  } else if (onl && n > 1) text('The match starts when everyone has picked', W / 2, 240, 16, '#cbb', 'center', null);
  if (touch) text(onl ? `Pad: move   ·   LP: confirm   ·   You are player ${me + 1}` : 'Pad: move   ·   LP: confirm   ·   ☰: back', W / 2, 524, 15, '#cbb', 'center', null);
  else text(onl ? `Move: WASD / arrows   ·   Confirm: F or ENTER   ·   ESC: leave   ·   You are player ${me + 1}`
     : arc ? 'Move: WASD / arrows   ·   Confirm: F or ENTER   ·   ESC: back'
           : 'P1: WASD + F or SPACE     ·     P2: arrows + I or ENTER     ·     ESC: back', W / 2, 524, 16, '#cbb', 'center', null);
}
function renderVs() {
  bg();
  const k = Math.min(1, G.t / 25), e = 1 - Math.pow(1 - k, 3), P2 = G.picks, n = P2.length;
  const pop = 1 + Math.max(0, 30 - G.t) * .1;
  if (n <= 2) {
    const [a, b] = P2;
    face(a, lerp(-150, 230, e), 250, 130); face(b, lerp(W + 150, W - 230, e), 250, 130, true);
    text(a.name, lerp(-150, 230, e), 420, 44, '#fff'); text(b.name, lerp(W + 150, W - 230, e), 420, 44, '#fff');
    text(a.title, lerp(-150, 230, e), 456, 17, '#cbb', 'center', null); text(b.title, lerp(W + 150, W - 230, e), 456, 17, '#cbb', 'center', null);
    ctx.save(); ctx.translate(W / 2, 250); ctx.scale(pop, pop); text('VS', 0, 0, 120, '#ffd23f'); ctx.restore();
    if (G.mode === 'arcade') text(`FIGHT ${G.ladderI + 1} OF ${G.ladder.length}`, W / 2, 60, 30, '#fff');
  } else {                                      // brawl: everyone lined up
    const me = mySide(), gap = W / (n + 1), r = Math.min(64, gap * .42);
    ctx.save(); ctx.translate(W / 2, 110); ctx.scale(pop, pop); text(`${n} PLAYER BRAWL`, 0, 0, 80, '#ffd23f'); ctx.restore();
    P2.forEach((d, i) => {
      const x = gap * (i + 1), y = lerp(H + 120, 300, e);
      face(d, x, y, r, i >= n / 2);
      text(d.name, x, y + r + 26, 24, PCOL[i]);
      if (i === me) text('YOU', x, y - r - 18, 18, '#ffd23f');
    });
    text('Last one standing wins the round  ·  first to 2 rounds wins', W / 2, 480, 18, '#cbb', 'center', null);
  }
}
function renderChampion() {
  bg();
  for (let i = 0; i < 80; i++) {
    const x = (i * 97 + G.t * (1 + i % 3)) % W, y = (i * 53 + G.t * (2 + i % 4)) % H;
    ctx.fillStyle = `hsl(${i * 37 % 360},90%,60%)`; ctx.fillRect(x, y, 8, 5);
  }
  text('CHAMPION!', W / 2, 80, 96, '#ffd23f');
  face(G.picks[0], W / 2, 270, 120);
  text(G.picks[0].name, W / 2, 430, 50, '#fff');
  text('defeated every challenger', W / 2, 470, 20, '#cbb', 'center', null);
  if (G.t > 60) text('Press ENTER', W / 2, 510, 20, '#ffd23f');
}
function render() {
  const wantBox = touch && G.scene === 'online' && net.ui === 'typing';
  if (codeBox.hidden === wantBox) codeBox.hidden = !wantBox;
  switch (G.scene) {
    case 'title': renderTitle(); break;
    case 'howto': renderHowto(); break;
    case 'online': renderOnline(); break;
    case 'select': renderSelect(); break;
    case 'vs': renderVs(); break;
    case 'fight': renderFight(); break;
    case 'champion': renderChampion(); break;
  }
  if (muted) text('MUTED', W - 12, H - 60, 14, '#f66', 'right');
  const linked = net.role === 'guest' ? !!net.conn : net.role === 'host' && net.guests.length > 0, canTalk = linked && !!net.peer;
  if (micBtn) {
    if (micBtn.hidden === canTalk) micBtn.hidden = !canTalk;
    micBtn.classList.toggle('on', voice.on);
  }
  if (linked) {
    const heard = Object.values(voice.calls).filter(c => c.live).length;
    const v = !canTalk ? 'VOICE NEEDS A DIRECT LINK' : voice.err || (voice.on ? 'MIC ON' : touch ? 'MIC OFF' : 'MIC OFF (T)') + ` · ${heard} VOICE LINK${heard === 1 ? '' : 'S'}`;
    const who = net.role === 'guest' ? (net.via === 'relay' ? 'RELAY' : 'DIRECT') : `HOST · ${net.guests.length + 1} PLAYERS`;
    text(`ONLINE · ${who} · ${v}`, W / 2, H - 9, 11, voice.on ? '#c6ff00' : '#9a9', 'center', null);
  }
}

/* ------------------------------------------------------------------- loop */
let last = performance.now(), acc = 0;
function frame(t) {
  acc += Math.min(100, t - last); last = t;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// debugging hooks (used for automated testing)
window.__game = { G, net, get fight() { return fight; }, keys, pressed, update, render, startFight, drawFighter, hostGame, joinGame, voice, ROSTER };

// An invite link (…?join=ABCD) drops the friend straight into the room.
const invite = new URLSearchParams(location.search).get('join');
if (invite && /^[A-Za-z]{4}$/.test(invite)) { G.scene = 'online'; joinGame(invite.toUpperCase()); }
})();
