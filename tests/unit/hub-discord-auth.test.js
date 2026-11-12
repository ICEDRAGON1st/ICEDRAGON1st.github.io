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

test("hub updates post to Discord at publish time without leftover shared boards", async () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(path.resolve(__dirname, "../../hub-discord.js"), "utf8");
  const announce = fs.readFileSync(path.resolve(__dirname, "../../tools/announce-hub-update.js"), "utf8");
  const boot = fs.readFileSync(path.resolve(__dirname, "../../script.js"), "utf8");
  assert.doesNotMatch(src, /hub_docs|hub-discord-site-updates/);
  assert.match(src, /publish-announces/);
  assert.doesNotMatch(
    src.slice(src.indexOf("async function maybeAnnounceHubBuild"), src.indexOf("const api = {")),
    /announceSiteUpdate/
  );
  assert.doesNotMatch(announce, /hub_docs|hub-discord-site-updates/);
  assert.match(announce, /ok announced/);
  assert.match(boot, /announceHubBuildOnBoot/);
  const result = await discord.maybeAnnounceHubBuild("20261015ex", ["note"]);
  assert.equal(result.ok, false);
  assert.equal(result.reason === "publish-announces" || result.reason === "no-webhook", true);
});
