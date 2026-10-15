"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.join(__dirname, "../..");
const alt = require(path.join(ROOT, "hub-canvas-alt.js"));

test("canvas alternatives live in a helper loaded from game boot", () => {
  const boot = fs.readFileSync(path.join(ROOT, "hub-game-boot.js"), "utf8");
  assert.match(boot, /hub-canvas-alt\.js/);
  assert.match(boot, /HubCanvasAlt/);
});

test("path aliases map canvas games to control copy", () => {
  assert.equal(alt.gameIdFromPath("/snake/"), "snake");
  assert.equal(alt.gameIdFromPath("/paper-io/index.html"), "paper");
  assert.equal(alt.gameIdFromPath("/wing-hop/"), "flappy");
  assert.equal(alt.gameIdFromPath("/ramp-rush/run.html"), "ramp");
  assert.equal(alt.gameIdFromPath("/fishing/"), "");
  assert.match(alt.describe("/snake/"), /arrow keys or WASD/i);
  assert.match(alt.describe("/paper-io/"), /trail is open/i);
  assert.equal(alt.describe("/fishing/"), "");
});

test("apply attaches a hidden description beside the game canvas", () => {
  const nodes = {};
  const canvas = {
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    insertAdjacentElement(_pos, el) {
      nodes[el.id] = el;
    }
  };
  const doc = {
    querySelector(sel) {
      return sel === "canvas#game" ? canvas : null;
    },
    getElementById(id) {
      return nodes[id] || null;
    },
    createElement(tag) {
      return { tag, id: "", className: "", textContent: "" };
    },
    head: {
      appendChild(el) {
        nodes[el.id] = el;
      }
    }
  };

  const missing = alt.apply(doc, "/fishing/");
  assert.equal(missing, null);
  assert.equal(canvas.attrs["aria-describedby"], undefined);

  const el = alt.apply(doc, "/snake/");
  assert.equal(el.id, "hub-canvas-alt");
  assert.match(el.textContent, /arrow keys or WASD/i);
  assert.equal(canvas.attrs["aria-describedby"], "hub-canvas-alt");
  assert.ok(nodes["hub-canvas-alt-style"]);
});
