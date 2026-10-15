"use strict";

const { test, expect } = require("@playwright/test");

test("hub critical path stays within its script budget", async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("hub-player-id", "p-performance-test");
    localStorage.setItem("hub-player-code", "PERFORMANCE-TEST");
    localStorage.setItem("hub-player-name", "PerformanceTest");
    localStorage.setItem("hub-player-name-locked", "1");
    localStorage.setItem("hub-sound-enabled", "0");
  });

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

  expect(metrics.scriptCount, JSON.stringify(metrics.scripts)).toBeLessThanOrEqual(12);
  expect(metrics.scriptBytes, JSON.stringify(metrics.scripts)).toBeLessThan(1_000_000);
  expect(metrics.interactiveAt).toBeLessThan(6_000);
  expect(metrics.scripts.some((entry) => /\/dictionary(?:-|\.js)/.test(entry.path))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-help.js"))).toBe(false);
  expect(metrics.scripts.some((entry) => entry.path.endsWith("/hub-admin.js"))).toBe(false);
});
