/**
 * hub-discord.js — Discord invite, optional OAuth login (via Supabase), channel webhooks.
 *
 * Setup (ICE):
 * 1. Invite is live: SITE_CONFIG.discord.invite
 * 2. Login: Discord Developer Portal → New Application → OAuth2
 *    - Redirect URL: https://clkamsflzyvdcepvelks.supabase.co/auth/v1/callback
 *    - Also add your site URL under Supabase Auth → URL config
 *    - Supabase Dashboard → Authentication → Providers → Discord → enable,
 *      paste Client ID + Client Secret
 * 3. Announcements: Discord channel → Edit → Integrations → Webhooks → New Webhook
 *    - Paste the webhook URL into SITE_CONFIG.discord.webhookUrl
 *    (Anyone who can read the site JS could spam that URL — use an #announcements
 *     channel and rotate the webhook if needed.)
 */
(function () {
  const SUPABASE_URL = "https://clkamsflzyvdcepvelks.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Ftc2Zsenl2ZGNlcHZlbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjE3ODEsImV4cCI6MjEwNTczNzc4MX0.s-k2d37X0gByK2-SLnsLWhkbQb15_sDuKpvZs7ABM3g";
  const LINK_KEY = "hub-discord-link-v1";
  const DEFAULT_INVITE = "https://discord.gg/6NHYfPwAwg";

  function cfg() {
    const d = (window.SITE_CONFIG && window.SITE_CONFIG.discord) || {};
    return {
      invite: String(d.invite || DEFAULT_INVITE).trim() || DEFAULT_INVITE,
      webhookUrl: String(d.webhookUrl || "").trim(),
      loginEnabled: d.loginEnabled !== false
    };
  }

  function openInvite() {
    const url = cfg().invite;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      location.href = url;
    }
    return url;
  }

  function readLink() {
    try {
      const raw = JSON.parse(localStorage.getItem(LINK_KEY) || "null");
      if (!raw || typeof raw !== "object") return null;
      return {
        discordId: String(raw.discordId || ""),
        username: String(raw.username || "").trim(),
        globalName: String(raw.globalName || "").trim(),
        avatar: String(raw.avatar || ""),
        playerId: String(raw.playerId || ""),
        at: Number(raw.at) || 0
      };
    } catch {
      return null;
    }
  }

  function writeLink(data) {
    try {
      if (!data) {
        localStorage.removeItem(LINK_KEY);
        return null;
      }
      localStorage.setItem(LINK_KEY, JSON.stringify(data));
      return data;
    } catch {
      return null;
    }
  }

  function displayName(link) {
    const L = link || readLink();
    if (!L) return "";
    return String(L.globalName || L.username || "").trim().slice(0, 16);
  }

  function authHeaders(accessToken) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    };
  }

  function parseAuthCallback() {
    const hash = String(location.hash || "").replace(/^#/, "");
    const search = String(location.search || "").replace(/^\?/, "");
    const params = new URLSearchParams(hash || search);
    const access = params.get("access_token") || "";
    const error = params.get("error_description") || params.get("error") || "";
    const fromDiscord =
      params.get("provider_token") ||
      params.has("access_token") ||
      /discord_auth=1/.test(location.search) ||
      /type=recovery|type=signup|type=magiclink|provider=discord/i.test(hash + search);
    return { access, error, fromDiscord: !!(access || error || fromDiscord) };
  }

  function clearAuthParamsFromUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete("discord_auth");
      url.searchParams.delete("code");
      history.replaceState({}, "", url.pathname + url.search + (url.hash.startsWith("#access_token") ? "" : url.hash));
      if (String(location.hash || "").includes("access_token")) {
        history.replaceState({}, "", url.pathname + url.search);
      }
    } catch {}
  }

  async function fetchSupabaseUser(accessToken) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: authHeaders(accessToken),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`auth user ${res.status}`);
    return res.json();
  }

  function discordIdentityFromUser(user) {
    if (!user || typeof user !== "object") return null;
    const identities = Array.isArray(user.identities) ? user.identities : [];
    const discord = identities.find((i) => String(i?.provider || "") === "discord") || null;
    const meta = { ...(user.user_metadata || {}), ...(discord?.identity_data || {}) };
    const discordId = String(
      meta.provider_id || meta.sub || discord?.id || user.id || ""
    ).trim();
    const username = String(meta.full_name || meta.name || meta.preferred_username || meta.user_name || "")
      .replace(/#\d+$/, "")
      .trim();
    const globalName = String(meta.custom_claims?.global_name || meta.full_name || username || "").trim();
    const avatar = String(meta.avatar_url || meta.picture || "").trim();
    if (!discordId && !username) return null;
    return { discordId, username, globalName, avatar };
  }

  async function applyDiscordSession(accessToken) {
    const user = await fetchSupabaseUser(accessToken);
    const ident = discordIdentityFromUser(user);
    if (!ident) throw new Error("No Discord identity on this session");
    const playerId =
      (typeof window.HubPlays?.getPlayerId === "function" && HubPlays.getPlayerId()) ||
      localStorage.getItem("hub-player-id") ||
      "";
    const link = writeLink({
      ...ident,
      playerId: String(playerId || ""),
      at: Date.now()
    });
    const name = displayName(link);
    if (name && typeof window.HubPlays?.getName === "function") {
      const current = String(HubPlays.getName() || "").trim();
      if (!current || /^guest-/i.test(current) || current.toLowerCase() === "player") {
        try {
          if (typeof HubPlays.claimName === "function") {
            await HubPlays.claimName(name);
          } else if (typeof HubPlays.setName === "function") {
            HubPlays.setName(name);
          }
        } catch {}
      }
    }
    try {
      window.HubAccountBag?.syncUp?.(playerId);
    } catch {}
    try {
      document.dispatchEvent(
        new CustomEvent("hub-discord-linked", { detail: { ...(link || {}), name } })
      );
    } catch {}
    return link;
  }

  function loginRedirectUrl() {
    const u = new URL(location.href);
    u.searchParams.set("discord_auth", "1");
    u.hash = "";
    return u.toString();
  }

  function loginWithDiscord() {
    if (!cfg().loginEnabled) {
      openInvite();
      return { ok: false, error: "Discord login is disabled right now — opened the server invite." };
    }
    const redirectTo = encodeURIComponent(loginRedirectUrl());
    const url = `${SUPABASE_URL}/auth/v1/authorize?provider=discord&redirect_to=${redirectTo}`;
    location.href = url;
    return { ok: true, pending: true };
  }

  async function handleRedirectIfPresent() {
    const { access, error, fromDiscord } = parseAuthCallback();
    if (!fromDiscord && !access && !error) return null;
    clearAuthParamsFromUrl();
    if (error) {
      return {
        ok: false,
        error:
          "Discord login isn't finished setting up yet (enable Discord in Supabase Auth). You can still join the server."
      };
    }
    if (!access) {
      return {
        ok: false,
        error: "Discord login didn't return a session. Enable Discord provider in Supabase, then try again."
      };
    }
    try {
      const link = await applyDiscordSession(access);
      return { ok: true, link, name: displayName(link) };
    } catch (err) {
      return {
        ok: false,
        error: err?.message || "Couldn't finish Discord login"
      };
    }
  }

  async function announce(content, opts = {}) {
    const webhook = cfg().webhookUrl;
    if (!webhook) return { ok: false, reason: "no-webhook" };
    const text = String(content || "").trim().slice(0, 1900);
    if (!text) return { ok: false, reason: "empty" };
    const body = {
      content: text,
      username: String(opts.username || "My Games").slice(0, 80),
      allowed_mentions: { parse: [] }
    };
    if (opts.avatarUrl) body.avatar_url = String(opts.avatarUrl);
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok && res.status !== 204) {
        return { ok: false, reason: `http-${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err?.message || "network" };
    }
  }

  function gameHomeUrl() {
    try {
      if (typeof location !== "undefined" && /^https?:$/i.test(location.protocol) && location.origin) {
        const host = String(location.hostname || "");
        if (host && host !== "localhost" && host !== "127.0.0.1") {
          return `${location.origin}/`;
        }
      }
    } catch {}
    const domain = String((window.SITE_CONFIG && SITE_CONFIG.domain) || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (domain) return `https://${domain}/`;
    return "https://icedragon1st.github.io/";
  }

  function announceEvent(title, detail) {
    const head = String(title || "My Games").trim();
    const body = String(detail || "").trim();
    const home = gameHomeUrl().replace(/\/$/, "");
    const playUrl = /fishing/i.test(head) ? `${home}/fishing/` : `${home}/`;
    const msg = body ? `**${head}**\n${body}\n${playUrl}` : `**${head}**\n${playUrl}`;
    return announce(msg, { username: "My Games Hub" });
  }

  window.HubDiscord = {
    openInvite,
    loginWithDiscord,
    handleRedirectIfPresent,
    announce,
    announceEvent,
    getLink: readLink,
    displayName,
    getInvite: () => cfg().invite,
    hasWebhook: () => !!cfg().webhookUrl
  };

  // Finish OAuth return as early as possible
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        handleRedirectIfPresent().then((result) => {
          if (!result) return;
          try {
            document.dispatchEvent(new CustomEvent("hub-discord-auth", { detail: result }));
          } catch {}
        });
      },
      { once: true }
    );
  } else {
    handleRedirectIfPresent().then((result) => {
      if (!result) return;
      try {
        document.dispatchEvent(new CustomEvent("hub-discord-auth", { detail: result }));
      } catch {}
    });
  }
})();
