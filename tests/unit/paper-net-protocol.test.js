"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");

const net = require(path.resolve(__dirname, "../../paper-io/net-protocol.js"));

test("Paper online writes stay at or below four per second", () => {
  assert.ok(net.HOST_PUBLISH_MS >= 250);
  assert.ok(net.GUEST_INPUT_MS >= 250);
  assert.equal(net.shouldPublish(1000, 800, net.HOST_PUBLISH_MS), false);
  assert.equal(net.shouldPublish(1000, 700, net.HOST_PUBLISH_MS), true);
});

test("guests keep a separate input document from the host snapshot", () => {
  assert.equal(net.roomDocId("ab12"), "paper-io-room-AB12");
  assert.equal(net.inputDocId("ab12", "p-Guest!"), "paper-io-input-AB12-p-guest");
  assert.notEqual(net.roomDocId("ab12"), net.inputDocId("ab12", "p-guest"));
});

test("snapshots are accepted in version order and host loss is stale after 15s", () => {
  assert.equal(net.acceptSnap(3, { v: 4 }), true);
  assert.equal(net.acceptSnap(4, { v: 3 }), false);
  assert.equal(net.acceptSnap(0, { v: 1 }), true);
  assert.equal(net.hostIsStale(20_000, 4_000), true);
  assert.equal(net.hostIsStale(10_000, 4_000), false);
  assert.equal(net.hostIsStale(20_000, 0), false);
});

test("grid is sent on claims or a periodic recovery snapshot", () => {
  assert.equal(net.shouldIncludeGrid(5000, 4000, false), false);
  assert.equal(net.shouldIncludeGrid(5000, 4000, true), true);
  assert.equal(net.shouldIncludeGrid(9000, 4000, false), true);
});

test("guest input writes only on a turn change or heartbeat", () => {
  assert.equal(net.shouldWriteInput(1000, 900, 1.0, 1.0), false);
  assert.equal(net.shouldWriteInput(1000, 700, 1.0, 1.2), true);
  assert.equal(net.shouldWriteInput(2500, 1000, 1.0, 1.0), true);
});
