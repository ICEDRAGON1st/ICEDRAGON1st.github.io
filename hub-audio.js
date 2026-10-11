/**
 * Hub Audio Manager — background music (BGM) + SFX volume prefs.
 *
 * window.HubAudio
 *   .setTheme(themeId)     // crossfade to that screen's default track (if Auto)
 *   .setTrack(trackId|"auto")
 *   .playSfx(kind)         // forwards to HubSound
 *   .getBgmVolume() / .setBgmVolume(0..1)
 *   .getSfxVolume() / .setSfxVolume(0..1)
 *   .listTracks() / .listCredits()
 *   .openCredits() / .closeCredits()
 *   .bindSettings(rootEl)  // wire sliders + song picker inside a settings panel
 */
(function () {
  if (window.HubAudio) return;

  const PREF_BGM = "hub-audio-bgm-volume";
  const PREF_SFX = "hub-audio-sfx-volume";
  const PREF_TRACK = "hub-audio-track";
  const PREF_MUTED = "hub-audio-bgm-muted";
  const FADE_MS = 900;

  const ABS = {
    artist: "Abstraction",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://tallbeard.itch.io/music-loop-bundle"
  };

  function absTrack(id, title, file, themes) {
    return {
      id,
      title,
      artist: ABS.artist,
      file: `sounds/music/abstraction/${file}`,
      license: ABS.license,
      licenseUrl: ABS.licenseUrl,
      sourceUrl: ABS.sourceUrl,
      themes: themes || []
    };
  }

  /**
   * Royalty-free / CC0 catalog. Drop new files in sounds/music/ and add a row here.
   * Themes map screens → default track when song mode is Auto.
   * Abstraction pack: https://tallbeard.itch.io/music-loop-bundle (CC0)
   */
  const TRACKS = [
    absTrack("skyline-city", "Distant Skyline — City Lights", "distant-skyline-city-lights.ogg", [
      "hub",
      "menu",
      "settings",
      "credits"
    ]),
    absTrack("skyline-night", "Distant Skyline — Night Drive", "distant-skyline-night-drive.ogg"),
    absTrack("skyline-strut", "Distant Skyline — Sidewalk Strut", "distant-skyline-sidewalk-strut.ogg", [
      "puzzle",
      "wordle",
      "sudoku",
      "memory",
      "hangman"
    ]),
    absTrack("seaside-waves", "Seaside — Endless Waves", "seaside-endless-waves.ogg", ["fishing"]),
    absTrack("seaside-coral", "Seaside — Coral Reef", "seaside-coral-reef.ogg"),
    absTrack("sunburn-beach", "Sunburn — Beach House", "sunburn-beach-house.ogg", ["garden", "cafe"]),
    absTrack("sunburn-spf", "Sunburn — SPF 3000", "sunburn-spf-3000.ogg"),
    absTrack("vacation-chill", "Vacation Day — Chillout", "vacation-day-chillout.ogg", ["cows"]),
    absTrack("vacation-adventure", "Vacation Day — Adventure", "vacation-day-adventure.ogg", [
      "arcade",
      "crossy",
      "guac",
      "bubble"
    ]),
    absTrack("summer-pool", "Have A Great Summer — Pool Party", "have-a-great-summer-pool-party.ogg"),
    absTrack("freefall-glide", "Freefall — Glide", "freefall-glide.ogg", ["flappy", "dino", "ramp"]),
    absTrack("freefall-view", "Freefall — What A View", "freefall-what-a-view.ogg", ["space"]),
    absTrack("deep-well", "Pull Me Down — Deep Well", "pull-me-down-deep-well.ogg", ["mine"]),
    absTrack("gravity", "Pull Me Down — Gravity", "pull-me-down-gravity.ogg"),
    absTrack("dark-traveler", "Dark Portents — Mysterious Traveler", "dark-portents-mysterious-traveler.ogg"),
    absTrack("dark-future", "Dark Portents — Shrouded Future", "dark-portents-shrouded-future.ogg"),
    absTrack("dust-rain", "Dust Bowl — Hope of Rain", "dust-bowl-hope-of-rain.ogg"),
    absTrack("dust-parched", "Dust Bowl — Parched", "dust-bowl-parched.ogg"),
    absTrack("dunes-oasis", "The Walking Dunes — Evening Oasis", "the-walking-dunes-evening-oasis.ogg"),
    absTrack("dunes-sun", "The Walking Dunes — Unblinking Sun", "the-walking-dunes-unblinking-sun.ogg"),
    absTrack("workshop", "Workshop — Breadboard", "workshop-breadboard.ogg", ["clicker", "stacker"]),
    absTrack("magnetic-tape", "Magnetic Tape — Scuffed", "magnetic-tape-scuffed.ogg", ["retro"]),
    absTrack("alley-divin", "Alley Cat — Dumpster Divin'", "alley-cat-dumpster-divin.ogg", [
      "snake",
      "breakout"
    ]),
    absTrack("alley-party", "Alley Cat — Dumpster Party", "alley-cat-dumpster-party.ogg", [
      "paper",
      "lemmings"
    ]),
    absTrack("soup-base", "Primordial Soup — Base", "primordial-soup-base.ogg"),
    absTrack("soup-jangles", "Primordial Soup — Jangles", "primordial-soup-jangles.ogg", [
      "blockblast",
      "pixletris",
      "2048"
    ]),
    absTrack("soup-melody", "Primordial Soup — Melody", "primordial-soup-melody.ogg"),
    absTrack("lift-chorus", "Lift You Up — Chorus", "lift-you-up-chorus.ogg", ["tictactoe", "connect-four"]),
    absTrack("lift-melody", "Lift You Up — Melody", "lift-you-up-melody.ogg", ["math", "quiz"]),
    {
      id: "hub-lounge",
      title: "Ambient Soundscape",
      artist: "SpringySpringo",
      file: "sounds/music/ambient-soundscape.mp3",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://opengameart.org/content/ambient-soundscape",
      themes: []
    },
    {
      id: "forest-calm",
      title: "Forest Ambience",
      artist: "TinyWorlds",
      file: "sounds/music/forest-ambience.mp3",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://opengameart.org/content/forest-ambience",
      themes: []
    },
    {
      id: "dream-depths",
      title: "Dream 2 (Ambience)",
      artist: "Sakura_Ninja",
      file: "sounds/music/dream-2-ambience.mp3",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://opengameart.org/content/dream-2-ambience",
      themes: []
    },
    {
      id: "happy-run",
      title: "Happy Adventure",
      artist: "TinyWorlds",
      file: "sounds/music/happy-adventure.mp3",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://opengameart.org/content/happy-adventure-loop",
      themes: []
    },
    {
      id: "chippey",
      title: "Chippey",
      artist: "Chasersgaming",
      file: "sounds/music/chippey.mp3",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
      sourceUrl: "https://opengameart.org/content/chippey",
      themes: []
    }
  ];

  const TRACK_BY_ID = Object.fromEntries(TRACKS.map((t) => [t.id, t]));
  const THEME_TO_TRACK = {};
  TRACKS.forEach((t) => {
    (t.themes || []).forEach((theme) => {
      if (!THEME_TO_TRACK[theme]) THEME_TO_TRACK[theme] = t.id;
    });
  });

  const PATH_THEME = [
    [/\/fishing\b/i, "fishing"],
    [/\/mine\b/i, "mine"],
    [/\/space-shooter\b/i, "space"],
    [/\/wing-hop\b/i, "flappy"],
    [/\/runosaur\b/i, "dino"],
    [/\/cross-walk\b/i, "crossy"],
    [/\/guac-a-mole\b/i, "guac"],
    [/\/bubble-pop\b/i, "bubble"],
    [/\/ramp-rush\b/i, "ramp"],
    [/\/garden-snap\b/i, "garden"],
    [/\/cafe-queue\b/i, "cafe"],
    [/\/cows\b/i, "cows"],
    [/\/clicker\b/i, "clicker"],
    [/\/stacker\b/i, "stacker"],
    [/\/snake\b/i, "snake"],
    [/\/breakout\b/i, "breakout"],
    [/\/paper-io\b/i, "paper"],
    [/\/dudes\b/i, "lemmings"],
    [/\/block-sweep\b/i, "blockblast"],
    [/\/pixel-drop\b/i, "pixletris"],
    [/\/2048\b/i, "2048"],
    [/\/math\b/i, "math"],
    [/\/quiz\b/i, "quiz"],
    [/\/sudoku\b/i, "sudoku"],
    [/\/memory-match\b/i, "memory"],
    [/\/hangman\b/i, "hangman"],
    [/\/tic-tac-toe\b/i, "tictactoe"],
    [/\/connect-four\b/i, "connect-four"]
  ];

  let bgmVolume = loadFloat(PREF_BGM, 0.55);
  let sfxVolume = loadFloat(PREF_SFX, readLegacySfx());
  let trackPref = loadTrackPref();
  let bgmMuted = localStorage.getItem(PREF_MUTED) === "1";
  let currentTheme = "hub";
  let currentTrackId = null;
  let unlocked = false;
  let fading = false;
  let fadeToken = 0;

  /** Dual players for crossfades */
  const a = makePlayer();
  const b = makePlayer();
  let active = a;
  let idle = b;

  function loadFloat(key, fallback) {
    const n = Number(localStorage.getItem(key));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(1, n));
  }

  function readLegacySfx() {
    const n = Number(localStorage.getItem("hub-sound-volume"));
    if (!Number.isFinite(n)) return 1;
    return Math.max(0, Math.min(1, n > 1.5 ? n / 3 : n));
  }

  function loadTrackPref() {
    const raw = String(localStorage.getItem(PREF_TRACK) || "auto").trim();
    if (raw === "auto") return "auto";
    if (TRACK_BY_ID[raw]) return raw;
    return "auto";
  }

  function hubAssetUrl(relPath) {
    const scripts = document.getElementsByTagName("script");
    for (let i = 0; i < scripts.length; i += 1) {
      const src = scripts[i].src || "";
      if (/hub-audio\.js(\?|$)/i.test(src)) {
        return new URL(relPath, src).href;
      }
    }
    return new URL(relPath, window.location.href).href;
  }

  function makePlayer() {
    const el = new Audio();
    el.loop = true;
    el.preload = "auto";
    el.volume = 0;
    el.setAttribute("playsinline", "");
    el.setAttribute("data-hub-audio", "bgm");
    return el;
  }

  function effectiveBgmVolume() {
    if (bgmMuted) return 0;
    return bgmVolume;
  }

  function persist() {
    try {
      localStorage.setItem(PREF_BGM, String(bgmVolume));
      localStorage.setItem(PREF_SFX, String(sfxVolume));
      localStorage.setItem(PREF_TRACK, trackPref);
      localStorage.setItem(PREF_MUTED, bgmMuted ? "1" : "0");
    } catch {}
  }

  function syncSfxToHubSound() {
    try {
      if (window.HubSound?.setVolume) {
        HubSound.setVolume(sfxVolume);
      }
      // Keep master mute in sync with SFX slider at 0 vs >0 only if user hasn't muted via speaker btn
      if (window.HubSound?.setEnabled && sfxVolume <= 0.001 && HubSound.isEnabled?.()) {
        // leave mute button alone — volume 0 is enough
      }
    } catch {}
  }

  function resolveTrackId(theme) {
    if (trackPref !== "auto" && TRACK_BY_ID[trackPref]) return trackPref;
    return THEME_TO_TRACK[theme] || THEME_TO_TRACK.hub || TRACKS[0].id;
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    [a, b].forEach((p) => {
      try {
        const play = p.play();
        if (play && play.then) {
          play.then(() => p.pause()).catch(() => {});
        }
      } catch {}
    });
    try {
      window.HubSound?.unlock?.();
    } catch {}
  }

  function cancelFade() {
    fadeToken += 1;
    fading = false;
  }

  function rampVolume(el, from, to, ms, token) {
    return new Promise((resolve) => {
      const start = performance.now();
      const span = Math.max(40, ms);
      function step(now) {
        if (token !== fadeToken) {
          resolve(false);
          return;
        }
        const t = Math.min(1, (now - start) / span);
        const eased = t * t * (3 - 2 * t);
        el.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve(true);
        }
      }
      el.volume = from;
      requestAnimationFrame(step);
    });
  }

  async function crossfadeTo(trackId, { force = false } = {}) {
    const track = TRACK_BY_ID[trackId];
    if (!track) return;
    if (!force && currentTrackId === trackId && !active.paused) return;

    const url = hubAssetUrl(track.file);
    const targetVol = effectiveBgmVolume();
    const token = ++fadeToken;
    fading = true;

    const next = idle;
    const prev = active;

    try {
      if (next.src !== url) {
        next.src = url;
        next.load();
      }
      next.currentTime = 0;
      next.volume = 0;
      const playPromise = next.play();
      if (playPromise && playPromise.then) await playPromise;
    } catch {
      fading = false;
      return;
    }

    if (token !== fadeToken) return;

    idle = prev;
    active = next;
    currentTrackId = trackId;

    const fadeOut = prev.src
      ? rampVolume(prev, prev.volume, 0, FADE_MS, token)
      : Promise.resolve(true);
    const fadeIn = rampVolume(next, 0, targetVol, FADE_MS, token);

    await Promise.all([fadeOut, fadeIn]);
    if (token !== fadeToken) return;

    try {
      prev.pause();
    } catch {}
    fading = false;
    dispatchChanged();
  }

  function applyLiveVolume() {
    const v = effectiveBgmVolume();
    if (!fading && active) {
      try {
        active.volume = v;
      } catch {}
    }
    if (v > 0 && unlocked && active.paused && currentTrackId) {
      active.play().catch(() => {});
    }
    if (v <= 0) {
      try {
        active.pause();
        idle.pause();
      } catch {}
    }
  }

  function setTheme(themeId) {
    const theme = String(themeId || "hub").trim() || "hub";
    currentTheme = theme;
    const trackId = resolveTrackId(theme);
    if (!unlocked) {
      currentTrackId = trackId;
      return trackId;
    }
    crossfadeTo(trackId);
    return trackId;
  }

  function setTrack(id) {
    const next = String(id || "auto").trim() || "auto";
    if (next !== "auto" && !TRACK_BY_ID[next]) return false;
    trackPref = next;
    persist();
    const resolved = resolveTrackId(currentTheme);
    if (unlocked) crossfadeTo(resolved, { force: true });
    else currentTrackId = resolved;
    dispatchChanged();
    paintSettings();
    return true;
  }

  function setBgmVolume(v) {
    bgmVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (bgmVolume > 0.001) bgmMuted = false;
    persist();
    applyLiveVolume();
    dispatchChanged();
    paintSettings();
    return bgmVolume;
  }

  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, Number(v) || 0));
    persist();
    syncSfxToHubSound();
    dispatchChanged();
    paintSettings();
    return sfxVolume;
  }

  function setBgmMuted(on) {
    bgmMuted = !!on;
    persist();
    applyLiveVolume();
    dispatchChanged();
    paintSettings();
  }

  function themeFromLocation() {
    const path = String(location.pathname || "");
    for (let i = 0; i < PATH_THEME.length; i += 1) {
      if (PATH_THEME[i][0].test(path)) return PATH_THEME[i][1];
    }
    // Hub root / Guessword
    if (/index\.html$/i.test(path) || /\/$/.test(path) || !path.includes("/")) {
      if (document.documentElement.classList.contains("playing-guessword")) return "wordle";
      return "hub";
    }
    return "arcade";
  }

  function listTracks() {
    return TRACKS.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      license: t.license
    }));
  }

  function listCredits() {
    return TRACKS.map((t) => ({
      title: t.title,
      artist: t.artist,
      license: t.license,
      licenseUrl: t.licenseUrl,
      sourceUrl: t.sourceUrl,
      file: t.file
    }));
  }

  function dispatchChanged() {
    try {
      document.dispatchEvent(
        new CustomEvent("hub-audio-changed", {
          detail: {
            theme: currentTheme,
            track: currentTrackId,
            trackPref,
            bgmVolume,
            sfxVolume,
            muted: bgmMuted
          }
        })
      );
    } catch {}
  }

  /* ── Credits overlay ── */

  function ensureCreditsUi() {
    if (document.getElementById("hub-credits-modal")) return;
    const style = document.createElement("style");
    style.id = "hub-audio-style";
    style.textContent = `
      #hub-credits-modal{position:fixed;inset:0;z-index:120000;display:flex;align-items:center;justify-content:center;
        padding:1.25rem;background:rgba(6,10,20,.72);backdrop-filter:blur(6px)}
      #hub-credits-modal.hidden{display:none}
      #hub-credits-modal .hub-credits-card{width:min(34rem,100%);max-height:min(80vh,40rem);overflow:auto;
        border-radius:16px;border:1px solid rgba(150,180,255,.28);background:linear-gradient(180deg,#152038,#0e1628);
        color:#e8eefc;padding:1.25rem 1.35rem 1.1rem;box-shadow:0 18px 50px rgba(0,0,0,.45)}
      #hub-credits-modal h2{margin:0 0 .35rem;font-size:1.35rem}
      #hub-credits-modal .hub-credits-intro{margin:0 0 1rem;color:#9eb6d8;font-size:.9rem;line-height:1.45}
      #hub-credits-modal .hub-credits-list{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}
      #hub-credits-modal .hub-credits-item{padding:.75rem .85rem;border-radius:12px;background:rgba(255,255,255,.04);
        border:1px solid rgba(140,170,230,.16)}
      #hub-credits-modal .hub-credits-title{font-weight:800;margin:0 0 .2rem}
      #hub-credits-modal .hub-credits-meta{margin:0;font-size:.85rem;color:#b7c8e6;line-height:1.4}
      #hub-credits-modal .hub-credits-meta a{color:#9ec0ff}
      #hub-credits-modal .hub-credits-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem}
      .hub-audio-settings{margin:.85rem 0 1.1rem;padding:.85rem .9rem;border-radius:12px;
        border:1px solid rgba(140,170,230,.18);background:rgba(255,255,255,.03)}
      .hub-audio-row{display:grid;grid-template-columns:7.5rem 1fr 3rem;gap:.55rem;align-items:center;margin:.55rem 0}
      .hub-audio-row label{font-size:.86rem;font-weight:700;color:#c8dbf7}
      .hub-audio-row input[type=range]{width:100%;accent-color:#7c9cff}
      .hub-audio-row .hub-audio-pct{font-size:.8rem;font-weight:700;color:#9eb6d8;text-align:right}
      .hub-audio-song-label{margin:.75rem 0 .35rem;font-size:.86rem;font-weight:800;color:#c8dbf7}
      .hub-audio-song-select{width:100%;max-width:22rem;padding:.45rem .55rem;border-radius:8px;
        border:1px solid rgba(140,170,230,.35);background:#101a30;color:#e8eefc;font:inherit}
      .hub-audio-credits-btn{margin-top:.65rem}
    `;
    document.head.appendChild(style);

    const modal = document.createElement("div");
    modal.id = "hub-credits-modal";
    modal.className = "hidden";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "hub-credits-title");
    modal.innerHTML = `
      <div class="hub-credits-card">
        <h2 id="hub-credits-title">Credits</h2>
        <p class="hub-credits-intro">Music used in My Games. Most loops are from Abstraction’s <a href="https://tallbeard.itch.io/music-loop-bundle" target="_blank" rel="noopener noreferrer">Music Loop Bundle</a> (CC0). Thank you to every artist listed below.</p>
        <ul class="hub-credits-list" id="hub-credits-list"></ul>
        <div class="hub-credits-actions">
          <button type="button" class="hub-btn modal-btn" id="hub-credits-close">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeCredits();
    });
    modal.querySelector("#hub-credits-close")?.addEventListener("click", closeCredits);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.classList.contains("hidden")) closeCredits();
    });
  }

  function openCredits() {
    ensureCreditsUi();
    const list = document.getElementById("hub-credits-list");
    if (list) {
      list.innerHTML = listCredits()
        .map((c) => {
          const license = c.licenseUrl
            ? `<a href="${escapeAttr(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.license)}</a>`
            : escapeHtml(c.license || "");
          const source = c.sourceUrl
            ? ` · <a href="${escapeAttr(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source</a>`
            : "";
          return `<li class="hub-credits-item">
            <p class="hub-credits-title">${escapeHtml(c.title)}</p>
            <p class="hub-credits-meta">by ${escapeHtml(c.artist)} · ${license}${source}</p>
          </li>`;
        })
        .join("");
    }
    document.getElementById("hub-credits-modal")?.classList.remove("hidden");
  }

  function closeCredits() {
    document.getElementById("hub-credits-modal")?.classList.add("hidden");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  /* ── Settings controls ── */

  function settingsHtml() {
    const options =
      `<option value="auto">Auto (by screen)</option>` +
      TRACKS.map(
        (t) =>
          `<option value="${escapeAttr(t.id)}">${escapeHtml(t.title)} — ${escapeHtml(t.artist)}</option>`
      ).join("");
    return `
      <div class="hub-audio-settings" data-hub-audio-settings>
        <p class="hub-settings-label">Sound &amp; music</p>
        <p class="hub-settings-intro">Volumes save on this device. Auto picks a track for each menu or minigame and crossfades when you switch.</p>
        <div class="hub-audio-row">
          <label for="hub-audio-bgm">Music</label>
          <input id="hub-audio-bgm" type="range" min="0" max="100" step="1" value="${Math.round(bgmVolume * 100)}" />
          <span class="hub-audio-pct" data-hub-audio-bgm-pct>${Math.round(bgmVolume * 100)}%</span>
        </div>
        <div class="hub-audio-row">
          <label for="hub-audio-sfx">Sound effects</label>
          <input id="hub-audio-sfx" type="range" min="0" max="100" step="1" value="${Math.round(sfxVolume * 100)}" />
          <span class="hub-audio-pct" data-hub-audio-sfx-pct>${Math.round(sfxVolume * 100)}%</span>
        </div>
        <p class="hub-audio-song-label">Song</p>
        <select id="hub-audio-song" class="hub-audio-song-select" aria-label="Choose background song">${options}</select>
        <button type="button" class="hub-btn hub-audio-credits-btn" id="hub-audio-open-credits">Music credits</button>
      </div>`;
  }

  function paintSettings(root) {
    const scope = root || document;
    const bgm = scope.querySelector("#hub-audio-bgm");
    const sfx = scope.querySelector("#hub-audio-sfx");
    const song = scope.querySelector("#hub-audio-song");
    const bgmPct = scope.querySelector("[data-hub-audio-bgm-pct]");
    const sfxPct = scope.querySelector("[data-hub-audio-sfx-pct]");
    if (bgm) bgm.value = String(Math.round(bgmVolume * 100));
    if (sfx) sfx.value = String(Math.round(sfxVolume * 100));
    if (song) song.value = trackPref;
    if (bgmPct) bgmPct.textContent = `${Math.round(bgmVolume * 100)}%`;
    if (sfxPct) sfxPct.textContent = `${Math.round(sfxVolume * 100)}%`;
  }

  function bindSettings(rootEl) {
    const root = rootEl || document.getElementById("hub-settings-panel");
    if (!root) return;
    let box = root.querySelector("[data-hub-audio-settings]");
    if (!box) {
      const mount = document.createElement("div");
      mount.innerHTML = settingsHtml();
      box = mount.firstElementChild;
      const hubLook = [...root.querySelectorAll(".hub-settings-label")].find((el) =>
        /hub look/i.test(el.textContent || "")
      );
      if (hubLook) root.insertBefore(box, hubLook);
      else {
        const h3 = root.querySelector("h3");
        if (h3 && h3.nextSibling) root.insertBefore(box, h3.nextSibling);
        else root.appendChild(box);
      }
    }

    const bgm = box.querySelector("#hub-audio-bgm");
    const sfx = box.querySelector("#hub-audio-sfx");
    const song = box.querySelector("#hub-audio-song");
    const creditsBtn = box.querySelector("#hub-audio-open-credits");

    if (bgm && !bgm.dataset.hubAudioBound) {
      bgm.dataset.hubAudioBound = "1";
      bgm.addEventListener("input", () => {
        unlock();
        setBgmVolume(Number(bgm.value) / 100);
        if (effectiveBgmVolume() > 0 && (!currentTrackId || active.paused)) {
          setTheme(currentTheme);
        }
      });
    }
    if (sfx && !sfx.dataset.hubAudioBound) {
      sfx.dataset.hubAudioBound = "1";
      sfx.addEventListener("input", () => {
        unlock();
        setSfxVolume(Number(sfx.value) / 100);
        try {
          window.HubSound?.play?.("click");
        } catch {}
      });
    }
    if (song && !song.dataset.hubAudioBound) {
      song.dataset.hubAudioBound = "1";
      song.addEventListener("change", () => {
        unlock();
        setTrack(song.value);
        showToast(
          song.value === "auto"
            ? "Song: Auto (by screen)"
            : `Song: ${TRACK_BY_ID[song.value]?.title || song.value}`
        );
      });
    }
    if (creditsBtn && !creditsBtn.dataset.hubAudioBound) {
      creditsBtn.dataset.hubAudioBound = "1";
      creditsBtn.addEventListener("click", () => openCredits());
    }
    paintSettings(box);
  }

  function showToast(msg) {
    try {
      if (typeof window.showGamesMessage === "function") {
        window.showGamesMessage(msg, 1600);
        return;
      }
    } catch {}
  }

  function playSfx(kind, extra) {
    try {
      window.HubSound?.play?.(kind, extra);
    } catch {}
  }

  function startForPage() {
    syncSfxToHubSound();
    currentTheme = themeFromLocation();
    currentTrackId = resolveTrackId(currentTheme);
    ensureCreditsUi();

    const kick = () => {
      unlock();
      crossfadeTo(resolveTrackId(currentTheme), { force: true });
    };
    document.addEventListener("pointerdown", kick, { once: true });
    document.addEventListener("keydown", kick, { once: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        try {
          active.pause();
        } catch {}
      } else if (unlocked && effectiveBgmVolume() > 0) {
        active.play().catch(() => {});
      }
    });
  }

  // Boot
  syncSfxToHubSound();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startForPage);
  } else {
    startForPage();
  }

  // Auto-bind hub settings when present
  const tryBind = () => {
    if (document.getElementById("hub-settings-panel")) bindSettings();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryBind);
  } else {
    setTimeout(tryBind, 0);
  }

  window.HubAudio = {
    setTheme,
    setTrack,
    getTrack: () => currentTrackId,
    getTrackPref: () => trackPref,
    getTheme: () => currentTheme,
    getBgmVolume: () => bgmVolume,
    setBgmVolume,
    getSfxVolume: () => sfxVolume,
    setSfxVolume,
    setBgmMuted,
    isBgmMuted: () => bgmMuted,
    playSfx,
    listTracks,
    listCredits,
    openCredits,
    closeCredits,
    bindSettings,
    unlock,
    TRACKS
  };
})();
