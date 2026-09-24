/**
 * hub-calls.js — voice calls for friend DMs and group chats (WebRTC mesh).
 * Signaling via Supabase hub_docs (Mantle fallback). STUN only (no TURN).
 *
 * window.HubCalls:
 *   startCall(kind, channelId) / joinCall(roomId) / hangUp()
 *   acceptRing(roomId) / declineRing(roomId)
 *   startScreenShare() / stopScreenShare()
 *   getActive(), startPolling(), stopPolling()
 */
(function () {
  const DOC_ID = "hub-calls";
  const API = "https://mantledb.sh/v2/icedragon1st-mygames/hub-calls";
  const TOKEN = "ice-hub-call-9f3a";
  const POLL_MS = 1500;
  const MAX_PEERS = 6;
  const SIGNAL_TTL_MS = 45_000;
  const ROOM_TTL_MS = 2 * 60 * 60_000;
  const SESSION_KEY = "hub-call-session-v1";
  const SESSION_MAX_MS = 2 * 60 * 60_000;
  const ICE_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp"
      ],
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ];

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  function playerId() {
    return String(window.HubPlays?.getPlayerId?.() || "");
  }

  function playerName() {
    return String(window.HubPlays?.getName?.() || "Player").trim().slice(0, 24) || "Player";
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function roomKey(kind, channelId) {
    if (kind === "group") return `group:${channelId}`;
    const me = playerId();
    const them = String(channelId || "");
    return `dm:${[me, them].sort().join(":")}`;
  }

  let cache = { rooms: {} };
  let pollTimer = 0;
  let active = null; // { roomId, kind, channelId, localStream, screenStream, pcs: Map }
  let seenSignals = new Set();
  let ringingRoomId = "";
  let writeQueue = Promise.resolve();
  let audioCtx = null;
  let speakRaf = 0;
  const meters = new Map(); // peerId -> { analyser, source, data, speaking, lastSpeak }

  async function fetchDoc() {
    try {
      const api = sb();
      let data = null;
      if (api) data = await api.getPrefer(DOC_ID, API);
      else {
        const res = await fetch(`${API}?t=${Date.now()}`, { cache: "no-store" });
        if (res.status === 404) return { token: TOKEN, rooms: {} };
        if (!res.ok) return null;
        data = await res.json();
      }
      if (!data || typeof data !== "object") return { token: TOKEN, rooms: {} };
      return {
        token: data.token || TOKEN,
        rooms: data.rooms && typeof data.rooms === "object" ? data.rooms : {}
      };
    } catch {
      return null;
    }
  }

  function pruneRooms(rooms) {
    const now = Date.now();
    const next = {};
    Object.entries(rooms || {}).forEach(([id, room]) => {
      if (!room || typeof room !== "object") return;
      const at = Number(room.updatedAt || room.createdAt) || 0;
      if (now - at > ROOM_TTL_MS) return;
      const peers = room.peers && typeof room.peers === "object" ? { ...room.peers } : {};
      const live = Object.values(peers).filter((p) => p && !p.left);
      if (!live.length && now - at > 60_000) return;
      const signals = Array.isArray(room.signals)
        ? room.signals.filter((s) => now - (Number(s?.at) || 0) < SIGNAL_TTL_MS).slice(-80)
        : [];
      next[id] = { ...room, peers, signals };
    });
    return next;
  }

  async function postDoc(rooms) {
    const payload = { token: TOKEN, rooms: pruneRooms(rooms) };
    try {
      const api = sb();
      if (api) {
        await api.pushPrefer(DOC_ID, payload, API);
        return true;
      }
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function enqueueWrite(fn) {
    writeQueue = writeQueue.then(fn).catch(() => {});
    return writeQueue;
  }

  async function mutateRooms(mutator) {
    return enqueueWrite(async () => {
      const doc = (await fetchDoc()) || { rooms: {} };
      const rooms = JSON.parse(JSON.stringify(doc.rooms || {}));
      mutator(rooms);
      // Merge remote signals so concurrent offer/answer writes don't clobber each other.
      try {
        const latest = await fetchDoc();
        if (latest?.rooms) {
          Object.keys(rooms).forEach((id) => {
            if (!rooms[id]) return;
            const byId = new Map();
            const remote = latest.rooms[id]?.signals;
            const local = rooms[id].signals;
            (Array.isArray(remote) ? remote : []).forEach((s) => {
              if (s?.id) byId.set(s.id, s);
            });
            (Array.isArray(local) ? local : []).forEach((s) => {
              if (s?.id) byId.set(s.id, s);
            });
            rooms[id].signals = [...byId.values()]
              .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0))
              .slice(-100);
          });
        }
      } catch {}
      const ok = await postDoc(rooms);
      if (ok) cache.rooms = pruneRooms(rooms);
      return ok;
    });
  }

  function ensureCallUi() {
    let style = document.getElementById("hub-call-styles");
    if (!style) {
      style = document.createElement("style");
      style.id = "hub-call-styles";
      document.head.appendChild(style);
    }
    style.textContent = `
      .hub-call-bar {
        position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%);
        z-index: 2400; width: min(22rem, calc(100vw - 1.25rem));
        background: linear-gradient(160deg, rgba(15,23,42,.97), rgba(8,47,73,.96));
        border: 1px solid rgba(56,189,248,.45); border-radius: 1rem;
        box-shadow: 0 16px 40px rgba(0,0,0,.45); padding: .75rem .9rem;
        color: #e2e8f0; font: 600 0.9rem/1.3 Outfit, system-ui, sans-serif;
        display: flex; flex-direction: column; gap: .55rem;
      }
      .hub-call-bar.is-wide { width: min(36rem, calc(100vw - 1.25rem)); }
      .hub-call-bar.hidden, .hub-call-bar[hidden] { display: none !important; }
      .hub-call-bar-top { display: flex; justify-content: space-between; gap: .5rem; align-items: center; }
      .hub-call-bar-meta { font-size: .78rem; color: #94a3b8; }
      .hub-call-peers { display: flex; flex-wrap: wrap; gap: .3rem; }
      .hub-call-peer {
        border-radius: 999px; padding: .2rem .55rem; font-size: .75rem;
        background: rgba(14,116,144,.35); border: 1px solid rgba(125,211,252,.35);
        display: inline-flex; align-items: center; gap: .35rem;
        transition: border-color .15s, background .15s, box-shadow .15s;
      }
      .hub-call-peer.is-sharing { border-color: #fbbf24; background: rgba(180,83,9,.4); }
      .hub-call-peer.is-talking {
        border-color: #4ade80;
        background: rgba(22,163,74,.42);
        box-shadow: 0 0 0 1px rgba(74,222,128,.45), 0 0 12px rgba(74,222,128,.35);
      }
      .hub-call-talk-bars {
        display: none; align-items: flex-end; gap: 2px; height: .7rem;
      }
      .hub-call-peer.is-talking .hub-call-talk-bars { display: inline-flex; }
      .hub-call-talk-bars i {
        display: block; width: 2px; border-radius: 1px; background: #86efac;
        animation: hub-call-bar-bounce 0.7s ease-in-out infinite;
      }
      .hub-call-talk-bars i:nth-child(1) { height: 35%; animation-delay: 0s; }
      .hub-call-talk-bars i:nth-child(2) { height: 70%; animation-delay: .15s; }
      .hub-call-talk-bars i:nth-child(3) { height: 45%; animation-delay: .28s; }
      @keyframes hub-call-bar-bounce {
        0%, 100% { transform: scaleY(0.45); }
        50% { transform: scaleY(1); }
      }
      .hub-call-videos {
        display: none; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
        gap: .4rem; max-height: 14rem; overflow: auto;
      }
      .hub-call-videos.has-video { display: grid; }
      .hub-call-video-wrap {
        position: relative; border-radius: .65rem; overflow: hidden;
        background: #0f172a; border: 1px solid rgba(125,211,252,.3); aspect-ratio: 16/10;
      }
      .hub-call-video-wrap video {
        width: 100%; height: 100%; object-fit: contain; display: block; background: #020617;
      }
      .hub-call-video-label {
        position: absolute; left: .35rem; bottom: .3rem; font-size: .68rem;
        background: rgba(2,6,23,.7); padding: .1rem .35rem; border-radius: .35rem;
      }
      .hub-call-actions { display: flex; flex-wrap: wrap; gap: .35rem; }
      .hub-call-actions button {
        flex: 1; min-width: 4.5rem; border: 0; border-radius: .65rem; padding: .5rem .6rem;
        font: inherit; font-weight: 700; cursor: pointer;
      }
      .hub-call-mute { background: #334155; color: #f8fafc; }
      .hub-call-mute.is-on { background: #b45309; }
      .hub-call-share { background: #0e7490; color: #ecfeff; }
      .hub-call-share.is-on { background: #a16207; color: #fffbeb; }
      .hub-call-hang { background: #be123c; color: #fff; }
      .hub-call-accept { background: #15803d; color: #fff; }
      .hub-call-decline { background: #475569; color: #fff; }
      .hub-call-btn, #friends-call-btn, #hub-chat-call-btn {
        border: 1px solid rgba(56,189,248,.5) !important;
        background: rgba(8,145,178,.35) !important; color: #e0f2fe !important;
      }
    `;
    if (document.getElementById("hub-call-bar")) return;
    const bar = document.createElement("div");
    bar.id = "hub-call-bar";
    bar.className = "hub-call-bar hidden";
    bar.hidden = true;
    bar.innerHTML = `
      <div class="hub-call-bar-top">
        <strong id="hub-call-title">Voice call</strong>
        <span id="hub-call-meta" class="hub-call-bar-meta"></span>
      </div>
      <div id="hub-call-videos" class="hub-call-videos"></div>
      <div id="hub-call-peers" class="hub-call-peers"></div>
      <div id="hub-call-actions" class="hub-call-actions"></div>
    `;
    document.body.appendChild(bar);
  }

  function isSharing() {
    return !!(active?.screenStream && active.screenStream.getVideoTracks().some((t) => t.readyState === "live"));
  }

  function syncLocalPreview() {
    const videos = document.getElementById("hub-call-videos");
    if (!videos) return;
    let wrap = document.getElementById("hub-call-video-local");
    if (isSharing() && active?.screenStream) {
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "hub-call-video-local";
        wrap.className = "hub-call-video-wrap";
        wrap.innerHTML = `<video autoplay playsinline muted></video><span class="hub-call-video-label">You</span>`;
        videos.prepend(wrap);
      }
      const vid = wrap.querySelector("video");
      if (vid && vid.srcObject !== active.screenStream) vid.srcObject = active.screenStream;
    } else if (wrap) {
      wrap.remove();
    }
    const has = !!videos.querySelector(".hub-call-video-wrap");
    videos.classList.toggle("has-video", has);
    document.getElementById("hub-call-bar")?.classList.toggle("is-wide", has);
  }

  function renderCallBar() {
    ensureCallUi();
    const bar = document.getElementById("hub-call-bar");
    const title = document.getElementById("hub-call-title");
    const meta = document.getElementById("hub-call-meta");
    const peersEl = document.getElementById("hub-call-peers");
    const actions = document.getElementById("hub-call-actions");
    const videos = document.getElementById("hub-call-videos");
    if (!bar || !actions) return;

    if (ringingRoomId && !active) {
      const room = cache.rooms?.[ringingRoomId];
      bar.hidden = false;
      bar.classList.remove("hidden", "is-wide");
      if (title) title.textContent = "Incoming call";
      if (meta) meta.textContent = room?.label || "Friend";
      if (peersEl) peersEl.innerHTML = "";
      if (videos) {
        videos.innerHTML = "";
        videos.classList.remove("has-video");
      }
      actions.innerHTML = `
        <button type="button" class="hub-call-accept" data-hub-call-accept>Accept</button>
        <button type="button" class="hub-call-decline" data-hub-call-decline>Decline</button>
      `;
      return;
    }

    if (!active) {
      bar.hidden = true;
      bar.classList.add("hidden");
      bar.classList.remove("is-wide");
      if (videos) {
        videos.innerHTML = "";
        videos.classList.remove("has-video");
      }
      return;
    }

    const room = cache.rooms?.[active.roomId];
    const muted = !!(active.localStream && [...active.localStream.getAudioTracks()].every((t) => !t.enabled));
    const sharing = isSharing();
    bar.hidden = false;
    bar.classList.remove("hidden");
    if (title) title.textContent = room?.label || "Voice call";
    const livePeers = Object.entries(room?.peers || {}).filter(([, p]) => p && !p.left);
    const linked = [...(active.pcs?.values() || [])].filter(
      (pc) => pc.connectionState === "connected" || pc.iceConnectionState === "connected"
    ).length;
    const parts = [`${livePeers.length} in call`, muted ? "muted" : "live"];
    if (linked) parts.push(`${linked} linked`);
    else if (livePeers.length > 1) parts.push("connecting…");
    if (sharing) parts.push("sharing");
    if (meta) meta.textContent = parts.join(" · ");
    if (peersEl) {
      peersEl.innerHTML = livePeers
        .map(([id, p]) => {
          const talking = isPeerTalking(id);
          const cls = [
            "hub-call-peer",
            p.sharing ? "is-sharing" : "",
            talking ? "is-talking" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return `<span class="${cls}" data-peer-id="${escapeHtml(id)}"><span class="hub-call-talk-bars" aria-hidden="true"><i></i><i></i><i></i></span>${escapeHtml(
            p.name || "Player"
          )}${p.sharing ? " · screen" : ""}</span>`;
        })
        .join("");
    }
    ensureSpeakLoop();
    syncLocalPreview();
    actions.innerHTML = `
      <button type="button" class="hub-call-mute${muted ? " is-on" : ""}" data-hub-call-mute>${muted ? "Unmute" : "Mute"}</button>
      <button type="button" class="hub-call-share${sharing ? " is-on" : ""}" data-hub-call-share>${sharing ? "Stop share" : "Share screen"}</button>
      <button type="button" class="hub-call-hang" data-hub-call-hang>Hang up</button>
    `;
  }

  function escapeHtml(raw) {
    return String(raw || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAudioCtx() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function stopWatch(peerId) {
    const m = meters.get(peerId);
    if (!m) return;
    try {
      m.source.disconnect();
    } catch {}
    try {
      m.analyser.disconnect();
    } catch {}
    try {
      m.gain?.disconnect();
    } catch {}
    try {
      m.stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}
    meters.delete(peerId);
  }

  function stopAllMeters() {
    [...meters.keys()].forEach(stopWatch);
    if (speakRaf) {
      cancelAnimationFrame(speakRaf);
      speakRaf = 0;
    }
  }

  function watchAudio(peerId, streamOrTrack, { play = false } = {}) {
    if (!peerId || !streamOrTrack) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    stopWatch(peerId);
    try {
      const srcStream =
        streamOrTrack instanceof MediaStream
          ? streamOrTrack
          : new MediaStream([streamOrTrack]);
      const tracks = srcStream.getAudioTracks();
      if (!tracks.length) return;
      // Always clone — never stop/own the live WebRTC receiver track.
      const stream = new MediaStream(tracks.map((t) => t.clone()));
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;
      const gain = ctx.createGain();
      gain.gain.value = 1;
      source.connect(analyser);
      analyser.connect(gain);
      if (play) gain.connect(ctx.destination);
      meters.set(peerId, {
        analyser,
        source,
        gain,
        stream,
        data: new Uint8Array(analyser.fftSize),
        speaking: false,
        lastSpeak: 0,
        playing: !!play
      });
    } catch (err) {
      console.warn("[HubCalls] meter", err);
    }
  }

  function isPeerTalking(peerId) {
    const m = meters.get(peerId);
    return !!(m && m.speaking);
  }

  function updateSpeakingUi() {
    document.querySelectorAll(".hub-call-peer[data-peer-id]").forEach((el) => {
      const id = el.getAttribute("data-peer-id");
      el.classList.toggle("is-talking", isPeerTalking(id));
    });
  }

  function sampleMeters() {
    const me = playerId();
    const localMuted =
      !!active?.localStream &&
      [...active.localStream.getAudioTracks()].every((t) => !t.enabled);
    const now = Date.now();
    meters.forEach((m, id) => {
      m.analyser.getByteTimeDomainData(m.data);
      let sum = 0;
      for (let i = 0; i < m.data.length; i++) {
        const v = (m.data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / m.data.length);
      const hot = rms > 0.045;
      if (id === me && localMuted) {
        m.speaking = false;
        return;
      }
      if (hot) m.lastSpeak = now;
      // Hold the glow briefly so short words still show
      m.speaking = now - m.lastSpeak < 280;
    });
  }

  function ensureSpeakLoop() {
    if (!active) {
      stopAllMeters();
      return;
    }
    const me = playerId();
    if (me && active.localStream && !meters.has(me)) {
      watchAudio(me, active.localStream);
    }
    if (speakRaf) return;
    const tick = () => {
      speakRaf = requestAnimationFrame(tick);
      if (!active) {
        stopAllMeters();
        return;
      }
      sampleMeters();
      updateSpeakingUi();
    };
    tick();
  }

  async function getMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Voice calls need a modern browser");
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
    } catch {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  }

  function stopLocal() {
    if (active?.localStream) {
      active.localStream.getTracks().forEach((t) => t.stop());
      active.localStream = null;
    }
    if (active?.screenStream) {
      active.screenStream.getTracks().forEach((t) => t.stop());
      active.screenStream = null;
    }
  }

  function closePc(peerId) {
    if (!active?.pcs) return;
    const pc = active.pcs.get(peerId);
    if (!pc) return;
    try {
      pc.close();
    } catch {}
    active.pcs.delete(peerId);
    document.getElementById(`hub-call-audio-${peerId}`)?.remove();
    document.getElementById(`hub-call-video-${peerId}`)?.remove();
    stopWatch(peerId);
    syncLocalPreview();
  }

  function attachRemoteVideo(peerId, stream, track) {
    const videos = document.getElementById("hub-call-videos");
    if (!videos) return;
    let wrap = document.getElementById(`hub-call-video-${peerId}`);
    if (!wrap) {
      const room = cache.rooms?.[active?.roomId];
      const name = room?.peers?.[peerId]?.name || "Friend";
      wrap = document.createElement("div");
      wrap.id = `hub-call-video-${peerId}`;
      wrap.className = "hub-call-video-wrap";
      wrap.innerHTML = `<video autoplay playsinline></video><span class="hub-call-video-label">${escapeHtml(name)}</span>`;
      videos.appendChild(wrap);
    }
    const vid = wrap.querySelector("video");
    // Video-only stream so browser autoplay isn't blocked by remote audio on the same element.
    const media = new MediaStream([track]);
    if (vid) {
      vid.muted = true;
      vid.srcObject = media;
      const p = vid.play();
      if (p && p.catch) p.catch(() => {});
    }
    track?.addEventListener?.("ended", () => {
      wrap?.remove();
      syncLocalPreview();
    });
    syncLocalPreview();
  }

  async function renegotiatePeer(peerId) {
    if (!active) return;
    const pc = active.pcs.get(peerId);
    if (!pc) return;
    try {
      const offer = await makeOffer(pc);
      await pushSignal(peerId, "offer", offer);
    } catch (err) {
      console.warn("[HubCalls] renegotiate", err);
    }
  }

  async function renegotiateAll() {
    if (!active?.pcs) return;
    for (const peerId of [...active.pcs.keys()]) {
      await renegotiatePeer(peerId);
    }
  }

  async function setSharingFlag(on) {
    const me = playerId();
    if (!active || !me) return;
    await mutateRooms((rooms) => {
      const room = rooms[active.roomId];
      if (!room?.peers?.[me]) return;
      rooms[active.roomId] = {
        ...room,
        peers: {
          ...room.peers,
          [me]: { ...room.peers[me], sharing: !!on }
        },
        updatedAt: Date.now()
      };
    });
  }

  async function startScreenShare() {
    if (!active) return { ok: false };
    if (!navigator.mediaDevices?.getDisplayMedia) {
      window.alert("Screen share isn't supported in this browser.");
      return { ok: false };
    }
    if (isSharing()) return { ok: true };
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15, displaySurface: "monitor" },
        audio: false
      });
    } catch (err) {
      if (err?.name !== "NotAllowedError") {
        window.alert(err?.message || "Couldn't start screen share");
      }
      return { ok: false };
    }
    const track = stream.getVideoTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return { ok: false };
    }
    track.onended = () => {
      stopScreenShare().catch(() => {});
    };
    active.screenStream = stream;

    for (const [peerId, pc] of active.pcs) {
      const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      try {
        if (videoSender) await videoSender.replaceTrack(track);
        else pc.addTrack(track, stream);
      } catch (err) {
        console.warn("[HubCalls] add screen track", peerId, err);
      }
    }
    await renegotiateAll();
    await setSharingFlag(true);
    renderCallBar();
    return { ok: true };
  }

  async function stopScreenShare() {
    if (!active) return;
    const stream = active.screenStream;
    active.screenStream = null;
    if (stream) stream.getTracks().forEach((t) => t.stop());

    for (const [, pc] of active.pcs || []) {
      const videoSender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (videoSender) {
        try {
          await videoSender.replaceTrack(null);
        } catch {}
      }
    }
    await renegotiateAll();
    await setSharingFlag(false);
    document.getElementById("hub-call-video-local")?.remove();
    syncLocalPreview();
    renderCallBar();
  }

  async function ensurePc(peerId) {
    if (!active) return null;
    if (active.pcs.has(peerId)) return active.pcs.get(peerId);
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 4
    });
    pc._hubPendingIce = [];
    active.pcs.set(peerId, pc);
    if (active.localStream) {
      active.localStream.getAudioTracks().forEach((track) => {
        track.enabled = true;
        pc.addTrack(track, active.localStream);
      });
    }
    if (active.screenStream) {
      active.screenStream.getTracks().forEach((track) => pc.addTrack(track, active.screenStream));
    }
    // Prefer complete SDP over trickle — poll signaling drops most ICE candidates.
    pc.onicecandidate = () => {};
    pc.ontrack = (ev) => {
      const track = ev.track;
      if (!track) return;
      track.enabled = true;
      if (track.kind === "video") {
        attachRemoteVideo(peerId, ev.streams[0], track);
        return;
      }
      attachRemoteAudio(peerId, track);
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "closed") closePc(peerId);
      else if (state === "disconnected") {
        setTimeout(() => {
          const cur = active?.pcs?.get(peerId);
          if (cur && cur.connectionState === "disconnected") closePc(peerId);
        }, 3500);
      }
    };
    return pc;
  }

  function attachRemoteAudio(peerId, track) {
    if (!track) return;
    track.enabled = true;
    getAudioCtx();
    // Primary playback: live track on an <audio> element (most reliable).
    let audio = document.getElementById(`hub-call-audio-${peerId}`);
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = `hub-call-audio-${peerId}`;
      audio.autoplay = true;
      audio.controls = false;
      audio.muted = false;
      audio.volume = 1;
      audio.setAttribute("playsinline", "");
      audio.style.position = "fixed";
      audio.style.width = "1px";
      audio.style.height = "1px";
      audio.style.opacity = "0";
      audio.style.pointerEvents = "none";
      document.body.appendChild(audio);
    }
    audio.srcObject = new MediaStream([track]);
    audio.muted = false;
    audio.volume = 1;
    const kick = () => {
      audio.muted = false;
      audio.volume = 1;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    };
    kick();
    track.onunmute = kick;
    audio.onloadedmetadata = kick;
    // Meter + secondary Web Audio playback use clones — never the same stream as <audio>.
    watchAudio(peerId, track, { play: true });
    ensureSpeakLoop();
  }

  function resumeAllRemoteAudio() {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    meters.forEach((m) => {
      if (m.playing && m.gain) {
        try {
          m.gain.connect(ctx.destination);
        } catch {}
      }
    });
    document.querySelectorAll('audio[id^="hub-call-audio-"]').forEach((audio) => {
      audio.muted = false;
      audio.volume = 1;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    });
  }

  function waitForIce(pc, ms = 4500) {
    if (!pc || pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      };
      const onChange = () => {
        if (pc.iceGatheringState === "complete") finish();
      };
      pc.addEventListener("icegatheringstatechange", onChange);
      setTimeout(finish, ms);
    });
  }

  async function makeOffer(pc) {
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await pc.setLocalDescription(offer);
    await waitForIce(pc);
    const desc = pc.localDescription;
    return { type: desc.type, sdp: desc.sdp };
  }

  async function makeAnswer(pc) {
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIce(pc);
    const desc = pc.localDescription;
    return { type: desc.type, sdp: desc.sdp };
  }

  async function flushPendingIce(pc) {
    const pending = pc._hubPendingIce || [];
    pc._hubPendingIce = [];
    for (const c of pending) {
      try {
        await pc.addIceCandidate(c);
      } catch {}
    }
  }

  async function pushSignal(to, type, payload) {
    if (!active) return;
    const from = playerId();
    await mutateRooms((rooms) => {
      const room = rooms[active.roomId];
      if (!room) return;
      const signals = Array.isArray(room.signals) ? room.signals.slice() : [];
      signals.push({
        id: makeId(),
        from,
        to,
        type,
        payload,
        at: Date.now()
      });
      rooms[active.roomId] = {
        ...room,
        signals: signals.slice(-80),
        updatedAt: Date.now()
      };
    });
  }

  async function handleSignal(sig) {
    if (!active || !sig || sig.to !== playerId()) return;
    if (seenSignals.has(sig.id)) return;
    seenSignals.add(sig.id);
    if (seenSignals.size > 400) {
      seenSignals = new Set([...seenSignals].slice(-200));
    }
    const from = String(sig.from || "");
    if (!from || from === playerId()) return;
    const pc = await ensurePc(from);
    if (!pc) return;
    try {
      if (sig.type === "offer") {
        if (pc.signalingState === "have-local-offer") {
          if (playerId() > from) return;
          try {
            await pc.setLocalDescription({ type: "rollback" });
          } catch {
            return;
          }
        }
        await pc.setRemoteDescription(sig.payload);
        await flushPendingIce(pc);
        const answer = await makeAnswer(pc);
        await pushSignal(from, "answer", answer);
      } else if (sig.type === "answer") {
        if (pc.signalingState === "have-local-offer" || !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(sig.payload);
          await flushPendingIce(pc);
        }
      } else if (sig.type === "ice" && sig.payload) {
        if (!pc.remoteDescription) {
          pc._hubPendingIce = pc._hubPendingIce || [];
          pc._hubPendingIce.push(sig.payload);
        } else {
          try {
            await pc.addIceCandidate(sig.payload);
          } catch {}
        }
      } else if (sig.type === "hangup") {
        closePc(from);
      }
    } catch (err) {
      console.warn("[HubCalls] signal", err);
    }
  }

  async function connectMesh(room) {
    if (!active || !room) return;
    const me = playerId();
    const peers = Object.entries(room.peers || {}).filter(
      ([id, p]) => id !== me && p && !p.left
    );
    for (const [pid] of peers) {
      let pc = active.pcs.get(pid);
      if (pc && (pc.connectionState === "failed" || pc.connectionState === "closed")) {
        closePc(pid);
        pc = null;
      }
      pc = await ensurePc(pid);
      if (!pc) continue;

      // Already up or in progress — do not tear down.
      if (
        pc.connectionState === "connected" ||
        pc.connectionState === "connecting" ||
        pc.iceConnectionState === "checking" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
      ) {
        continue;
      }
      if (pc.signalingState === "have-local-offer" || pc.signalingState === "have-remote-offer") {
        continue;
      }

      // Lower id offers once when idle.
      if (me > pid) continue;
      if (pc.remoteDescription && pc.localDescription) continue;

      try {
        const offer = await makeOffer(pc);
        await pushSignal(pid, "offer", offer);
      } catch (err) {
        console.warn("[HubCalls] offer", err);
      }
    }
    const signals = Array.isArray(room.signals) ? room.signals : [];
    for (const sig of signals) await handleSignal(sig);
  }

  async function enterRoom(roomId, { asRingAccept = false } = {}) {
    const me = playerId();
    if (!me) throw new Error("Set a hub name first");
    const stream = await getMic();
    active = {
      roomId,
      kind: "",
      channelId: "",
      localStream: stream,
      screenStream: null,
      pcs: new Map()
    };
    ringingRoomId = "";
    await mutateRooms((rooms) => {
      const room = rooms[roomId];
      if (!room) return;
      const peers = { ...(room.peers || {}) };
      peers[me] = {
        name: playerName(),
        joinedAt: Date.now(),
        left: false,
        ringing: false
      };
      rooms[roomId] = {
        ...room,
        peers,
        updatedAt: Date.now()
      };
      active.kind = room.kind;
      active.channelId = room.channelId;
    });
    const room = cache.rooms?.[roomId];
    await connectMesh(room || {});
    saveCallSession();
    renderCallBar();
    if (asRingAccept) {
      try {
        window.HubNotifications?.push?.({
          title: "Call connected",
          body: room?.label || "Voice call"
        });
      } catch {}
    }
  }

  async function startCall(kind, channelId) {
    const me = playerId();
    if (!me) {
      window.alert("Set a hub username before calling.");
      return { ok: false, error: "no name" };
    }
    if (kind !== "dm" && kind !== "group") {
      return { ok: false, error: "Calls are for friends and groups" };
    }
    if (kind === "dm" && window.HubFriends && !HubFriends.isFriend?.(channelId)) {
      return { ok: false, error: "Friends only" };
    }
    if (active) await hangUp();
    const id = roomKey(kind, channelId);
    let label = "Voice call";
    if (kind === "group") {
      const g = window.HubChat?.getGroups?.()?.find((x) => x.id === channelId);
      label = g?.name ? `${g.name} call` : "Group call";
    } else {
      const f = window.HubFriends?.getFriends?.()?.find((x) => x.playerId === channelId);
      label = f?.name ? `Call · ${f.name}` : "Friend call";
    }

    let stream;
    try {
      stream = await getMic();
    } catch (err) {
      window.alert(err?.message || "Microphone permission needed");
      return { ok: false, error: "mic" };
    }

    active = {
      roomId: id,
      kind,
      channelId,
      localStream: stream,
      screenStream: null,
      pcs: new Map()
    };

    const ok = await mutateRooms((rooms) => {
      const existing = rooms[id];
      const peers = existing?.peers && typeof existing.peers === "object" ? { ...existing.peers } : {};
      // Clear stale left flags for me
      peers[me] = {
        name: playerName(),
        joinedAt: Date.now(),
        left: false,
        ringing: false
      };
      if (kind === "dm") {
        const them = String(channelId);
        if (!peers[them] || peers[them].left) {
          peers[them] = {
            name: label.replace(/^Call · /, "") || "Friend",
            joinedAt: 0,
            left: false,
            ringing: true
          };
        }
      }
      // Group: no interrupt ring — friends see "Join call" in the chat header.
      const live = Object.values(peers).filter((p) => p && !p.left);
      if (live.length > MAX_PEERS) {
        throw new Error("Call is full (max 6)");
      }
      rooms[id] = {
        id,
        kind,
        channelId: String(channelId),
        label,
        hostId: existing?.hostId || me,
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
        peers,
        signals: Array.isArray(existing?.signals) ? existing.signals : []
      };
    }).catch((err) => {
      console.warn(err);
      return false;
    });

    if (!ok) {
      stopLocal();
      active = null;
      renderCallBar();
      return { ok: false, error: "Could not start call" };
    }

    await connectMesh(cache.rooms?.[id] || {});
    saveCallSession();
    renderCallBar();
    syncCallButtons();
    return { ok: true, roomId: id };
  }

  async function joinCall(roomId) {
    if (active) await hangUp();
    try {
      await enterRoom(roomId);
      syncCallButtons();
      return { ok: true };
    } catch (err) {
      window.alert(err?.message || "Couldn't join call");
      await hangUp();
      return { ok: false };
    }
  }

  async function acceptRing(roomId) {
    const id = roomId || ringingRoomId;
    ringingRoomId = "";
    if (!id) return { ok: false };
    return joinCall(id);
  }

  async function declineRing(roomId) {
    const id = roomId || ringingRoomId;
    ringingRoomId = "";
    const me = playerId();
    if (id && me) {
      await mutateRooms((rooms) => {
        const room = rooms[id];
        if (!room) return;
        const peers = { ...(room.peers || {}) };
        if (peers[me]) peers[me] = { ...peers[me], ringing: false, left: true };
        rooms[id] = { ...room, peers, updatedAt: Date.now() };
      });
    }
    renderCallBar();
  }

  function clearCallSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  function saveCallSession() {
    if (!active?.roomId) {
      clearCallSession();
      return;
    }
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          roomId: active.roomId,
          kind: active.kind || "",
          channelId: active.channelId || "",
          savedAt: Date.now()
        })
      );
    } catch {}
  }

  function loadCallSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data?.roomId) return null;
      if (Date.now() - (Number(data.savedAt) || 0) > SESSION_MAX_MS) {
        clearCallSession();
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }

  async function waitForPlayerId(ms = 6000) {
    const start = Date.now();
    while (Date.now() - start < ms) {
      if (playerId()) return playerId();
      await new Promise((r) => setTimeout(r, 200));
    }
    return playerId();
  }

  async function resumeCallSession() {
    if (active) return;
    const saved = loadCallSession();
    if (!saved?.roomId) return;
    await waitForPlayerId();
    if (!playerId()) return;
    const doc = await fetchDoc();
    if (doc) cache.rooms = pruneRooms(doc.rooms || {});
    const room = cache.rooms?.[saved.roomId];
    if (!room) {
      clearCallSession();
      return;
    }
    const live = Object.values(room.peers || {}).filter((p) => p && !p.left);
    const mePeer = room.peers?.[playerId()];
    // Room still alive if anyone is in it, or we were and just refreshed (may be left:false still).
    if (!live.length && !mePeer) {
      clearCallSession();
      return;
    }
    try {
      await enterRoom(saved.roomId);
      syncCallButtons();
    } catch (err) {
      console.warn("[HubCalls] resume", err);
      clearCallSession();
      if (active) {
        stopLocal();
        active = null;
        stopAllMeters();
        renderCallBar();
      }
    }
  }

  async function hangUp() {
    const me = playerId();
    const roomId = active?.roomId;
    if (active?.pcs) {
      [...active.pcs.keys()].forEach((pid) => {
        pushSignal(pid, "hangup", {}).catch(() => {});
        closePc(pid);
      });
    }
    stopLocal();
    active = null;
    stopAllMeters();
    clearCallSession();
    document.getElementById("hub-call-videos")?.replaceChildren();
    if (roomId && me) {
      await mutateRooms((rooms) => {
        const room = rooms[roomId];
        if (!room) return;
        const peers = { ...(room.peers || {}) };
        if (peers[me]) peers[me] = { ...peers[me], left: true, ringing: false, sharing: false };
        rooms[roomId] = { ...room, peers, updatedAt: Date.now() };
      });
    }
    renderCallBar();
    syncCallButtons();
  }

  function toggleMute() {
    if (!active?.localStream) return;
    active.localStream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    renderCallBar();
  }

  function getActive() {
    return active
      ? { roomId: active.roomId, kind: active.kind, channelId: active.channelId }
      : null;
  }

  async function poll() {
    const doc = await fetchDoc();
    if (doc) cache.rooms = pruneRooms(doc.rooms || {});
    const me = playerId();
    if (!me) {
      renderCallBar();
      syncCallButtons();
      return;
    }

    // Incoming ring?
    if (!active) {
      const ring = Object.values(cache.rooms).find((room) => {
        const p = room?.peers?.[me];
        return p && p.ringing && !p.left && !p.joinedAt;
      });
      ringingRoomId = ring?.id || "";
    }

    if (active) {
      const room = cache.rooms?.[active.roomId];
      if (!room) {
        await hangUp();
      } else {
        const mePeer = room.peers?.[me];
        if (mePeer?.left) {
          await hangUp();
        } else {
          await connectMesh(room);
        }
      }
    }
    renderCallBar();
    syncCallButtons();
  }

  function channelCallRoom(kind, channelId) {
    const id = roomKey(kind, channelId);
    const room = cache.rooms?.[id];
    if (!room) return null;
    const live = Object.values(room.peers || {}).filter((p) => p && !p.left);
    if (!live.length) return null;
    return room;
  }

  function syncCallButtons() {
    wireCallButtons();
    const channel = window.HubChat?.getActiveChannel?.();
    const hubBtn = document.getElementById("hub-chat-call-btn");
    const friendsBtn = document.getElementById("friends-call-btn");
    [hubBtn, friendsBtn].forEach((btn) => {
      if (!btn) return;
      if (!channel || (channel.type !== "dm" && channel.type !== "group")) {
        btn.hidden = true;
        btn.classList.add("hidden");
        return;
      }
      btn.hidden = false;
      btn.classList.remove("hidden");
      const room = channelCallRoom(channel.type === "group" ? "group" : "dm", channel.id);
      const inThis =
        active &&
        active.kind === (channel.type === "group" ? "group" : "dm") &&
        active.channelId === channel.id;
      if (inThis) btn.textContent = "In call";
      else if (room) btn.textContent = "Join call";
      else btn.textContent = "Call";
    });
  }

  let wiredClicks = false;
  function wireCallButtons() {
    ensureCallUi();
    // Hub overlay chat header
    const hubHead = document.querySelector("#hub-chat-panel .hub-chat-head");
    if (hubHead && !document.getElementById("hub-chat-call-btn")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "hub-chat-call-btn";
      btn.className = "hub-call-btn hidden";
      btn.hidden = true;
      btn.textContent = "Call";
      const close = document.getElementById("hub-chat-close");
      if (close) hubHead.insertBefore(btn, close);
      else hubHead.appendChild(btn);
    }
    // Friends panel chat header
    const friendsHead = document.querySelector(".friends-chat-head");
    if (friendsHead && !document.getElementById("friends-call-btn")) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "friends-call-btn";
      btn.className = "hub-btn hub-call-btn hidden";
      btn.hidden = true;
      btn.textContent = "Call";
      friendsHead.appendChild(btn);
    }

    if (wiredClicks) return;
    wiredClicks = true;
    document.addEventListener("click", async (e) => {
      if (e.target.closest("#hub-call-bar, #hub-chat-call-btn, #friends-call-btn")) {
        resumeAllRemoteAudio();
      }
      if (e.target.closest("[data-hub-call-hang]")) {
        e.preventDefault();
        hangUp();
        return;
      }
      if (e.target.closest("[data-hub-call-mute]")) {
        e.preventDefault();
        toggleMute();
        return;
      }
      if (e.target.closest("[data-hub-call-share]")) {
        e.preventDefault();
        if (isSharing()) stopScreenShare();
        else startScreenShare();
        return;
      }
      if (e.target.closest("[data-hub-call-accept]")) {
        e.preventDefault();
        acceptRing(ringingRoomId);
        return;
      }
      if (e.target.closest("[data-hub-call-decline]")) {
        e.preventDefault();
        declineRing(ringingRoomId);
        return;
      }
      const startBtn = e.target.closest("#hub-chat-call-btn, #friends-call-btn");
      if (!startBtn) return;
      e.preventDefault();
      const channel = window.HubChat?.getActiveChannel?.();
      if (!channel || (channel.type !== "dm" && channel.type !== "group")) return;
      const kind = channel.type === "group" ? "group" : "dm";
      const room = channelCallRoom(kind, channel.id);
      const inThis = active && active.roomId === roomKey(kind, channel.id);
      if (inThis) return;
      if (room) await joinCall(room.id);
      else await startCall(kind, channel.id);
    });
  }

  function startPolling() {
    poll();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(poll, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = 0;
  }

  window.HubCalls = {
    startCall,
    joinCall,
    hangUp,
    acceptRing,
    declineRing,
    startScreenShare,
    stopScreenShare,
    getActive,
    startPolling,
    stopPolling,
    syncCallButtons
  };

  function boot() {
    try {
      wireCallButtons();
      startPolling();
      setInterval(syncCallButtons, 2000);
      // Keep the call across game navigations / refresh — only Hang up leaves.
      window.addEventListener("pagehide", () => {
        if (active) saveCallSession();
      });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && active) {
          saveCallSession();
          resumeAllRemoteAudio();
          getAudioCtx();
        }
      });
      setTimeout(() => {
        resumeCallSession().catch((err) => console.warn("[HubCalls] resume", err));
      }, 600);
    } catch (err) {
      console.warn("[HubCalls] boot", err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 400));
  } else {
    setTimeout(boot, 400);
  }
})();
