import AppKit
import CoreGraphics
import IOKit
// Only foreground application names. Never query window titles, URLs or keyboard content.
func sample() {
    var idle = CGEventSource.secondsSinceLastEventType(.combinedSessionState, eventType: .null)
    let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOHIDSystem"))
    if service != 0 {
        if let value = IORegistryEntryCreateCFProperty(service, "HIDIdleTime" as CFString, kCFAllocatorDefault, 0)?.takeRetainedValue() as? NSNumber { idle = value.doubleValue / 1_000_000_000 }
        IOObjectRelease(service)
    }
    let app = NSWorkspace.shared.frontmostApplication
    let row: [String: Any] = ["at": Date().timeIntervalSince1970 * 1000, "app": app?.localizedName ?? "未知应用", "idle": idle]
    if let data = try? JSONSerialization.data(withJSONObject: row), let line = String(data: data, encoding: .utf8) {
        print(line)
        fflush(stdout)
    }
}
sample()
Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in sample() }
RunLoop.main.run()
