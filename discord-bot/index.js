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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "unlink") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const member = interaction.member;
      if (!member || typeof member.setNickname !== "function") {
        await interaction.editReply("Couldn't access your member profile.");
        return;
      }
      await member.setNickname(null, "My Games /unlink");
      await interaction.editReply("Nickname cleared on this server.");
    } catch (err) {
      console.warn("/unlink failed", err);
      await interaction.editReply(
        "Couldn't clear your nickname. Make sure the bot role is above yours and has **Manage Nicknames**."
      );
    }
    return;
  }

  if (interaction.commandName !== "link") return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const raw = interaction.options.getString("code", true);

  try {
    const resolved = await resolveCodeToUsername(raw);
    if (!resolved.ok) {
      await interaction.editReply(resolved.error);
      return;
    }

    const member = interaction.member;
    if (!member || typeof member.setNickname !== "function") {
      await interaction.editReply("Couldn't access your member profile in this server.");
      return;
    }

    // Discord nicknames max 32; hub names are ≤16
    await member.setNickname(resolved.name, `My Games /link ${resolved.code}`);
    await saveDiscordLink(interaction.user.id, {
      discordId: interaction.user.id,
      discordTag: interaction.user.tag,
      playerId: resolved.playerId,
      name: resolved.name,
      code: resolved.code
    });

    await interaction.editReply(
      `Linked! Your Discord nickname is now **${resolved.name}** (code ${resolved.code}).`
    );
  } catch (err) {
    console.warn("/link failed", err);
    const msg = String(err?.message || err);
    if (/Missing Permissions|hierarchy|nickname/i.test(msg)) {
      await interaction.editReply(
        "Found your account, but Discord blocked the nickname change. Drag the bot's role **above** member roles and give it **Manage Nicknames**."
      );
      return;
    }
    await interaction.editReply("Something went wrong looking up that code. Try again in a moment.");
  }
});

client.login(token).catch((err) => {
  console.error("Login failed", err);
  process.exit(1);
});
