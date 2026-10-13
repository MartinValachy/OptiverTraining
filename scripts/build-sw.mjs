// Post-build step: inject a precache manifest of the static export (out/) into the service worker.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
if (!existsSync(OUT)) {
  console.error("build-sw: out/ not found (did next build run with output: 'export'?)");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(OUT).filter((f) => !f.endsWith("sw.js") && statSync(f).size < 5_000_000);
const urls = new Set();
const hash = createHash("sha256");
for (const f of files.sort()) {
  const rel = "/" + relative(OUT, f).split(sep).join("/");
  hash.update(rel);
  hash.update(readFileSync(f));
  if (rel.endsWith("/index.html")) urls.add(rel.slice(0, -"index.html".length));
  urls.add(rel);
}
const version = hash.digest("hex").slice(0, 12);
const tpl = readFileSync("src/sw/sw-template.js", "utf8");
const sw =
  `self.__PRECACHE_MANIFEST = ${JSON.stringify([...urls].sort())};\nself.__PRECACHE_VERSION = ${JSON.stringify(version)};\n` + tpl;
writeFileSync(join(OUT, "sw.js"), sw);
console.log(`build-sw: precached ${urls.size} URLs, version ${version}`);
