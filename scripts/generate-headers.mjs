/**
 * Finalize dist/_headers: replace __INLINE_HASHES__ with sha256 CSP hashes of
 * every inline <script> body found in the built HTML.
 *
 * Keeps script-src free of 'unsafe-inline' and survives Astro upgrades:
 * whatever inline scripts the build emits are measured from the real output.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const TEMPLATE = new URL("../static/_headers", import.meta.url).pathname;

const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => join(e.parentPath, e.name));
}

const hashes = new Set();
for (const file of await htmlFiles(DIST)) {
  const html = readFileSync(file, "utf-8");
  for (const match of html.matchAll(INLINE_SCRIPT_RE)) {
    const body = match[1];
    if (!body.trim()) continue;
    const digest = createHash("sha256").update(body, "utf-8").digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
}

const template = readFileSync(TEMPLATE, "utf-8");
if (!template.includes("__INLINE_HASHES__")) {
  console.error("error: static/_headers missing __INLINE_HASHES__ placeholder");
  process.exit(1);
}
writeFileSync(
  join(DIST, "_headers"),
  template.replace("__INLINE_HASHES__", [...hashes].sort().join(" ")),
);
console.log(`generate-headers: ${hashes.size} inline script hash(es) → dist/_headers`);
