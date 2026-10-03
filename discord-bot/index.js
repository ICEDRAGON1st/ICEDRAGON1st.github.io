/**
 * My Games Discord link bot
 * /link CODE  → look up hub username → set server nickname
 * /unlink     → clear nickname override
 *
 * Keep this process running (your PC, Railway, Render, etc.).
 * Never put DISCORD_TOKEN in the public website.
 */
require("dotenv").config();

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

/** Discord display name for nick prefix (not the hub username). */
function discordDisplayName(interaction) {
  const user = interaction?.user;
  const global = String(user?.globalName || "").trim();
  const username = String(user?.username || "").trim();
  return sanitizeName(global || username) || "Player";
}

/**
 * Keep Discord name, append hub username: `ICE_DRAGON (ICE_DRAGON)`.
 * Discord nicknames max 32 chars.
 */
function buildLinkedNickname(discordName, hubName) {
  const hub = sanitizeName(hubName) || "Player";
  const suffix = ` (${hub})`;
  const maxBase = Math.max(1, 32 - suffix.length);
  let base = sanitizeName(discordName) || "Player";
  // Drop a previous " (hub)" suffix if someone re-links.
  base = base.replace(/\s*\([^)]*\)\s*$/, "").trim() || "Player";
  base = base.slice(0, maxBase);
  return `${base}${suffix}`.slice(0, 32);
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
      await interaction.editReply(content);
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    console.warn("reply failed", err?.code || err?.message || err);
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "unlink") {
      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (err) {
        console.warn("/unlink defer failed", err?.code || err?.message || err);
        return;
      }
      try {
        const member = interaction.member;
        if (!member || typeof member.setNickname !== "function") {
          await safeEdit(interaction, "Couldn't access your member profile.");
          return;
        }
        await member.setNickname(null, "My Games /unlink");
        await safeEdit(interaction, "Nickname cleared on this server.");
      } catch (err) {
        console.warn("/unlink failed", err);
        await safeEdit(
          interaction,
          "Couldn't clear your nickname. Make sure the bot role is above yours and has **Manage Nicknames**."
        );
      }
      return;
    }

    if (interaction.commandName !== "link") return;

    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.warn("/link defer failed", err?.code || err?.message || err);
      return;
    }

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

      // Keep Discord name + hub username in parentheses: ICE_DRAGON (ICE_DRAGON)
      const nick = buildLinkedNickname(discordDisplayName(interaction), resolved.name);
      await member.setNickname(nick, `My Games /link ${resolved.code}`);
      await saveDiscordLink(interaction.user.id, {
        discordId: interaction.user.id,
        discordTag: interaction.user.tag,
        playerId: resolved.playerId,
        name: resolved.name,
        code: resolved.code,
        nick
      });

      await safeEdit(
        interaction,
        `Linked! Your Discord nickname is now **${nick}** (code ${resolved.code}).`
      );
    } catch (err) {
      console.warn("/link failed", err);
      const msg = String(err?.message || err);
      if (/Missing Permissions|hierarchy|nickname/i.test(msg)) {
        await safeEdit(
          interaction,
          "Found your account, but Discord blocked the nickname change. Drag the bot's role **above** member roles and give it **Manage Nicknames**."
        );
        return;
      }
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
