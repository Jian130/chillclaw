import Foundation
import Testing
@testable import SlackClawNative
@testable import SlackClawClient
@testable import SlackClawChatUI
@testable import SlackClawProtocol

@MainActor
@Suite(.serialized)
struct OnboardingTests {
    @Test
    func appStateRequiresOnboardingWhenSetupIncomplete() {
        let appState = SlackClawAppState()
        appState.overview = makeOverview(setupCompleted: false)

        #expect(appState.requiresOnboarding == true)

        appState.overview = makeOverview(setupCompleted: true)
        #expect(appState.requiresOnboarding == false)
    }

    @Test
    func onboardingDestinationMapsToNativeSection() {
        #expect(onboardingDestinationSection(.team) == .team)
        #expect(onboardingDestinationSection(.dashboard) == .dashboard)
        #expect(onboardingDestinationSection(.chat) == .chat)
    }

    @Test
    func nativeOnboardingForcesLightAppearance() {
        #expect(nativeOnboardingPreferredColorScheme == .light)
    }

    @Test
    func buildsOnboardingMemberRequestWithDeterministicHiddenFields() {
        let request = buildOnboardingMemberRequest(
            .init(
                name: "Alex Morgan",
                jobTitle: "Research Analyst",
                avatarPresetId: "onboarding-analyst",
                personalityTraits: ["Analytical", "Detail-Oriented"],
                skillIds: ["research", "summarization"],
                memoryEnabled: true,
                brainEntryId: "brain-1"
            )
        )

        #expect(request.name == "Alex Morgan")
        #expect(request.jobTitle == "Research Analyst")
        #expect(request.avatar.presetId == "onboarding-analyst")
        #expect(request.avatar.accent == "#97b5ea")
        #expect(request.avatar.emoji == "🧠")
        #expect(request.avatar.theme == "onboarding")
        #expect(request.personality == "Analytical, Detail-Oriented")
        #expect(request.soul == "Analytical, Detail-Oriented")
        #expect(request.workStyles.isEmpty)
        #expect(request.knowledgePackIds.isEmpty)
        #expect(request.capabilitySettings.memoryEnabled == true)
        #expect(request.capabilitySettings.contextWindow == 128000)
    }

    @Test
    func bootstrapUsesOverviewGateBeforeHeavySectionLoads() async {
        let loadRecorder = NativeLoadRecorder()
        let appState = makeAppState(
            setupCompleted: false,
            selectedSection: .dashboard,
            loader: .init(
                fetchOverview: {
                    await loadRecorder.record("overview")
                    return makeOverview(setupCompleted: false)
                },
                fetchDeploymentTargets: {
                    await loadRecorder.record("deploy")
                    return .init(checkedAt: "2026-03-20T00:00:00.000Z", targets: [])
                },
                fetchModelConfig: {
                    await loadRecorder.record("models")
                    return emptyModelConfig()
                },
                fetchChannelConfig: {
                    await loadRecorder.record("channels")
                    return emptyChannelConfig()
                },
                fetchSkillsConfig: {
                    await loadRecorder.record("skills")
                    return emptySkillConfig()
                },
                fetchAITeamOverview: {
                    await loadRecorder.record("team")
                    return emptyAITeamOverview()
                }
            )
        )

        await appState.bootstrap()

        #expect(appState.hasBootstrapped == true)
        #expect(appState.requiresOnboarding == true)
        #expect(appState.errorMessage == nil)
        #expect(await loadRecorder.events() == ["overview"])
    }

    @Test
    func refreshAllLoadsOnlyCurrentSectionData() async {
        let loadRecorder = NativeLoadRecorder()
        let appState = makeAppState(
            setupCompleted: true,
            selectedSection: .dashboard,
            loader: .init(
                fetchOverview: {
                    await loadRecorder.record("overview")
                    return makeOverview(setupCompleted: true)
                },
                fetchDeploymentTargets: {
                    await loadRecorder.record("deploy")
                    return .init(checkedAt: "2026-03-20T00:00:00.000Z", targets: [])
                },
                fetchModelConfig: {
                    await loadRecorder.record("models")
                    return emptyModelConfig()
                },
                fetchChannelConfig: {
                    await loadRecorder.record("channels")
                    return emptyChannelConfig()
                },
                fetchSkillsConfig: {
                    await loadRecorder.record("skills")
                    return emptySkillConfig()
                },
                fetchAITeamOverview: {
                    await loadRecorder.record("team")
                    return emptyAITeamOverview()
                }
            )
        )

        await appState.refreshAll()

        #expect(appState.errorMessage == nil)
        #expect(await loadRecorder.events() == ["overview", "models", "team"])
    }

    @Test
    func onboardingBootstrapReusesExistingOverviewWithoutRefetchingIt() async throws {
        let recorder = NativeRequestRecorder()
        let session = await recorder.session { request in
            let path = request.url?.path ?? ""
            if path == "/api/overview" {
                throw URLError(.timedOut)
            }

            #expect(path == "/api/onboarding/state")

            let response = HTTPURLResponse(
                url: try #require(request.url),
                statusCode: 200,
                httpVersion: nil,
                headerFields: ["Content-Type": "application/json"]
            )!
            let body = """
            {
              "firstRun": {
                "introCompleted": true,
                "setupCompleted": false
              },
              "draft": {
                "currentStep": "welcome"
              },
              "summary": {}
            }
            """
            return (response, Data(body.utf8))
        }

        let configuration = SlackClawClientConfiguration(
            daemonURL: URL(string: "http://127.0.0.1:4545")!,
            fallbackWebURL: URL(string: "http://127.0.0.1:4545/")!
        )
        let client = SlackClawAPIClient(
            session: session,
            configurationProvider: { configuration }
        )
        let appState = SlackClawAppState(
            configuration: configuration,
            client: client,
            endpointStore: DaemonEndpointStore(configuration: configuration, ping: { true }),
            processManager: DaemonProcessManager(launchAgent: FakeLaunchAgentController(), ping: { true }),
            chatViewModel: SlackClawChatViewModel(transport: FakeChatTransport()),
            loader: .init(
                fetchOverview: { makeOverview(setupCompleted: false) },
                fetchDeploymentTargets: { .init(checkedAt: "2026-03-20T00:00:00.000Z", targets: []) },
                fetchModelConfig: { emptyModelConfig() },
                fetchChannelConfig: { emptyChannelConfig() },
                fetchSkillsConfig: { emptySkillConfig() },
                fetchAITeamOverview: { emptyAITeamOverview() }
            )
        )
        appState.overview = makeOverview(setupCompleted: false)

        let emptyStream = AsyncStream<SlackClawEvent> { continuation in
            continuation.finish()
        }
        let viewModel = NativeOnboardingViewModel(
            appState: appState,
            daemonEventStreamFactory: { emptyStream }
        )
        await viewModel.bootstrap()

        #expect(viewModel.pageError == nil)
        #expect(await recorder.recordedURLs() == ["http://127.0.0.1:4545/api/onboarding/state?fresh=1"])
    }

    @Test
    func onboardingRefreshResourceMapsDaemonEventsByStep() {
        let installEvent = SlackClawEvent.deployCompleted(
            correlationId: "deploy-1",
            targetId: "managed-local",
            status: "completed",
            message: "Installed.",
            engineStatus: makeOverview(setupCompleted: true).engine
        )
        let modelEvent = SlackClawEvent.configApplied(resource: .models, summary: "Models saved.")
        let channelEvent = SlackClawEvent.channelSessionUpdated(
            channelId: "wechat",
            session: .init(
                id: "session-1",
                channelId: "wechat",
                entryId: nil,
                status: "ready",
                message: "Ready",
                logs: [],
                launchUrl: nil,
                inputPrompt: nil
            )
        )
        let employeeEvent = SlackClawEvent.configApplied(resource: .aiEmployees, summary: "AI employees saved.")
        let unrelatedEvent = SlackClawEvent.taskProgress(taskId: "task-1", status: .running, message: "Working")

        #expect(onboardingRefreshResourceForEvent(.install, installEvent) == .overview)
        #expect(onboardingRefreshResourceForEvent(.model, modelEvent) == .model)
        #expect(onboardingRefreshResourceForEvent(.channel, channelEvent) == .channel)
        #expect(onboardingRefreshResourceForEvent(.employee, employeeEvent) == .team)
        #expect(onboardingRefreshResourceForEvent(.complete, employeeEvent) == .team)
        #expect(onboardingRefreshResourceForEvent(.welcome, unrelatedEvent) == nil)
        #expect(onboardingRefreshResourceForEvent(.model, unrelatedEvent) == nil)
    }

    @Test
    func onboardingDaemonEventsRefreshOnlyTheCurrentStepResource() async throws {
        let recorder = NativeRequestRecorder()
        let session = await recorder.session { request in
            let url = try #require(request.url)
            switch url.path {
            case "/api/onboarding/state":
                let body = try JSONEncoder.slackClaw.encode(makeOnboardingStateResponse(step: .model))
                return (jsonResponse(url: url), body)
            case "/api/models/config":
                let body = try JSONEncoder.slackClaw.encode(emptyModelConfig())
                return (jsonResponse(url: url), body)
            case "/api/channels/config":
                let body = try JSONEncoder.slackClaw.encode(emptyChannelConfig())
                return (jsonResponse(url: url), body)
            case "/api/ai-team/overview":
                let body = try JSONEncoder.slackClaw.encode(emptyAITeamOverview())
                return (jsonResponse(url: url), body)
            default:
                throw URLError(.badURL)
            }
        }

        let configuration = SlackClawClientConfiguration(
            daemonURL: URL(string: "http://127.0.0.1:4545")!,
            fallbackWebURL: URL(string: "http://127.0.0.1:4545/")!
        )
        let client = SlackClawAPIClient(
            session: session,
            configurationProvider: { configuration }
        )
        let appState = SlackClawAppState(
            configuration: configuration,
            client: client,
            endpointStore: DaemonEndpointStore(configuration: configuration, ping: { true }),
            processManager: DaemonProcessManager(launchAgent: FakeLaunchAgentController(), ping: { true }),
            chatViewModel: SlackClawChatViewModel(transport: FakeChatTransport()),
            loader: .init(
                fetchOverview: { makeOverview(setupCompleted: false) },
                fetchDeploymentTargets: { .init(checkedAt: "2026-03-20T00:00:00.000Z", targets: []) },
                fetchModelConfig: { emptyModelConfig() },
                fetchChannelConfig: { emptyChannelConfig() },
                fetchSkillsConfig: { emptySkillConfig() },
                fetchAITeamOverview: { emptyAITeamOverview() }
            )
        )
        appState.overview = makeOverview(setupCompleted: false)

        let eventStream = AsyncStream<SlackClawEvent> { continuation in
            continuation.yield(.configApplied(resource: .models, summary: "Models saved."))
            continuation.finish()
        }

        let viewModel = NativeOnboardingViewModel(
            appState: appState,
            daemonEventStreamFactory: { eventStream }
        )

        await viewModel.bootstrap()
        await waitForRecordedURLCount(recorder, expectedCount: 3)

        #expect(
            await recorder.recordedURLs() == [
                "http://127.0.0.1:4545/api/onboarding/state?fresh=1",
                "http://127.0.0.1:4545/api/models/config?fresh=1",
                "http://127.0.0.1:4545/api/models/config?fresh=1"
            ]
        )
    }

    @Test
    func onboardingDaemonEventsIgnoreIrrelevantSteps() async throws {
        let recorder = NativeRequestRecorder()
        let session = await recorder.session { request in
            let url = try #require(request.url)
            switch url.path {
            case "/api/onboarding/state":
                let body = try JSONEncoder.slackClaw.encode(makeOnboardingStateResponse(step: .channel))
                return (jsonResponse(url: url), body)
            case "/api/channels/config":
                let body = try JSONEncoder.slackClaw.encode(emptyChannelConfig())
                return (jsonResponse(url: url), body)
            case "/api/models/config":
                let body = try JSONEncoder.slackClaw.encode(emptyModelConfig())
                return (jsonResponse(url: url), body)
            case "/api/ai-team/overview":
                let body = try JSONEncoder.slackClaw.encode(emptyAITeamOverview())
                return (jsonResponse(url: url), body)
            default:
                throw URLError(.badURL)
            }
        }

        let configuration = SlackClawClientConfiguration(
            daemonURL: URL(string: "http://127.0.0.1:4545")!,
            fallbackWebURL: URL(string: "http://127.0.0.1:4545/")!
        )
        let client = SlackClawAPIClient(
            session: session,
            configurationProvider: { configuration }
        )
        let appState = SlackClawAppState(
            configuration: configuration,
            client: client,
            endpointStore: DaemonEndpointStore(configuration: configuration, ping: { true }),
            processManager: DaemonProcessManager(launchAgent: FakeLaunchAgentController(), ping: { true }),
            chatViewModel: SlackClawChatViewModel(transport: FakeChatTransport()),
            loader: .init(
                fetchOverview: { makeOverview(setupCompleted: false) },
                fetchDeploymentTargets: { .init(checkedAt: "2026-03-20T00:00:00.000Z", targets: []) },
                fetchModelConfig: { emptyModelConfig() },
                fetchChannelConfig: { emptyChannelConfig() },
                fetchSkillsConfig: { emptySkillConfig() },
                fetchAITeamOverview: { emptyAITeamOverview() }
            )
        )
        appState.overview = makeOverview(setupCompleted: false)

        let eventStream = AsyncStream<SlackClawEvent> { continuation in
            continuation.yield(.taskProgress(taskId: "task-1", status: .running, message: "Working"))
            continuation.finish()
        }

        let viewModel = NativeOnboardingViewModel(
            appState: appState,
            daemonEventStreamFactory: { eventStream }
        )

        await viewModel.bootstrap()
        await waitForRecordedURLCount(recorder, expectedCount: 2)

        let urls = await recorder.recordedURLs()
        #expect(urls.contains("http://127.0.0.1:4545/api/onboarding/state?fresh=1"))
        #expect(urls.contains("http://127.0.0.1:4545/api/channels/config?fresh=1"))
        #expect(urls.contains("http://127.0.0.1:4545/api/models/config?fresh=1"))
        #expect(urls.filter { $0.contains("/api/channels/config") }.count == 1)
        #expect(urls.filter { $0.contains("/api/models/config") }.count == 1)
        #expect(urls.filter { $0.contains("/api/ai-team/overview") }.isEmpty)
    }
}

private func makeOverview(setupCompleted: Bool) -> ProductOverview {
    .init(
        appName: "SlackClaw",
        appVersion: "0.1.2",
        platformTarget: "macOS first",
        firstRun: .init(introCompleted: true, setupCompleted: setupCompleted, selectedProfileId: nil),
        appService: .init(mode: .launchagent, installed: true, running: true, managedAtLogin: true, label: nil, summary: "Running", detail: "Loaded"),
        engine: .init(engine: "openclaw", installed: true, running: true, version: "2026.3.13", summary: "Ready", pendingGatewayApply: false, pendingGatewayApplySummary: nil, lastCheckedAt: "2026-03-20T00:00:00.000Z"),
        installSpec: .init(engine: "openclaw", desiredVersion: "latest", installSource: "npm-local", prerequisites: ["macOS"], installPath: nil),
        capabilities: .init(engine: "openclaw", supportsInstall: true, supportsUpdate: true, supportsRecovery: true, supportsStreaming: true, runtimeModes: ["gateway"], supportedChannels: ["telegram"], starterSkillCategories: ["communication"], futureLocalModelFamilies: ["qwen"]),
        installChecks: [],
        channelSetup: .init(baseOnboardingCompleted: true, channels: [], nextChannelId: nil, gatewayStarted: true, gatewaySummary: "Running"),
        profiles: [],
        templates: [],
        healthChecks: [],
        recoveryActions: [],
        recentTasks: []
    )
}

@MainActor
private func makeAppState(
    setupCompleted: Bool,
    selectedSection: NativeSection,
    loader: SlackClawAppDataLoader
) -> SlackClawAppState {
    let configuration = SlackClawClientConfiguration(
        daemonURL: URL(string: "http://127.0.0.1:4545")!,
        fallbackWebURL: URL(string: "http://127.0.0.1:4545/")!
    )
    let client = SlackClawAPIClient(configurationProvider: { configuration })
    let endpointStore = DaemonEndpointStore(configuration: configuration, ping: { true })
    let processManager = DaemonProcessManager(launchAgent: FakeLaunchAgentController(), ping: { true })
    let chatViewModel = SlackClawChatViewModel(transport: FakeChatTransport())
    let appState = SlackClawAppState(
        configuration: configuration,
        client: client,
        endpointStore: endpointStore,
        processManager: processManager,
        chatViewModel: chatViewModel,
        loader: loader
    )
    appState.selectedSection = selectedSection
    appState.overview = makeOverview(setupCompleted: setupCompleted)
    return appState
}

private func emptyModelConfig() -> ModelConfigOverview {
    .init(
        providers: [],
        models: [],
        defaultModel: nil,
        configuredModelKeys: [],
        savedEntries: [],
        defaultEntryId: nil,
        fallbackEntryIds: []
    )
}

private func emptyChannelConfig() -> ChannelConfigOverview {
    .init(
        baseOnboardingCompleted: true,
        capabilities: [],
        entries: [],
        activeSession: nil,
        gatewaySummary: "Gateway ready"
    )
}

private func emptySkillConfig() -> SkillCatalogOverview {
    .init(
        managedSkillsDir: nil,
        workspaceDir: nil,
        marketplaceAvailable: true,
        marketplaceSummary: "Ready",
        installedSkills: [],
        readiness: .init(total: 0, eligible: 0, disabled: 0, blocked: 0, missing: 0, warnings: [], summary: "Ready"),
        marketplacePreview: []
    )
}

private func emptyAITeamOverview() -> AITeamOverview {
    .init(
        teamVision: "",
        members: [],
        teams: [],
        activity: [],
        availableBrains: [],
        knowledgePacks: [],
        skillOptions: []
    )
}

private func makeOnboardingStateResponse(step: OnboardingStep) -> OnboardingStateResponse {
    .init(
        firstRun: .init(introCompleted: true, setupCompleted: false),
        draft: .init(currentStep: step),
        summary: .init()
    )
}

private func jsonResponse(url: URL) -> HTTPURLResponse {
    HTTPURLResponse(
        url: url,
        statusCode: 200,
        httpVersion: nil,
        headerFields: ["Content-Type": "application/json"]
    )!
}

private func waitForRecordedURLCount(_ recorder: NativeRequestRecorder, expectedCount: Int) async {
    for _ in 0 ..< 50 {
        if await recorder.recordedURLs().count >= expectedCount {
            return
        }

        try? await Task.sleep(nanoseconds: 10_000_000)
    }
}

private actor NativeLoadRecorder {
    private var recorded: [String] = []

    func record(_ event: String) {
        recorded.append(event)
    }

    func events() -> [String] {
        recorded
    }
}

private actor NativeRequestRecorder {
    private var requests: [URLRequest] = []

    func session(handler: @escaping @Sendable (URLRequest) async throws -> (HTTPURLResponse, Data)) async -> URLSession {
        await MainActor.run {
            NativeRecordingURLProtocol.handler = { request in
                await self.record(request)
                return try await handler(request)
            }
        }

        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [NativeRecordingURLProtocol.self]
        return URLSession(configuration: configuration)
    }

    func record(_ request: URLRequest) {
        requests.append(request)
    }

    func recordedURLs() -> [String] {
        requests.compactMap { $0.url?.absoluteString }
    }
}

private struct FakeChatTransport: SlackClawChatTransport {
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
            lastPreview: nil,
            lastMessageAt: nil,
            unreadCount: 0,
            activeRunState: nil,
            historyStatus: "loaded",
            composerState: .init(status: "idle", canSend: true, canAbort: false),
            messages: []
        )
    }

    func createThread(memberId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "created", overview: .init(threads: []), thread: nil)
    }

    func sendMessage(threadId: String, message: String, clientMessageId: String?) async throws -> ChatActionResponse {
        .init(status: "completed", message: "sent", overview: .init(threads: []), thread: nil)
    }

    func abort(threadId: String) async throws -> ChatActionResponse {
        .init(status: "completed", message: "aborted", overview: .init(threads: []), thread: nil)
    }

    func events() async throws -> AsyncThrowingStream<ChatStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish()
        }
    }
}

private actor FakeLaunchAgentController: LaunchAgentControlling {
    func installAndStart() async throws {}
    func stopAndRemove() async throws {}
    func restart() async throws {}

    func status() async -> LaunchAgentStatus {
        .init(installed: true, running: true, detail: "fake")
    }
}

private final class NativeRecordingURLProtocol: URLProtocol, @unchecked Sendable {
    @MainActor static var handler: (@Sendable (URLRequest) async throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Task {
            guard let client else { return }
            let handler = await MainActor.run { Self.handler }
            guard let handler else {
                client.urlProtocol(self, didFailWithError: SlackClawClientError.invalidResponse)
                return
            }

            do {
                let (response, data) = try await handler(request)
                client.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                client.urlProtocol(self, didLoad: data)
                client.urlProtocolDidFinishLoading(self)
            } catch {
                client.urlProtocol(self, didFailWithError: error)
            }
        }
    }

    override func stopLoading() {}
}
