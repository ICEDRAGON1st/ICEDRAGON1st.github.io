"use strict";

const { test, expect } = require("@playwright/test");

async function isolateFromExternalServices(context) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
}

async function seedPlayer(page) {
  await page.addInitScript(() => {
    localStorage.setItem("hub-player-id", "p-performance-test");
    localStorage.setItem("hub-player-code", "PERFORMANCE-TEST");
    localStorage.setItem("hub-player-name", "PerformanceTest");
    localStorage.setItem("hub-player-name-locked", "1");
    localStorage.setItem("hub-sound-enabled", "0");
  });
}

async function emulateColdFast3G(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    connectionType: "cellular3g"
  });
}

test("hub critical path stays within its script budget", async ({ context, page }) => {
  await isolateFromExternalServices(context);
  await seedPlayer(page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Number.isFinite(window.__myGamesInteractiveAt), null, {
    timeout: 20_000
  });

  const metrics = await page.evaluate(() => {
    const interactiveAt = window.__myGamesInteractiveAt;
    const scripts = performance
      .getEntriesByType("resource")
      .filter((entry) => entry.initiatorType === "script" && entry.responseEnd <= interactiveAt)
      .map((entry) => ({
        path: new URL(entry.name).pathname,
        bytes: entry.decodedBodySize || entry.transferSize || 0
      }));
    return {
      interactiveAt,
      scriptCount: new Set(scripts.map((entry) => entry.path)).size,
      scriptBytes: scripts.reduce((total, entry) => total + entry.bytes, 0),
      scripts
    };
  });

  expect(metrics.scriptCount, JSON.stringify(metrics.scripts)).toBeLessThanOrEqual(17);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-games.js"))).toBe(true);
  expect(metrics.scriptBytes, JSON.stringify(metrics.scripts)).toBeLessThan(1_000_000);
  expect(metrics.interactiveAt).toBeLessThan(6_000);
  expect(metrics.scripts.some((entry) => /\/dictionary(?:-|\.js)/.test(entry.path))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-help.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-help-info.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-admin.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-call-signal.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-calls.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-leaderboard-pbs.js"))).toBe(
    false
  );
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-friends-edges.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-chat-mine.js"))).toBe(false);
});

test("cold hub reaches its shell within the Fast 3G budget", async ({ context, page }) => {
  await isolateFromExternalServices(context);
  await seedPlayer(page);
  await emulateColdFast3G(context, page);

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Number.isFinite(window.__myGamesInteractiveAt), null, {
    timeout: 20_000
  });

  const metrics = await page.evaluate(() => ({
    interactiveAt: window.__myGamesInteractiveAt,
    transferBytes: performance
      .getEntriesByType("resource")
      .filter((entry) => entry.responseEnd <= window.__myGamesInteractiveAt)
      .reduce((total, entry) => total + (entry.transferSize || 0), 0)
  }));

  expect(metrics.interactiveAt, JSON.stringify(metrics)).toBeLessThan(4_500);
});

for (const target of [
  { name: "small game", path: "/snake/" },
  { name: "Paper Claim", path: "/paper-io/" }
]) {
  test(`${target.name} reaches its cold Fast 3G shell within budget`, async ({ context, page }) => {
    await isolateFromExternalServices(context);
    await seedPlayer(page);
    await emulateColdFast3G(context, page);

    await page.goto(target.path, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.documentElement.classList.contains("hub-booting"),
      null,
      { timeout: 20_000 }
    );
    const metrics = await page.evaluate(() => ({
      interactiveAt: performance.now(),
      resources: performance
        .getEntriesByType("resource")
        .filter((entry) => entry.startTime < 2_000)
        .map((entry) => ({
          path: new URL(entry.name).pathname,
          type: entry.initiatorType,
          start: Math.round(entry.startTime),
          end: Math.round(entry.responseEnd),
          duration: Math.round(entry.duration),
          bytes: entry.transferSize || 0
        }))
        .sort((a, b) => b.end - a.end)
        .slice(0, 20)
    }));

    expect(metrics.interactiveAt, `${target.path} metrics ${JSON.stringify(metrics)}`).toBeLessThan(
      2_500
    );
  });
}
