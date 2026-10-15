"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { test, expect } = require("@playwright/test");

const ROOT = path.resolve(__dirname, "../..");
const PAGES = [
  { name: "hub", path: "/" },
  ...fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      file: path.join(ROOT, entry.name, "index.html"),
      path: `/${entry.name}/`
    }))
    .filter((target) => fs.existsSync(target.file))
    .filter((target) => /hub-game-boot\.js/i.test(fs.readFileSync(target.file, "utf8")))
    .map(({ name, path: route }) => ({ name, path: route }))
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
    if (target.path !== "/") {
      await expect
        .poll(
          () =>
            page.evaluate(() => ({
              net: Boolean(window.HubNet),
              afk: Boolean(window.HubAfk),
              coins: Boolean(window.HubCoins),
              sound: Boolean(window.HubSound),
              audio: Boolean(window.HubAudio)
            })),
          { message: `${target.path} shared boot modules` }
        )
        .toEqual({
          net: true,
          afk: true,
          coins: true,
          sound: true,
          audio: true
        });
    }
    expect(errors, `${target.path} browser errors`).toEqual([]);
  });
}

test("Fishing restores deferred social integrations after its shell", async ({ page }) => {
  await page.goto("/fishing/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));

  await expect.poll(() => page.evaluate(() => Boolean(window.HubLeaderboard))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.HubFriends))).toBe(true);
  await expect.poll(() => page.evaluate(() => Boolean(window.HubDiscord))).toBe(true);
});

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

  expect(requestedPacks).toEqual([]);

  await page.evaluate(() => window.selectGame("wordle"));
  await expect
    .poll(() => new Set(requestedPacks), { timeout: 10_000 })
    .toEqual(new Set(["/words.js", "/dictionary.js"]));

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
  await page.goto("/?smoke=deep-link#wordle", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  await expect
    .poll(
      () =>
        page.evaluate(
          "typeof WORDS_IS_6 !== 'undefined' && typeof VALID_GUESSES_IS_6 !== 'undefined' && " +
            "Array.isArray(WORDS_IS_6) && VALID_GUESSES_IS_6 instanceof Set && " +
            "typeof WORDS_IS === 'undefined'"
        ),
      { timeout: 10_000 }
    )
    .toBe(true);
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
      window.HubHelpInfo &&
      window.HubHelp &&
      window.HubAdmin &&
      window.HubFishingGifts &&
      window.HubFishingMail &&
      window.HubCoins &&
      window.HubLeaderboardPbs &&
      window.HubLeaderboard &&
      window.HubFriendsEdges &&
      window.HubFriends &&
      window.HubChatMine &&
      window.HubChat &&
      window.HubOnlineMatchMine &&
      window.HubOnlineMatch &&
      window.HubNotificationsMine &&
      window.HubNotifications &&
      window.HubCallSignal &&
      window.HubCalls,
    null,
    { timeout: 10_000 }
  );
});

test("canvas games expose a screen-reader control alternative", async ({ page }) => {
  await page.goto("/snake/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector("canvas#game");
        const alt = document.getElementById("hub-canvas-alt");
        return Boolean(
          window.HubCanvasAlt &&
          canvas &&
          alt &&
          canvas.getAttribute("aria-describedby") === "hub-canvas-alt" &&
          /arrow keys or WASD/i.test(alt.textContent || "")
        );
      })
    )
    .toBe(true);
});

test("non-canvas games skip the canvas alternative", async ({ page }) => {
  await page.goto("/fishing/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("hub-booting"));
  await expect.poll(() => page.evaluate(() => Boolean(window.HubCanvasAlt))).toBe(true);
  expect(await page.locator("#hub-canvas-alt").count()).toBe(0);
});

test("hub keeps the seeded player id instead of reminting from Auth", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  await page.waitForFunction(() => Boolean(window.HubSupabase?.peekBoundPlayerId), null, {
    timeout: 10_000
  });
  const ids = await page.evaluate(() => ({
    stored: localStorage.getItem("hub-player-id"),
    plays: window.HubPlays?.getPlayerId?.() || ""
  }));
  expect(ids.stored).toBe("p-smoke-test");
  expect(ids.plays).toBe("p-smoke-test");
});

test("Discord login upgrades the current guest session instead of minting a second user", async ({
  page
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  await page.waitForFunction(
    () =>
      typeof window.HubDiscord?.linkAuthorizeUrl === "function" &&
      typeof window.HubSupabase?.adoptSession === "function",
    null,
    { timeout: 10_000 }
  );
  const urls = await page.evaluate(() => {
    const redirect = "https://icedragon1st.github.io/?discord_auth=1";
    return {
      link: window.HubDiscord.linkAuthorizeUrl(redirect),
      signin: window.HubDiscord.signInAuthorizeUrl(redirect)
    };
  });
  expect(urls.link).toContain("/auth/v1/user/identities/authorize?provider=discord");
  expect(urls.signin).toContain("/auth/v1/authorize?provider=discord");
});

test("Help answers owner from the extracted GAME_INFO helper", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  await page.waitForFunction(
    () =>
      window.HubHelpInfo &&
      window.HubHelp &&
      window.HubHelp.ready &&
      window.HubHelp.ready() &&
      window.HubHelp.getGameInfo &&
      window.HubHelp.getGameInfo().owner,
    null,
    { timeout: 10_000 }
  );
  await page.evaluate(() => {
    window.HubHelp.open();
    window.HubHelp.ask("who is the owner");
  });
  await expect(page.locator("#hub-help-root")).toContainText(/ICE_DRAGON/);

  await page.evaluate(() => {
    window.HubHelp.ask("how many games are there");
  });
  await expect(page.locator("#hub-help-root")).toContainText(/32/);
  await page.evaluate(() => {
    window.HubHelp.ask("how many of them are clicker games");
  });
  await expect(page.locator("#hub-help-root")).toContainText(/Crystal Clicker/);
});

test("What's new keeps Tab inside the dialog", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  await page.waitForFunction(() => Boolean(window.HubA11y?.nextFocus));
  await page.evaluate(() => {
    document.getElementById("whats-new-modal")?.classList.remove("hidden");
  });
  const modal = page.locator("#whats-new-modal");
  await expect(modal).toBeVisible();
  await page.locator("#whats-new-ok").focus();
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const root = document.getElementById("whats-new-modal");
        return !!(root && root.contains(document.activeElement));
      })
    )
    .toBe(true);
});

test("update history loads only when opened", async ({ page }) => {
  const historyRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/changelog.json")) {
      historyRequests.push(request.url());
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("hub-booting"),
    null,
    { timeout: 20_000 }
  );
  expect(historyRequests).toEqual([]);

  const whatsNew = page.locator("#whats-new-ok");
  if (await whatsNew.isVisible()) await whatsNew.click();
  await page.locator("#toggle-updates-btn").click();
  await expect(page.locator("#updates-list .updates-item").first()).toBeVisible();
  expect(historyRequests).toHaveLength(1);
});
