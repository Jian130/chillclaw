import Foundation
import ChillClawProtocol

public final class ChillClawEventStreamClient: @unchecked Sendable {
    public typealias RawEventStreamFactory = @Sendable (_ url: URL) async throws -> AsyncThrowingStream<Data, Error>
    public typealias SleepHandler = @Sendable (_ delayNanos: UInt64) async -> Void

    private let configurationProvider: @Sendable () async -> ChillClawClientConfiguration
    private let rawEventStreamFactory: RawEventStreamFactory
    private let reconnectBackoffNanos: [UInt64]
    private let sleepHandler: SleepHandler
    private let communicationLogger: ChillClawCommunicationLogger?

    public init(
        session: URLSession = .shared,
        configurationProvider: @escaping @Sendable () async -> ChillClawClientConfiguration,
        rawEventStreamFactory: RawEventStreamFactory? = nil,
        reconnectBackoffNanos: [UInt64] = [
            250_000_000,
            500_000_000,
            1_000_000_000,
        ],
        sleepHandler: SleepHandler? = nil,
        communicationLogger: ChillClawCommunicationLogger? = nil
    ) {
        self.configurationProvider = configurationProvider
        self.reconnectBackoffNanos = reconnectBackoffNanos
        self.rawEventStreamFactory = rawEventStreamFactory ?? Self.makeDefaultRawEventStreamFactory(session: session)
        self.sleepHandler = sleepHandler ?? { delayNanos in
            try? await Task.sleep(nanoseconds: delayNanos)
        }
        self.communicationLogger = communicationLogger
    }

    public func daemonEvents() -> AsyncStream<ChillClawEvent> {
        AsyncStream { continuation in
            let task = Task {
                var reconnectAttempt = 0

                while !Task.isCancelled {
                    let configuration = await configurationProvider()
                    let url = configuration.daemonURL.appending(path: "/api/events")

                    do {
                        logCommunication("events.stream.connecting", [
                            "url": Self.normalizeDaemonEventSocketURL(url).absoluteString,
                            "attempt": String(reconnectAttempt)
                        ])
                        let rawStream = try await rawEventStreamFactory(url)
                        logCommunication("events.stream.open", [
                            "url": Self.normalizeDaemonEventSocketURL(url).absoluteString
                        ])
                        for try await payload in rawStream {
                            if Task.isCancelled {
                                break
                            }

                            if let event = try? JSONDecoder.chillClaw.decode(ChillClawEvent.self, from: payload) {
                                logCommunication("events.stream.message", Self.eventCommunicationSummary(event))
                                continuation.yield(event)
                            } else {
                                logCommunication("events.stream.malformed-message", [
                                    "byteCount": String(payload.count)
                                ])
                            }
                        }
                    } catch {
                        logCommunication("events.stream.failed", [
                            "error": String(describing: type(of: error))
                        ])
                        // Reconnect below using the same backoff path as a closed stream.
                    }

                    if Task.isCancelled {
                        break
                    }

                    let delay = reconnectBackoffNanos[min(reconnectAttempt, reconnectBackoffNanos.count - 1)]
                    reconnectAttempt = min(reconnectAttempt + 1, reconnectBackoffNanos.count - 1)
                    logCommunication("events.stream.reconnect-scheduled", [
                        "delayNanos": String(delay),
                        "attempt": String(reconnectAttempt)
                    ])
                    await sleepHandler(delay)
                }

                logCommunication("events.stream.closed", [:])
                continuation.finish()
            }

            continuation.onTermination = { @Sendable _ in
                task.cancel()
            }
        }
    }

    static func normalizeDaemonEventSocketURL(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }

        switch components.scheme?.lowercased() {
        case "http":
            components.scheme = "ws"
        case "https":
            components.scheme = "wss"
        default:
            break
        }

        return components.url ?? url
    }

    private static func makeDefaultRawEventStreamFactory(session: URLSession) -> RawEventStreamFactory {
        { url in
            AsyncThrowingStream { continuation in
                let task = session.webSocketTask(with: normalizeDaemonEventSocketURL(url))
                task.resume()

                let receiver = Task {
                    do {
                        while !Task.isCancelled {
                            let message = try await task.receive()
                            switch message {
                            case let .data(data):
                                continuation.yield(data)
                            case let .string(text):
                                if let data = text.data(using: .utf8) {
                                    continuation.yield(data)
                                }
                            @unknown default:
                                break
                            }
                        }
                        continuation.finish()
                    } catch {
                        if Task.isCancelled {
                            continuation.finish()
                        } else {
                            continuation.finish(throwing: error)
                        }
                    }
                }

                continuation.onTermination = { @Sendable _ in
                    receiver.cancel()
                    task.cancel(with: .goingAway, reason: nil)
                }
            }
        }
    }

    private func logCommunication(_ event: String, _ details: [String: String]) {
        communicationLogger?(event, details)
    }

    private static func eventCommunicationSummary(_ event: ChillClawEvent) -> [String: String] {
        switch event {
        case .daemonHeartbeat:
            return ["eventType": "daemon.heartbeat"]
        case let .overviewUpdated(snapshot):
            return snapshotSummary("overview.updated", snapshot)
        case let .aiTeamUpdated(snapshot):
            return snapshotSummary("ai-team.updated", snapshot)
        case let .modelConfigUpdated(snapshot):
            return snapshotSummary("model-config.updated", snapshot)
        case let .channelConfigUpdated(snapshot):
            return snapshotSummary("channel-config.updated", snapshot)
        case let .pluginConfigUpdated(snapshot):
            return snapshotSummary("plugin-config.updated", snapshot)
        case let .skillCatalogUpdated(snapshot):
            return snapshotSummary("skill-catalog.updated", snapshot)
        case let .presetSkillSyncUpdated(snapshot):
            return snapshotSummary("preset-skill-sync.updated", snapshot)
        case let .downloadsUpdated(snapshot):
            return snapshotSummary("downloads.updated", snapshot)
        case let .downloadProgress(jobId, _, _, progress, _):
            return ["eventType": "download.progress", "jobId": jobId, "progress": String(progress)]
        case let .downloadStatus(jobId, status):
            return ["eventType": "download.status", "jobId": jobId, "status": status]
        case let .downloadCompleted(job):
            return ["eventType": "download.completed", "jobId": job.id]
        case let .downloadFailed(jobId, _):
            return ["eventType": "download.failed", "jobId": jobId]
        case let .deployProgress(correlationId, targetId, phase, percent, _):
            return ["eventType": "deploy.progress", "correlationId": correlationId, "targetId": targetId, "phase": phase.rawValue, "percent": percent.map(String.init) ?? ""]
        case let .deployCompleted(correlationId, targetId, status, _, _):
            return ["eventType": "deploy.completed", "correlationId": correlationId, "targetId": targetId, "status": status]
        case let .gatewayStatus(reachable, pendingGatewayApply, _):
            return ["eventType": "gateway.status", "reachable": String(reachable), "pendingGatewayApply": String(pendingGatewayApply)]
        case let .taskProgress(taskId, status, _):
            return ["eventType": "task.progress", "taskId": taskId, "status": status.rawValue]
        case let .localRuntimeProgress(action, phase, percent, _, _):
            return ["eventType": "local-runtime.progress", "action": action, "phase": phase, "percent": percent.map(String.init) ?? ""]
        case let .localRuntimeCompleted(action, status, _, _):
            return ["eventType": "local-runtime.completed", "action": action, "status": status]
        case let .runtimeProgress(resourceId, action, phase, percent, _, _):
            return ["eventType": "runtime.progress", "resourceId": resourceId, "action": action, "phase": phase, "percent": percent.map(String.init) ?? ""]
        case let .runtimeCompleted(resourceId, action, status, _, _):
            return ["eventType": "runtime.completed", "resourceId": resourceId, "action": action, "status": status]
        case let .runtimeUpdateStaged(resourceId, version, _, _):
            return ["eventType": "runtime.update-staged", "resourceId": resourceId, "version": version]
        case let .operationUpdated(operation):
            return operationSummary("operation.updated", operation)
        case let .operationCompleted(operation):
            return operationSummary("operation.completed", operation)
        case let .chatStream(threadId, _, payload):
            return ["eventType": "chat.stream", "threadId": threadId, "payloadType": chatStreamEventType(payload)]
        case let .channelSessionUpdated(channelId, session):
            return ["eventType": "channel.session.updated", "channelId": channelId.rawValue, "sessionId": session.id, "sessionStatus": session.status]
        case let .configApplied(resource, _):
            return ["eventType": "config.applied", "resource": resource.rawValue]
        }
    }

    private static func snapshotSummary<T>(_ eventType: String, _ snapshot: RevisionedSnapshot<T>) -> [String: String] {
        [
            "eventType": eventType,
            "epoch": snapshot.epoch,
            "revision": String(snapshot.revision),
        ]
    }

    private static func operationSummary(_ eventType: String, _ snapshot: RevisionedSnapshot<OperationSummary>) -> [String: String] {
        [
            "eventType": eventType,
            "epoch": snapshot.epoch,
            "revision": String(snapshot.revision),
            "operationId": snapshot.data.operationId,
            "operationScope": snapshot.data.scope,
            "operationAction": snapshot.data.action,
            "operationStatus": snapshot.data.status,
            "operationPhase": snapshot.data.phase ?? "",
        ]
    }

    private static func chatStreamEventType(_ event: ChatStreamEvent) -> String {
        switch event {
        case .threadCreated:
            return "thread-created"
        case .historyLoaded:
            return "history-loaded"
        case .messageCreated:
            return "message-created"
        case .runStarted:
            return "run-started"
        case .assistantThinking:
            return "assistant-thinking"
        case .connectionState:
            return "connection-state"
        case .assistantToolStatus:
            return "assistant-tool-status"
        case .assistantDelta:
            return "assistant-delta"
        case .assistantCompleted:
            return "assistant-completed"
        case .assistantAborted:
            return "assistant-aborted"
        case .assistantFailed:
            return "assistant-failed"
        case .threadUpdated:
            return "thread-updated"
        }
    }
}
