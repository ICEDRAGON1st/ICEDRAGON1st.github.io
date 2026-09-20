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
  const VOLUME_KEY = "hub-sound-volume";

  function loadEnabled() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "on") return true;
    if (raw === "off") return false;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "off") return false;
    return true;
  }

  function loadVolume() {
    const n = Number(localStorage.getItem(VOLUME_KEY));
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.min(3, n));
  }

  let enabled = loadEnabled();
  let volume = loadVolume();
  let audioCtx = null;
  let masterGain = null;
  let noiseBuffer = null;
  let rainBuffer = null;
  let thunderBuffer = null;
  let surfBuffer = null;
  let stormRainSample = null;
  let stormFullSample = null;
  let stormSamplesLoading = null;
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
    ensureMaster(audioCtx);
    return audioCtx;
  }

  function ensureMaster(ctx) {
    if (!ctx) return null;
    if (!masterGain) {
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    }
    return masterGain;
  }

  function getOut(ctx) {
    const c = ctx || getAudio();
    return ensureMaster(c);
  }

  function applyMasterVolume() {
    if (!masterGain) return;
    const v = enabled ? volume : 0;
    try {
      const t = (audioCtx && audioCtx.currentTime) || 0;
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(Math.max(0, v), t);
    } catch {
      masterGain.gain.value = Math.max(0, v);
    }
  }

  function setVolume(next) {
    const n = Number(next);
    volume = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {}
    applyMasterVolume();
    return volume;
  }

  function getVolume() {
    return volume;
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
    gain.connect(getOut(ctx));
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
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 4);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    // Sparse droplet impulses only — no continuous hiss bed
    let i = 0;
    while (i < len) {
      // Gap between drops (~0.8–4 ms at 48k) → audible patter, not static sheet
      const gap = 40 + Math.floor(Math.random() * 160);
      i += gap;
      if (i >= len) break;
      const amp = 0.25 + Math.random() * 0.75;
      const sign = Math.random() < 0.5 ? -1 : 1;
      // Short wet splat (0.4–2 ms)
      const splat = 6 + Math.floor(Math.random() * 28);
      for (let k = 0; k < splat && i + k < len; k += 1) {
        const env = Math.exp(-k / (3 + Math.random() * 5));
        // Mild high-freq tick, not broadband static
        const tick = sign * amp * env * (0.55 + 0.45 * Math.sin(k * 1.7));
        data[i + k] += tick;
      }
      // Occasional bigger drop
      if (Math.random() < 0.04) {
        const heavy = 18 + Math.floor(Math.random() * 40);
        const hAmp = 0.7 + Math.random() * 0.5;
        for (let k = 0; k < heavy && i + k < len; k += 1) {
          data[i + k] += sign * hAmp * Math.exp(-k / 10) * (Math.random() * 0.4 + 0.6);
        }
      }
      i += splat;
    }
    let peak = 0.001;
    for (let n = 0; n < len; n += 1) peak = Math.max(peak, Math.abs(data[n]));
    const norm = 0.85 / peak;
    for (let n = 0; n < len; n += 1) data[n] *= norm;
    rainBuffer = buf;
    return rainBuffer;
  }

  /** Long brown rumble for thunder (no fade envelope — safe to loop). */
  function getThunderBuffer(ctx) {
    if (thunderBuffer && thunderBuffer.sampleRate === ctx.sampleRate) return thunderBuffer;
    const len = Math.floor(ctx.sampleRate * 2.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = (b0 + 0.03 * white) / 1.03;
      b1 = (b1 + 0.06 * b0) / 1.06;
      data[i] = b1 * 5.5;
    }
    thunderBuffer = buf;
    return thunderBuffer;
  }

  /** Soft brown-ish water bed — no rain crackle. */
  function getSurfBuffer(ctx) {
    if (surfBuffer && surfBuffer.sampleRate === ctx.sampleRate) return surfBuffer;
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      // Triple integrate → very soft low rumble, like distant shore
      b0 = (b0 + 0.02 * white) / 1.02;
      b1 = (b1 + 0.035 * b0) / 1.035;
      b2 = (b2 + 0.05 * b1) / 1.05;
      // Slow amplitude swell baked into the loop
      const swell = 0.72 + 0.28 * Math.sin((i / len) * Math.PI * 2);
      data[i] = b2 * 4.2 * swell;
    }
    surfBuffer = buf;
    return surfBuffer;
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

  /**
   * Real weather recordings (CC0 via OpenGameArt):
   * - sounds/weather-rain.ogg — "Rain (loopable)" by Ylmir
   * - sounds/weather-storm.ogg — "Rain + Long Thunder" by WuxiaScrub (thunder ~20s)
   */
  async function ensureStormSamples() {
    if (stormRainSample && stormFullSample) return true;
    if (stormSamplesLoading) return stormSamplesLoading;
    const ctx = getAudio();
    if (!ctx) return false;
    stormSamplesLoading = (async () => {
      const load = async (file) => {
        const res = await fetch(hubAssetUrl(file), { cache: "force-cache" });
        if (!res.ok) throw new Error(`missing ${file}`);
        const raw = await res.arrayBuffer();
        return ctx.decodeAudioData(raw.slice(0));
      };
      try {
        const [rain, full] = await Promise.all([
          load("sounds/weather-rain.ogg"),
          load("sounds/weather-storm.ogg")
        ]);
        stormRainSample = rain;
        stormFullSample = full;
        return true;
      } catch {
        return !!(stormRainSample || stormFullSample);
      } finally {
        stormSamplesLoading = null;
      }
    })();
    return stormSamplesLoading;
  }

  function playRecordedThunder(rainGain) {
    const ctx = getAudio();
    if (!ctx || !enabled || !stormFullSample) return;
    const now = ctx.currentTime;
    const buf = stormFullSample;
    // Thunder crack sits near the 20s mark in the recording
    const offset = Math.min(19.2, Math.max(0, buf.duration - 11));
    const dur = Math.min(11, Math.max(4, buf.duration - offset));

    if (rainGain) {
      try {
        const cur = Math.max(0.0001, rainGain.gain.value);
        rainGain.gain.cancelScheduledValues(now);
        rainGain.gain.setValueAtTime(cur, now);
        rainGain.gain.exponentialRampToValueAtTime(0.05, now + 0.1);
        rainGain.gain.exponentialRampToValueAtTime(0.18, now + 4);
      } catch {}
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.95, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.7, now + 2.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(gain);
    gain.connect(getOut(ctx));
    src.start(now, offset, dur);

    if (ambientNodes) {
      ambientNodes.sources.push(src);
      ambientNodes.gains.push(gain);
    }
  }

  function startStormAmbient() {
    const ctx = getAudio();
    if (!ctx) return;
    stopAmbient();
    ambientKind = "storm";

    const startWithSamples = () => {
      if (ambientKind !== "storm" || !enabled) return;
      const t = ctx.currentTime;
      const sources = [];
      const gains = [];
      const timers = [];

      // Prefer dedicated rain loop; fall back to full storm bed
      const rainBuf = stormRainSample || stormFullSample;
      if (!rainBuf) return;

      const rain = ctx.createBufferSource();
      rain.buffer = rainBuf;
      rain.loop = true;
      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.0001, t);
      rainGain.gain.exponentialRampToValueAtTime(stormRainSample ? 0.18 : 0.14, t + 1.1);
      rain.connect(rainGain);
      rainGain.connect(getOut(ctx));
      rain.start(t);
      sources.push(rain);
      gains.push(rainGain);

      const scheduleThunder = (delayMs) => {
        const id = setTimeout(() => {
          if (!enabled || ambientKind !== "storm") return;
          playRecordedThunder(rainGain);
          scheduleThunder(6500 + Math.random() * 8500);
        }, delayMs);
        timers.push(id);
      };
      // Opening thunder so the storm is obvious
      if (stormFullSample) scheduleThunder(600);

      ambientNodes = { sources, gains, timers };
    };

    ensureStormSamples().then((ok) => {
      if (ambientKind !== "storm") return;
      if (ok) {
        startWithSamples();
        return;
      }
      // Last-resort: quiet filtered noise (should rarely run)
      startStormAmbientSynthFallback();
    });
  }

  function startStormAmbientSynthFallback() {
    const ctx = getAudio();
    if (!ctx || ambientKind !== "storm") return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getSurfBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.03, t + 1);
    src.connect(lp);
    lp.connect(gain);
    gain.connect(getOut(ctx));
    src.start(t);
    ambientNodes = { sources: [src], gains: [gain], timers: [] };
  }

  function startCalmAmbient() {
    const ctx = getAudio();
    if (!ctx) return;
    stopAmbient();
    ambientKind = "calm";
    const t = ctx.currentTime;

    // Soft low shore wash (not filtered rain)
    const src = ctx.createBufferSource();
    src.buffer = getSurfBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(520, t);
    lp.Q.setValueAtTime(0.5, t);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(55, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.055, t + 1.4);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(getOut(ctx));
    src.start(t);

    // Slow breathing swell on the bed
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.08, t);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(0.012, t + 1.6);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start(t);

    // Very soft deep drone — water presence, not a chord
    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.setValueAtTime(62, t);
    const drone2 = ctx.createOscillator();
    drone2.type = "sine";
    drone2.frequency.setValueAtTime(93, t);
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, t);
    droneGain.gain.exponentialRampToValueAtTime(0.022, t + 1.8);
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = "lowpass";
    droneLp.frequency.setValueAtTime(280, t);
    drone.connect(droneLp);
    drone2.connect(droneLp);
    droneLp.connect(droneGain);
    droneGain.connect(getOut(ctx));
    drone.start(t);
    drone2.start(t);

    const timers = [];
    // Rare soft water laps — quiet, low, spaced out
    const lap = () => {
      if (!enabled || ambientKind !== "calm") return;
      const soft = 0.012 + Math.random() * 0.01;
      softTone({
        freq: 110 + Math.random() * 40,
        dur: 1.4 + Math.random() * 0.6,
        vol: soft,
        slide: -18 - Math.random() * 12,
        attack: 0.35,
        lp: 420
      });
      noiseHit({
        dur: 0.55 + Math.random() * 0.25,
        vol: soft * 0.9,
        freq: 280 + Math.random() * 120,
        q: 0.35,
        type: "lowpass",
        delay: 0.05
      });
    };
    timers.push(setTimeout(lap, 2200));
    timers.push(
      setInterval(() => {
        if (Math.random() < 0.65) lap();
      }, 5200 + Math.random() * 2400)
    );

    ambientNodes = {
      sources: [src, lfo, drone, drone2],
      gains: [gain, droneGain, lfoGain],
      timers
    };
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
    gain.connect(getOut(ctx));
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
    gain.connect(getOut(ctx));
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
    gain.connect(getOut(ctx));
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
    if (enabled) {
      getAudio();
      applyMasterVolume();
      play("click");
    } else {
      stopAmbient();
      applyMasterVolume();
    }
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
    // Fishing (and others) can opt out — Settings owns mute/volume there.
    if (document.body?.getAttribute("data-hub-sound-btn") === "off") {
      document.getElementById("hub-sound-btn")?.remove();
      return;
    }
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
    setEnabled,
    getVolume,
    setVolume,
    unlock: getAudio,
    stopAmbient,
    setAmbientWeather
  };
})();
