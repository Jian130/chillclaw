import AppKit
import Testing
@testable import ChillClawChatUI
@testable import ChillClawNative
@testable import ChillClawProtocol

struct ChatPresentationTests {
    @Test
    func chatScreenOpensComposerDirectlyWithoutNewChatLandingCopy() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = try String(
            contentsOf: packageRoot.appendingPathComponent("Sources/ChillClawNative/Screens.swift"),
            encoding: .utf8
        )
        let chatScreenSource = try #require(
            source
                .components(separatedBy: "struct ChatScreen: View")
                .dropFirst()
                .first?
                .components(separatedBy: "private struct NativeChatSidebarRow")
                .first
        )

        #expect(chatScreenSource.contains("New Chat") == false)
        #expect(chatScreenSource.contains("Choose a chat") == false)
        #expect(chatScreenSource.contains("Create a new chat") == false)
    }

    @Test
    func chatStatusHelpersMapBridgeAndToolStates() {
        #expect(nativeChatComposerLabel(for: "sending") == "Sending")
        #expect(nativeChatComposerLabel(for: "thinking") == "Thinking")
        #expect(nativeChatComposerLabel(for: "streaming") == "Streaming")
        #expect(nativeChatComposerLabel(for: "aborting") == "Stopping")
        #expect(nativeChatComposerTone(for: "failed") == .danger)
        #expect(nativeChatBridgeLabel(for: .reconnecting) == "Reconnecting")
        #expect(nativeChatBridgeTone(for: .disconnected) == .warning)
        #expect(nativeChatToolActivityLabel(for: .running) == "Running")
        #expect(nativeChatToolActivityTone(for: .completed) == .success)
    }

    @Test
    func composerShortcutHelpersMatchCodexStyleBehavior() {
        #expect(
            nativeChatShouldHandleComposerPlainReturn(
                keyCode: 36,
                modifierFlags: [],
                isComposing: false
            ) == true
        )
        #expect(
            nativeChatShouldSendComposerShortcut(
                keyCode: 36,
                modifierFlags: [],
                isComposing: false,
                canSend: true,
                draft: "Send this"
            ) == true
        )
        #expect(
            nativeChatShouldSendComposerShortcut(
                keyCode: 36,
                modifierFlags: [.shift],
                isComposing: false,
                canSend: true,
                draft: "Keep newline"
            ) == false
        )
        #expect(
            nativeChatShouldSendComposerShortcut(
                keyCode: 36,
                modifierFlags: [],
                isComposing: true,
                canSend: true,
                draft: "正在输入"
            ) == false
        )
        #expect(
            nativeChatShouldHandleComposerPlainReturn(
                keyCode: 36,
                modifierFlags: [.shift],
                isComposing: false
            ) == false
        )
        #expect(
            nativeChatShouldInsertComposerLineBreak(
                keyCode: 36,
                modifierFlags: [.shift],
                isComposing: false
            ) == true
        )
    }

    @Test
    func chatSidebarHelpersKeepTheMinimalRailDimensionsConsistent() {
        #expect(nativeChatSidebarWidth(collapsed: false) == 272)
        #expect(nativeChatSidebarWidth(collapsed: true) == 76)
        #expect(nativeChatShowsSidebarLabels(collapsed: false) == true)
        #expect(nativeChatShowsSidebarLabels(collapsed: true) == false)
    }
}
