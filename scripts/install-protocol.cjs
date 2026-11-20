const assert = require("node:assert/strict");
const vm = require("node:vm");

// The toolchain's AddSourceList deep link supplies the catalog DIRECTORY.
// See https://github.com/Suwatte/Toolchain/blob/main/src/templates/catalog.js
function listBase(address) {
  const url = new URL(address);
  assert.equal(url.protocol, "https:", "Saved List address must use HTTPS");
  assert.ok(!url.search && !url.hash, "Saved List address must not contain a query or fragment");
  assert.ok(!/\/(?:sources\.json|index\.html)\/?$/i.test(url.pathname),
    "Use the Saved List directory address, without /sources.json or /index.html");
  return url.href.replace(/\/+$/, "");
}

function catalogURL(address) {
  return `${listBase(address)}/sources.json`;
}

function sourceURL(address, source) {
  assert.match(source.path, /^[a-zA-Z0-9_.-]+$/, "Catalog path must be an artifact basename");
  assert.ok(!source.path.endsWith(".stt"), "Catalog path must omit .stt");
  return `${listBase(address)}/sources/${source.path}.stt`;
}

function validateCatalog(catalog) {
  assert.equal(catalog.catalogVersion, 2);
  assert.ok(Array.isArray(catalog.sources) && catalog.sources.length > 0);
  const ids = new Set();
  for (const source of catalog.sources) {
    assert.ok(source.id && !ids.has(source.id), "Catalog IDs must be present and unique");
    ids.add(source.id);
    assert.equal(typeof source.version, "number");
    assert.ok(Number.isFinite(source.version));
    assert.ok(Array.isArray(source.languages) && source.languages.length > 0);
    assert.equal(typeof source.rating, "number");
    assert.ok(source.variantId && source.sourceId);
    assert.ok(["jsc", "webkit"].includes(source.environment));
    sourceURL("https://example.org/catalog", source);
  }
  return catalog;
}

function bootstrap(program, source, filename) {
  const context = {
    console,
    HttpClient: class HttpClient {
      constructor(config) { this.config = config; }
      get() { throw new Error("Installation bootstrap must not access the network"); }
    },
  };
  vm.runInNewContext(program, context, { filename, timeout: 3000 });
  const pkg = context.SourcePackage;
  assert.ok(pkg, "Downloaded bytes must export SourcePackage, not JSON or an HTTP error");
  assert.equal(pkg.SourceMetadata.id, source.id);
  assert.equal(pkg.SourceMetadata.version, source.version);
  assert.equal(typeof pkg.bootstrap, "function");
  const instance = vm.runInNewContext("SourcePackage.bootstrap()", context, { timeout: 3000 });
  for (const method of ["getItemList", "getSearchResults", "getContent", "getChapters", "getChapterPages"]) {
    assert.equal(typeof instance[method], "function", `${source.id}.${method}`);
  }
  return instance;
}

module.exports = { listBase, catalogURL, sourceURL, validateCatalog, bootstrap };
