/**
 * My Games Discord link bot
 * /link CODE  → look up hub username → set server nickname
 * /unlink     → clear nickname override
 *
 * Keep this process running (your PC, Railway, Render, etc.).
 * Never put DISCORD_TOKEN in the public website.
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  MessageFlags
} = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase config in .env");
  process.exit(1);
}

/** Only one bot process at a time — duplicates race slash commands (10062 Unknown interaction). */
const LOCK_PATH = path.join(__dirname, ".bot.lock");
function acquireSingletonLock() {
  try {
    if (fs.existsSync(LOCK_PATH)) {
      const prev = Number(String(fs.readFileSync(LOCK_PATH, "utf8") || "").trim());
      if (Number.isFinite(prev) && prev > 0) {
        try {
          process.kill(prev, 0); // throws if not running
          console.error(
            `Another My Games LINK bot is already running (pid ${prev}). Stop it first.`
          );
          process.exit(1);
        } catch {
          // stale lock
        }
      }
    }
    fs.writeFileSync(LOCK_PATH, String(process.pid), "utf8");
  } catch (err) {
    console.warn("lock warning", err?.message || err);
  }
  const clear = () => {
    try {
      if (fs.existsSync(LOCK_PATH) && String(fs.readFileSync(LOCK_PATH, "utf8")).trim() === String(process.pid)) {
        fs.unlinkSync(LOCK_PATH);
      }
    } catch {}
  };
  process.on("exit", clear);
  process.on("SIGINT", () => {
    clear();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    clear();
    process.exit(0);
  });
}
acquireSingletonLock();

function normalizePlayerCode(raw) {
  return String(raw || "")
    .toUpperCase()
    .replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, "")
    .slice(0, 8);
}

function formatPlayerCode(norm) {
  const n = normalizePlayerCode(norm);
  return n.length === 8 ? `${n.slice(0, 4)}-${n.slice(4)}` : n;
}

function sanitizeName(raw) {
  return String(raw || "")
    .replace(/[<>&"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
}

function cleanDiscordLabel(raw) {
  return String(raw || "")
    .replace(/[<>&"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*\([^)]*\)\s*$/, "") // drop previous " (hub)" suffix
    .trim();
}

/**
 * Left side of nick = Discord profile name (e.g. ice_dragon alt).
 * Never use the current server nickname — that may already be an old hub-only link.
 */
function discordDisplayName(interaction, hubName) {
  const user = interaction?.user;
  const hub = sanitizeName(hubName).toLowerCase();
  const global = cleanDiscordLabel(user?.globalName);
  const username = cleanDiscordLabel(user?.username);
  for (const candidate of [global, username]) {
    if (!candidate) continue;
    if (hub && candidate.toLowerCase() === hub) continue;
    return candidate;
  }
  return global || username || "Player";
}

/**
 * `DiscordName (HubUsername)` e.g. `ice_dragon alt (ICE_DRAGON PHONE)`.
 * Discord nicknames max 32 chars — keep Discord name; shrink hub in () if needed.
 */
function buildLinkedNickname(discordName, hubName) {
  let base = cleanDiscordLabel(discordName) || "Player";
  let hub = sanitizeName(hubName) || "Player";
  let nick = `${base} (${hub})`;
  if (nick.length > 32) {
    const maxHub = 32 - base.length - 3; // space + ( + )
    if (maxHub >= 2) {
      hub = hub.slice(0, maxHub);
      nick = `${base} (${hub})`;
    } else {
      base = base.slice(0, Math.max(1, 32 - hub.length - 3));
      nick = `${base} (${hub})`;
    }
  }
  return nick.slice(0, 32);
}

async function getHubDoc(id) {
  const url = `${SUPABASE_URL}/rest/v1/hub_docs?id=eq.${encodeURIComponent(id)}&select=data`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0]?.data ?? null;
}

async function resolveCodeToUsername(rawCode) {
  const code = normalizePlayerCode(rawCode);
  if (code.length !== 8) {
    return { ok: false, error: "Enter your full 8-character player code (like ABCD-EFGH)." };
  }

  const codesDoc = await getHubDoc("player-codes");
  const codes =
    codesDoc && codesDoc.codes && typeof codesDoc.codes === "object"
      ? codesDoc.codes
      : codesDoc && typeof codesDoc === "object"
        ? codesDoc
        : {};

  const entry =
    codes[code] ||
    codes[formatPlayerCode(code)] ||
    Object.entries(codes).find(([k]) => normalizePlayerCode(k) === code)?.[1] ||
    null;

  if (!entry || typeof entry !== "object" || !entry.playerId) {
    return {
      ok: false,
      error: `No account found for ${formatPlayerCode(code)}. Open the hub, copy your player code from Settings, then try again.`
    };
  }

  const playerId = String(entry.playerId);
  let name = sanitizeName(entry.name || "");

  if (!name) {
    const namesDoc = await getHubDoc("name-registry");
    const names =
      namesDoc && namesDoc.names && typeof namesDoc.names === "object"
        ? namesDoc.names
        : namesDoc && typeof namesDoc === "object"
          ? namesDoc
          : {};
    for (const claim of Object.values(names)) {
      if (claim && claim.playerId === playerId && claim.name) {
        name = sanitizeName(claim.name);
        break;
      }
    }
  }

  if (!name || /^guest-/i.test(name) || name.toLowerCase() === "player") {
    return {
      ok: false,
      error: "That code exists, but has no real username yet. Claim a nickname on the hub first."
    };
  }

  return { ok: true, code: formatPlayerCode(code), playerId, name };
}

async function saveDiscordLink(discordId, payload) {
  try {
    const prev = (await getHubDoc("discord-links-v1")) || { byDiscord: {}, byPlayer: {} };
    const byDiscord =
      prev.byDiscord && typeof prev.byDiscord === "object" ? { ...prev.byDiscord } : {};
    const byPlayer =
      prev.byPlayer && typeof prev.byPlayer === "object" ? { ...prev.byPlayer } : {};
    byDiscord[String(discordId)] = {
      ...payload,
      at: Date.now()
    };
    if (payload.playerId) {
      byPlayer[String(payload.playerId)] = {
        discordId: String(discordId),
        name: payload.name,
        code: payload.code,
        at: Date.now()
      };
    }
    const url = `${SUPABASE_URL}/rest/v1/hub_docs`;
    await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify({
        id: "discord-links-v1",
        data: { byDiscord, byPlayer },
        updated_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn("[link] saveDiscordLink failed", err?.message || err);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember]
});

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  if (guildId) console.log(`Target guild: ${guildId}`);
});

async function safeEdit(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    console.warn("reply failed", err?.code || err?.message || err);
  }
}

async function ack(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  } catch (err) {
    console.warn("defer failed", err?.code || err?.message || err);
    return false;
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "unlink") {
      if (!(await ack(interaction))) return;
      try {
        const member = interaction.member;
        if (!member || typeof member.setNickname !== "function") {
          await safeEdit(interaction, "Couldn't access your member profile.");
          return;
        }
        if (interaction.guild?.ownerId === interaction.user.id) {
          await safeEdit(
            interaction,
            "Discord does not allow bots to clear the **server owner's** nickname. Clear it yourself in Discord (server profile → nickname)."
          );
          return;
        }
        await member.setNickname(null, "My Games /unlink");
        await safeEdit(interaction, "Nickname cleared on this server.");
      } catch (err) {
        console.warn("/unlink failed", err?.code || err?.message || err);
        await safeEdit(
          interaction,
          "Couldn't clear your nickname. Make sure the bot role is above yours and has **Manage Nicknames**."
        );
      }
      return;
    }

    if (interaction.commandName !== "link") return;
    if (!(await ack(interaction))) return;

    const raw = interaction.options.getString("code", true);

    try {
      const resolved = await resolveCodeToUsername(raw);
      if (!resolved.ok) {
        await safeEdit(interaction, resolved.error);
        return;
      }

      const member = interaction.member;
      if (!member || typeof member.setNickname !== "function") {
        await safeEdit(interaction, "Couldn't access your member profile in this server.");
        return;
      }

      // DiscordName (HubUsername) — e.g. ice_dragon alt (ICE_DRAGON PHONE)
      const discordName = discordDisplayName(interaction, resolved.name);
      const nick = buildLinkedNickname(discordName, resolved.name);
      console.log(
        `/link nick for ${interaction.user.id}: discord="${discordName}" hub="${resolved.name}" -> "${nick}"`
      );
      const payload = {
        discordId: interaction.user.id,
        discordTag: interaction.user.tag,
        playerId: resolved.playerId,
        name: resolved.name,
        code: resolved.code,
        nick,
        discordName
      };

      // Always save the account link, even if Discord blocks the nickname.
      await saveDiscordLink(interaction.user.id, payload);

      const isOwner = interaction.guild?.ownerId === interaction.user.id;
      if (isOwner) {
        await safeEdit(
          interaction,
          `Account linked as **${resolved.name}** (code ${resolved.code}).\n` +
            `Discord **blocks bots from changing the server owner's nickname**.\n` +
            `Set it yourself to: \`${nick}\`\n` +
            `(Server profile → Edit server profile → Nickname)`
        );
        return;
      }

      try {
        await member.setNickname(nick, `My Games /link ${resolved.code}`);
      } catch (err) {
        console.warn("/link nick failed", err?.code || err?.message || err);
        const msg = String(err?.message || err);
        if (/Missing Permissions|hierarchy|nickname|50013/i.test(msg)) {
          await safeEdit(
            interaction,
            `Account linked as **${resolved.name}**, but Discord blocked the nickname change.\n` +
              `Put the **MY GAMES LINK** role above members and enable **Manage Nicknames**.\n` +
              `Target nickname: \`${nick}\``
          );
          return;
        }
        throw err;
      }

      await safeEdit(
        interaction,
        `Linked! Your Discord nickname is now **${nick}** (code ${resolved.code}).`
      );
    } catch (err) {
      console.warn("/link failed", err?.code || err?.message || err);
      await safeEdit(interaction, "Something went wrong looking up that code. Try again in a moment.");
    }
  } catch (err) {
    // Never let a bad interaction kill the whole bot process.
    console.warn("interaction handler error", err?.code || err?.message || err);
  }
});

client.on("error", (err) => {
  console.warn("client error", err?.code || err?.message || err);
});

process.on("unhandledRejection", (err) => {
  console.warn("unhandledRejection", err?.code || err?.message || err);
});

client.login(token).catch((err) => {
  console.error("Login failed", err);
  process.exit(1);
});
