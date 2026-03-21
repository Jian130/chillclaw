import AppKit
import Testing
@testable import SlackClawNative

struct LaunchSupportTests {
    @Test
    @MainActor
    func launchCoordinatorActivatesForegroundAppAndFrontsWindow() {
        let app = FakeNativeApplication()

        NativeLaunchCoordinator.configure(app)

        #expect(app.activationPolicies == [.regular])
        #expect(app.activateCalls == [true])
        #expect(app.firstWindowVisibleCalls == 1)
    }
}

private final class FakeNativeApplication: NativeApplicationControlling {
    var activationPolicies: [NSApplication.ActivationPolicy] = []
    var activateCalls: [Bool] = []
    var firstWindowVisibleCalls = 0

    @discardableResult
    func setActivationPolicy(_ activationPolicy: NSApplication.ActivationPolicy) -> Bool {
        activationPolicies.append(activationPolicy)
        return true
    }

    func activate(ignoringOtherApps flag: Bool) {
        activateCalls.append(flag)
    }

    func makeFirstWindowVisible() {
        firstWindowVisibleCalls += 1
    }
}
