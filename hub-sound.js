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
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      // Soften toward the end so we can reuse one buffer
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    noiseBuffer = buf;
    return noiseBuffer;
  }

  function tone({ freq, dur = 0.08, type = "square", vol = 0.07, slide = 0, delay = 0 }) {
    const ctx = getAudio();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.linearRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  /** Short filtered noise burst — the “strike” of a key. */
  function noiseHit({ dur = 0.03, vol = 0.04, freq = 1800, delay = 0, q = 1.2 } = {}) {
    const ctx = getAudio();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(freq, t);
    filter.Q.setValueAtTime(q, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Soft ASMR-style key — close-mic thock + creamy tick (Guessword). */
  function playKeyThock() {
    // Lighter body (less deep bass)
    tone({ freq: 210, dur: 0.1, type: "sine", vol: 0.04, slide: -35 });
    tone({ freq: 340, dur: 0.07, type: "triangle", vol: 0.026, slide: -60 });
    // Creamy mid / stem tick
    tone({ freq: 720, dur: 0.03, type: "sine", vol: 0.018, slide: -140 });
    tone({ freq: 1180, dur: 0.018, type: "triangle", vol: 0.012, slide: -200, delay: 0.005 });
    // Soft brush / plastic whisper
    noiseHit({ dur: 0.045, vol: 0.036, freq: 2200, q: 0.6 });
    noiseHit({ dur: 0.032, vol: 0.02, freq: 4800, q: 0.75, delay: 0.006 });
    noiseHit({ dur: 0.055, vol: 0.01, freq: 1400, q: 0.45, delay: 0.015 });
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
      // Soft erase — lighter ASMR brush
      noiseHit({ dur: 0.04, vol: 0.026, freq: 1800, q: 0.55 });
      tone({ freq: 320, dur: 0.08, type: "sine", vol: 0.032, slide: -100 });
      tone({ freq: 480, dur: 0.06, type: "triangle", vol: 0.018, slide: -80, delay: 0.01 });
      noiseHit({ dur: 0.05, vol: 0.01, freq: 1100, q: 0.4, delay: 0.012 });
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
