"use strict";

const { test, expect } = require("@playwright/test");

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2
});

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
    localStorage.setItem("hub-player-id", "p-mobile-smoke");
    localStorage.setItem("hub-player-code", "MOBILE-SMOKE");
    localStorage.setItem("hub-player-name", "MobileSmoke");
    localStorage.setItem("hub-player-name-locked", "1");
    localStorage.setItem("hub-sound-enabled", "0");
  });
});

for (const target of [
  { name: "hub", path: "/" },
  { name: "Paper Claim", path: "/paper-io/" },
  { name: "Fishing Idle", path: "/fishing/" }
]) {
  test(`${target.name} fits a phone viewport`, async ({ page }) => {
    await page.goto(target.path, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => !document.documentElement.classList.contains("hub-booting"),
      null,
      { timeout: 20_000 }
    );

    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth - window.innerWidth,
      body: document.body.scrollWidth - window.innerWidth
    }));
    expect(overflow.document).toBeLessThanOrEqual(2);
    expect(overflow.body).toBeLessThanOrEqual(2);
  });
}
