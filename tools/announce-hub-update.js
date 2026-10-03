/**
 * Post the current WORDLE_BUILD changelog to Discord #updates (and claim via Supabase)
 * so announcements go out at publish time — no one has to refresh the hub.
 *
 * Usage: node tools/announce-hub-update.js [buildId]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SUPABASE_URL = "https://clkamsflzyvdcepvelks.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsa2Ftc2Zsenl2ZGNlcHZlbGtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxNjE3ODEsImV4cCI6MjEwNTczNzc4MX0.s-k2d37X0gByK2-SLnsLWhkbQb15_sDuKpvZs7ABM3g";
const DOC_ID = "hub-discord-site-updates";

function readPrivateUpdatesWebhook() {
  const fromEnv = String(process.env.DISCORD_UPDATES_WEBHOOK || "").trim();
  if (fromEnv) return fromEnv;
  const localPath = path.join(__dirname, "discord-secrets.local.js");
  if (!fs.existsSync(localPath)) return "";
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const local = require(localPath);
    return String(local?.webhookUpdatesUrl || "").trim();
  } catch {
    return "";
  }
}

function readSiteConfig() {
  const src = fs.readFileSync(path.join(ROOT, "site-config.js"), "utf8");
  // Prefer private local/env webhook — never rely on the public site-config URL
  // (scrapers steal webhooks from GitHub Pages and spam #updates).
  const webhook =
    readPrivateUpdatesWebhook() ||
    /webhookUpdatesUrl:\s*\n?\s*"([^"]+)"/.exec(src)?.[1] ||
    /webhookUpdatesUrl:\s*"([^"]+)"/.exec(src)?.[1] ||
    "";
  const roleId = /updatesRoleId:\s*"([^"]+)"/.exec(src)?.[1] || "";
  const domain = /domain:\s*"([^"]+)"/.exec(src)?.[1] || "icedragon1st.github.io";
  return { webhook, roleId, domain };
}

function readBuild() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  return /WORDLE_BUILD\s*=\s*"([^"]+)"/.exec(html)?.[1] || "";
}

function readChangelog() {
  const src = fs.readFileSync(path.join(ROOT, "script.js"), "utf8");
  const m = src.match(/const CHANGELOG = (\{\r?\n[\s\S]*?\r?\n\});/);
  if (!m) return {};
  try {
    return Function(`"use strict"; return (${m[1]});`)();
  } catch {
    return {};
  }
}

function homeUrl(domain) {
  const host = String(domain || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  if (host) return `https://${host}/`;
  return "https://icedragon1st.github.io/";
}

function formatMessage(build, notes, roleId, domain) {
  const bullets = notes
    .slice(0, 12)
    .map((n) => `• ${n}`)
    .join("\n");
  const ping = roleId ? `<@&${roleId}> ` : "";
  return `${ping}**My Games update${build ? ` · \`${build}\`` : ""}**\n${bullets || "• Site update"}\n${homeUrl(domain)}`;
}

async function readClaim() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/hub_docs?id=eq.${encodeURIComponent(DOC_ID)}&select=data`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json"
      },
      cache: "no-store"
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.data && typeof rows[0].data === "object" ? rows[0].data : null;
}

async function writeClaim(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/hub_docs`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: DOC_ID,
      data,
      updated_at: new Date().toISOString()
    })
  });
  return res.ok;
}

async function postWebhook(webhook, content, roleId) {
  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: String(content).slice(0, 1900),
      username: "My Games Updates",
      allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] }
    })
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`discord ${res.status} ${await res.text()}`);
  }
}

function buildRank(id) {
  const m = /^(\d+)([a-z]*)$/i.exec(String(id || "").trim());
  if (!m) return [0, 0, String(id || "")];
  const letters = m[2].toLowerCase();
  let n = 0;
  for (let i = 0; i < letters.length; i += 1) {
    n = n * 26 + (letters.charCodeAt(i) - 96);
  }
  return [Number(m[1]) || 0, n, String(id || "")];
}

function alreadyAnnounced(last, build) {
  if (!last) return false;
  if (last === build) return true;
  const [ld, ls] = buildRank(last);
  const [bd, bs] = buildRank(build);
  if (ld !== bd) return ld > bd;
  return ls >= bs;
}

async function main() {
  const args = process.argv.slice(2).map((a) => String(a || "").trim());
  const force = args.includes("--force");
  const argBuild = args.find((a) => a && a !== "--force") || "";
  const build = argBuild || readBuild();
  const changelog = readChangelog();
  const notes = Array.isArray(changelog[build])
    ? changelog[build].map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  const { webhook, roleId, domain } = readSiteConfig();

  if (!build) {
    console.error("no WORDLE_BUILD");
    process.exit(1);
  }
  if (!notes.length) {
    console.log("skip — no changelog notes for", build);
    return;
  }
  if (!webhook) {
    console.error("no webhookUpdatesUrl in site-config.js");
    process.exit(1);
  }

  const existing = await readClaim();
  const last = String(existing?.lastBuild || "");
  if (!force && alreadyAnnounced(last, build)) {
    console.log("skip — already announced", last, ">=", build);
    return;
  }

  const claimed = await writeClaim({
    lastBuild: build,
    at: Date.now(),
    notes: notes.slice(0, 12)
  });
  if (!claimed) {
    console.error("claim failed");
    process.exit(1);
  }

  await postWebhook(webhook, formatMessage(build, notes, roleId, domain), roleId);
  console.log("ok announced", build, `(${notes.length} notes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
