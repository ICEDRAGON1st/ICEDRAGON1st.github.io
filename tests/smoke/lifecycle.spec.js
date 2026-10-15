"use strict";

const { test, expect } = require("@playwright/test");

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

test("Stacker pauses when the tab is hidden", async ({ page }) => {
  await page.goto("/stacker/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    {
      timeout: 20_000
    }
  );
  await page.waitForFunction(
    () => Boolean(window.HubAfk) && typeof window.HubLifecycle?.onHiddenPause === "function"
  );

  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#overlay")).toHaveClass(/hidden/);

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));

  await expect(page.locator("#overlay")).not.toHaveClass(/hidden/);
  await expect(page.locator("#overlay")).toContainText(/paused/i);
});
