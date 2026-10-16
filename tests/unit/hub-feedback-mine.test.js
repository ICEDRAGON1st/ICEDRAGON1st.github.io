"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const mine = require(path.join(ROOT, "hub-feedback-mine.js"));

test("owned feedback lives in a helper used by the Feedback panel", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-feedback.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(ui, /window\.HubFeedbackMine/);
  assert.match(ui, /persistMine/);
  assert.match(ui, /pullMine/);
  assert.match(ui, /persistFeedbackItemContribution/);
  assert.match(ui, /fetchFeedbackTableRemote/);
  assert.match(ui, /skipShared: !fetched/);
  assert.match(index, /hub-feedback-mine\.js/);
  assert.equal(mine.SAVE_KEY, "feedback-mine");
});

test("owned feedback keeps only this player's tickets and never shrinks a richer local list", () => {
  const snapshot = mine.collectMine(
    [
      {
        id: "f1",
        fromId: "p-me",
        fromName: "Ada",
        type: "bug",
        game: "Snake",
        text: "Walls eat the tail",
        at: 20
      },
      {
        id: "f2",
        fromId: "p-other",
        fromName: "Bea",
        type: "idea",
        game: "Hub",
        text: "Should not copy other players",
        at: 21
      },
      { id: "f1", fromId: "p-me", fromName: "Ada", type: "bug", text: "dup", at: 1 }
    ],
    ["f1", "missing"],
    "p-me"
  );
  assert.equal(snapshot.playerId, "p-me");
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].id, "f1");
  assert.equal(snapshot.items[0].text, "Walls eat the tail");
  assert.deepEqual(snapshot.pendingIds, ["f1", "missing"]);

  const restored = mine.applyMine([], [], snapshot);
  assert.equal(restored.items[0].id, "f1");
  assert.ok(restored.pendingIds.includes("f1"));

  const richer = mine.applyMine(
    [
      {
        id: "local",
        fromId: "p-me",
        fromName: "Ada",
        type: "idea",
        game: "Hub",
        text: "Keep my local note",
        at: 9
      }
    ],
    ["local"],
    snapshot
  );
  assert.equal(richer.items.length, 2);
  assert.ok(richer.items.some((item) => item.id === "local"));
  assert.ok(richer.items.some((item) => item.id === "f1"));
  assert.ok(richer.pendingIds.includes("local"));
  assert.ok(richer.pendingIds.includes("f1"));

  const overlaid = mine.overlayFeedbackItems(
    {
      items: [
        {
          id: "hub",
          fromId: "p-hub",
          fromName: "Hub",
          type: "idea",
          game: "Hub",
          text: "Already on the board",
          at: 5
        }
      ]
    },
    [
      {
        player_id: "p-me",
        items: [
          {
            id: "f1",
            fromId: "p-me",
            fromName: "Ada",
            type: "bug",
            game: "Snake",
            text: "Walls eat the tail",
            at: 20
          }
        ]
      },
      {
        player_id: "p-pal",
        items: [
          {
            id: "f3",
            fromId: "p-pal",
            fromName: "Pal",
            type: "idea",
            game: "Quiz",
            text: "More categories",
            at: 21
          }
        ]
      },
      {
        player_id: "",
        items: [{ id: "skip", fromId: "p-skip", fromName: "Skip", type: "idea", text: "nope", at: 22 }]
      }
    ]
  );
  assert.equal(overlaid.items.some((item) => item.id === "hub"), true);
  assert.equal(overlaid.items.some((item) => item.id === "f1"), true);
  assert.equal(overlaid.items.some((item) => item.id === "f3"), true);
  assert.equal(overlaid.items.some((item) => item.id === "skip"), false);

  const liveRow = mine.applyChange(
    { items: [{ id: "hub", fromId: "p-hub", fromName: "Hub", type: "idea", game: "Hub", text: "Already on the board", at: 5 }] },
    {
      type: "UPDATE",
      new: {
        player_id: "p-pal",
        items: [
          {
            id: "f3",
            fromId: "p-pal",
            fromName: "Pal",
            type: "idea",
            game: "Quiz",
            text: "More categories",
            at: 21
          }
        ]
      }
    }
  );
  assert.equal(liveRow.items.some((item) => item.id === "hub"), true);
  assert.equal(liveRow.items.some((item) => item.id === "f3"), true);

  const afterDelete = mine.applyChange(liveRow, {
    type: "DELETE",
    old_record: { player_id: "p-pal" }
  });
  assert.equal(afterDelete.items.some((item) => item.id === "f3"), true);
});

test("feedback live rows subscribe without rewriting the shared inbox", () => {
  const ui = fs.readFileSync(path.join(ROOT, "hub-feedback.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160029_feedback_item_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(ui, /ensureFeedbackRealtime/);
  assert.match(ui, /applyFeedbackRealtime/);
  assert.match(ui, /subscribeFeedbackItemContributions/);
  assert.doesNotMatch(
    ui.slice(ui.indexOf("function applyFeedbackRealtime"), ui.indexOf("function stopFeedbackRealtime")),
    /pushRemote/
  );
  assert.match(supabase, /function subscribeFeedbackItemContributions/);
  assert.match(sql, /alter table public\.feedback_item_contributions replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.feedback_item_contributions/i);
  assert.doesNotMatch(sql, /to anon/i);
});
