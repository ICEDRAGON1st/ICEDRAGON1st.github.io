"use strict";

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = require("acorn-walk");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "storage-manifest.json");
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "tests", "tools"]);

function sourceFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, files);
    else if (
      entry.isFile() &&
      entry.name.endsWith(".js") &&
      !/^(dictionary|words)(?:-|\.js)/.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

function exact(value) {
  return { type: "exact", value };
}

function pattern(value) {
  return { type: "pattern", value: value.replace(/\*+/g, "*") };
}

function resolveValue(node, constants) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return exact(node.value);
  if (node.type === "Identifier") return constants.get(node.name) || null;
  if (node.type === "TemplateLiteral") {
    if (!node.expressions.length) return exact(node.quasis[0]?.value?.cooked || "");
    const parts = [];
    for (let i = 0; i < node.quasis.length; i += 1) {
      parts.push(node.quasis[i]?.value?.cooked || "");
      if (i < node.expressions.length) {
        const resolved = resolveValue(node.expressions[i], constants);
        parts.push(resolved?.type === "exact" ? resolved.value : "*");
      }
    }
    return pattern(parts.join(""));
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = resolveValue(node.left, constants);
    const right = resolveValue(node.right, constants);
    if (!left && !right) return null;
    const value = `${left?.value || "*"}${right?.value || "*"}`;
    return left?.type === "exact" && right?.type === "exact" ? exact(value) : pattern(value);
  }
  return null;
}

function localStorageMethod(callee) {
  if (!callee || callee.type !== "MemberExpression") return "";
  const property = callee.computed ? callee.property?.value : callee.property?.name;
  if (!["getItem", "setItem", "removeItem"].includes(property)) return "";
  const object = callee.object;
  if (object?.type === "Identifier" && object.name === "localStorage") return property;
  if (
    object?.type === "MemberExpression" &&
    object.object?.type === "Identifier" &&
    object.object.name === "window" &&
    (object.computed ? object.property?.value : object.property?.name) === "localStorage"
  ) {
    return property;
  }
  return "";
}

function readBagRules() {
  const text = fs.readFileSync(path.join(ROOT, "hub-account-bag.js"), "utf8");
  const ast = acorn.parse(text, { ecmaVersion: "latest", sourceType: "script" });
  const values = { BAG_KEYS: [], BAG_KEY_PREFIXES: [] };
  walk.simple(ast, {
    VariableDeclarator(node) {
      const name = node.id?.type === "Identifier" ? node.id.name : "";
      if (!(name in values) || node.init?.type !== "ArrayExpression") return;
      values[name] = node.init.elements
        .filter((element) => element?.type === "Literal" && typeof element.value === "string")
        .map((element) => element.value);
    }
  });
  return { keys: new Set(values.BAG_KEYS), prefixes: values.BAG_KEY_PREFIXES };
}

function classify(value, bagRules) {
  const sample = value.replace(/\*/g, "");
  const account =
    bagRules.keys.has(value) ||
    bagRules.prefixes.some((prefix) => value.startsWith(prefix)) ||
    value.startsWith("hub-coins-v1:");
  const transient = /(session|pending|rate-limit|mantle-|seen|active-room|override)/i.test(sample);
  const merge = /(high-score|best|lifetime|wins-count|max-level)/i.test(sample)
    ? "max"
    : /(save|stats|wordle-game|daily-streak|coins)/i.test(sample)
      ? "domain"
      : "latest";
  const versionMatch = /-v(\d+)(?:\*|$)/i.exec(value);
  return {
    scope: account ? "account" : transient ? "transient-device" : "device",
    merge,
    schemaVersion: versionMatch ? Number(versionMatch[1]) : null
  };
}

function inventory() {
  const found = new Map();
  const unresolved = [];

  for (const file of sourceFiles(ROOT).sort()) {
    const relative = path.relative(ROOT, file).replace(/\\/g, "/");
    const text = fs.readFileSync(file, "utf8");
    let ast;
    try {
      ast = acorn.parse(text, {
        ecmaVersion: "latest",
        sourceType: "script",
        locations: true,
        allowHashBang: true
      });
    } catch (error) {
      throw new Error(`${relative}: ${error.message}`);
    }

    const constants = new Map();
    walk.simple(ast, {
      VariableDeclarator(node) {
        if (node.id?.type !== "Identifier") return;
        const value = resolveValue(node.init, constants);
        if (value) constants.set(node.id.name, value);
      }
    });

    walk.simple(ast, {
      CallExpression(node) {
        if (!localStorageMethod(node.callee)) return;
        const value = resolveValue(node.arguments[0], constants);
        if (!value || !value.value) {
          unresolved.push(`${relative}:${node.loc.start.line}`);
          return;
        }
        const signature = `${value.type}:${value.value}`;
        if (!found.has(signature)) {
          found.set(signature, { type: value.type, value: value.value, owners: new Set() });
        }
        found.get(signature).owners.add(relative);
      }
    });
  }

  const bagRules = readBagRules();
  for (const key of bagRules.keys) {
    const signature = `exact:${key}`;
    if (!found.has(signature)) {
      found.set(signature, {
        type: "exact",
        value: key,
        owners: new Set(["hub-account-bag.js"])
      });
    }
  }
  for (const prefix of bagRules.prefixes) {
    const value = `${prefix}*`;
    const signature = `pattern:${value}`;
    if (!found.has(signature)) {
      found.set(signature, {
        type: "pattern",
        value,
        owners: new Set(["hub-account-bag.js"])
      });
    }
  }
  const entries = [...found.values()]
    .map((entry) => ({
      type: entry.type,
      value: entry.value,
      ...classify(entry.value, bagRules),
      owners: [...entry.owners].sort()
    }))
    .sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`));

  const unresolvedByFile = new Map();
  for (const location of unresolved) {
    const file = location.replace(/:\d+$/, "");
    unresolvedByFile.set(file, (unresolvedByFile.get(file) || 0) + 1);
  }

  return {
    version: 1,
    note: "Generated inventory. Review scope and merge metadata when adding or changing persisted state.",
    entries,
    unresolved: [...unresolvedByFile]
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => a.file.localeCompare(b.file))
  };
}

function comparable(manifest) {
  return JSON.stringify(manifest, null, 2) + "\n";
}

const current = inventory();

if (process.argv.includes("--write")) {
  fs.writeFileSync(MANIFEST_PATH, comparable(current), "utf8");
  console.log(
    `Wrote ${path.relative(ROOT, MANIFEST_PATH)} (${current.entries.length} keys/patterns, ${current.unresolved.reduce((sum, item) => sum + item.count, 0)} unresolved calls).`
  );
  process.exit(0);
}

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error("storage-manifest.json is missing. Run npm run inventory:storage and review it.");
  process.exit(1);
}

const saved = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
if (comparable(saved) !== comparable(current)) {
  console.error(
    "Persisted-storage usage changed. Run npm run inventory:storage, review account scope/merge rules, and commit the manifest."
  );
  process.exitCode = 1;
} else {
  console.log(
    `Storage manifest is current (${current.entries.length} keys/patterns, ${current.unresolved.reduce((sum, item) => sum + item.count, 0)} unresolved calls).`
  );
}
