import Foundation
import Testing
@testable import SlackClawChatUI
@testable import SlackClawProtocol

@MainActor
struct ChatViewModelTests {
    @Test
    func sendStartsWithOptimisticPendingMessagesBeforeTheDaemonResponds() async {
        let transport = DelayedSendChatTransport()
        let viewModel = SlackClawChatViewModel(transport: transport)

        await viewModel.refresh()
        viewModel.draftMessage = "Draft a response"

        let sendTask = Task {
            await viewModel.sendCurrentMessage()
        }

        for _ in 0..<50 {
            if viewModel.selectedThread?.messages.count == 2 {
                break
            }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }

        #expect(viewModel.draftMessage.isEmpty)
        #expect(viewModel.selectedThread?.composerState.status == "sending")
        #expect(viewModel.selectedThread?.messages.count == 2)
        #expect(viewModel.selectedThread?.messages.first?.role == "user")
        #expect(viewModel.selectedThread?.messages.last?.pending == true)

        transport.finishSend()
        await sendTask.value
    }

    @Test
    func sendFailurePreservesDraftAndSurfacesError() async {
        let transport = FailingSendChatTransport()
        let viewModel = SlackClawChatViewModel(transport: transport)

        await viewModel.refresh()
        viewModel.draftMessage = "Draft a response"

        await viewModel.sendCurrentMessage()

        #expect(viewModel.draftMessage == "Draft a response")
        #expect(viewModel.errorMessage?.contains("Send failed") == true)
    }

    @Test
    func startRetriesTheEventStreamAfterADisconnect() async {
        let transport = RetryingChatTransport()
        let viewModel = SlackClawChatViewModel(transport: transport)

        await viewModel.start()
        for _ in 0..<100 {
            if transport.eventsCallCount >= 2 {
                break
            }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }

        #expect(transport.eventsCallCount >= 2)
        #expect(viewModel.errorMessage == nil)
    }
}

private final class FailingSendChatTransport: SlackClawChatTransport, @unchecked Sendable {
    func fetchOverview() async throws -> ChatOverview {
        .init(threads: [
            .init(
                id: "thread-1",
                memberId: "member-1",
                agentId: "agent-1",
                sessionKey: "session-1",
                title: "Thread",
                createdAt: "2026-03-20T00:00:00.000Z",
                updatedAt: "2026-03-20T00:00:00.000Z",
                unreadCount: 0,
                historyStatus: "ready",
                composerState: .init(status: "idle", canSend: true, canAbort: false)
            )
        ])
    }

    func fetchThread(threadId: String) async throws -> ChatThreadDetail {
        .init(
            id: threadId,
            memberId: "member-1",
            agentId: "agent-1",
            sessionKey: "session-1",
            title: "Thread",
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            unreadCount: 0,
            historyStatus: "ready",
            composerState: .init(status: "idle", canSend: true, canAbort: false),
            messages: []
        )
    }

    func createThread(memberId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func sendMessage(threadId: String, message: String, clientMessageId: String?) async throws -> ChatActionResponse {
        struct TestFailure: LocalizedError {
            var errorDescription: String? { "Send failed." }
        }

        throw TestFailure()
    }

    func abort(threadId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func events() async throws -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish()
        }
    }
}

private final class DelayedSendChatTransport: SlackClawChatTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var continuation: CheckedContinuation<ChatActionResponse, Error>?

    func fetchOverview() async throws -> ChatOverview {
        .init(threads: [
            .init(
                id: "thread-1",
                memberId: "member-1",
                agentId: "agent-1",
                sessionKey: "session-1",
                title: "Thread",
                createdAt: "2026-03-20T00:00:00.000Z",
                updatedAt: "2026-03-20T00:00:00.000Z",
                unreadCount: 0,
                historyStatus: "ready",
                composerState: .init(status: "idle", canSend: true, canAbort: false)
            )
        ])
    }

    func fetchThread(threadId: String) async throws -> ChatThreadDetail {
        .init(
            id: threadId,
            memberId: "member-1",
            agentId: "agent-1",
            sessionKey: "session-1",
            title: "Thread",
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            unreadCount: 0,
            historyStatus: "ready",
            composerState: .init(status: "idle", canSend: true, canAbort: false),
            messages: []
        )
    }

    func createThread(memberId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func sendMessage(threadId: String, message: String, clientMessageId: String?) async throws -> ChatActionResponse {
        try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            self.continuation = continuation
            lock.unlock()
        }
    }

    func finishSend() {
        lock.lock()
        let continuation = self.continuation
        self.continuation = nil
        lock.unlock()

        continuation?.resume(returning: .init(
            status: "completed",
            message: "ok",
            overview: .init(threads: [
                .init(
                    id: "thread-1",
                    memberId: "member-1",
                    agentId: "agent-1",
                    sessionKey: "session-1",
                    title: "Thread",
                    createdAt: "2026-03-20T00:00:00.000Z",
                    updatedAt: "2026-03-20T00:00:01.000Z",
                    unreadCount: 0,
                    historyStatus: "ready",
                    composerState: .init(status: "thinking", canSend: false, canAbort: true, activityLabel: "Thinking…")
                )
            ]),
            thread: .init(
                id: "thread-1",
                memberId: "member-1",
                agentId: "agent-1",
                sessionKey: "session-1",
                title: "Thread",
                createdAt: "2026-03-20T00:00:00.000Z",
                updatedAt: "2026-03-20T00:00:01.000Z",
                unreadCount: 0,
                historyStatus: "ready",
                composerState: .init(status: "thinking", canSend: false, canAbort: true, activityLabel: "Thinking…"),
                messages: [
                    .init(id: "user-1", role: "user", text: "Draft a response", clientMessageId: "client-1", status: "sent"),
                    .init(id: "assistant-1", role: "assistant", text: "", status: "pending", pending: true)
                ]
            )
        ))
    }

    func abort(threadId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func events() async throws -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish()
        }
    }
}

private final class RetryingChatTransport: SlackClawChatTransport, @unchecked Sendable {
    private let lock = NSLock()
    private(set) var eventsCallCount = 0

    func fetchOverview() async throws -> ChatOverview {
        .init(threads: [])
    }

    func fetchThread(threadId: String) async throws -> ChatThreadDetail {
        .init(
            id: threadId,
            memberId: "member-1",
            agentId: "agent-1",
            sessionKey: "session-1",
            title: "Thread",
            createdAt: "2026-03-20T00:00:00.000Z",
            updatedAt: "2026-03-20T00:00:00.000Z",
            unreadCount: 0,
            historyStatus: "ready",
            composerState: .init(status: "idle", canSend: true, canAbort: false),
            messages: []
        )
    }

    func createThread(memberId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func sendMessage(threadId: String, message: String, clientMessageId: String?) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func abort(threadId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "ok", overview: .init(threads: []), thread: nil)
    }

    func events() async throws -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let call = lock.withLock {
            eventsCallCount += 1
            return eventsCallCount
        }

        if call == 1 {
            struct DisconnectError: LocalizedError {
                var errorDescription: String? { "Disconnected." }
            }
            throw DisconnectError()
        }

        return AsyncThrowingStream { continuation in
            continuation.yield(.connectionState(threadId: "thread-1", state: .connected, detail: "Reconnected."))
            continuation.finish()
        }
    }
}

private extension NSLock {
    func withLock<T>(_ body: () -> T) -> T {
        lock()
        defer { unlock() }
        return body()
    }
}
