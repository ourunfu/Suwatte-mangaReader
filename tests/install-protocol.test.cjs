const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { catalogURL, sourceURL } = require("../scripts/install-protocol.cjs");

test("Saved List directory resolves catalog and each plugin as sibling paths", () => {
  for (const base of [
    "https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages",
    "https://cdn.jsdelivr.net/gh/ourunfu/Suwatte-mangaReader@gh-pages",
  ]) {
    assert.equal(catalogURL(`${base}/`), `${base}/sources.json`);
    for (const id of ["zh.copymanga", "zh.sourcecheck"]) {
      assert.equal(sourceURL(base, { path: id }), `${base}/sources/${id}.stt`);
    }
    assert.throws(() => sourceURL(`${base}/sources.json`, { path: "zh.sourcecheck" }), /directory address/);
  }
});

test("HTTP error bodies from the old file-as-directory URL reproduce script parse failures", () => {
  // Observed HTTP 404 bodies for .../sources.json/sources/zh.sourcecheck.stt.
  for (const body of [
    "404: Not Found",
    "Couldn't find the requested file /sources.json/sources/zh.sourcecheck.stt in ourunfu/Suwatte-mangaReader.",
  ]) {
    assert.throws(() => vm.runInNewContext(body), { name: "SyntaxError" });
  }
});
