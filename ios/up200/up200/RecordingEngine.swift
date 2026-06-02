import Foundation
import AVFoundation
import Speech
import UIKit

enum RecordingEngineState: Equatable, CustomStringConvertible {
    case idle
    case recordingAll
    case recordingAudioOnly
    case paused
    case finalizing
    case recovering
    case error(String)

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
        case .finalizing:
            return "finalizing"
        case .recovering:
            return "recovering"
        case .error(let message):
            return "error(\(message))"
        }
    }
}

struct RecordingStopResult {
    let sessionDirectory: URL?
    let audioSegmentURLs: [URL]
    let transcriptFileURL: URL?
}

@MainActor
final class RecordingEngine: ObservableObject {
    static let shared = RecordingEngine()

    @Published private(set) var state: RecordingEngineState = .idle
    @Published private(set) var activeAudioFileURL: URL?
    @Published private(set) var activeSessionDirectory: URL?
    @Published private(set) var liveTranscript = "" {
        didSet {
            for continuation in transcriptContinuations.values {
                continuation.yield(liveTranscript)
            }
        }
    }

    private let instanceID = UUID()
    private lazy var audioPipeline = ContinuousAudioTrackPipeline(
        onTranscript: { [weak self] transcript in
            Task { @MainActor [weak self] in
                self?.liveTranscript = transcript
            }
        },
        onActiveSegmentChanged: { [weak self] url in
            Task { @MainActor [weak self] in
                self?.activeAudioFileURL = url
            }
        }
    )
    private var observers: [NSObjectProtocol] = []
    private var transcriptContinuations: [UUID: AsyncStream<String>.Continuation] = [:]
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

        observers.append(
            center.addObserver(
                forName: AVAudioSession.interruptionNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                Task { @MainActor [weak self] in
                    self?.handleAudioSessionInterruption(notification)
                }
            }
        )

        observers.append(
            center.addObserver(
                forName: AVAudioSession.mediaServicesWereResetNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.handleMediaServicesReset()
                }
            }
        )

        observers.append(
            center.addObserver(
                forName: AVAudioSession.routeChangeNotification,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                Task { @MainActor [weak self] in
                    self?.handleRouteChange(notification)
                }
            }
        )

        log("registered scene lifecycle observers")
    }

    func transcriptionStream() -> AsyncStream<String> {
        let id = UUID()
        return AsyncStream { continuation in
            continuation.yield(liveTranscript)
            transcriptContinuations[id] = continuation
            continuation.onTermination = { @Sendable [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.transcriptContinuations.removeValue(forKey: id)
                }
            }
        }
    }

    func start() {
        Task { @MainActor in
            await startRecording()
        }
    }

    func pause() {
        Task { @MainActor in
            transition(to: .finalizing, reason: "pause requested")
            _ = await audioPipeline.stop(reason: "pause requested")
            activeAudioFileURL = nil
            activeSessionDirectory = nil
            transition(to: .paused, reason: "pause finalized")
        }
    }

    func stop() {
        Task { @MainActor in
            _ = await stopRecording()
        }
    }

    @discardableResult
    func startRecording() async -> Bool {
        await startRecordingAll()
    }

    @discardableResult
    func stopRecording() async -> RecordingStopResult? {
        guard state == .recordingAll || state == .recordingAudioOnly || state == .paused else {
            log("stop requested; state remains \(state)")
            return nil
        }

        transition(to: .finalizing, reason: "stop requested")
        let result = await audioPipeline.stop(reason: "stop requested")
        activeAudioFileURL = nil
        activeSessionDirectory = nil
        liveTranscript = ""
        transition(to: .idle, reason: "stop finalized")
        return result
    }

    private func sceneDidEnterBackground() {
        guard state == .recordingAll else {
            log("sceneDidEnterBackground received; state remains \(state)")
            return
        }

        audioPipeline.noteAppDidEnterBackground()
        transition(to: .recordingAudioOnly, reason: "sceneDidEnterBackground")
    }

    private func sceneDidBecomeActive() {
        guard state == .recordingAudioOnly else {
            log("sceneDidBecomeActive received; state remains \(state)")
            return
        }

        audioPipeline.noteAppDidBecomeActive()
        transition(to: .recordingAll, reason: "sceneDidBecomeActive")
    }

    private func handleAudioSessionInterruption(_ notification: Notification) {
        guard state == .recordingAll || state == .recordingAudioOnly else { return }
        guard let typeValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else {
            return
        }

        switch type {
        case .began:
            audioPipeline.handleInterruptionBegan()
        case .ended:
            let optionsValue = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: optionsValue)
            audioPipeline.handleInterruptionEnded(shouldResume: options.contains(.shouldResume))
        @unknown default:
            break
        }
    }

    private func handleMediaServicesReset() {
        guard state == .recordingAll || state == .recordingAudioOnly else { return }
        audioPipeline.rebuildAfterMediaServicesReset()
    }

    private func handleRouteChange(_ notification: Notification) {
        guard state == .recordingAll || state == .recordingAudioOnly else { return }
        guard let reasonValue = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        audioPipeline.noteRouteChange(reason: reason)
    }

    private func startRecordingAll() async -> Bool {
        guard state == .idle || state == .paused else {
            log("start requested; state remains \(state)")
            return false
        }

        do {
            try await requestMicrophoneAccess()
            let fileURL = try audioPipeline.start()
            activeAudioFileURL = fileURL
            activeSessionDirectory = audioPipeline.currentSessionDirectory
            transition(to: .recordingAll, reason: "audio pipeline started")
            log("writing AAC audio to \(fileURL.path)")
        } catch {
            activeAudioFileURL = nil
            activeSessionDirectory = nil
            transition(to: .idle, reason: "audio pipeline failed")
            log("audio pipeline error: \(error.localizedDescription)")
            return false
        }

        return true
    }

    private func requestMicrophoneAccess() async throws {
        let granted = await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }

        guard granted else {
            throw RecordingEngineError.microphonePermissionDenied
        }
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

private enum RecordingEngineError: LocalizedError {
    case microphonePermissionDenied
    case missingAudioDevice
    case cannotAddAudioInput
    case cannotAddAudioOutput
    case cannotAddWriterInput
    case writerStartFailed

    var errorDescription: String? {
        switch self {
        case .microphonePermissionDenied:
            return "Microphone permission was denied."
        case .missingAudioDevice:
            return "No audio capture device is available."
        case .cannotAddAudioInput:
            return "The audio input could not be added to the capture session."
        case .cannotAddAudioOutput:
            return "The audio output could not be added to the capture session."
        case .cannotAddWriterInput:
            return "The AAC writer input could not be added."
        case .writerStartFailed:
            return "The asset writer could not start writing."
        }
    }
}

private final class ContinuousAudioTrackPipeline: NSObject, AVCaptureAudioDataOutputSampleBufferDelegate, @unchecked Sendable {
    private let queue = DispatchQueue(label: "com.up200.recording.audio-pipeline", qos: .userInteractive)
    private let maintenanceQueue = DispatchQueue(label: "com.up200.recording.audio-maintenance", qos: .utility)
    private let transcriptionPipeline: LiveTranscriptionPipeline
    private let onActiveSegmentChanged: @Sendable (URL?) -> Void
    private let captureSession = AVCaptureSession()
    private let segmentDuration = CMTime(seconds: 30, preferredTimescale: 600)
    private var audioOutput: AVCaptureAudioDataOutput?
    private var writer: AVAssetWriter?
    private var writerInput: AVAssetWriterInput?
    private var sessionDirectory: URL?
    private var currentFileURL: URL?
    private var currentSegmentStartedAt: CMTime?
    private var hasStartedWriterSession = false
    private var segmentIndex = 0
    private var isRunning = false
    private var isInterrupted = false
    private var shouldQueueSegmentsForCatchUp = false
    private var finalizedSegmentURLs: [URL] = []
    private var pendingSegmentFinishes = 0
    private var pendingStopContinuation: CheckedContinuation<RecordingStopResult, Never>?

    var currentSessionDirectory: URL? {
        queue.sync { sessionDirectory }
    }

    init(
        onTranscript: @escaping @Sendable (String) -> Void,
        onActiveSegmentChanged: @escaping @Sendable (URL?) -> Void
    ) {
        self.transcriptionPipeline = LiveTranscriptionPipeline(onTranscript: onTranscript)
        self.onActiveSegmentChanged = onActiveSegmentChanged
        super.init()
    }

    func start() throws -> URL {
        try queue.sync {
            if isRunning, let currentFileURL {
                return currentFileURL
            }

            return try startLocked()
        }
    }

    func stop(reason: String) async -> RecordingStopResult {
        await withCheckedContinuation { continuation in
            queue.async { [weak self] in
                guard let self else {
                    continuation.resume(returning: RecordingStopResult(
                        sessionDirectory: nil,
                        audioSegmentURLs: [],
                        transcriptFileURL: nil
                    ))
                    return
                }

                self.stopLocked(reason: reason, continuation: continuation)
            }
        }
    }

    func noteAppDidEnterBackground() {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.appendManifestEvent("scene_background")
            self.shouldQueueSegmentsForCatchUp = true
            self.transcriptionPipeline.pauseForSystem(reason: "scene_background")
            self.rotateSegmentLocked(reason: "scene_background", nextStartTime: nil)
            self.healthCheckLocked(reason: "scene_background")
        }
    }

    func noteAppDidBecomeActive() {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.appendManifestEvent("scene_active")
            if self.shouldQueueSegmentsForCatchUp {
                self.rotateSegmentLocked(reason: "scene_active", nextStartTime: nil)
                self.shouldQueueSegmentsForCatchUp = false
            }
            self.healthCheckLocked(reason: "scene_active")
            self.transcriptionPipeline.catchUpFromDiskIfNeeded()
        }
    }

    func handleInterruptionBegan() {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.isInterrupted = true
            self.appendManifestEvent("interruption_began")
            if self.captureSession.isRunning {
                self.captureSession.stopRunning()
            }
            self.rotateSegmentLocked(reason: "interruption_began", nextStartTime: nil)
            self.transcriptionPipeline.pauseForSystem(reason: "interruption_began")
        }
    }

    func handleInterruptionEnded(shouldResume: Bool) {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.appendManifestEvent("interruption_ended shouldResume=\(shouldResume)")
            self.isInterrupted = false
            self.rebuildCaptureAndWriterLocked(reason: "interruption_ended")
        }
    }

    func rebuildAfterMediaServicesReset() {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.appendManifestEvent("media_services_reset")
            self.rebuildCaptureAndWriterLocked(reason: "media_services_reset")
        }
    }

    func noteRouteChange(reason: AVAudioSession.RouteChangeReason) {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.appendManifestEvent("route_change reason=\(reason.rawValue)")
            if reason == .oldDeviceUnavailable || reason == .categoryChange {
                self.healthCheckLocked(reason: "route_change")
            }
        }
    }

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard isRunning, !isInterrupted else { return }

        do {
            try appendAudioSampleLocked(sampleBuffer)
        } catch {
            appendManifestEvent("append_error \(error.localizedDescription)")
            rebuildCaptureAndWriterLocked(reason: "append_error")
        }

        transcriptionPipeline.append(sampleBuffer)
    }

    private func startLocked() throws -> URL {
        try configureAudioSession()
        let directory = try makeSessionDirectory()
        self.sessionDirectory = directory
        self.segmentIndex = 0
        self.isInterrupted = false
        self.shouldQueueSegmentsForCatchUp = false
        self.finalizedSegmentURLs = []
        self.pendingSegmentFinishes = 0
        self.pendingStopContinuation = nil

        try configureCaptureSession()
        let fileURL = try startNewSegmentLocked()
        self.isRunning = true

        transcriptionPipeline.start(sessionDirectory: directory)
        captureSession.startRunning()
        appendManifestEvent("capture_started segment=\(segmentIndex)")

        return fileURL
    }

    private func appendAudioSampleLocked(_ sampleBuffer: CMSampleBuffer) throws {
        let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)

        if let currentSegmentStartedAt,
           timestamp - currentSegmentStartedAt >= segmentDuration {
            rotateSegmentLocked(reason: "duration", nextStartTime: timestamp)
        }

        guard let writer, let writerInput, writer.status == .writing else {
            _ = try startNewSegmentLocked()
            return try appendAudioSampleLocked(sampleBuffer)
        }

        if !hasStartedWriterSession {
            writer.startSession(atSourceTime: timestamp)
            currentSegmentStartedAt = timestamp
            hasStartedWriterSession = true
        }

        guard writerInput.isReadyForMoreMediaData else {
            rotateSegmentLocked(reason: "writer_backpressure", nextStartTime: timestamp)
            guard let newWriterInput = self.writerInput,
                  newWriterInput.isReadyForMoreMediaData else {
                appendManifestEvent("writer_backpressure_drop segment=\(segmentIndex)")
                return
            }
            try appendAudioSampleLocked(sampleBuffer)
            return
        }

        if !writerInput.append(sampleBuffer) {
            throw writer.error ?? RecordingEngineError.writerStartFailed
        }
    }

    private func rotateSegmentLocked(reason: String, nextStartTime: CMTime?) {
        finishCurrentSegmentLocked(reason: reason)
        do {
            _ = try startNewSegmentLocked()
            currentSegmentStartedAt = nextStartTime
        } catch {
            appendManifestEvent("segment_start_failed reason=\(reason) error=\(error.localizedDescription)")
        }
    }

    private func startNewSegmentLocked() throws -> URL {
        guard let sessionDirectory else {
            throw RecordingEngineError.writerStartFailed
        }

        segmentIndex += 1
        let fileURL = sessionDirectory.appendingPathComponent(String(format: "audio-%05d.mp4", segmentIndex))
        let writer = try AVAssetWriter(outputURL: fileURL, fileType: .mp4)
        writer.movieFragmentInterval = CMTime(seconds: 2, preferredTimescale: 600)

        let writerInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 128_000
        ])
        writerInput.expectsMediaDataInRealTime = true

        guard writer.canAdd(writerInput) else {
            throw RecordingEngineError.cannotAddWriterInput
        }
        writer.add(writerInput)

        guard writer.startWriting() else {
            throw writer.error ?? RecordingEngineError.writerStartFailed
        }

        self.writer = writer
        self.writerInput = writerInput
        self.currentFileURL = fileURL
        self.currentSegmentStartedAt = nil
        self.hasStartedWriterSession = false
        onActiveSegmentChanged(fileURL)
        appendManifestEvent("segment_started index=\(segmentIndex) file=\(fileURL.lastPathComponent)")

        return fileURL
    }

    private func finishCurrentSegmentLocked(reason: String) {
        guard let writer else { return }

        let writerToFinish = writer
        let finishedURL = currentFileURL
        let finishedIndex = segmentIndex
        let requiresCatchUp = shouldQueueSegmentsForCatchUp

        writerInput?.markAsFinished()
        self.writer = nil
        self.writerInput = nil
        self.currentFileURL = nil
        self.currentSegmentStartedAt = nil
        self.hasStartedWriterSession = false

        appendManifestEvent("segment_finishing index=\(finishedIndex) reason=\(reason)")
        pendingSegmentFinishes += 1
        writerToFinish.finishWriting { [weak self] in
            let status = writerToFinish.status
            let file = finishedURL?.lastPathComponent ?? "unknown"
            self?.queue.async { [weak self] in
                guard let self else { return }
                self.pendingSegmentFinishes = max(0, self.pendingSegmentFinishes - 1)
                self.appendManifestEvent("segment_finished index=\(finishedIndex) status=\(status.rawValue) file=\(file)")
                if status == .completed, let finishedURL {
                    self.finalizedSegmentURLs.append(finishedURL)
                    self.transcriptionPipeline.noteSegmentFinalized(
                        finishedURL,
                        requiresCatchUp: requiresCatchUp
                    )
                }
                self.completeStopIfReadyLocked()
            }
        }
    }

    private func stopLocked(reason: String, continuation: CheckedContinuation<RecordingStopResult, Never>) {
        guard isRunning || writer != nil || captureSession.isRunning else {
            continuation.resume(returning: stopResultLocked())
            return
        }

        isRunning = false
        isInterrupted = false
        pendingStopContinuation = continuation

        if captureSession.isRunning {
            captureSession.stopRunning()
        }

        transcriptionPipeline.stop(reason: reason)
        audioOutput?.setSampleBufferDelegate(nil, queue: nil)
        finishCurrentSegmentLocked(reason: reason)
        shouldQueueSegmentsForCatchUp = false
        appendManifestEvent("capture_stopped reason=\(reason)")
        onActiveSegmentChanged(nil)
        completeStopIfReadyLocked()
    }

    private func completeStopIfReadyLocked() {
        guard !isRunning, pendingSegmentFinishes == 0, let continuation = pendingStopContinuation else {
            return
        }

        pendingStopContinuation = nil
        continuation.resume(returning: stopResultLocked())
    }

    private func stopResultLocked() -> RecordingStopResult {
        RecordingStopResult(
            sessionDirectory: sessionDirectory,
            audioSegmentURLs: finalizedSegmentURLs.sorted { $0.lastPathComponent < $1.lastPathComponent },
            transcriptFileURL: sessionDirectory?.appendingPathComponent("transcript.jsonl")
        )
    }

    private func rebuildCaptureAndWriterLocked(reason: String) {
        guard isRunning else { return }

        if captureSession.isRunning {
            captureSession.stopRunning()
        }

        finishCurrentSegmentLocked(reason: reason)

        do {
            try configureAudioSession()
            try configureCaptureSession()
            _ = try startNewSegmentLocked()
            if shouldQueueSegmentsForCatchUp {
                transcriptionPipeline.pauseForSystem(reason: "\(reason)_background")
            } else {
                transcriptionPipeline.start(sessionDirectory: sessionDirectory)
            }
            captureSession.startRunning()
            appendManifestEvent("capture_rebuilt reason=\(reason)")
        } catch {
            appendManifestEvent("capture_rebuild_failed reason=\(reason) error=\(error.localizedDescription)")
        }
    }

    private func healthCheckLocked(reason: String) {
        guard isRunning, !isInterrupted else { return }

        if writer == nil || writer?.status == .failed || writer?.status == .cancelled || !captureSession.isRunning {
            rebuildCaptureAndWriterLocked(reason: "health_check_\(reason)")
        } else {
            appendManifestEvent("health_ok reason=\(reason)")
        }
    }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .measurement,
            options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker]
        )
        try session.setActive(true)
    }

    private func configureCaptureSession() throws {
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }

        for input in captureSession.inputs {
            captureSession.removeInput(input)
        }
        for output in captureSession.outputs {
            captureSession.removeOutput(output)
        }

        guard let audioDevice = AVCaptureDevice.default(for: .audio) else {
            throw RecordingEngineError.missingAudioDevice
        }

        let audioInput = try AVCaptureDeviceInput(device: audioDevice)
        guard captureSession.canAddInput(audioInput) else {
            throw RecordingEngineError.cannotAddAudioInput
        }
        captureSession.addInput(audioInput)

        let audioOutput = AVCaptureAudioDataOutput()
        guard captureSession.canAddOutput(audioOutput) else {
            throw RecordingEngineError.cannotAddAudioOutput
        }
        captureSession.addOutput(audioOutput)
        audioOutput.setSampleBufferDelegate(self, queue: queue)
        self.audioOutput = audioOutput
    }

    private func makeSessionDirectory() throws -> URL {
        let cacheRoot = try FileManager.default.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = cacheRoot
            .appendingPathComponent("Recordings", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func appendManifestEvent(_ message: String) {
        guard let sessionDirectory else { return }

        let line = "\(Date().timeIntervalSince1970) \(message)\n"
        let url = sessionDirectory.appendingPathComponent("manifest.log")

        maintenanceQueue.async {
            do {
                if !FileManager.default.fileExists(atPath: url.path) {
                    try Data().write(to: url)
                }
                let handle = try FileHandle(forWritingTo: url)
                try handle.seekToEnd()
                if let data = line.data(using: .utf8) {
                    try handle.write(contentsOf: data)
                }
                try handle.close()
            } catch {
                print("[ContinuousAudioTrackPipeline] manifest write failed: \(error.localizedDescription)")
            }
        }
    }
}

private final class LiveTranscriptionPipeline {
    private let queue = DispatchQueue(
        label: "com.up200.recording.transcription",
        qos: .utility
    )
    private let restartDelay: TimeInterval = 2
    private let maxLiveTranscriptCharacters = 4_000
    private let partialFlushInterval: TimeInterval = 10
    private let taskRotationInterval: TimeInterval = 55
    private let locale = Locale(identifier: "en_US")
    private let onTranscript: @Sendable (String) -> Void
    private let pendingBufferSlots = DispatchSemaphore(value: 12)

    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var authorizationStatus = SFSpeechRecognizerAuthorizationStatus.notDetermined
    private var isAuthorizationRequestInFlight = false
    private var recentCommittedTranscript = ""
    private var currentPartialTranscript = ""
    private var lastFlushedPartialTranscript = ""
    private var lastPartialFlushDate = Date.distantPast
    private var sessionDirectory: URL?
    private var transcriptFileURL: URL?
    private var catchUpBacklogFileURL: URL?
    private var catchUpInFlight = false
    private var isPausedForSystem = false
    private var segmentsNeedingCatchUp = Set<String>()
    private var caughtUpSegmentNames = Set<String>()
    private var liveCoverageHealthy = false
    private var currentSegmentNeedsCatchUp = false
    private var isRunning = false
    private var isRestartScheduled = false
    private var restartGeneration = 0
    private var taskGeneration = 0

    init(onTranscript: @escaping @Sendable (String) -> Void) {
        self.onTranscript = onTranscript
    }

    func start(sessionDirectory: URL?) {
        queue.async { [weak self] in
            guard let self else { return }

            if self.sessionDirectory != sessionDirectory {
                self.sessionDirectory = sessionDirectory
                self.transcriptFileURL = sessionDirectory?.appendingPathComponent("transcript.jsonl")
                self.catchUpBacklogFileURL = sessionDirectory?.appendingPathComponent("transcription-backlog.txt")
                self.recentCommittedTranscript = ""
                self.currentPartialTranscript = ""
                self.lastFlushedPartialTranscript = ""
                self.lastPartialFlushDate = .distantPast
                self.segmentsNeedingCatchUp.removeAll(keepingCapacity: true)
                self.caughtUpSegmentNames.removeAll(keepingCapacity: true)
                self.liveCoverageHealthy = false
                self.currentSegmentNeedsCatchUp = false
                self.createTranscriptFileIfNeeded()
                self.createCatchUpBacklogFileIfNeeded()
            }

            self.isRunning = true
            self.isPausedForSystem = false
            if self.requestSpeechAuthorizationIfNeeded() {
                return
            }
            self.startRecognitionIfAllowed()
        }
    }

    func stop(reason: String) {
        queue.async { [weak self] in
            self?.stopLocked(reason: reason)
        }
    }

    func pauseForSystem(reason: String) {
        queue.async { [weak self] in
            guard let self, self.isRunning else { return }
            self.flushTranscriptEventLocked(type: "system_pause", text: "", metadata: ["reason": reason])
            self.resetRecognitionTaskLocked(endAudio: true)
            self.markLiveCoverageGapLocked(reason: reason)
            self.isPausedForSystem = true
            self.isRestartScheduled = false
            self.restartGeneration += 1
            self.taskGeneration += 1
        }
    }

    func noteSegmentFinalized(_ url: URL, requiresCatchUp: Bool) {
        queue.async { [weak self] in
            guard let self else { return }

            var queuedSegment = false
            if requiresCatchUp || self.currentSegmentNeedsCatchUp || !self.liveCoverageHealthy {
                self.queueSegmentForCatchUpLocked(url.lastPathComponent)
                queuedSegment = true
                self.flushTranscriptEventLocked(
                    type: "catch_up_queued",
                    text: "",
                    metadata: ["segment": url.lastPathComponent]
                )
            }

            self.currentSegmentNeedsCatchUp = !self.liveCoverageHealthy
            if queuedSegment, !self.isPausedForSystem {
                self.catchUpFromDiskIfNeeded()
            }
        }
    }

    func catchUpFromDiskIfNeeded() {
        queue.async { [weak self] in
            guard let self, self.isRunning, !self.catchUpInFlight else { return }
            guard self.authorizationStatus == .authorized else { return }
            guard let sessionDirectory = self.sessionDirectory else { return }

            self.loadDurableCatchUpBacklogLocked()
            let segmentURLs = self.finishedAudioSegments(in: sessionDirectory)
            let pendingSegments = segmentURLs.filter {
                self.segmentsNeedingCatchUp.contains($0.lastPathComponent)
                    && !self.caughtUpSegmentNames.contains($0.lastPathComponent)
            }
            guard !pendingSegments.isEmpty else {
                self.isPausedForSystem = false
                self.startRecognitionIfAllowed()
                return
            }

            self.catchUpInFlight = true
            self.isPausedForSystem = false
            self.resetRecognitionTaskLocked(endAudio: true)
            self.runCatchUpLocked(segmentURLs: pendingSegments)
        }
    }

    func append(_ sampleBuffer: CMSampleBuffer) {
        guard pendingBufferSlots.wait(timeout: .now()) == .success else {
            queue.async { [weak self] in
                self?.markLiveCoverageGapLocked(reason: "transcription_queue_full")
            }
            return
        }

        queue.async { [weak self] in
            defer { self?.pendingBufferSlots.signal() }
            guard let self, self.isRunning else {
                return
            }

            self.appendLocked(sampleBuffer)
        }
    }

    private func requestSpeechAuthorizationIfNeeded() -> Bool {
        guard authorizationStatus == .notDetermined else { return false }
        guard !isAuthorizationRequestInFlight else { return true }

        isAuthorizationRequestInFlight = true
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            self?.queue.async {
                guard let self else { return }
                self.isAuthorizationRequestInFlight = false
                self.authorizationStatus = status
                if status == .authorized {
                    self.startRecognitionIfAllowed()
                } else {
                    self.markLiveCoverageGapLocked(reason: "speech_authorization_\(status.rawValue)")
                    self.log("speech recognition unavailable; authorization status \(status.rawValue)")
                }
            }
        }
        return true
    }

    private func startRecognitionIfAllowed() {
        guard isRunning else { return }
        guard !isPausedForSystem else { return }
        guard request == nil, task == nil else { return }

        guard authorizationStatus == .authorized else {
            log("speech recognition unavailable; authorization status \(authorizationStatus.rawValue)")
            return
        }

        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            markLiveCoverageGapLocked(reason: "speech_recognizer_unavailable")
            scheduleRestart(reason: "speech recognizer unavailable")
            return
        }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        self.recognizer = recognizer
        self.request = request
        taskGeneration += 1
        let generation = taskGeneration

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            self?.queue.async {
                self?.handleRecognitionUpdate(result: result, error: error)
            }
        }

        scheduleTaskRotation(generation: generation)
        liveCoverageHealthy = true
        log("speech recognition task started")
    }

    private func appendLocked(_ sampleBuffer: CMSampleBuffer) {
        guard isRunning, !isPausedForSystem else { return }

        guard let request else {
            guard authorizationStatus == .authorized, !isAuthorizationRequestInFlight else {
                return
            }
            startRecognitionIfAllowed()
            return
        }

        request.appendAudioSampleBuffer(sampleBuffer)
    }

    private func handleRecognitionUpdate(result: SFSpeechRecognitionResult?, error: Error?) {
        if let result {
            currentPartialTranscript = result.bestTranscription.formattedString
            flushPartialTranscriptIfNeeded(force: false)
            onTranscript(combinedTranscript(recentCommittedTranscript, currentPartialTranscript))
        }

        if let error {
            log("speech recognition error: \(error.localizedDescription)")
            flushTranscriptEventLocked(
                type: "recognition_error",
                text: currentPartialTranscript,
                metadata: ["error": error.localizedDescription]
            )
            markLiveCoverageGapLocked(reason: "speech_recognition_error")
            resetRecognitionTaskLocked(endAudio: false)
            scheduleRestart(reason: "speech recognition error")
            return
        }

        if result?.isFinal == true {
            flushPartialTranscriptIfNeeded(force: true)
            flushTranscriptEventLocked(type: "final", text: currentPartialTranscript, metadata: ["source": "live"])
            recentCommittedTranscript = boundedTranscript(
                combinedTranscript(recentCommittedTranscript, currentPartialTranscript)
            )
            currentPartialTranscript = ""
            lastFlushedPartialTranscript = ""
            resetRecognitionTaskLocked(endAudio: false)
            scheduleRestart(reason: "final speech result")
        }
    }

    private func combinedTranscript(_ committed: String, _ partial: String) -> String {
        if committed.isEmpty { return partial }
        if partial.isEmpty { return committed }
        return committed + "\n" + partial
    }

    private func boundedTranscript(_ transcript: String) -> String {
        guard transcript.count > maxLiveTranscriptCharacters else { return transcript }
        return String(transcript.suffix(maxLiveTranscriptCharacters))
    }

    private func flushPartialTranscriptIfNeeded(force: Bool) {
        guard !currentPartialTranscript.isEmpty else { return }

        let now = Date()
        let shouldFlush = force
            || currentPartialTranscript != lastFlushedPartialTranscript
                && now.timeIntervalSince(lastPartialFlushDate) >= partialFlushInterval

        guard shouldFlush else { return }

        flushTranscriptEventLocked(type: "partial", text: currentPartialTranscript, metadata: ["source": "live"])
        lastFlushedPartialTranscript = currentPartialTranscript
        lastPartialFlushDate = now
    }

    private func createTranscriptFileIfNeeded() {
        guard let transcriptFileURL else { return }
        do {
            if !FileManager.default.fileExists(atPath: transcriptFileURL.path) {
                try Data().write(to: transcriptFileURL)
            }
        } catch {
            log("transcript cache create failed: \(error.localizedDescription)")
        }
    }

    private func createCatchUpBacklogFileIfNeeded() {
        guard let catchUpBacklogFileURL else { return }
        do {
            if !FileManager.default.fileExists(atPath: catchUpBacklogFileURL.path) {
                try Data().write(to: catchUpBacklogFileURL)
            }
        } catch {
            log("catch-up backlog create failed: \(error.localizedDescription)")
        }
    }

    private func queueSegmentForCatchUpLocked(_ segmentName: String) {
        guard !segmentsNeedingCatchUp.contains(segmentName) else { return }

        segmentsNeedingCatchUp.insert(segmentName)
        guard let catchUpBacklogFileURL else { return }

        do {
            if !FileManager.default.fileExists(atPath: catchUpBacklogFileURL.path) {
                try Data().write(to: catchUpBacklogFileURL)
            }
            let handle = try FileHandle(forWritingTo: catchUpBacklogFileURL)
            try handle.seekToEnd()
            if let data = "\(segmentName)\n".data(using: .utf8) {
                try handle.write(contentsOf: data)
            }
            try handle.close()
        } catch {
            log("catch-up backlog write failed: \(error.localizedDescription)")
        }
    }

    private func loadDurableCatchUpBacklogLocked() {
        guard let catchUpBacklogFileURL,
              let backlog = try? String(contentsOf: catchUpBacklogFileURL, encoding: .utf8) else {
            return
        }

        for segmentName in backlog.split(separator: "\n").map(String.init) {
            if !caughtUpSegmentNames.contains(segmentName) {
                segmentsNeedingCatchUp.insert(segmentName)
            }
        }
    }

    private func rewriteDurableCatchUpBacklogLocked() {
        guard let catchUpBacklogFileURL else { return }

        let pendingNames = segmentsNeedingCatchUp
            .filter { !caughtUpSegmentNames.contains($0) }
            .sorted()
        let body = pendingNames.isEmpty ? "" : pendingNames.joined(separator: "\n") + "\n"

        do {
            try body.data(using: .utf8)?.write(to: catchUpBacklogFileURL, options: .atomic)
        } catch {
            log("catch-up backlog rewrite failed: \(error.localizedDescription)")
        }
    }

    private func flushTranscriptEventLocked(type: String, text: String, metadata: [String: String]) {
        guard let transcriptFileURL else { return }

        var payload = metadata
        payload["type"] = type
        payload["timestamp"] = String(Date().timeIntervalSince1970)
        payload["text"] = text

        do {
            let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
            guard var line = String(data: data, encoding: .utf8) else { return }
            line.append("\n")
            if !FileManager.default.fileExists(atPath: transcriptFileURL.path) {
                try Data().write(to: transcriptFileURL)
            }
            let handle = try FileHandle(forWritingTo: transcriptFileURL)
            try handle.seekToEnd()
            if let lineData = line.data(using: .utf8) {
                try handle.write(contentsOf: lineData)
            }
            try handle.close()
        } catch {
            log("transcript cache write failed: \(error.localizedDescription)")
        }
    }

    private func finishedAudioSegments(in directory: URL) -> [URL] {
        let urls = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )) ?? []

        return urls
            .filter { $0.pathExtension == "mp4" && $0.lastPathComponent.hasPrefix("audio-") }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
    }

    private func runCatchUpLocked(segmentURLs: [URL]) {
        var remainingSegments = segmentURLs
        guard let nextSegment = remainingSegments.first else {
            catchUpInFlight = false
            isPausedForSystem = false
            startRecognitionIfAllowed()
            return
        }
        remainingSegments.removeFirst()

        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
            catchUpInFlight = false
            isPausedForSystem = false
            scheduleRestart(reason: "catch-up recognizer unavailable")
            return
        }

        let request = SFSpeechURLRecognitionRequest(url: nextSegment)
        request.shouldReportPartialResults = false
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let segmentName = nextSegment.lastPathComponent
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            self?.queue.async {
                guard let self else { return }

                if let error {
                    self.flushTranscriptEventLocked(
                        type: "catch_up_error",
                        text: "",
                        metadata: ["segment": segmentName, "error": error.localizedDescription]
                    )
                }

                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString
                    self.flushTranscriptEventLocked(
                        type: "final",
                        text: text,
                        metadata: ["source": "catch_up", "segment": segmentName]
                    )
                    self.recentCommittedTranscript = self.boundedTranscript(
                        self.combinedTranscript(self.recentCommittedTranscript, text)
                    )
                    self.onTranscript(self.combinedTranscript(self.recentCommittedTranscript, self.currentPartialTranscript))
                    self.segmentsNeedingCatchUp.remove(segmentName)
                    self.caughtUpSegmentNames.insert(segmentName)
                    self.rewriteDurableCatchUpBacklogLocked()
                }

                if error != nil || result?.isFinal == true {
                    self.task = nil
                    guard !remainingSegments.isEmpty else {
                        self.runCatchUpLocked(segmentURLs: [])
                        return
                    }

                    self.catchUpInFlight = false
                    self.startRecognitionIfAllowed()
                    self.queue.asyncAfter(deadline: .now() + self.restartDelay) { [weak self] in
                        self?.catchUpFromDiskIfNeeded()
                    }
                }
            }
        }
    }

    private func scheduleRestart(reason: String) {
        guard isRunning, !isRestartScheduled else { return }

        isRestartScheduled = true
        restartGeneration += 1
        let generation = restartGeneration
        log("scheduling transcription restart: \(reason)")

        queue.asyncAfter(deadline: .now() + restartDelay) { [weak self] in
            guard let self,
                  self.isRunning,
                  self.restartGeneration == generation else {
                return
            }

            self.isRestartScheduled = false
            self.startRecognitionIfAllowed()
        }
    }

    private func scheduleTaskRotation(generation: Int) {
        queue.asyncAfter(deadline: .now() + taskRotationInterval) { [weak self] in
            guard let self,
                  self.isRunning,
                  !self.isPausedForSystem,
                  !self.catchUpInFlight,
                  self.taskGeneration == generation,
                  self.request != nil || self.task != nil else {
                return
            }

            self.flushPartialTranscriptIfNeeded(force: true)
            self.flushTranscriptEventLocked(
                type: "task_rotation",
                text: "",
                metadata: ["interval": String(self.taskRotationInterval)]
            )
            self.resetRecognitionTaskLocked(endAudio: true)
            self.scheduleRestart(reason: "speech task rotation")
        }
    }

    private func markLiveCoverageGapLocked(reason: String) {
        liveCoverageHealthy = false
        currentSegmentNeedsCatchUp = true
        flushTranscriptEventLocked(type: "coverage_gap", text: "", metadata: ["reason": reason])
    }

    private func resetRecognitionTaskLocked(endAudio: Bool) {
        if endAudio {
            request?.endAudio()
        }
        task?.cancel()
        task = nil
        request = nil
        recognizer = nil
        liveCoverageHealthy = false
        taskGeneration += 1
    }

    private func stopLocked(reason: String) {
        guard isRunning || task != nil || request != nil else { return }

        log("stopping transcription pipeline: \(reason)")
        isRunning = false
        isRestartScheduled = false
        catchUpInFlight = false
        isPausedForSystem = false
        isAuthorizationRequestInFlight = false
        liveCoverageHealthy = false
        currentSegmentNeedsCatchUp = false
        restartGeneration += 1
        taskGeneration += 1
        currentPartialTranscript = ""
        lastFlushedPartialTranscript = ""
        resetRecognitionTaskLocked(endAudio: true)
    }

    private func log(_ message: String) {
        print("[LiveTranscriptionPipeline] \(message)")
    }
}
