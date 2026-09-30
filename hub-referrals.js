/**
 * hub-referrals.js — invite links (?ref=PLAYERCODE) → INVITER title at 3 unique joins.
 *
 * window.HubReferrals:
 *   .captureFromUrl()
 *   .getInviteUrl()
 *   .getStatus() → { count, need, unlocked, pending }
 *   .creditIfPending() → Promise
 *   .hasInviterTitle(name?)
 */
(function () {
  const PENDING_KEY = "hub-pending-invite-v1";
  const CREDITED_KEY = "hub-invite-credited-v1";
  const LOCAL_STATUS_KEY = "hub-invite-status-v1";
  const DOC_ID = "hub-referrals-v1";
  const NEED = 3;

  function sb() {
    return window.HubSupabase && HubSupabase.ready ? HubSupabase : null;
  }

  function normalizeCode(raw) {
    if (typeof window.HubPlays?.normalizePlayerCode === "function") {
      return HubPlays.normalizePlayerCode(raw);
    }
    return String(raw || "")
      .toUpperCase()
      .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
      .slice(0, 8);
  }

  function formatCode(raw) {
    if (typeof window.HubPlays?.formatPlayerCode === "function") {
      return HubPlays.formatPlayerCode(raw);
    }
    const n = normalizeCode(raw);
    return n.length === 8 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
  }

  function myPlayerId() {
    try {
      return String(window.HubPlays?.getPlayerId?.() || localStorage.getItem("hub-player-id") || "");
    } catch {
      return "";
    }
  }

  function myName() {
    try {
      return String(window.HubPlays?.getName?.() || "").trim();
    } catch {
      return "";
    }
  }

  function myCode() {
    try {
      return normalizeCode(window.HubPlays?.getPlayerCode?.() || "");
    } catch {
      return "";
    }
  }

  function readPending() {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      const code = normalizeCode(raw.code);
      if (code.length !== 8) return null;
      return { code, at: Number(raw.at) || 0 };
    } catch {
      return null;
    }
  }

  function writePending(code) {
    const norm = normalizeCode(code);
    if (norm.length !== 8) return null;
    const payload = { code: norm, at: Date.now() };
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    } catch {}
    return payload;
  }

  function clearPending() {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
  }

  function alreadyCreditedSelf() {
    try {
      return localStorage.getItem(CREDITED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markCreditedSelf() {
    try {
      localStorage.setItem(CREDITED_KEY, "1");
    } catch {}
  }

  function readLocalStatus() {
    try {
      const raw = JSON.parse(localStorage.getItem(LOCAL_STATUS_KEY) || "null");
      if (!raw || typeof raw !== "object") return { count: 0, unlocked: false };
      return {
        count: Math.max(0, Number(raw.count) || 0),
        unlocked: !!raw.unlocked
      };
    } catch {
      return { count: 0, unlocked: false };
    }
  }

  function writeLocalStatus(status) {
    try {
      localStorage.setItem(
        LOCAL_STATUS_KEY,
        JSON.stringify({
          count: Math.max(0, Number(status.count) || 0),
          unlocked: !!status.unlocked,
          at: Date.now()
        })
      );
    } catch {}
  }

  function captureFromUrl() {
    try {
      const url = new URL(location.href);
      const raw =
        url.searchParams.get("ref") ||
        url.searchParams.get("invite") ||
        url.searchParams.get("invitedBy") ||
        "";
      const code = normalizeCode(raw);
      if (code.length === 8) {
        // Don't store your own code as a pending invite
        if (code !== myCode()) writePending(code);
        url.searchParams.delete("ref");
        url.searchParams.delete("invite");
        url.searchParams.delete("invitedBy");
        history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch {}
    return readPending();
  }

  function getInviteUrl() {
    const code = myCode();
    const origin =
      typeof location !== "undefined" && location.origin
        ? location.origin
        : "https://icedragon1st.github.io";
    if (code.length !== 8) return `${origin}/`;
    return `${origin}/?ref=${encodeURIComponent(formatCode(code))}`;
  }

  function emptyDoc() {
    return { byInviter: {}, byInvitee: {} };
  }

  async function pullDoc() {
    const api = sb();
    if (!api) return emptyDoc();
    try {
      const data = await api.getDoc(DOC_ID);
      if (!data || typeof data !== "object") return emptyDoc();
      return {
        byInviter:
          data.byInviter && typeof data.byInviter === "object" ? data.byInviter : {},
        byInvitee:
          data.byInvitee && typeof data.byInvitee === "object" ? data.byInvitee : {}
      };
    } catch {
      return emptyDoc();
    }
  }

  async function pushDoc(doc) {
    const api = sb();
    if (!api) return false;
    try {
      await api.upsertDoc(DOC_ID, doc);
      return true;
    } catch {
      return false;
    }
  }

  async function resolveCodeToPlayerId(code) {
    const norm = normalizeCode(code);
    if (norm.length !== 8) return "";
    try {
      if (typeof window.HubPlays?.ensurePlayerCodeRegistered === "function") {
        // Ensure codes map is warm when possible
      }
    } catch {}
    try {
      // Local vault first
      const accounts = window.HubPlays?.getSavedAccounts?.() || [];
      const hit = accounts.find((a) => normalizeCode(a.code) === norm);
      if (hit?.playerId) return String(hit.playerId);
    } catch {}
    const api = sb();
    if (!api) return "";
    try {
      const data = await api.getDoc("player-codes");
      const codes = data?.codes && typeof data.codes === "object" ? data.codes : data || {};
      const entry = codes[norm] || codes[formatCode(norm)] || null;
      return entry?.playerId ? String(entry.playerId) : "";
    } catch {
      return "";
    }
  }

  async function unlockSelfIfNeeded(count) {
    if (count < NEED) return false;
    writeLocalStatus({ count, unlocked: true });
    try {
      await window.HubPlays?.markInviter?.(count);
    } catch {}
    try {
      document.dispatchEvent(
        new CustomEvent("hub-inviter-unlocked", { detail: { count } })
      );
    } catch {}
    return true;
  }

  function countFor(inviterId, doc) {
    const row = doc?.byInviter?.[inviterId];
    if (!row || typeof row !== "object") return 0;
    const invitees = row.invitees && typeof row.invitees === "object" ? row.invitees : {};
    return Object.keys(invitees).length;
  }

  async function refreshMyStatus() {
    const me = myPlayerId();
    if (!me) return getStatus();
    const doc = await pullDoc();
    const count = countFor(me, doc);
    const unlocked = count >= NEED || !!doc.byInviter?.[me]?.unlockedAt;
    writeLocalStatus({ count, unlocked });
    if (unlocked) {
      try {
        await window.HubPlays?.markInviter?.(count);
      } catch {}
    }
    return getStatus();
  }

  function getStatus() {
    const local = readLocalStatus();
    let claimCount = 0;
    let claimUnlocked = false;
    try {
      const claim = window.HubPlays?.getClaimForName?.(myName());
      claimCount = Math.max(0, Number(claim?.inviteCount) || 0);
      claimUnlocked = !!claim?.inviter;
    } catch {}
    const count = Math.max(local.count, claimCount);
    const unlocked = local.unlocked || claimUnlocked || count >= NEED;
    return {
      count,
      need: NEED,
      unlocked,
      pending: readPending(),
      remaining: Math.max(0, NEED - count)
    };
  }

  function hasInviterTitle(name) {
    try {
      if (name && typeof window.HubPlays?.getClaimForName === "function") {
        const claim = HubPlays.getClaimForName(name);
        if (claim?.inviter) return true;
      }
      if (!name || nameKeySafe(name) === nameKeySafe(myName())) {
        return !!getStatus().unlocked;
      }
    } catch {}
    return false;
  }

  function nameKeySafe(name) {
    if (typeof window.HubPlays?.sanitizeName === "function") {
      return String(HubPlays.sanitizeName(name) || "")
        .trim()
        .toLowerCase();
    }
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  /**
   * Call after a real username is claimed on this device.
   * Credits the pending inviter once per invitee account.
   */
  async function creditIfPending() {
    if (alreadyCreditedSelf()) {
      clearPending();
      return { ok: false, reason: "already-credited" };
    }
    const pending = readPending();
    if (!pending) return { ok: false, reason: "no-pending" };

    const inviteeId = myPlayerId();
    const inviteeName = myName();
    if (!inviteeId || !inviteeName || /^guest-/i.test(inviteeName)) {
      return { ok: false, reason: "need-name" };
    }

    const inviterCode = pending.code;
    if (inviterCode === myCode()) {
      clearPending();
      return { ok: false, reason: "self" };
    }

    const inviterId = await resolveCodeToPlayerId(inviterCode);
    if (!inviterId) return { ok: false, reason: "unknown-code" };
    if (inviterId === inviteeId) {
      clearPending();
      return { ok: false, reason: "self" };
    }

    const doc = await pullDoc();
    if (doc.byInvitee[inviteeId]) {
      markCreditedSelf();
      clearPending();
      return { ok: false, reason: "already-credited" };
    }

    if (!doc.byInviter[inviterId] || typeof doc.byInviter[inviterId] !== "object") {
      doc.byInviter[inviterId] = { invitees: {}, unlockedAt: 0 };
    }
    if (!doc.byInviter[inviterId].invitees || typeof doc.byInviter[inviterId].invitees !== "object") {
      doc.byInviter[inviterId].invitees = {};
    }

    doc.byInviter[inviterId].invitees[inviteeId] = {
      name: inviteeName.slice(0, 16),
      code: inviterCode,
      at: Date.now()
    };
    doc.byInvitee[inviteeId] = {
      inviterId,
      inviterCode,
      at: Date.now()
    };

    const count = Object.keys(doc.byInviter[inviterId].invitees).length;
    if (count >= NEED && !doc.byInviter[inviterId].unlockedAt) {
      doc.byInviter[inviterId].unlockedAt = Date.now();
    }

    const ok = await pushDoc(doc);
    if (!ok) return { ok: false, reason: "sync-failed" };

    markCreditedSelf();
    clearPending();

    // Unlock title on the inviter's name claim (works even when they're offline)
    if (count >= NEED) {
      try {
        await window.HubPlays?.markInviterForPlayerId?.(inviterId, count);
      } catch {}
    }

    // If THIS device is the inviter (shared PC), unlock locally too.
    if (inviterId === myPlayerId()) {
      await unlockSelfIfNeeded(count);
    }

    try {
      document.dispatchEvent(
        new CustomEvent("hub-invite-credited", {
          detail: { inviterId, inviteeId, count, unlocked: count >= NEED }
        })
      );
    } catch {}

    return { ok: true, inviterId, count, unlocked: count >= NEED };
  }

  // Boot
  captureFromUrl();
  setTimeout(() => {
    refreshMyStatus().catch(() => {});
  }, 2000);
  document.addEventListener("hub-username-ready", () => {
    creditIfPending()
      .then(() => refreshMyStatus())
      .catch(() => {});
  });
  document.addEventListener("hub-player-changed", () => {
    refreshMyStatus().catch(() => {});
  });

  window.HubReferrals = {
    NEED,
    captureFromUrl,
    getInviteUrl,
    getStatus,
    refreshMyStatus,
    creditIfPending,
    hasInviterTitle,
    formatCode,
    normalizeCode
  };
})();
