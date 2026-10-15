"use strict";

const { test, expect } = require("@playwright/test");

const PAGES = [
  { name: "hub", path: "/" },
  { name: "small game", path: "/snake/" },
  { name: "Paper Claim", path: "/paper-io/" },
  { name: "Fishing Idle", path: "/fishing/" },
  { name: "Mine Depth", path: "/mine/" },
  { name: "Dudes", path: "/dudes/" },
  { name: "Ramp Rush", path: "/ramp-rush/" }
];

test.beforeEach(async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("hub-player-id", "p-smoke-test");
    localStorage.setItem("hub-player-code", "SMOKE-TEST-CODE");
    localStorage.setItem("hub-player-name", "SmokeTest");
    localStorage.setItem("hub-player-name-locked", "1");
    localStorage.setItem("hub-sound-enabled", "0");
  });
});

for (const target of PAGES) {
  test(`${target.name} reaches an interactive shell`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      if (/ERR_FAILED|Failed to load resource|blockedbyclient/i.test(text)) return;
      errors.push(text);
    });

    const response = await page.goto(target.path, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${target.path} response`).toBeLessThan(400);
    await page.waitForFunction(
      () => !document.documentElement.classList.contains("hub-booting"),
      null,
      { timeout: 20_000 }
    );

    await expect(page.locator("body")).toBeVisible();
    await expect(page).toHaveTitle(/\S+/);
    expect(errors, `${target.path} browser errors`).toEqual([]);
  });
}

test("Guessword loads only the active dictionary pack", async ({ page }) => {
  const requestedPacks = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/(?:words|dictionary)(?:-[a-z0-9]+)*\.js$/i.test(path)) {
      requestedPacks.push(path);
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );

  expect(new Set(requestedPacks)).toEqual(new Set(["/words.js", "/dictionary.js"]));

  await page.evaluate(() => window.switchLanguage());
  await expect
    .poll(() => new Set(requestedPacks), { timeout: 10_000 })
    .toEqual(new Set(["/words.js", "/dictionary.js", "/words-da.js", "/dictionary-da.js"]));

  await page.evaluate(() => window.togglePlayMode());
  await page.evaluate(() => window.switchLength());
  await expect
    .poll(() => new Set(requestedPacks), { timeout: 10_000 })
    .toEqual(
      new Set([
        "/words.js",
        "/dictionary.js",
        "/words-da.js",
        "/dictionary-da.js",
        "/words-da-6.js",
        "/dictionary-da-6.js"
      ])
    );

  await page.evaluate(() => window.switchLanguage());
  await expect
    .poll(() => new Set(requestedPacks), { timeout: 10_000 })
    .toContain("/dictionary-is-6.js");

  requestedPacks.length = 0;
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  expect(new Set(requestedPacks)).toEqual(new Set(["/words-is-6.js", "/dictionary-is-6.js"]));
});

test("optional hub helpers load after the interactive shell", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  await page.waitForFunction(
    () =>
      window.HubOnlineOverlay &&
      window.HubHelp &&
      window.HubAdmin &&
      window.HubFishingGifts &&
      window.HubFishingMail,
    null,
    { timeout: 10_000 }
  );
});
