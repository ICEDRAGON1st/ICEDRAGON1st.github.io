/**
 * Post the current WORDLE_BUILD changelog to Discord #updates at publish time.
 * Leftover shared boards are not used as a lock — browsers do not post this.
 *
 * Usage: node tools/announce-hub-update.js [buildId]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

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
  try {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, "changelog.json"), "utf8"));
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
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

async function main() {
  const args = process.argv.slice(2).map((a) => String(a || "").trim());
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

  await postWebhook(webhook, formatMessage(build, notes, roleId, domain), roleId);
  console.log("ok announced", build, `(${notes.length} notes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
