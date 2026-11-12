"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-referrals-mine.js"));

test("owned invite status lives in a helper used by referrals", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-referrals.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubReferralsMine/);
  assert.match(ui, /persistMine/);
  assert.match(ui, /pullMine/);
  assert.match(ui, /persistReferralContribution/);
  assert.match(ui, /fetchReferralTableRemote/);
  assert.match(ui, /if \(tableWrote && !\(opts && opts\.rewriteShared\)\) \{\s*rememberDoc\(doc\);\s*return true;/);
  assert.match(index, /hub-referrals-mine\.js/);
  assert.equal(mine.SAVE_KEY, "invite-mine");
});

test("invite status merges the higher count and keeps credited/unlocked", () => {
  const snapshot = mine.collectMine({ count: 3, unlocked: true, credited: true }, "p-me");
  assert.equal(snapshot.playerId, "p-me");
  assert.equal(snapshot.count, 3);
  assert.equal(snapshot.unlocked, true);
  assert.equal(snapshot.credited, true);

  const restored = mine.applyMine({ count: 0, unlocked: false, credited: false }, snapshot);
  assert.equal(restored.count, 3);
  assert.equal(restored.unlocked, true);
  assert.equal(restored.credited, true);

  const richer = mine.applyMine({ count: 4, unlocked: false, credited: false }, snapshot);
  assert.equal(richer.count, 4);
  assert.equal(richer.unlocked, true);
  assert.equal(richer.credited, true);

  const keepLocalCredit = mine.applyMine(
    { count: 1, unlocked: false, credited: true },
    { count: 0, unlocked: false, credited: false }
  );
  assert.equal(keepLocalCredit.count, 1);
  assert.equal(keepLocalCredit.credited, true);
  assert.equal(keepLocalCredit.unlocked, false);
});

test("owned invite rows overlay without stealing an existing credit or shrinking on delete", () => {
  const hub = {
    byInviter: {
      "p-host": {
        invitees: { "p-old": { name: "Old", code: "ABCD2345", at: 1 } },
        unlockedAt: 0
      }
    },
    byInvitee: { "p-old": { inviterId: "p-host", inviterCode: "ABCD2345", at: 1 } }
  };
  const overlaid = mine.overlayReferralDoc(hub, [
    {
      player_id: "p-new",
      inviter_id: "p-host",
      inviter_code: "ABCD2345",
      invitee_name: "New",
      credited_at: "2026-01-02T00:00:00.000Z"
    },
    {
      player_id: "p-old",
      inviter_id: "p-thief",
      inviter_code: "ZZZZ2345",
      invitee_name: "Stolen",
      at: 99
    },
    { player_id: "", inviter_id: "p-host" }
  ]);
  assert.equal(overlaid.byInvitee["p-old"].inviterId, "p-host");
  assert.equal(overlaid.byInvitee["p-new"].inviterId, "p-host");
  assert.equal(overlaid.byInviter["p-host"].invitees["p-new"].name, "New");
  assert.equal(overlaid.byInviter["p-thief"], undefined);
  assert.equal(Object.keys(overlaid.byInviter["p-host"].invitees).length, 2);

  const liveRow = mine.applyChange(hub, {
    type: "INSERT",
    record: {
      player_id: "p-new",
      inviter_id: "p-host",
      inviter_code: "ABCD2345",
      invitee_name: "New",
      credited_at: "2026-01-02T00:00:00.000Z"
    }
  });
  assert.equal(liveRow.byInvitee["p-new"].inviterId, "p-host");
  assert.equal(liveRow.byInvitee["p-old"].inviterId, "p-host");

  const afterDelete = mine.applyChange(liveRow, {
    type: "DELETE",
    old_record: { player_id: "p-new", inviter_id: "p-host" }
  });
  assert.equal(afterDelete.byInvitee["p-new"].inviterId, "p-host");
  assert.equal(afterDelete.byInvitee["p-old"].inviterId, "p-host");
});

test("invite live rows subscribe without rewriting the shared board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-referrals.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160042_referral_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(ui, /ensureReferralsRealtime/);
  assert.match(ui, /applyReferralsRealtime/);
  assert.match(ui, /subscribeReferralContributions/);
  assert.doesNotMatch(
    ui.slice(
      ui.indexOf("function applyReferralsRealtime"),
      ui.indexOf("function stopReferralsRealtime")
    ),
    /upsertDoc|pushDoc/
  );
  assert.match(supabase, /function subscribeReferralContributions/);
  assert.match(supabase, /referral_contributions/);
  assert.match(sql, /alter table public\.referral_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.referral_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
});

test("invite codes resolve from owned player-code rows before the shared board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-referrals.js"), "utf8");
  const fn = ui.slice(
    ui.indexOf("async function resolveCodeToPlayerId"),
    ui.indexOf("async function unlockSelfIfNeeded")
  );
  assert.match(fn, /getPlayerCodeClaim/);
  assert.match(fn, /listPlayerCodeClaims/);
  assert.match(fn, /rowsToCodesMap/);
  assert.match(fn, /getDoc\("player-codes"\)/);
  assert.ok(fn.indexOf("getPlayerCodeClaim") < fn.indexOf("getDoc(\"player-codes\")"));
});
