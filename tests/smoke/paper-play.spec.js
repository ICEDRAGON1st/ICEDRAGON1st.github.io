"use strict";

const { test, expect } = require("@playwright/test");

test("Paper Claim starts and keeps rendering", async ({ context, page }) => {
  const deferredSocialScripts = /\/hub-(?:friends|chat|calls|leaderboard)\.js$/;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      if (deferredSocialScripts.test(url.pathname)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
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
  const socialResponses = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (deferredSocialScripts.test(new URL(response.url()).pathname)) {
      socialResponses.push(response.url());
    }
  });

  await page.goto("/paper-io/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  expect(socialResponses).toEqual([]);
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
  await expect.poll(() => page.evaluate(() => Boolean(window.HubLeaderboard))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.HubFriends))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.HubChat))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.HubCalls))).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("Paper Claim honors reduced-effects preference", async ({ context, page }) => {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("hub-player-id", "p-paper-reduced-test");
    localStorage.setItem("hub-player-name", "PaperReducedTest");
    localStorage.setItem("hub-player-name-locked", "1");
    localStorage.setItem("hub-sound-enabled", "0");
  });

  await page.goto("/paper-io/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await expect(page.locator("html")).toHaveAttribute("data-paper-effects", "reduced");
  await page.locator("#start-btn").click();
  await expect(page.locator("#score")).toContainText("%");
});
