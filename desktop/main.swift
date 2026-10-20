import Cocoa
import SwiftUI

struct Item: Codable, Identifiable { var id = UUID(); var text: String; var done = false }
final class Store: ObservableObject {
    @Published var days: [String: [Item]] = [:]
    @Published var date = Date()
    @Published var minimal = UserDefaults.standard.bool(forKey: "minimal")
    @Published var avatar = UserDefaults.standard.bool(forKey: "ball")
    @Published var error: String?
    let url: URL
    var key: String { let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: date) }
    var items: [Item] { days[key] ?? [] }
    var progress: Double { items.isEmpty ? 0 : Double(items.filter(\.done).count) / Double(items.count) }
    init() {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("FeiyueDesktop")
        url = dir.appendingPathComponent("schedule.json")
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: url.path) { days = try JSONDecoder().decode([String: [Item]].self, from: Data(contentsOf: url)) }
        } catch { self.error = "读取日程失败：\(error.localizedDescription)" }
        Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in self?.objectWillChange.send() }
    }
    func save() { do { try JSONEncoder().encode(days).write(to: url, options: .atomic); error = nil } catch { self.error = "保存失败：\(error.localizedDescription)" } }
    func add(_ text: String) { let t = text.trimmingCharacters(in: .whitespacesAndNewlines); guard !t.isEmpty else { return }; days[key, default: []].append(Item(text: t)); save() }
    func change(_ id: UUID, text: String? = nil, toggle: Bool = false) { guard let i = days[key]?.firstIndex(where: { $0.id == id }) else { return }; if let text { days[key]![i].text = text }; if toggle { days[key]![i].done.toggle() }; save() }
    func remove(_ id: UUID) { days[key]?.removeAll { $0.id == id }; save() }
    var color: Color { minimal ? Color(red: 0.34, green: 0.43, blue: 0.38) : Color(red: 0.38, green: 0.68, blue: 0.53) }
}
struct Ring: View {
    @ObservedObject var store: Store
    var body: some View { ZStack { Circle().stroke(Color.gray.opacity(0.2), lineWidth: 5); Circle().trim(from: 0, to: store.progress).stroke(store.color, style: StrokeStyle(lineWidth: 5, lineCap: .round)).rotationEffect(.degrees(-90)); Text("\(Int(store.progress * 100))%").font(.system(size: 13, weight: .semibold)) }.frame(width: 52, height: 52) }
}
struct Ball: View {
    @ObservedObject var store: Store
    var body: some View { ZStack { Circle().fill(Color(red: 1, green: 0.98, blue: 0.94)); if let image = NSImage(named: store.avatar ? "ball" : "avatar") { Image(nsImage: image).resizable().scaledToFill().frame(width: 64, height: 64).clipShape(Circle()) }; Circle().stroke(Color.gray.opacity(0.2), lineWidth: 4); Circle().trim(from: 0, to: store.progress).stroke(store.color, style: StrokeStyle(lineWidth: 4, lineCap: .round)).rotationEffect(.degrees(-90)) }.frame(width: 72, height: 72).padding(6) }
}
struct Row: View {
    @ObservedObject var store: Store
    let item: Item
    var body: some View { HStack(spacing: 10) {
        Button { store.change(item.id, toggle: true) } label: { Image(systemName: item.done ? "checkmark.circle.fill" : "circle").font(.system(size: 21)).foregroundStyle(store.color) }.buttonStyle(.plain)
        TextField("日程", text: Binding(get: { store.items.first(where: { $0.id == item.id })?.text ?? item.text }, set: { store.change(item.id, text: $0) })).textFieldStyle(.plain).strikethrough(item.done).foregroundStyle(item.done ? .secondary : .primary)
        Button { store.remove(item.id) } label: { Image(systemName: "xmark").font(.system(size: 11)).foregroundStyle(.secondary) }.buttonStyle(.plain).help("删除这项日程")
    }.padding(12).background(store.minimal ? Color.white : Color(red: 1, green: 0.96, blue: 0.84)).clipShape(RoundedRectangle(cornerRadius: 12)) }
}
struct ListView: View {
    @ObservedObject var store: Store
    @State private var input = ""
    var close: () -> Void
    var body: some View { VStack(spacing: 16) {
        HStack { VStack(alignment: .leading, spacing: 5) { Text("飞跃日程规划本").font(.system(size: 19, weight: .semibold)); Text("把今天，一件件完成。").font(.system(size: 12)).foregroundStyle(.secondary) }; Spacer(); Button(action: close) { Image(systemName: "chevron.down") }.buttonStyle(.plain).help("收起清单") }
        HStack { Button { store.date = Calendar.current.date(byAdding: .day, value: -1, to: store.date)! } label: { Image(systemName: "chevron.left") }; DatePicker("", selection: $store.date, displayedComponents: .date).labelsHidden(); Button { store.date = Calendar.current.date(byAdding: .day, value: 1, to: store.date)! } label: { Image(systemName: "chevron.right") }; Spacer(); Ring(store: store) }.buttonStyle(.plain)
        HStack { Text("已完成 \(store.items.filter(\.done).count) / \(store.items.count) 项").font(.system(size: 12)).foregroundStyle(.secondary); Spacer(); Button("今天") { store.date = Date() }.buttonStyle(.plain).foregroundStyle(store.color) }
        ScrollView { VStack(spacing: 8) { if store.items.isEmpty { Text("还没有日程\n在下方写下第一件小事吧").font(.system(size: 14)).foregroundStyle(.secondary).multilineTextAlignment(.center).padding(.top, 50) }; ForEach(store.items) { item in Row(store: store, item: item) } } }.frame(maxHeight: .infinity)
        HStack { TextField("添一件要做的事…", text: $input).textFieldStyle(.plain).onSubmit(add); Button(action: add) { Image(systemName: "plus.circle.fill").font(.system(size: 25)).foregroundStyle(store.color) }.buttonStyle(.plain).disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }.padding(12).background(Color.white).clipShape(RoundedRectangle(cornerRadius: 12))
        if let error = store.error { Text(error).font(.caption).foregroundStyle(.red) }
        HStack { Button(store.minimal ? "简约" : "春日彩色") { store.minimal.toggle(); UserDefaults.standard.set(store.minimal, forKey: "minimal") }; Spacer(); Menu("设置") { Button(store.avatar ? "使用认真头像" : "使用蓝色小球") { store.avatar.toggle(); UserDefaults.standard.set(store.avatar, forKey: "ball") }; Button("打开数据文件夹") { NSWorkspace.shared.open(store.url.deletingLastPathComponent()) }; Button("退出飞跃") { NSApp.terminate(nil) } } }.font(.system(size: 11)).buttonStyle(.plain).foregroundStyle(.secondary)
    }.padding(22).frame(width: 360, height: 520).background(Color(red: 0.99, green: 0.98, blue: 0.95)).preferredColorScheme(.light) }
    func add() { store.add(input); input = "" }
}
final class FloatingPanel: NSPanel { override var canBecomeKey: Bool { true }; override var canBecomeMain: Bool { false } }
final class BallHost: NSHostingView<Ball> {
    var action: (() -> Void)?
    var start = NSPoint.zero
    var origin = NSPoint.zero
    var dragged = false
    override func mouseDown(with event: NSEvent) { start = NSEvent.mouseLocation; origin = window!.frame.origin; dragged = false }
    override func mouseDragged(with event: NSEvent) { let p = NSEvent.mouseLocation; let dx = p.x - start.x; let dy = p.y - start.y; if abs(dx) + abs(dy) > 4 { dragged = true }; window?.setFrameOrigin(NSPoint(x: origin.x + dx, y: origin.y + dy)) }
    override func mouseUp(with event: NSEvent) { if !dragged { action?() }; if let p = window?.frame.origin { UserDefaults.standard.set([p.x, p.y], forKey: "position") } }
    required init(rootView: Ball) { super.init(rootView: rootView) }
    @MainActor required dynamic init?(coder: NSCoder) { fatalError() }
}
final class Delegate: NSObject, NSApplicationDelegate {
    let store = Store()
    var ball: FloatingPanel!
    var list: FloatingPanel!
    var status: NSStatusItem!
    func applicationDidFinishLaunching(_ notification: Notification) {
        for name in ["avatar", "ball"] { if let path = Bundle.main.path(forResource: name, ofType: "png"), let image = NSImage(contentsOfFile: path) { image.setName(name) } }
        let screen = NSScreen.main!.visibleFrame
        ball = FloatingPanel(contentRect: NSRect(x: screen.maxX - 110, y: screen.minY + 130, width: 84, height: 84), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        ball.backgroundColor = .clear; ball.isOpaque = false; ball.hasShadow = false
        let host = BallHost(rootView: Ball(store: store)); host.action = { [weak self] in self?.toggle() }; ball.contentView = host
        if let pos = UserDefaults.standard.array(forKey: "position") as? [Double], pos.count == 2, NSScreen.screens.contains(where: { $0.visibleFrame.contains(NSPoint(x: pos[0] + 42, y: pos[1] + 42)) }) { ball.setFrameOrigin(NSPoint(x: pos[0], y: pos[1])) }
        list = FloatingPanel(contentRect: NSRect(x: 0, y: 0, width: 360, height: 520), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        list.backgroundColor = NSColor(calibratedRed: 0.99, green: 0.98, blue: 0.95, alpha: 1); list.hasShadow = true; list.isMovableByWindowBackground = true
        list.contentView = NSHostingView(rootView: ListView(store: store, close: { [weak self] in self?.list.orderOut(nil) }))
        for panel in [ball!, list!] { panel.level = .floating; panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]; panel.hidesOnDeactivate = false; panel.isReleasedWhenClosed = false }
        ball.orderFrontRegardless()
        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength); status.button?.title = "◉ 飞跃"
        let menu = NSMenu(); menu.addItem(withTitle: "显示 / 收起日程", action: #selector(toggle), keyEquivalent: ""); menu.addItem(withTitle: "找回悬浮头像", action: #selector(reset), keyEquivalent: ""); menu.addItem(.separator()); menu.addItem(withTitle: "退出飞跃", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"); for item in menu.items { if item.action != #selector(NSApplication.terminate(_:)) { item.target = self } }; status.menu = menu
    }
    @objc func reset() { let f = NSScreen.main!.visibleFrame; ball.setFrameOrigin(NSPoint(x: f.maxX - 110, y: f.minY + 130)); ball.orderFrontRegardless() }
    @objc func toggle() {
        if list.isVisible { list.orderOut(nil); return }
        store.date = Date()
        let f = ball.screen?.visibleFrame ?? NSScreen.main!.visibleFrame
        let x = min(max(f.minX, ball.frame.minX - 370), f.maxX - 360)
        let y = min(max(f.minY, ball.frame.maxY - 520), f.maxY - 520)
        list.setFrameOrigin(NSPoint(x: x, y: y)); list.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
}
let app = NSApplication.shared
let delegate = Delegate()
app.setActivationPolicy(.accessory)
app.delegate = delegate
app.run()
