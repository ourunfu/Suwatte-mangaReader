const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { validateCatalog, sourceURL, bootstrap } = require("../scripts/install-protocol.cjs");

const root = path.resolve(__dirname, "../dist");
const catalog = validateCatalog(JSON.parse(fs.readFileSync(path.join(root, "sources.json"), "utf8")));

test("catalog contains the reader and the dependency-free diagnostic", () => {
  assert.deepEqual(catalog.sources.map(source => source.id).sort(), ["zh.copymanga", "zh.sourcecheck"]);
});

test("official generated install links use the directory address documented for Saved Lists", () => {
  const pageScript = fs.readFileSync(path.join(root, "catalog.js"), "utf8");
  for (const base of [
    "https://raw.githubusercontent.com/ourunfu/Suwatte-mangaReader/gh-pages",
    "https://cdn.jsdelivr.net/gh/ourunfu/Suwatte-mangaReader@gh-pages",
  ]) {
    const context = {
      window: { location: { href: `${base}/index.html?preview=true#sources` } },
      document: { getElementById: () => ({}) },
      // Keep the page's unrelated async rendering dormant.
      fetch: () => new Promise(() => {}),
    };
    vm.runInNewContext(`${pageScript}\nredirectToCatalog();`, context);
    const link = new URL(context.window.location.href);
    assert.equal(link.protocol, "suwatte:");
    assert.equal(link.hostname, "AddSourceList");
    assert.equal(link.searchParams.get("list"), base);
    assert.equal(new URL(sourceURL(link.searchParams.get("list"), catalog.sources[0])).pathname,
      new URL(`${base}/sources/${catalog.sources[0].path}.stt`).pathname);
  }
});

for (const source of catalog.sources) {
  test(`${source.id}: catalog-resolved STT initializes without Node or network access`, async () => {
    const url = new URL(sourceURL("https://example.org", source));
    const filename = path.join(root, url.pathname);
    const instance = bootstrap(fs.readFileSync(filename, "utf8"), source, filename);
    if (source.id === "zh.sourcecheck") {
      const result = await instance.getItemList();
      assert.equal(result.items.length, 0);
      assert.equal(result.isLastPage, true);
    }
  });
}
