import Foundation
import JavaScriptCore

struct Catalog: Decodable {
    let catalogVersion: Int
    let sources: [CatalogSource]
}

struct CatalogSource: Decodable {
    let id: String
    let version: Double
    let path: String
    let environment: String
}

struct CheckError: Error, CustomStringConvertible {
    let description: String
}

func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw CheckError(description: message) }
}

func checkException(_ context: JSContext, _ stage: String) throws {
    if let exception = context.exception {
        throw CheckError(description: "\(stage): \(exception.toString() ?? "unknown JavaScript error")")
    }
}

func reproduceDownloadError(_ label: String, _ body: String) throws {
    let context = JSContext()!
    context.evaluateScript(body)
    guard let exception = context.exception else {
        throw CheckError(description: "\(label): expected an HTTP error body to fail JavaScript parsing")
    }
    try require(exception.forProperty("name")?.toString() == "SyntaxError",
                "\(label): expected SyntaxError, got \(exception.toString() ?? "unknown")")
    // Wording can vary by the JavaScriptCore version on the macOS runner.
    print("HTTP error reproduction [\(label)]: \(exception.toString() ?? "SyntaxError")")
}

func checkBundle(_ source: CatalogSource, in directory: URL) throws {
    try require(source.path.range(of: "^[A-Za-z0-9_.-]+$", options: .regularExpression) != nil
                && source.path != "." && source.path != ".." && !source.path.hasSuffix(".stt"),
                "\(source.id): path must be an artifact basename without .stt")
    let fileURL = directory.appendingPathComponent("sources", isDirectory: true)
        .appendingPathComponent(source.path + ".stt")
    let script = try String(contentsOf: fileURL, encoding: .utf8)
    let context = JSContext()!
    // Match the installation environment: no Node globals and no real network.
    context.evaluateScript("""
        var __networkAttempts = 0;
        class HttpClient {
            constructor(config) { this.config = config; }
            request() {
                __networkAttempts += 1;
                throw new Error("Installation bootstrap must not access the network");
            }
            get() { return this.request(); }
            post() { return this.request(); }
            put() { return this.request(); }
            patch() { return this.request(); }
            delete() { return this.request(); }
        }
        """)
    try checkException(context, "\(source.id): initialize test environment")
    context.evaluateScript(script, withSourceURL: fileURL)
    try checkException(context, "\(source.id): evaluate downloaded bundle")

    guard let package = context.objectForKeyedSubscript("SourcePackage"),
          package.isObject, !package.isUndefined,
          let metadata = package.forProperty("SourceMetadata"), metadata.isObject else {
        throw CheckError(description: "\(source.id): missing SourcePackage.SourceMetadata")
    }
    try require(metadata.forProperty("id")?.toString() == source.id,
                "\(source.id): bundle metadata ID does not match sources.json")
    try require(metadata.forProperty("version")?.toDouble() == source.version,
                "\(source.id): bundle version does not match sources.json")
    try require(context.evaluateScript("typeof SourcePackage.bootstrap")?.toString() == "function",
                "\(source.id): missing bootstrap function")
    guard let instance = context.evaluateScript("SourcePackage.bootstrap()") else {
        throw CheckError(description: "\(source.id): bootstrap returned no value")
    }
    try checkException(context, "\(source.id): bootstrap")
    try require(instance.isObject && !instance.isNull && !instance.isUndefined,
                "\(source.id): bootstrap must return a source delegate")
    context.setObject(instance, forKeyedSubscript: "__installedSource" as NSString)
    for method in ["getItemList", "getSearchResults", "getContent", "getChapters", "getChapterPages"] {
        try require(context.evaluateScript("typeof __installedSource.\(method)")?.toString() == "function",
                    "\(source.id): missing delegate method \(method)")
    }
    try require(context.evaluateScript("__networkAttempts")?.toInt32() == 0,
                "\(source.id): bootstrap attempted network access")
    try checkException(context, "\(source.id): validate delegate")
    print("PASS \(source.id) v\(source.version): sources/\(source.path).stt, \(script.utf8.count) UTF-8 bytes, native JSC evaluation and bootstrap")
}

do {
    try require(CommandLine.arguments.count <= 2, "Usage: swift scripts/check_jsc.swift [build-directory]")
    let directory = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "dist", isDirectory: true)
    let catalogData = try Data(contentsOf: directory.appendingPathComponent("sources.json"))
    let catalog = try JSONDecoder().decode(Catalog.self, from: catalogData)
    try require(catalog.catalogVersion == 2, "Expected catalogVersion 2")
    try require(!catalog.sources.isEmpty, "Catalog must declare at least one source")
    try require(Set(catalog.sources.map { $0.id }).count == catalog.sources.count, "Catalog IDs must be unique")

    try reproduceDownloadError("GitHub raw: expected Unexpected token ':'", "404: Not Found")
    try reproduceDownloadError("CDN: expected Unexpected EOF", "Couldn't find the requested file /sources.json/sources/zh.sourcecheck.stt in ourunfu/Suwatte-mangaReader.")

    var checked = 0
    for source in catalog.sources {
        try require(["jsc", "webkit"].contains(source.environment), "\(source.id): unknown environment")
        if source.environment == "jsc" {
            try checkBundle(source, in: directory)
            checked += 1
        } else {
            print("SKIP \(source.id): WebKit bundle requires a WebKit runtime")
        }
    }
    try require(checked > 0, "Catalog declared no JSC bundles to check")
    print("PASS: checked all \(checked) catalog-declared JSC bundles")
} catch {
    fputs("JavaScriptCore validation failed: \(error)\n", stderr)
    exit(1)
}
