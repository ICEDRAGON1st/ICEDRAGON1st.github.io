"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const FORBIDDEN = [
  {
    name: "public hub_docs insert",
    pattern:
      /create policy[\s\S]{0,200}hub_docs[\s\S]{0,200}for insert[\s\S]{0,200}with check\s*\(\s*true\s*\)/i
  },
  {
    name: "public hub_docs update",
    pattern:
      /create policy[\s\S]{0,200}hub_docs[\s\S]{0,200}for update[\s\S]{0,200}using\s*\(\s*true\s*\)/i
  },
  {
    name: "service-role JWT",
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl/
  }
];

const files = fs
  .readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith(".sql"))
  .sort();

if (files.length < 2) {
  console.error("Expected at least two versioned Supabase migrations.");
  process.exitCode = 1;
} else {
  const findings = [];
  for (const name of files) {
    if (!/^\d{12,14}_[a-z0-9_-]+\.sql$/.test(name)) {
      findings.push(`${name}: migration filename must look like 202610150001_name.sql`);
    }
    const text = fs.readFileSync(path.join(MIGRATIONS, name), "utf8");
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(text)) findings.push(`${name}: ${rule.name}`);
    }
    if (!/enable row level security/i.test(text) && /create table/i.test(text)) {
      findings.push(`${name}: new tables must enable row level security`);
    }
  }

  const setup = fs.readFileSync(path.join(ROOT, "supabase", "setup.sql"), "utf8");
  if (/with check\s*\(\s*true\s*\)/i.test(setup)) {
    findings.push("supabase/setup.sql: public-write compatibility file must stay retired");
  }

  if (findings.length) {
    console.error("Supabase migration check failed:");
    findings.forEach((finding) => console.error(`- ${finding}`));
    process.exitCode = 1;
  } else {
    console.log(`Supabase migrations OK (${files.length} files).`);
  }
}
