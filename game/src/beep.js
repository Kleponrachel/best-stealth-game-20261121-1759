// Night Vault — sound. Every effect is synthesized live with WebAudio:
// soft footfalls, a bright gem chime, a low keycard thunk, a rising alarm
// and a little win / lose phrase. No audio files, no network. Safe to call
// before any user gesture: the context simply stays suspended until then.
let ctx = null;
let master = null;

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume();
}

function tone(freq, dur, type = 'sine', vol = 0.5, when = 0, slideTo = null) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playEvent(name) {
  if (typeof window === 'undefined') return;
  switch (name) {
    case 'step':
      tone(90 + Math.random() * 30, 0.07, 'triangle', 0.18);
      break;
    case 'gem':
      tone(880, 0.12, 'sine', 0.5);
      tone(1318, 0.2, 'sine', 0.4, 0.07);
      break;
    case 'keycard':
      tone(220, 0.12, 'square', 0.25);
      tone(330, 0.16, 'square', 0.25, 0.1);
      break;
    case 'spotted':
      tone(520, 0.25, 'sawtooth', 0.3, 0, 780);
      break;
    case 'alarm':
      tone(440, 0.22, 'sawtooth', 0.35, 0, 660);
      tone(440, 0.22, 'sawtooth', 0.35, 0.24, 660);
      break;
    case 'caught':
      tone(330, 0.5, 'sawtooth', 0.4, 0, 110);
      break;
    case 'clear':
      tone(523, 0.14, 'sine', 0.45);
      tone(659, 0.14, 'sine', 0.45, 0.12);
      tone(784, 0.3, 'sine', 0.45, 0.24);
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'sine', 0.45, i * 0.13));
      break;
    default:
      break;
  }
}
