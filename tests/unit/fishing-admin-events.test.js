"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const admin = require(path.resolve(__dirname, "../../fishing/admin-events.js"));

const NOW = 1_700_000_000_000;
const LIVE = NOW + 10 * 60 * 1000;
const opts = { now: NOW, token: admin.TOKEN };

test("Fishing admin events parse bundles, commands, and clamps", () => {
  assert.equal(admin.clampAdminMult(0.2), 1);
  assert.equal(admin.clampAdminMult(5000), 1000);
  assert.equal(admin.clampAdminMinutes(0), 1);
  assert.equal(admin.clampAdminMinutes(3000), 1440);

  assert.equal(
    admin.parseAdminEventPayload({ kind: "luck", until: NOW - 1, mult: 2 }, false, opts),
    null
  );
  assert.equal(
    admin.parseAdminEventPayload({ kind: "luck", until: LIVE, mult: 2, token: "nope" }, true, opts),
    null
  );

  const luck = admin.parseAdminEventPayload(
    { kind: "luck", until: LIVE, startedAt: NOW, mult: 5, token: admin.TOKEN },
    true,
    opts
  );
  assert.equal(luck.kind, "luck");
  assert.equal(luck.mult, 5);

  const storm = admin.parseAdminEventPayload(
    { kind: "weather", target: "rain", until: LIVE, token: admin.TOKEN },
    true,
    opts
  );
  assert.equal(storm.target, "storm");
  assert.equal(storm.mult, 1);

  const bundle = admin.parseAdminBundle(
    {
      token: admin.TOKEN,
      boost: { kind: "luck", until: LIVE, startedAt: NOW, mult: 2 },
      variant: { kind: "variant", target: "gold+shiny", until: LIVE, startedAt: NOW, mult: 3 },
      mutation: {
        toxic: { kind: "mutation", target: "toxic", until: LIVE, startedAt: NOW, mult: 4 },
        lava: { kind: "mutation", target: "lava", until: LIVE, startedAt: NOW, mult: 5 }
      },
      luckyblock: { kind: "luckyblock", until: LIVE, startedAt: NOW, mult: 10 },
      speed: { kind: "speed", until: LIVE, startedAt: NOW, mult: 2 },
      weather: { kind: "weather", target: "storm", until: LIVE, startedAt: NOW, mult: 1 }
    },
    true,
    opts
  );
  assert.equal(bundle.boost.kind, "luck");
  assert.equal(bundle.variant.target, "gold+shiny");
  assert.equal(bundle.mutation.toxic.mult, 4);
  assert.equal(bundle.mutation.lava.mult, 5);
  assert.equal(bundle.mutation.neon, null);
  assert.equal(bundle.luckyblock.mult, 10);
  assert.equal(bundle.speed.mult, 2);
  assert.equal(bundle.weather.target, "storm");

  const winner = admin.pickBetterAdminEvent(
    { until: LIVE, mult: 2 },
    { until: LIVE + 1000, mult: 1 }
  );
  assert.equal(winner.until, LIVE + 1000);

  assert.deepEqual(admin.parseAdminCommand("5x luck 10m global"), {
    kind: "luck",
    minutes: 10,
    mult: 5,
    scope: "global",
    target: ""
  });
  assert.equal(admin.parseAdminCommand("clear toxic").kind, "clear-toxic");
  assert.deepEqual(admin.parseAdminCommand("storm 6h"), {
    kind: "weather",
    minutes: 360,
    mult: 1,
    scope: "local",
    target: "storm"
  });
  assert.equal(admin.parseAdminCommand("gold + shiny").target, "gold+shiny");
  assert.equal(admin.parseAdminCommand("10x luckyblock 5m").kind, "luckyblock");
});
