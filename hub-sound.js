/**
 * Shared Web Audio sounds for every game.
 * Mute is stored in localStorage and shared across the whole site.
 *
 * window.HubSound.play(kind)
 * kinds: click, key, back, error, flip, win, lose, hint, achieve,
 *        eat, place, match, shoot, hit, clear, flap, merge, draw
 */
(function () {
  const STORAGE_KEY = "hub-sound";
  const LEGACY_KEY = "wordle-sound";

  function loadEnabled() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "on") return true;
    if (raw === "off") return false;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "off") return false;
    return true;
  }

  let enabled = loadEnabled();
  let audioCtx = null;
  let noiseBuffer = null;

  function getAudio() {
    if (!enabled) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function getNoiseBuffer(ctx) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      // Slightly brown-ish noise — softer / creamier than pure white
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5 * (1 - i / len);
    }
    noiseBuffer = buf;
    return noiseBuffer;
  }

  function tone({ freq, dur = 0.08, type = "square", vol = 0.07, slide = 0, delay = 0, attack = 0.012 }) {
    const ctx = getAudio();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + Math.max(0.004, attack));
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  /** Soft low-passed sine for honey / creamy body. */
  function softTone({ freq, dur = 0.12, vol = 0.04, slide = 0, delay = 0, attack = 0.02, lp = 1200 } = {}) {
    const ctx = getAudio();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(60, freq + slide), t + dur);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lp, t);
    filter.Q.setValueAtTime(0.7, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.04);
  }

  /** Short filtered noise burst — the “strike” of a key. */
  function noiseHit({ dur = 0.03, vol = 0.04, freq = 1800, delay = 0, q = 1.2, type = "bandpass" } = {}) {
    const ctx = getAudio();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(q, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Creamy “honey keyboard” ASMR thock — buttery, muted, close-mic. */
  function playKeyThock() {
    // Tiny organic variation so every press feels handmade
    const wobble = (Math.random() - 0.5) * 18;
    const soft = 0.92 + Math.random() * 0.16;

    // Slow honey body — warm mids, no boom
    softTone({
      freq: 255 + wobble,
      dur: 0.18,
      vol: 0.048 * soft,
      slide: -40,
      attack: 0.028,
      lp: 900
    });
    softTone({
      freq: 380 + wobble * 0.6,
      dur: 0.14,
      vol: 0.03 * soft,
      slide: -55,
      attack: 0.022,
      lp: 1400,
      delay: 0.008
    });
    // Silky overtone (like a lubed linear)
    softTone({
      freq: 560 + wobble,
      dur: 0.1,
      vol: 0.016 * soft,
      slide: -90,
      attack: 0.018,
      lp: 2000,
      delay: 0.012
    });
    // Tiny keycap kiss — soft, not clicky
    softTone({
      freq: 1350 + wobble * 2,
      dur: 0.035,
      vol: 0.01 * soft,
      slide: -260,
      attack: 0.006,
      lp: 3200,
      delay: 0.004
    });

    // Buttery cream texture (low-passed noise, long glide)
    noiseHit({
      dur: 0.11,
      vol: 0.042 * soft,
      freq: 1600,
      q: 0.35,
      type: "lowpass",
      delay: 0.002
    });
    noiseHit({
      dur: 0.08,
      vol: 0.022 * soft,
      freq: 2800,
      q: 0.45,
      type: "lowpass",
      delay: 0.012
    });
    // Soft “case foam” hush after bottom-out
    noiseHit({
      dur: 0.14,
      vol: 0.014 * soft,
      freq: 700,
      q: 0.3,
      type: "lowpass",
      delay: 0.03
    });
  }

  function play(kind, extra) {
    if (!enabled) return;
    if (kind === "key") playKeyThock();
    else if (kind === "click" || kind === "place") {
      // Slightly fuller generic UI click (still short)
      tone({ freq: 620, dur: 0.04, type: "triangle", vol: 0.05 });
      tone({ freq: 980, dur: 0.028, type: "square", vol: 0.02, slide: -120 });
      noiseHit({ dur: 0.018, vol: 0.028, freq: 2800, q: 1.1 });
    } else if (kind === "back") {
      const wobble = (Math.random() - 0.5) * 12;
      softTone({ freq: 340 + wobble, dur: 0.12, vol: 0.032, slide: -70, attack: 0.02, lp: 1100 });
      softTone({ freq: 520 + wobble, dur: 0.08, vol: 0.016, slide: -100, attack: 0.015, lp: 1800, delay: 0.01 });
      noiseHit({ dur: 0.09, vol: 0.028, freq: 1500, q: 0.35, type: "lowpass" });
      noiseHit({ dur: 0.1, vol: 0.012, freq: 900, q: 0.3, type: "lowpass", delay: 0.02 });
    } else if (kind === "error") {
      tone({ freq: 180, dur: 0.16, type: "sawtooth", vol: 0.05, slide: -70 });
      tone({ freq: 140, dur: 0.18, type: "square", vol: 0.03, delay: 0.04 });
    } else if (kind === "flip") {
      const freq = extra === "correct" ? 620 : extra === "present" ? 390 : 210;
      tone({ freq, dur: 0.09, type: "triangle", vol: 0.055 });
    } else if (kind === "win") {
      [523, 659, 784, 1046].forEach((freq, i) => {
        tone({ freq, dur: 0.16, type: "triangle", vol: 0.07, delay: i * 0.11 });
      });
      window.HubConfetti?.burst();
    } else if (kind === "lose") {
      [330, 247, 196].forEach((freq, i) => {
        tone({ freq, dur: 0.2, type: "triangle", vol: 0.06, delay: i * 0.14 });
      });
    } else if (kind === "hint" || kind === "draw") {
      tone({ freq: 520, dur: 0.08, type: "triangle", vol: 0.05 });
      tone({ freq: 390, dur: 0.1, type: "triangle", vol: 0.04, delay: 0.07 });
    } else if (kind === "achieve") {
      [659, 784, 988].forEach((freq, i) => {
        tone({ freq, dur: 0.12, type: "triangle", vol: 0.06, delay: i * 0.08 });
      });
      window.HubConfetti?.burst({ count: 90, duration: 1800 });
    } else if (kind === "eat" || kind === "match") {
      tone({ freq: 640, dur: 0.07, type: "triangle", vol: 0.06 });
      tone({ freq: 820, dur: 0.08, type: "triangle", vol: 0.05, delay: 0.05 });
    } else if (kind === "shoot" || kind === "flap") {
      tone({ freq: 880, dur: 0.04, type: "square", vol: 0.035, slide: -220 });
    } else if (kind === "hit") {
      tone({ freq: 240, dur: 0.1, type: "sawtooth", vol: 0.05, slide: -90 });
    } else if (kind === "clear") {
      [392, 523, 659].forEach((freq, i) => {
        tone({ freq, dur: 0.12, type: "triangle", vol: 0.06, delay: i * 0.07 });
      });
    } else if (kind === "merge") {
      tone({ freq: 430, dur: 0.09, type: "triangle", vol: 0.055, slide: 90 });
    }
  }

  function setEnabled(next) {
    enabled = !!next;
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    localStorage.setItem(LEGACY_KEY, enabled ? "on" : "off");
    paintButtons();
    if (enabled) play("click");
  }

  function toggle() {
    setEnabled(!enabled);
  }

  function paint(btn) {
    if (!btn) return;
    btn.textContent = enabled ? "🔊" : "🔇";
    btn.title = enabled ? "Mute sounds" : "Unmute sounds";
    btn.setAttribute("aria-label", enabled ? "Mute sounds" : "Unmute sounds");
  }

  function paintButtons() {
    document.querySelectorAll("#sound-btn, #hub-sound-btn").forEach(paint);
  }

  function injectStyles() {
    if (document.getElementById("hub-sound-style")) return;
    const style = document.createElement("style");
    style.id = "hub-sound-style";
    style.textContent = `
      #hub-sound-btn {
        appearance: none;
        margin-left: 0.4rem;
        min-width: 2.4rem;
        height: 2.4rem;
        padding: 0 0.45rem;
        border-radius: 8px;
        border: 1px solid currentColor;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 1.05rem;
        cursor: pointer;
        opacity: 0.9;
      }
      #hub-sound-btn:hover { opacity: 1; }
    `;
    document.head.appendChild(style);
  }

  function bindUi() {
    let btn = document.getElementById("sound-btn");
    if (!btn) {
      const menu = document.getElementById("menu-btn");
      if (!menu) return;
      injectStyles();
      btn = document.createElement("button");
      btn.id = "hub-sound-btn";
      btn.type = "button";
      menu.insertAdjacentElement("afterend", btn);
    }
    if (btn.dataset.hubSoundBound) {
      paint(btn);
      return;
    }
    btn.dataset.hubSoundBound = "1";
    paint(btn);
    btn.addEventListener("click", toggle);
  }

  document.addEventListener("pointerdown", getAudio, { once: true });
  document.addEventListener("keydown", getAudio, { once: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUi);
  } else {
    bindUi();
  }

  window.HubSound = {
    play,
    toggle,
    isEnabled: () => enabled,
    unlock: getAudio
  };
})();
