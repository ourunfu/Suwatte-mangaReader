import Foundation
import JavaScriptCore

let fileURL = URL(fileURLWithPath: CommandLine.arguments[1])
let script = try String(contentsOf: fileURL, encoding: .utf8)
print("JavaScriptCore input UTF8 bytes: \(script.utf8.count)")
let context = JSContext()!
var exceptions: [String] = []
context.exceptionHandler = { _, exception in
  let line = exception?.objectForKeyedSubscript("line")?.toString() ?? "-"
  let col = exception?.objectForKeyedSubscript("column")?.toString() ?? "-"
  let details = exception?.toString() ?? "unknown JS error"
  let record = "\(details) at \(line):\(col)"
  print("JSC EXCEPTION: \(record)")
  exceptions.append(record)
}
context.evaluateScript("class HttpClient { constructor(config) { this.config=config; } }")
context.evaluateScript(script)
if !exceptions.isEmpty { exit(1) }
let package = context.objectForKeyedSubscript("SourcePackage")
print("SourcePackage: \(package?.isUndefined == false ? "present" : "undefined")")
let metadata = package?.forProperty("SourceMetadata")
print("Source metadata ID: \(metadata?.forProperty("id")?.toString() ?? "nil")")
guard metadata?.forProperty("id")?.toString() == "zh.copymanga" else { exit(2) }
let boot = package?.forProperty("bootstrap")
guard let instance = boot?.call(withArguments: []) else { exit(3) }
if !exceptions.isEmpty { exit(4) }
print("Bootstrap constructed: \(instance.isObject)")
