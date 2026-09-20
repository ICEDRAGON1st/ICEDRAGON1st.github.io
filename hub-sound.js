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
  let surfBuffer = null;
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
    const len = Math.floor(ctx.sampleRate * 3.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let pink = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      // Light pink bed — soft rain sheet, not white static
      pink = (pink + 0.045 * white) / 1.045;
      let sample = pink * 0.55;
      // Dense droplet ticks (rain, not crackle-static)
      if (Math.random() < 0.085) {
        const drop = (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.55);
        // Tiny decaying splat
        const splatLen = 4 + Math.floor(Math.random() * 10);
        for (let k = 0; k < splatLen && i + k < len; k += 1) {
          data[i + k] = (data[i + k] || 0) + drop * Math.exp(-k * 0.45);
        }
      }
      // Occasional heavier drop
      if (Math.random() < 0.008) {
        const heavy = (Math.random() * 2 - 1) * 0.9;
        const splatLen = 8 + Math.floor(Math.random() * 18);
        for (let k = 0; k < splatLen && i + k < len; k += 1) {
          data[i + k] = (data[i + k] || 0) + heavy * Math.exp(-k * 0.28);
        }
      }
      data[i] = (data[i] || 0) + sample;
    }
    // Soft normalize
    let peak = 0.001;
    for (let i = 0; i < len; i += 1) peak = Math.max(peak, Math.abs(data[i]));
    const norm = 0.9 / peak;
    for (let i = 0; i < len; i += 1) data[i] *= norm;
    rainBuffer = buf;
    return rainBuffer;
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

  function playThunderClap() {
    const ctx = getAudio();
    if (!ctx || !enabled) return;
    const now = ctx.currentTime;
    const strike = 0.75 + Math.random() * 0.35;

    // Sharp crack (close lightning)
    noiseHit({
      dur: 0.08,
      vol: 0.14 * strike,
      freq: 2200 + Math.random() * 900,
      q: 0.55,
      type: "bandpass"
    });
    noiseHit({
      dur: 0.14,
      vol: 0.1 * strike,
      freq: 900 + Math.random() * 400,
      q: 0.4,
      type: "bandpass",
      delay: 0.02
    });

    // Body boom — long low noise roll
    const body = ctx.createBufferSource();
    body.buffer = getNoiseBuffer(ctx);
    body.loop = true;
    const bodyLp = ctx.createBiquadFilter();
    bodyLp.type = "lowpass";
    bodyLp.frequency.setValueAtTime(380, now);
    bodyLp.frequency.exponentialRampToValueAtTime(90, now + 1.8);
    bodyLp.Q.setValueAtTime(0.6, now);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.16 * strike, now + 0.04);
    bodyGain.gain.exponentialRampToValueAtTime(0.08 * strike, now + 0.35);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
    body.connect(bodyLp);
    bodyLp.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now);
    body.stop(now + 2.5);

    // Deep sub rumble that rolls down
    softTone({
      freq: 55 + Math.random() * 18,
      dur: 1.8,
      vol: 0.07 * strike,
      slide: -28,
      attack: 0.06,
      lp: 180,
      delay: 0.04
    });
    softTone({
      freq: 38,
      dur: 2.2,
      vol: 0.05 * strike,
      slide: -12,
      attack: 0.12,
      lp: 120,
      delay: 0.12
    });

    // Distant echo crack
    noiseHit({
      dur: 0.45,
      vol: 0.055 * strike,
      freq: 160,
      q: 0.35,
      type: "lowpass",
      delay: 0.28 + Math.random() * 0.15
    });
    noiseHit({
      dur: 0.7,
      vol: 0.04 * strike,
      freq: 90,
      q: 0.3,
      type: "lowpass",
      delay: 0.55 + Math.random() * 0.2
    });
  }

  function startStormAmbient() {
    const ctx = getAudio();
    if (!ctx) return;
    stopAmbient();
    ambientKind = "storm";
    const t = ctx.currentTime;

    // Close rain patter (droplet buffer, bright but not static)
    const near = ctx.createBufferSource();
    near.buffer = getRainBuffer(ctx);
    near.loop = true;
    const nearHp = ctx.createBiquadFilter();
    nearHp.type = "highpass";
    nearHp.frequency.setValueAtTime(420, t);
    const nearBp = ctx.createBiquadFilter();
    nearBp.type = "bandpass";
    nearBp.frequency.setValueAtTime(2100, t);
    nearBp.Q.setValueAtTime(0.35, t);
    const nearLp = ctx.createBiquadFilter();
    nearLp.type = "lowpass";
    nearLp.frequency.setValueAtTime(6800, t);
    const nearGain = ctx.createGain();
    nearGain.gain.setValueAtTime(0.0001, t);
    nearGain.gain.exponentialRampToValueAtTime(0.07, t + 0.9);
    near.connect(nearHp);
    nearHp.connect(nearBp);
    nearBp.connect(nearLp);
    nearLp.connect(nearGain);
    nearGain.connect(ctx.destination);
    near.start(t);

    // Softer distant rain sheet
    const far = ctx.createBufferSource();
    far.buffer = getRainBuffer(ctx);
    far.loop = true;
    far.playbackRate.setValueAtTime(0.82, t);
    const farLp = ctx.createBiquadFilter();
    farLp.type = "lowpass";
    farLp.frequency.setValueAtTime(1600, t);
    const farHp = ctx.createBiquadFilter();
    farHp.type = "highpass";
    farHp.frequency.setValueAtTime(180, t);
    const farGain = ctx.createGain();
    farGain.gain.setValueAtTime(0.0001, t);
    farGain.gain.exponentialRampToValueAtTime(0.04, t + 1.2);
    far.connect(farHp);
    farHp.connect(farLp);
    farLp.connect(farGain);
    farGain.connect(ctx.destination);
    far.start(t + 0.15);

    // Quiet storm bed rumble (not the thunder itself)
    const rumble = ctx.createOscillator();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(42, t);
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.012, t + 1.4);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(t);

    const timers = [];
    let thunderTimer = 0;
    const scheduleThunder = (delayMs) => {
      thunderTimer = setTimeout(() => {
        if (!enabled || ambientKind !== "storm") return;
        playThunderClap();
        // Duck rain slightly under the boom, then recover
        try {
          const now = ctx.currentTime;
          nearGain.gain.cancelScheduledValues(now);
          farGain.gain.cancelScheduledValues(now);
          nearGain.gain.setValueAtTime(Math.max(0.0001, nearGain.gain.value), now);
          farGain.gain.setValueAtTime(Math.max(0.0001, farGain.gain.value), now);
          nearGain.gain.exponentialRampToValueAtTime(0.04, now + 0.06);
          farGain.gain.exponentialRampToValueAtTime(0.025, now + 0.06);
          nearGain.gain.exponentialRampToValueAtTime(0.07, now + 1.4);
          farGain.gain.exponentialRampToValueAtTime(0.04, now + 1.5);
        } catch {}
        scheduleThunder(4200 + Math.random() * 5200);
      }, delayMs);
      timers.push(thunderTimer);
    };
    // Opening thunder so storm is obvious
    scheduleThunder(500);

    ambientNodes = {
      sources: [near, far, rumble],
      gains: [nearGain, farGain, rumbleGain],
      timers
    };
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
    gain.connect(ctx.destination);
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
    droneGain.connect(ctx.destination);
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
