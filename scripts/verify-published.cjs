const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { parseArgs } = require("node:util");
const { catalogURL, sourceURL, validateCatalog, bootstrap } = require("./install-protocol.cjs");

const { values } = parseArgs({ options: {
  base: { type: "string", default: "https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages" },
  "expected-dir": { type: "string" },
} });
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), cache: "no-store" });
  assert.equal(response.status, 200, `Download failed: HTTP ${response.status} ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(bytes.length > 0, `Empty download: ${url}`);
  console.log(`HTTP 200 ${url}\n  ${bytes.length} bytes; ${response.headers.get("content-type")}; sha256=${digest(bytes)}`);
  return bytes;
}

async function verify() {
  const catalogBytes = await download(catalogURL(values.base));
  if (values["expected-dir"]) {
    assert.deepEqual(catalogBytes, fs.readFileSync(path.join(values["expected-dir"], "sources.json")),
      "Published catalog does not match this build");
  }
  const catalog = validateCatalog(JSON.parse(catalogBytes.toString("utf8")));
  for (const source of catalog.sources) {
    const url = sourceURL(values.base, source);
    const bytes = await download(url);
    if (values["expected-dir"]) {
      assert.deepEqual(bytes, fs.readFileSync(path.join(values["expected-dir"], "sources", `${source.path}.stt`)),
        `Published ${source.id} does not match this build`);
    }
    bootstrap(bytes.toString("utf8"), source, url);
    console.log(`  ${source.id} v${source.version}: SourcePackage metadata and bootstrap passed`);
  }
}

(async () => {
  // New Git objects can take a moment to reach raw GitHub/CDN edges.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { await verify(); return; }
    catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Attempt ${attempt} failed: ${error.message}; retrying in 5 seconds`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
