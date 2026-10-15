"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const discord = require(path.resolve(__dirname, "../../hub-discord.js"));
const supabase = require(path.resolve(__dirname, "../../hub-supabase.js"));

test("Discord OAuth prefers identity link so the guest Auth user is upgraded", () => {
  const redirect = "https://icedragon1st.github.io/?discord_auth=1";
  assert.match(discord.signInAuthorizeUrl(redirect), /\/auth\/v1\/authorize\?provider=discord/);
  assert.match(
    discord.linkAuthorizeUrl(redirect),
    /\/auth\/v1\/user\/identities\/authorize\?provider=discord/
  );
  assert.match(discord.linkAuthorizeUrl(redirect), /redirect_to=/);
  assert.equal(typeof supabase.adoptSession, "function");
});

test("Discord callback tokens and identities stay attached to the local player", () => {
  const parsed = discord.parseAuthCallback(
    "https://icedragon1st.github.io/?discord_auth=1#access_token=abc&refresh_token=def&provider_token=xyz"
  );
  assert.equal(parsed.access, "abc");
  assert.equal(parsed.refresh, "def");
  assert.equal(parsed.fromDiscord, true);
  assert.equal(parsed.error, "");

  const ident = discord.discordIdentityFromUser({
    id: "11111111-2222-3333-4444-555555555555",
    identities: [
      {
        provider: "discord",
        id: "123456789012345678",
        identity_data: {
          full_name: "Ice#1234",
          custom_claims: { global_name: "ICE_DRAGON" },
          avatar_url: "https://cdn.discordapp.com/avatars/1.png"
        }
      }
    ],
    user_metadata: {}
  });
  assert.equal(ident.discordId, "123456789012345678");
  assert.equal(ident.username, "Ice");
  assert.equal(ident.globalName, "ICE_DRAGON");
  assert.equal(discord.discordIdentityFromUser({ identities: [] }), null);
  assert.equal(discord.discordIdentityFromUser(null), null);
});
