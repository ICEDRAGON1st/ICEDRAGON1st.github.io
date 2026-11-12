"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const pbs = require(path.join(ROOT, "hub-leaderboard-pbs.js"));

test("personal bests live in a helper used by the shared board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-leaderboard.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const fetchSlice = ui.slice(
    ui.indexOf("async function fetchRemote"),
    ui.indexOf("async function pushRemote")
  );
  const pushSlice = ui.slice(
    ui.indexOf("async function pushRemote"),
    ui.indexOf("function normalizeEntry")
  );
  assert.match(ui, /window\.HubLeaderboardPbs/);
  assert.match(ui, /persistMyPbs/);
  assert.match(ui, /pullMyPbs/);
  assert.match(ui, /persistLeaderboardPbContribution/);
  assert.match(ui, /fetchLeaderboardTableRemote/);
  assert.match(ui, /fetchLeaderboardResetsRemote/);
  assert.match(ui, /persistLeaderboardResets/);
  assert.match(ui, /skipShared: !fetched/);
  assert.doesNotMatch(fetchSlice, /getPrefer/);
  assert.match(ui, /if \(!row\) return \{\}/);
  assert.match(pushSlice, /if \(opts\.wipe\) \{/);
  assert.match(pushSlice, /if \(resetsWrote\) return/);
  assert.match(pushSlice, /else if \(tableWrote\) \{/);
  assert.doesNotMatch(pushSlice, /pushPrefer/);
  assert.match(ui, /rewriteShared: true, wipe: true/);
  assert.match(plays, /hub-leaderboard-pbs\.js/);
  assert.match(index, /hub-leaderboard-pbs\.js/);
  assert.equal(pbs.SAVE_KEY, "lb-pbs");
});

test("personal-best merge keeps the better score and restores a missing row", () => {
  assert.equal(pbs.isBetter(12, 10, false), true);
  assert.equal(pbs.isBetter(8, 10, true), true);
  assert.equal(pbs.isBetter(10, 10, false), false);

  const mine = pbs.collectMine(
    {
      snake: {
        you: { name: "You", score: 40, at: 20, playerId: "p-local" },
        them: { name: "Them", score: 90, at: 10, playerId: "p-other" }
      }
    },
    (entry) => entry.playerId === "p-local"
  );
  assert.equal(mine.games.snake.score, 40);
  assert.equal(mine.games.snake.playerId, "p-local");

  const restored = pbs.applyPersonalBests(
    { snake: { them: { name: "Them", score: 90, at: 10, playerId: "p-other" } } },
    mine,
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(restored.snake.you.score, 40);
  assert.equal(restored.snake.them.score, 90);

  const richer = pbs.applyPersonalBests(
    { snake: { you: { name: "You", score: 12, at: 1, playerId: "p-local" } } },
    mine,
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(richer.snake.you.score, 40);

  const overlaid = pbs.overlayLeaderboardGames(
    { games: { snake: { them: { name: "Them", score: 90, at: 10, playerId: "p-other" } } } },
    [
      {
        player_id: "p-local",
        games: { snake: { name: "You", score: 40, at: 20, playerId: "p-local" } }
      },
      {
        player_id: "p-other",
        games: { snake: { name: "Them", score: 120, at: 30, playerId: "p-other" } }
      },
      { player_id: "", games: { snake: { name: "Skip", score: 999, at: 40, playerId: "p-skip" } } }
    ],
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(overlaid.games.snake.you.score, 40);
  assert.equal(overlaid.games.snake.them.score, 120);
  assert.equal(overlaid.games.snake.skip, undefined);

  const liveRow = pbs.applyChange(
    { games: { snake: { them: { name: "Them", score: 90, at: 10, playerId: "p-other" } } } },
    {
      type: "UPDATE",
      new: {
        player_id: "p-other",
        games: { snake: { name: "Them", score: 120, at: 30, playerId: "p-other" } }
      }
    },
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(liveRow.games.snake.them.score, 120);

  const afterDelete = pbs.applyChange(liveRow, {
    type: "DELETE",
    old_record: { player_id: "p-other" }
  });
  assert.equal(afterDelete.games.snake.them.score, 120);
});

test("owned name binds overlay onto the board without becoming a fake game", () => {
  const overlaid = pbs.overlayLeaderboardGames(
    {
      games: {
        snake: {
          oldname: { name: "OldName", score: 40, at: 20, playerId: "p-local" }
        }
      },
      resets: {}
    },
    [
      {
        player_id: "p-local",
        games: {
          snake: { name: "NewName", score: 40, at: 20, playerId: "p-local" },
          __namebind: { name: "NewName", score: 0, at: 0, playerId: "p-local" }
        }
      }
    ],
    (name) => String(name || "").toLowerCase()
  );
  assert.equal(overlaid.resets["namebind:p-local"], "NewName");
  assert.equal(overlaid.games.__namebind, undefined);
  assert.equal(overlaid.games.snake.newname.score, 40);

  const mine = pbs.collectMine(
    {
      snake: { newname: { name: "NewName", score: 40, at: 20, playerId: "p-local" } },
      __namebind: { name: "NewName", score: 0, at: 0, playerId: "p-local" }
    },
    (entry) => entry.playerId === "p-local"
  );
  assert.equal(mine.games.__namebind, undefined);
  assert.equal(mine.games.snake.score, 40);
});

test("leaderboard wipe overlay keeps later ICE cuts without shrinking a name bind", () => {
  const hub = {
    games: { snake: { them: { name: "Them", score: 90, at: 10, playerId: "p-other" } } },
    resets: { "snake:them": 50, "namebind:p-other": "Them" }
  };
  const live = pbs.applyResetsChange(hub, {
    type: "UPDATE",
    record: {
      doc_id: "hub-leaderboard-resets",
      data: { token: "ice-hub-admin-9f3a", resets: { "snake:them": 80, "namebind:p-cheat": "Nope" } }
    }
  });
  assert.equal(live.resets["snake:them"], 80);
  assert.equal(live.resets["namebind:p-other"], "Them");
  assert.equal(live.resets["namebind:p-cheat"], undefined);
  assert.equal(live.games.snake.them.score, 90);

  const ignored = pbs.applyResetsChange(live, {
    type: "UPDATE",
    record: { doc_id: "hub-admin-announce", data: { resets: { "snake:them": 999 } } }
  });
  assert.equal(ignored.resets["snake:them"], 80);

  const afterDelete = pbs.applyResetsChange(live, {
    type: "DELETE",
    old_record: { doc_id: "hub-leaderboard-resets" }
  });
  assert.equal(afterDelete.resets["snake:them"], 80);
});

test("leaderboard live rows subscribe without rewriting the shared board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-leaderboard.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160030_leaderboard_pb_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(ui, /ensureLeaderboardRealtime/);
  assert.match(ui, /applyLeaderboardRealtime/);
  assert.match(ui, /applyLeaderboardResetsRealtime/);
  assert.match(ui, /subscribeLeaderboardPbContributions/);
  assert.match(ui, /subscribeAdminBroadcasts/);
  assert.match(ui, /leaderboardLiveJoined\("leaderboard_pb_contributions"\)/);
  assert.match(ui, /leaderboardLiveJoined\("admin_broadcasts"\)/);
  assert.match(ui, /skipShared: joined/);
  assert.doesNotMatch(
    ui.slice(
      ui.indexOf("function applyLeaderboardRealtime"),
      ui.indexOf("function stopLeaderboardRealtime")
    ),
    /pushRemote/
  );
  assert.match(supabase, /function subscribeLeaderboardPbContributions/);
  assert.match(sql, /alter table public\.leaderboard_pb_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.leaderboard_pb_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});

test("Most Invites hydrates from owned invite rows before the shared board", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-leaderboard.js"), "utf8");
  const fn = ui.slice(
    ui.indexOf("async function hydrateInvitesBoard"),
    ui.indexOf("async function clearPlayer")
  );
  assert.match(fn, /listReferralContributions/);
  assert.match(fn, /overlayReferralDoc/);
  assert.match(fn, /listNicknameClaims/);
  assert.match(fn, /rowsToNameMap/);
  assert.doesNotMatch(fn, /getDoc\("hub-referrals-v1"\)/);
  assert.doesNotMatch(fn, /getDoc\("name-registry"\)/);
  assert.match(fn, /leaderboardLiveJoined\("referral_contributions"\)/);
  assert.match(fn, /leaderboardLiveJoined\("nickname_claims"\)/);
  assert.match(fn, /HubReferrals\?\.peekDoc/);
  assert.match(fn, /HubPlays\?\.getNameRegistry/);
});
