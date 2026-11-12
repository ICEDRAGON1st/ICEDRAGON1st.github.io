"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const rooms = require(path.join(ROOT, "paper-io/rooms-mine.js"));

const HOST = "p-hostaaaaaa";
const GUEST = "p-guestaaaaaa";

test("owned Paper rooms live in a helper used by the online arena", () => {
  const script = fs.readFileSync(path.join(ROOT, "paper-io/script.js"), "utf8");
  const index = fs.readFileSync(path.join(ROOT, "paper-io/index.html"), "utf8");
  const roomsSrc = fs.readFileSync(path.join(ROOT, "paper-io/rooms-mine.js"), "utf8");
  const getSlice = script.slice(script.indexOf("async function sbGet"), script.indexOf("function encodeGrid"));
  const putSlice = script.slice(script.indexOf("async function sbPut"), script.indexOf("function encodeGrid"));
  assert.match(index, /rooms-mine\.js/);
  assert.match(script, /window\.PaperClaimRooms/);
  assert.match(script, /readDoc/);
  assert.match(script, /writeDoc/);
  assert.match(script, /ensureRealtime/);
  assert.match(script, /stopRealtime/);
  assert.match(roomsSrc, /if \(tableFetched \|\| liveJoined\(\)\) return null/);
  assert.match(getSlice, /if \(hit !== undefined\) return hit/);
  assert.match(putSlice, /if \(wrote\) return/);
  assert.equal(rooms.TABLE, "paper_room_contributions");
  assert.equal(rooms.LOBBY_DOC, "paper-io-lobbies");
});

test("Paper overlay unions seats and keeps the host snapshot without shrinking on delete", () => {
  const hostRoom = {
    code: "AB12",
    hostId: HOST,
    status: "waiting",
    createdAt: 10,
    updatedAt: 20,
    seats: { [HOST]: { name: "Host", color: 0, joinedAt: 10 } },
    inputs: { [HOST]: 1.2 },
    snap: { v: 3, t: 20, players: [{ id: HOST, x: 1, y: 2 }] }
  };
  const guestSeat = {
    code: "AB12",
    hostId: HOST,
    status: "waiting",
    createdAt: 12,
    updatedAt: 25,
    seats: { [GUEST]: { name: "Guest", color: 1, joinedAt: 12 } },
    inputs: { [GUEST]: 0.4 },
    snap: { v: 99, t: 25, players: [] }
  };

  const overlaid = rooms.overlayPaperRooms({ rooms: { AB12: hostRoom } }, [
    { player_id: GUEST, rooms: { AB12: guestSeat } },
    { player_id: "", rooms: { SKIP: hostRoom } }
  ]);
  assert.equal(overlaid.rooms.SKIP, undefined);
  assert.equal(overlaid.rooms.AB12.seats[HOST].name, "Host");
  assert.equal(overlaid.rooms.AB12.seats[GUEST].name, "Guest");
  assert.equal(overlaid.rooms.AB12.inputs[GUEST], 0.4);
  assert.equal(overlaid.rooms.AB12.snap.v, 3);

  const guestMine = rooms.collectMine(overlaid.rooms, GUEST);
  assert.equal(guestMine.rooms.AB12.snap, null);
  assert.equal(guestMine.rooms.AB12.seats[HOST], undefined);
  assert.equal(guestMine.rooms.AB12.inputs[GUEST], 0.4);

  const hostMine = rooms.collectMine(overlaid.rooms, HOST);
  assert.equal(hostMine.rooms.AB12.snap.v, 3);
  assert.equal(hostMine.rooms.AB12.seats[GUEST].name, "Guest");

  const liveRow = rooms.applyChange(overlaid, {
    type: "UPDATE",
    new: {
      player_id: HOST,
      rooms: {
        AB12: { ...hostRoom, status: "playing", updatedAt: 40, snap: { v: 4, t: 40 } }
      }
    }
  });
  assert.equal(liveRow.rooms.AB12.status, "playing");
  assert.equal(liveRow.rooms.AB12.snap.v, 4);
  assert.equal(liveRow.rooms.AB12.seats[GUEST].name, "Guest");

  const afterDelete = rooms.applyChange(liveRow, {
    type: "DELETE",
    old_record: { player_id: GUEST }
  });
  assert.equal(afterDelete.rooms.AB12.seats[GUEST].name, "Guest");
  assert.equal(afterDelete.rooms.AB12.snap.v, 4);

  const lobby = rooms.toLobby(liveRow, 40);
  assert.equal(lobby.rooms.AB12.status, "playing");
});

test("Paper live rows subscribe without rewriting the shared board", () => {
  const script = fs.readFileSync(path.join(ROOT, "paper-io/script.js"), "utf8");
  const supabase = fs.readFileSync(path.join(ROOT, "hub-supabase.js"), "utf8");
  const sql = fs.readFileSync(
    path.join(ROOT, "supabase/migrations/202610160048_paper_room_contributions_realtime.sql"),
    "utf8"
  );
  assert.match(script, /ensureRealtime/);
  assert.match(supabase, /function subscribePaperRoomContributions/);
  assert.match(supabase, /paper_room_contributions/);
  assert.match(sql, /alter table public\.paper_room_contributions replica identity full/i);
  assert.match(
    sql,
    /alter publication supabase_realtime add table public\.paper_room_contributions/i
  );
  assert.doesNotMatch(sql, /to anon/i);
  assert.doesNotMatch(sql, /add table public\.hub_docs/i);
});
