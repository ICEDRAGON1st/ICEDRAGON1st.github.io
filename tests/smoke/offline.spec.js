"use strict";

const { test, expect } = require("@playwright/test");

test("visited hub and game remain playable offline without changing saves", async ({
  context,
  page
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await page.evaluate(() => localStorage.setItem("offline-smoke-save", "preserved"));
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));

  await page.goto("/paper-io/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await expect(page.locator("#start-btn")).toBeVisible();

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await expect(page.locator("#start-btn")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("offline-smoke-save")))
    .toBe("preserved");

  await context.setOffline(false);
  expect(pageErrors).toEqual([]);
});
