"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const broadcasts = require(path.join(ROOT, "hub-admin-broadcasts.js"));

test("admin broadcast overlay replaces a live channel without shrinking on delete", () => {
  const live = broadcasts.applyChange(
    {
      docs: {
        "hub-admin-announce": { id: "a1", text: "Hello", until: 9e12 },
        "hub-admin-grants": { token: "ice-hub-admin-9f3a", grants: [{ id: "g1" }] }
      }
    },
    {
      type: "UPDATE",
      record: {
        doc_id: "hub-admin-announce",
        data: { id: "a2", text: "Live now", until: 9e12 }
      }
    }
  );
  assert.equal(live.docs["hub-admin-announce"].id, "a2");
  assert.equal(live.docs["hub-admin-announce"].text, "Live now");
  assert.equal(live.docs["hub-admin-grants"].grants[0].id, "g1");

  const grants = broadcasts.applyChange(live, {
    eventType: "INSERT",
    new: {
      doc_id: "hub-admin-grants",
      data: { token: "ice-hub-admin-9f3a", grants: [{ id: "g1" }, { id: "g2" }] }
    }
  });
  assert.equal(grants.docs["hub-admin-grants"].grants.length, 2);
  assert.equal(grants.docs["hub-admin-announce"].id, "a2");

  const afterDelete = broadcasts.applyChange(grants, {
    type: "DELETE",
    old_record: { doc_id: "hub-admin-announce" }
  });
  assert.equal(afterDelete.docs["hub-admin-announce"].id, "a2");
  assert.equal(afterDelete.docs["hub-admin-grants"].grants.length, 2);

  const ignored = broadcasts.applyChange(afterDelete, {
    type: "UPDATE",
    record: { doc_id: "fishing-admin-events", data: { kind: "luck" } }
  });
  assert.equal(ignored.docs["fishing-admin-events"], undefined);
  assert.equal(ignored.docs["hub-admin-announce"].id, "a2");
});

test("admin broadcasts subscribe without rewriting hub_docs from the live overlay", () => {
  const admin = fs.readFileSync(path.join(ROOT, "hub-admin.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const plays = fs.readFileSync(path.join(ROOT, "hub-plays.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160038_admin_broadcasts_realtime.sql"),
    "utf8"
  );
  assert.match(admin, /ensureAdminBroadcastRealtime/);
  assert.match(admin, /applyAdminBroadcastRealtime/);
  assert.match(admin, /subscribeAdminBroadcasts/);
  assert.match(admin, /isRealtimeJoined\?\.\("admin_broadcasts"\)/);
  assert.match(admin, /missing\.length && !sb\(\)\?\.isRealtimeJoined\?\.\("admin_broadcasts"\)/);
  assert.match(admin, /listAdminBroadcasts/);
  assert.doesNotMatch(
    admin.slice(
      admin.indexOf("function applyAdminBroadcastRealtime"),
      admin.indexOf("function stopAdminBroadcastRealtime")
    ),
    /upsertDoc|upsertAdminDoc|pushDoc/
  );
  assert.match(plays, /hub-admin-broadcasts\.js/);
  assert.match(supabase, /function subscribeAdminBroadcasts/);
  assert.match(supabase, /async function listAdminBroadcasts/);
  assert.doesNotMatch(supabase, /async function upsertAdminBroadcast/);
  assert.match(sql, /alter table public\.admin_broadcasts replica identity full/i);
  assert.match(sql, /alter publication supabase_realtime add table public\.admin_broadcasts/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
  assert.doesNotMatch(sql, /to anon/i);
});
