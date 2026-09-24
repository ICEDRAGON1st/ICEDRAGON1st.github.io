/**
 * hub-calls.js — voice calls for friend DMs and group chats (WebRTC mesh).
 * Signaling via Supabase hub_docs (Mantle fallback). STUN only (no TURN).
 *
 * window.HubCalls:
 *   startCall(kind, channelId) / joinCall(roomId) / hangUp()
 *   acceptRing(roomId) / declineRing(roomId)
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
  const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

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
  let active = null; // { roomId, kind, channelId, localStream, pcs: Map, pendingSignals: Set }
  let seenSignals = new Set();
  let ringingRoomId = "";
  let writeQueue = Promise.resolve();

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
      const rooms = { ...(doc.rooms || {}) };
      mutator(rooms);
      const ok = await postDoc(rooms);
      if (ok) cache.rooms = pruneRooms(rooms);
      return ok;
    });
  }

  function ensureCallUi() {
    if (document.getElementById("hub-call-bar")) return;
    const style = document.createElement("style");
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
      .hub-call-bar.hidden, .hub-call-bar[hidden] { display: none !important; }
      .hub-call-bar-top { display: flex; justify-content: space-between; gap: .5rem; align-items: center; }
      .hub-call-bar-meta { font-size: .78rem; color: #94a3b8; }
      .hub-call-peers { display: flex; flex-wrap: wrap; gap: .3rem; }
      .hub-call-peer {
        border-radius: 999px; padding: .2rem .55rem; font-size: .75rem;
        background: rgba(14,116,144,.35); border: 1px solid rgba(125,211,252,.35);
      }
      .hub-call-actions { display: flex; flex-wrap: wrap; gap: .35rem; }
      .hub-call-actions button {
        flex: 1; min-width: 4.5rem; border: 0; border-radius: .65rem; padding: .5rem .6rem;
        font: inherit; font-weight: 700; cursor: pointer;
      }
      .hub-call-mute { background: #334155; color: #f8fafc; }
      .hub-call-mute.is-on { background: #b45309; }
      .hub-call-hang { background: #be123c; color: #fff; }
      .hub-call-accept { background: #15803d; color: #fff; }
      .hub-call-decline { background: #475569; color: #fff; }
      .hub-call-btn, #friends-call-btn, #hub-chat-call-btn {
        border: 1px solid rgba(56,189,248,.5) !important;
        background: rgba(8,145,178,.35) !important; color: #e0f2fe !important;
      }
    `;
    document.head.appendChild(style);
    const bar = document.createElement("div");
    bar.id = "hub-call-bar";
    bar.className = "hub-call-bar hidden";
    bar.hidden = true;
    bar.innerHTML = `
      <div class="hub-call-bar-top">
        <strong id="hub-call-title">Voice call</strong>
        <span id="hub-call-meta" class="hub-call-bar-meta"></span>
      </div>
      <div id="hub-call-peers" class="hub-call-peers"></div>
      <div id="hub-call-actions" class="hub-call-actions"></div>
    `;
    document.body.appendChild(bar);
  }

  function renderCallBar() {
    ensureCallUi();
    const bar = document.getElementById("hub-call-bar");
    const title = document.getElementById("hub-call-title");
    const meta = document.getElementById("hub-call-meta");
    const peersEl = document.getElementById("hub-call-peers");
    const actions = document.getElementById("hub-call-actions");
    if (!bar || !actions) return;

    if (ringingRoomId && !active) {
      const room = cache.rooms?.[ringingRoomId];
      bar.hidden = false;
      bar.classList.remove("hidden");
      if (title) title.textContent = "Incoming call";
      if (meta) meta.textContent = room?.label || "Friend";
      if (peersEl) peersEl.innerHTML = "";
      actions.innerHTML = `
        <button type="button" class="hub-call-accept" data-hub-call-accept>Accept</button>
        <button type="button" class="hub-call-decline" data-hub-call-decline>Decline</button>
      `;
      return;
    }

    if (!active) {
      bar.hidden = true;
      bar.classList.add("hidden");
      return;
    }

    const room = cache.rooms?.[active.roomId];
    const muted = !!(active.localStream && [...active.localStream.getAudioTracks()].every((t) => !t.enabled));
    bar.hidden = false;
    bar.classList.remove("hidden");
    if (title) title.textContent = room?.label || "Voice call";
    const livePeers = Object.values(room?.peers || {}).filter((p) => p && !p.left);
    if (meta) meta.textContent = `${livePeers.length} in call · ${muted ? "muted" : "live"}`;
    if (peersEl) {
      peersEl.innerHTML = livePeers
        .map((p) => `<span class="hub-call-peer">${escapeHtml(p.name || "Player")}</span>`)
        .join("");
    }
    actions.innerHTML = `
      <button type="button" class="hub-call-mute${muted ? " is-on" : ""}" data-hub-call-mute>${muted ? "Unmute" : "Mute"}</button>
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

  async function getMic() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Voice calls need a modern browser");
    }
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false
    });
  }

  function stopLocal() {
    if (!active?.localStream) return;
    active.localStream.getTracks().forEach((t) => t.stop());
    active.localStream = null;
  }

  function closePc(peerId) {
    if (!active?.pcs) return;
    const pc = active.pcs.get(peerId);
    if (!pc) return;
    try {
      pc.close();
    } catch {}
    active.pcs.delete(peerId);
    const audio = document.getElementById(`hub-call-audio-${peerId}`);
    audio?.remove();
  }

  async function ensurePc(peerId) {
    if (!active) return null;
    if (active.pcs.has(peerId)) return active.pcs.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    active.pcs.set(peerId, pc);
    if (active.localStream) {
      active.localStream.getTracks().forEach((track) => pc.addTrack(track, active.localStream));
    }
    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !active) return;
      pushSignal(peerId, "ice", ev.candidate.toJSON());
    };
    pc.ontrack = (ev) => {
      let audio = document.getElementById(`hub-call-audio-${peerId}`);
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `hub-call-audio-${peerId}`;
        audio.autoplay = true;
        audio.playsInline = true;
        audio.style.display = "none";
        document.body.appendChild(audio);
      }
      audio.srcObject = ev.streams[0] || new MediaStream([ev.track]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") closePc(peerId);
    };
    return pc;
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
        await pc.setRemoteDescription(sig.payload);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await pushSignal(from, "answer", pc.localDescription);
      } else if (sig.type === "answer") {
        if (!pc.currentRemoteDescription) await pc.setRemoteDescription(sig.payload);
      } else if (sig.type === "ice" && sig.payload) {
        try {
          await pc.addIceCandidate(sig.payload);
        } catch {}
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
      const pc = await ensurePc(pid);
      if (!pc) continue;
      // Higher id politely waits; lower id offers.
      if (me > pid) continue;
      if (pc.localDescription || pc.remoteDescription) continue;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await pushSignal(pid, "offer", pc.localDescription);
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
    if (roomId && me) {
      await mutateRooms((rooms) => {
        const room = rooms[roomId];
        if (!room) return;
        const peers = { ...(room.peers || {}) };
        if (peers[me]) peers[me] = { ...peers[me], left: true, ringing: false };
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
    getActive,
    startPolling,
    stopPolling,
    syncCallButtons
  };

  function boot() {
    try {
      wireCallButtons();
      startPolling();
      // Keep call buttons in sync when chat opens
      setInterval(syncCallButtons, 2000);
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
