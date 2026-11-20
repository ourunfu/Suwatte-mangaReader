const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

test("compiled STT can initialize without Node require", () => {
  const filename = path.resolve(__dirname, "../dist/sources/zh.copymanga.stt");
  const program = fs.readFileSync(filename, "utf8");
  const context = {
    console,
    URL,
    HttpClient: class HttpClient {
      constructor(config) { this.config = config; }
    },
  };
  vm.runInNewContext(program, context, { filename, timeout: 3000 });
  const pkg = context.SourcePackage;
  assert.ok(pkg, "SourcePackage global exists");
  assert.ok(pkg.SourceMetadata, "Bundle exports SourceMetadata");
  assert.equal(pkg.SourceMetadata.id, "zh.copymanga");
  assert.equal(typeof pkg.bootstrap, "function");
  const source = pkg.bootstrap();
  assert.equal(typeof source.getSearchResults, "function");
  assert.equal(typeof source.getChapters, "function");
  assert.equal(typeof source.getChapterPages, "function");
});
