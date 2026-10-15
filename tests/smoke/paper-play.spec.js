"use strict";

const { test, expect } = require("@playwright/test");

test("Paper Claim starts and keeps rendering", async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem("hub-player-id", "p-paper-smoke");
    localStorage.setItem("hub-player-code", "PAPER-SMOKE-CODE");
    localStorage.setItem("hub-player-name", "PaperSmoke");
    localStorage.setItem("hub-player-name-locked", "1");
    localStorage.setItem("hub-sound-enabled", "0");
  });

  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/paper-io/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await page.locator("#start-btn").click();
  await expect(page.locator("#overlay")).toHaveClass(/hidden/);

  const frameMetrics = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const deltas = [];
        const started = performance.now();
        let previous = started;
        function frame(now) {
          deltas.push(now - previous);
          previous = now;
          if (now - started >= 2000) {
            const sorted = deltas.slice(1).sort((a, b) => a - b);
            const p75 = sorted[Math.floor(sorted.length * 0.75)] || 1000;
            resolve({ count: deltas.length, p75Fps: 1000 / p75 });
          } else {
            requestAnimationFrame(frame);
          }
        }
        requestAnimationFrame(frame);
      })
  );

  expect(frameMetrics.count).toBeGreaterThan(60);
  // Playwright records failure video in software-rendered headless Chromium,
  // which is commonly capped near 30 FPS on CI. This smoke gate catches stalls;
  // the separate performance profile owns the 55 FPS device target.
  expect(frameMetrics.p75Fps).toBeGreaterThan(25);
  await expect(page.locator("#score")).toContainText("%");
  expect(pageErrors).toEqual([]);
});
