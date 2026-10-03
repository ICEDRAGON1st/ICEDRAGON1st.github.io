# My Games Discord /link bot

Links a hub **player code** to a Discord nickname.

## Setup

1. Copy `.env.example` → `.env` and fill in:
   - `DISCORD_TOKEN` — Bot token from Developer Portal
   - `DISCORD_CLIENT_ID` — Application ID (Developer Portal → General Information)
   - `DISCORD_GUILD_ID` — your server ID
2. Invite the bot with scopes `bot` + `applications.commands` and permission **Manage Nicknames**.
3. Server Settings → Roles → put the bot role **above** members.
4. Install & register & run:

```bash
cd discord-bot
npm install
npm run register
npm start
```

Keep **one** `npm start` running (or host it on Railway / Render). Do not start the bot twice — duplicate processes break `/link`. Slash commands only work while the bot is online.

In Discord Developer Portal → your app → **General Information**, leave **Interactions Endpoint URL** empty (gateway bot only).

## Commands

- `/link code:ABCD-EFGH` — set nickname to `DiscordName (HubUsername)` (e.g. `ICE_DRAGON (ICE_DRAGON)`)
- `/unlink` — clear the nickname override
