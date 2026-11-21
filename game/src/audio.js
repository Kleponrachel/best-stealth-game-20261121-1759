// Sound, synthesized live with WebAudio: no audio files, no network. A soft step
// every stride, a chime for a gem, a two-note sting when a guard spots you, a low
// drone under everything. Created on the first user gesture; silent when the tab
// has no audio or the player muted it with M.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let drone = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      drone = ctx.createOscillator();
      const droneGain = ctx.createGain();
      drone.type = 'sine';
      drone.frequency.value = 55;
      droneGain.gain.value = 0.035;
      drone.connect(droneGain);
      droneGain.connect(master);
      drone.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol, freq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    step(sneak) {
      noiseBurst(0.05, sneak ? 0.05 : 0.11, sneak ? 500 : 900);
    },
    guardStep(distance) {
      if (distance > 320) return;
      noiseBurst(0.06, 0.09 * (1 - distance / 320), 300);
    },
    gem() {
      tone(880, 0.12, 'sine', 0.16);
      tone(1318, 0.18, 'sine', 0.14, 0.07);
    },
    key() {
      tone(523, 0.1, 'triangle', 0.16);
      tone(784, 0.14, 'triangle', 0.16, 0.08);
    },
    door() {
      tone(180, 0.3, 'sawtooth', 0.1, 0, 90);
      noiseBurst(0.25, 0.12, 400);
    },
    spotted() {
      tone(660, 0.14, 'square', 0.09);
      tone(660, 0.14, 'square', 0.09, 0.16);
    },
    alert() {
      tone(440, 0.22, 'sawtooth', 0.14, 0, 880);
      tone(880, 0.3, 'sawtooth', 0.12, 0.18, 440);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.16, 0, 55);
      tone(110, 0.6, 'square', 0.1, 0.1, 55);
    },
    level() {
      tone(523, 0.12, 'sine', 0.15);
      tone(659, 0.12, 'sine', 0.15, 0.1);
      tone(784, 0.2, 'sine', 0.15, 0.2);
    },
    win() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.25, 'sine', 0.15, i * 0.11));
    },
    click() {
      tone(700, 0.05, 'sine', 0.08);
    },
  };
}
