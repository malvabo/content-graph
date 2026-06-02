import Foundation
import UIKit

enum RecordingEngineState: Equatable, CustomStringConvertible {
    case idle
    case recordingAll
    case recordingAudioOnly
    case paused

    var description: String {
        switch self {
        case .idle:
            return "idle"
        case .recordingAll:
            return "recordingAll"
        case .recordingAudioOnly:
            return "recordingAudioOnly"
        case .paused:
            return "paused"
        }
    }
}

@MainActor
final class RecordingEngine: ObservableObject {
    static let shared = RecordingEngine()

    @Published private(set) var state: RecordingEngineState = .idle

    private let instanceID = UUID()
    private var observers: [NSObjectProtocol] = []
    private var hasStartedObserving = false

    private init() {
        log("initialized")
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
        print("[RecordingEngine \(instanceID)] deinitialized")
    }

    func bootstrap() {
        guard !hasStartedObserving else {
            log("bootstrap ignored; observers already registered")
            return
        }

        hasStartedObserving = true

        let center = NotificationCenter.default
        observers.append(
            center.addObserver(
                forName: UIScene.didEnterBackgroundNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.sceneDidEnterBackground()
                }
            }
        )

        observers.append(
            center.addObserver(
                forName: UIScene.didActivateNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.sceneDidBecomeActive()
                }
            }
        )

        log("registered scene lifecycle observers")
    }

    func start() {
        transition(to: .recordingAll, reason: "start requested")
    }

    func pause() {
        transition(to: .paused, reason: "pause requested")
    }

    func stop() {
        transition(to: .idle, reason: "stop requested")
    }

    private func sceneDidEnterBackground() {
        guard state == .recordingAll else {
            log("sceneDidEnterBackground received; state remains \(state)")
            return
        }

        transition(to: .recordingAudioOnly, reason: "sceneDidEnterBackground")
    }

    private func sceneDidBecomeActive() {
        guard state == .recordingAudioOnly else {
            log("sceneDidBecomeActive received; state remains \(state)")
            return
        }

        transition(to: .recordingAll, reason: "sceneDidBecomeActive")
    }

    private func transition(to newState: RecordingEngineState, reason: String) {
        guard state != newState else {
            log("\(reason); already \(state)")
            return
        }

        let oldState = state
        state = newState
        log("\(reason): \(oldState) -> \(newState)")
    }

    private func log(_ message: String) {
        print("[RecordingEngine \(instanceID)] \(message)")
    }
}
