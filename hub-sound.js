/**
 * Shared Web Audio sounds for every game.
 * Mute is stored in localStorage and shared across the whole site.
 *
 * window.HubSound.play(kind)
 * kinds: click, key, back, error, flip, win, lose, hint, achieve,
 *        eat, place, match, shoot, hit, clear, flap, merge, draw,
 *        weather-storm, weather-calm, weather-none
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
  let rainBuffer = null;
  let keySamples = [];
  let keySamplesLoading = null;
  let ambientKind = null;
  let ambientNodes = null;

  function getAudio() {
    if (!enabled) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function hubAssetUrl(relPath) {
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i += 1) {
      const src = scripts[i].src || "";
      if (/hub-sound\.js(\?|$)/i.test(src)) {
        return new URL(relPath, src).href;
      }
    }
    return new URL(relPath, window.location.href).href;
  }

  async function ensureKeySamples() {
    if (keySamples.length) return keySamples;
    if (keySamplesLoading) return keySamplesLoading;
    const ctx = getAudio();
    if (!ctx) return [];
    keySamplesLoading = (async () => {
      const files = [];
      for (let i = 0; i < 16; i += 1) files.push(`sounds/key-cream-${i}.wav`);
      const loaded = [];
      await Promise.all(
        files.map(async (file) => {
          try {
            const res = await fetch(hubAssetUrl(file), { cache: "force-cache" });
            if (!res.ok) return;
            const raw = await res.arrayBuffer();
            const buf = await ctx.decodeAudioData(raw.slice(0));
            loaded.push(buf);
          } catch {}
        })
      );
      keySamples = loaded;
      return keySamples;
    })();
    try {
      return await keySamplesLoading;
    } finally {
      keySamplesLoading = null;
    }
  }

  function playKeySample(opts = {}) {
    const ctx = getAudio();
    if (!ctx || !keySamples.length) return false;
    const buf = keySamples[(Math.random() * keySamples.length) | 0];
    if (!buf) return false;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Keep close to the recording — tiny natural variation only
    const rateBase = opts.rate != null ? opts.rate : 1;
    src.playbackRate.value = rateBase * (0.985 + Math.random() * 0.03);
    const gain = ctx.createGain();
    const vol = (opts.vol != null ? opts.vol : 0.4) * (0.92 + Math.random() * 0.16);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.35, buf.duration + 0.04));
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);
    return true;
  }

  /** Your creamy keyboard recording clips; soft synth only while loading. */
  function playKeyThock() {
    if (playKeySample({ vol: 0.38 })) return;
    ensureKeySamples();
    playKeyThockSynth();
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

  function getRainBuffer(ctx) {
    if (rainBuffer && rainBuffer.sampleRate === ctx.sampleRate) return rainBuffer;
    const len = Math.floor(ctx.sampleRate * 2.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.018 * white) / 1.018;
      // Soft hiss with a bit of crackle for rain texture
      const crackle = Math.random() < 0.012 ? (Math.random() * 2 - 1) * 0.35 : 0;
      data[i] = last * 2.8 + crackle * 0.15;
    }
    rainBuffer = buf;
    return rainBuffer;
  }

  function stopAmbient() {
    if (!ambientNodes) {
      ambientKind = null;
      return;
    }
    (ambientNodes.timers || []).forEach((id) => {
      clearInterval(id);
      clearTimeout(id);
    });
    (ambientNodes.sources || []).forEach((src) => {
      try {
        src.stop();
      } catch {}
      try {
        src.disconnect();
      } catch {}
    });
    (ambientNodes.gains || []).forEach((gain) => {
      try {
        gain.disconnect();
      } catch {}
    });
    ambientNodes = null;
    ambientKind = null;
  }

  function startStormAmbient() {
    const ctx = getAudio();
    if (!ctx) return;
    stopAmbient();
    ambientKind = "storm";
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getRainBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(0.55, t);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(4200, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.045, t + 0.8);
    src.connect(filter);
    filter.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);

    // Soft distant rumble bed
    const rumble = ctx.createOscillator();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(48, t);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.018, t + 1.2);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(t);

    const timers = [];
    const boom = () => {
      if (!enabled || ambientKind !== "storm") return;
      const now = ctx.currentTime;
      noiseHit({ dur: 0.55, vol: 0.07, freq: 120, q: 0.4, type: "lowpass" });
      noiseHit({ dur: 0.35, vol: 0.04, freq: 280, q: 0.6, type: "lowpass", delay: 0.08 });
      softTone({ freq: 70, dur: 0.9, vol: 0.03, slide: -20, attack: 0.08, lp: 220, delay: 0.02 });
      // Keep rain from clipping during thunder
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
        gain.gain.exponentialRampToValueAtTime(0.028, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 1.1);
      } catch {}
    };
    // Opening thunder stinger
    timers.push(setTimeout(boom, 400));
    timers.push(
      setInterval(() => {
        if (Math.random() < 0.55) boom();
      }, 5200 + Math.random() * 2800)
    );

    ambientNodes = { sources: [src, rumble], gains: [gain, rumbleGain], timers };
  }

  function startCalmAmbient() {
    const ctx = getAudio();
    if (!ctx) return;
    stopAmbient();
    ambientKind = "calm";
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getRainBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, t);
    filter.Q.setValueAtTime(0.4, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.022, t + 1.1);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t);

    const pad = ctx.createOscillator();
    pad.type = "sine";
    pad.frequency.setValueAtTime(196, t);
    const pad2 = ctx.createOscillator();
    pad2.type = "sine";
    pad2.frequency.setValueAtTime(246.9, t);
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.0001, t);
    padGain.gain.exponentialRampToValueAtTime(0.016, t + 1.4);
    const padLp = ctx.createBiquadFilter();
    padLp.type = "lowpass";
    padLp.frequency.setValueAtTime(700, t);
    pad.connect(padLp);
    pad2.connect(padLp);
    padLp.connect(padGain);
    padGain.connect(ctx.destination);
    pad.start(t);
    pad2.start(t);

    // Soft swell accents
    const timers = [];
    timers.push(
      setInterval(() => {
        if (!enabled || ambientKind !== "calm") return;
        softTone({
          freq: 330 + Math.random() * 40,
          dur: 0.55,
          vol: 0.012,
          slide: 18,
          attack: 0.12,
          lp: 1100
        });
      }, 3800)
    );

    ambientNodes = { sources: [src, pad, pad2], gains: [gain, padGain], timers };
  }

  function setAmbientWeather(kind) {
    if (!enabled) {
      stopAmbient();
      return;
    }
    if (kind === "storm") {
      if (ambientKind === "storm") return;
      startStormAmbient();
      return;
    }
    if (kind === "calm") {
      if (ambientKind === "calm") return;
      startCalmAmbient();
      return;
    }
    stopAmbient();
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

  function playKeyThockSynth() {
    const wobble = (Math.random() - 0.5) * 14;
    softTone({
      freq: 300 + wobble,
      dur: 0.16,
      vol: 0.04,
      slide: -35,
      attack: 0.03,
      lp: 850
    });
    softTone({
      freq: 440 + wobble,
      dur: 0.12,
      vol: 0.024,
      slide: -50,
      attack: 0.025,
      lp: 1300,
      delay: 0.01
    });
    noiseHit({
      dur: 0.1,
      vol: 0.035,
      freq: 1400,
      q: 0.3,
      type: "lowpass",
      delay: 0.004
    });
  }

  function play(kind, extra) {
    if (!enabled) return;
    if (kind === "key") {
      playKeyThock();
      return;
    }
    if (kind === "click" || kind === "place") {
      // Slightly fuller generic UI click (still short)
      tone({ freq: 620, dur: 0.04, type: "triangle", vol: 0.05 });
      tone({ freq: 980, dur: 0.028, type: "square", vol: 0.02, slide: -120 });
      noiseHit({ dur: 0.018, vol: 0.028, freq: 2800, q: 1.1 });
    } else if (kind === "back") {
      if (playKeySample({ vol: 0.26, rate: 0.94 })) return;
      ensureKeySamples();
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
    } else if (kind === "weather-storm") {
      setAmbientWeather("storm");
    } else if (kind === "weather-calm") {
      setAmbientWeather("calm");
    } else if (kind === "weather-none" || kind === "weather-stop") {
      setAmbientWeather("none");
    }
  }

  function setEnabled(next) {
    enabled = !!next;
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    localStorage.setItem(LEGACY_KEY, enabled ? "on" : "off");
    paintButtons();
    if (enabled) play("click");
    else stopAmbient();
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

  document.addEventListener("pointerdown", () => {
    getAudio();
    ensureKeySamples();
  }, { once: true });
  document.addEventListener("keydown", () => {
    getAudio();
    ensureKeySamples();
  }, { once: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUi);
  } else {
    bindUi();
  }

  window.HubSound = {
    play,
    toggle,
    isEnabled: () => enabled,
    unlock: getAudio,
    stopAmbient,
    setAmbientWeather
  };
})();
