/**
 * Register /link as a guild slash command (instant).
 * Usage: node register-commands.js
 */
require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in .env");
  process.exit(1);
}

const body = [
  {
    name: "link",
    description: "Link your My Games player code — sets your Discord nickname to your hub username",
    options: [
      {
        type: 3,
        name: "code",
        description: "Your 8-character player code (e.g. ABCD-EFGH)",
        required: true
      }
    ]
  },
  {
    name: "unlink",
    description: "Clear the linked My Games nickname override on this server",
    options: []
  }
];

async function main() {
  const url = `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Register failed", res.status, text);
    process.exit(1);
  }
  console.log("Slash commands registered for guild", guildId);
  console.log(text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
