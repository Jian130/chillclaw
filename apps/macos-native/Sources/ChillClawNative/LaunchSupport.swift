import AppKit
import Foundation

@MainActor
protocol NativeApplicationControlling: AnyObject {
    @discardableResult
    func setActivationPolicy(_ activationPolicy: NSApplication.ActivationPolicy) -> Bool
    func activate(ignoringOtherApps flag: Bool)
    func makeFirstWindowVisible(minimumSize: CGSize)
}

@MainActor
extension NSApplication: NativeApplicationControlling {
    func makeFirstWindowVisible(minimumSize: CGSize) {
        guard let window = windows.first else { return }
        window.contentMinSize = minimumSize
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
    }
}

@MainActor
struct NativeLaunchCoordinator {
    static func configure(_ app: NativeApplicationControlling) {
        _ = app.setActivationPolicy(.regular)
        app.activate(ignoringOtherApps: true)
        app.makeFirstWindowVisible(minimumSize: nativeOnboardingMinimumWindowSize)
    }
}

@MainActor
func nativeApplicationIconImage() -> NSImage? {
    for extensionName in ["icns", "png"] {
        guard let iconURL = nativeBundledResourceURL(forResource: "ChillClawAppIcon", withExtension: extensionName),
              let iconImage = NSImage(contentsOf: iconURL)
        else { continue }
        return iconImage
    }

    return nil
}

@MainActor
final class NativeAppDelegate: NSObject, NSApplicationDelegate {
    func applicationWillFinishLaunching(_ notification: Notification) {
        NSWindow.allowsAutomaticWindowTabbing = false
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureApplicationIcon()
        NativeLaunchCoordinator.configure(NSApp)

        Task { @MainActor in
            for _ in 0..<5 {
                try? await Task.sleep(nanoseconds: 150_000_000)
                NativeLaunchCoordinator.configure(NSApp)
            }
        }
    }

    private func configureApplicationIcon() {
        NSApp.applicationIconImage = nativeApplicationIconImage()
    }
}
