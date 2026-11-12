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

test("Fishing admin announce live rows overlay a popup without shrinking on delete", () => {
  const live = admin.applyAnnounceChange(
    { payload: { token: admin.TOKEN, id: "a1", text: "Hi", until: LIVE } },
    {
      type: "UPDATE",
      record: {
        doc_id: "fishing-admin-announce",
        data: { token: admin.TOKEN, id: "a2", text: "Live now", until: LIVE }
      }
    }
  );
  assert.equal(live.replaced, true);
  assert.equal(live.payload.id, "a2");
  assert.equal(live.payload.text, "Live now");

  const ignored = admin.applyAnnounceChange(live, {
    type: "UPDATE",
    record: { doc_id: "fishing-admin-events", data: { kind: "luck" } }
  });
  assert.equal(ignored.replaced, false);
  assert.equal(ignored.payload.id, "a2");

  const afterDelete = admin.applyAnnounceChange(live, {
    type: "DELETE",
    old_record: { doc_id: "fishing-admin-announce" }
  });
  assert.equal(afterDelete.replaced, false);
  assert.equal(afterDelete.payload.id, "a2");
});

test("Fishing admin-event live rows overlay luck without shrinking on delete", () => {
  const live = admin.applyBroadcastChange(
    { payload: { token: admin.TOKEN, boost: { kind: "luck", until: LIVE, mult: 2 } } },
    {
      type: "UPDATE",
      record: {
        doc_id: "fishing-admin-events",
        data: { token: admin.TOKEN, boost: { kind: "luck", until: LIVE, mult: 5 } }
      }
    }
  );
  assert.equal(live.replaced, true);
  assert.equal(live.payload.boost.mult, 5);

  const ignored = admin.applyBroadcastChange(live, {
    type: "UPDATE",
    record: { doc_id: "hub-admin-announce", data: { text: "hi" } }
  });
  assert.equal(ignored.replaced, false);
  assert.equal(ignored.payload.boost.mult, 5);

  const afterDelete = admin.applyBroadcastChange(live, {
    type: "DELETE",
    old_record: { doc_id: "fishing-admin-events" }
  });
  assert.equal(afterDelete.replaced, false);
  assert.equal(afterDelete.payload.boost.mult, 5);
});

test("Fishing admin events subscribe without rewriting hub_docs from the live overlay", () => {
  const fs = require("node:fs");
  const script = fs.readFileSync(path.join(__dirname, "../../fishing/script.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(__dirname, "../../supabase/migrations/202610160039_admin_broadcasts_fishing_events.sql"),
    "utf8"
  );
  assert.match(script, /ensureAdminEventRealtime/);
  assert.match(script, /applyAdminEventRealtime/);
  assert.match(script, /applyAdminAnnounceRealtime/);
  assert.match(script, /subscribeAdminBroadcasts/);
  assert.match(script, /fishingLiveJoined\("admin_broadcasts"\)/);
  assert.match(script, /listAdminBroadcasts/);
  assert.match(script, /upsertAdminDoc\(ADMIN_ANNOUNCE_DOC/);
  assert.doesNotMatch(
    script.slice(
      script.indexOf("function applyAdminAnnounceRealtime"),
      script.indexOf("async function fetchAdminAnnounceRemote")
    ),
    /upsertAdminDoc|upsertDoc|pushPrefer/
  );
  assert.doesNotMatch(
    script.slice(
      script.indexOf("function applyAdminEventRealtime"),
      script.indexOf("function stopAdminEventRealtime")
    ),
    /upsertAdminDoc|upsertDoc|pushPrefer/
  );
  assert.doesNotMatch(
    script.slice(
      script.indexOf("async function pollAdminEvent"),
      script.indexOf("function startAdminEventPolling")
    ),
    /getDoc|getPrefer/
  );
  assert.doesNotMatch(
    script.slice(
      script.indexOf("async function fetchAdminAnnounceRemote"),
      script.indexOf("async function pollAdminAnnounce")
    ),
    /getPrefer|getDoc/
  );
  assert.doesNotMatch(
    script.slice(
      script.indexOf("async function pushAdminAnnounceRemote"),
      script.indexOf("async function publishAdminAnnounce")
    ),
    /pushPrefer|upsertDoc/
  );
  assert.doesNotMatch(
    script.slice(
      script.indexOf("async function pushAdminBundleRemote"),
      script.indexOf("async function maybeRetryPendingAdminPush")
    ),
    /upsertDoc|pushPrefer|getDoc/
  );
  assert.match(script, /async function loadAdminAuditEntries/);
  assert.match(script, /upsertAdminDoc\(ADMIN_AUDIT_DOC/);
  assert.doesNotMatch(
    script.slice(
      script.indexOf("let adminAuditEntries"),
      script.indexOf("function syncAdminAuditSection")
    ),
    /getDoc|getPrefer|upsertDoc/
  );
  assert.match(sql, /fishing-admin-events/);
  assert.match(sql, /security definer/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});
