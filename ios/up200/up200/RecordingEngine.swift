import Foundation
import AVFoundation
import Speech
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
    @Published private(set) var activeAudioFileURL: URL?
    @Published private(set) var liveTranscript = "" {
        didSet {
            for continuation in transcriptContinuations.values {
                continuation.yield(liveTranscript)
            }
        }
    }

    private let instanceID = UUID()
    private lazy var audioPipeline = ContinuousAudioTrackPipeline { [weak self] transcript in
        Task { @MainActor [weak self] in
            self?.liveTranscript = transcript
        }
    }
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
            await startRecordingAll()
        }
    }

    func pause() {
        audioPipeline.stop(reason: "pause requested")
        transition(to: .paused, reason: "pause requested")
    }

    func stop() {
        audioPipeline.stop(reason: "stop requested")
        activeAudioFileURL = nil
        liveTranscript = ""
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

    private func startRecordingAll() async {
        guard state == .idle || state == .paused else {
            log("start requested; state remains \(state)")
            return
        }

        do {
            try await requestMicrophoneAccess()
            let fileURL = try audioPipeline.start()
            activeAudioFileURL = fileURL
            transition(to: .recordingAll, reason: "audio pipeline started")
            log("writing AAC audio to \(fileURL.path)")
        } catch {
            activeAudioFileURL = nil
            transition(to: .idle, reason: "audio pipeline failed")
            log("audio pipeline error: \(error.localizedDescription)")
        }
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

private final class ContinuousAudioTrackPipeline: NSObject, AVCaptureAudioDataOutputSampleBufferDelegate {
    private let queue = DispatchQueue(label: "com.up200.recording.audio-pipeline")
    private let transcriptionPipeline: LiveTranscriptionPipeline
    private let captureSession = AVCaptureSession()
    private var audioOutput: AVCaptureAudioDataOutput?
    private var writer: AVAssetWriter?
    private var writerInput: AVAssetWriterInput?
    private var currentFileURL: URL?
    private var hasStartedWriterSession = false
    private var isRunning = false

    init(onTranscript: @escaping @Sendable (String) -> Void) {
        self.transcriptionPipeline = LiveTranscriptionPipeline(onTranscript: onTranscript)
        super.init()
    }

    func start() throws -> URL {
        try queue.sync {
            if isRunning, let currentFileURL {
                log("start ignored; already writing to \(currentFileURL.path)")
                return currentFileURL
            }

            return try startLocked()
        }
    }

    func stop(reason: String) {
        queue.async { [weak self] in
            self?.stopLocked(reason: reason)
        }
    }

    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        guard isRunning,
              let writer,
              let writerInput,
              writer.status == .writing else {
            return
        }

        if !hasStartedWriterSession {
            let timestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
            writer.startSession(atSourceTime: timestamp)
            hasStartedWriterSession = true
            log("writer session started at \(timestamp.seconds)")
        }

        guard writerInput.isReadyForMoreMediaData else {
            log("writer input not ready; dropped one audio sample buffer")
            return
        }

        if !writerInput.append(sampleBuffer) {
            let message = writer.error?.localizedDescription ?? "unknown append error"
            log("failed to append audio sample buffer: \(message)")
        }

        transcriptionPipeline.append(sampleBuffer)
    }

    private func startLocked() throws -> URL {
        try configureAudioSession()

        let fileURL = try makeOutputURL()
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

        try configureCaptureSession()

        guard writer.startWriting() else {
            throw writer.error ?? RecordingEngineError.writerStartFailed
        }

        self.writer = writer
        self.writerInput = writerInput
        self.currentFileURL = fileURL
        self.hasStartedWriterSession = false
        self.isRunning = true

        transcriptionPipeline.start()
        captureSession.startRunning()
        log("capture started; fragmented AAC file: \(fileURL.path)")

        return fileURL
    }

    private func stopLocked(reason: String) {
        guard isRunning || writer != nil || captureSession.isRunning else {
            return
        }

        log("stopping audio pipeline: \(reason)")
        isRunning = false

        if captureSession.isRunning {
            captureSession.stopRunning()
        }

        transcriptionPipeline.stop(reason: reason)
        audioOutput?.setSampleBufferDelegate(nil, queue: nil)
        writerInput?.markAsFinished()

        let writerToFinish = writer
        let finishedURL = currentFileURL

        writer = nil
        writerInput = nil
        currentFileURL = nil
        hasStartedWriterSession = false

        writerToFinish?.finishWriting {
            let path = finishedURL?.path ?? "unknown file"
            switch writerToFinish?.status {
            case .completed:
                self.log("finalized audio file: \(path)")
            case .failed:
                let message = writerToFinish?.error?.localizedDescription ?? "unknown finish error"
                self.log("failed to finalize audio file \(path): \(message)")
            case .cancelled:
                self.log("audio file finalization cancelled: \(path)")
            default:
                self.log("audio file finalization ended with status \(writerToFinish?.status.rawValue ?? -1): \(path)")
            }
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
        log("AVAudioSession activated for playAndRecord")
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

    private func makeOutputURL() throws -> URL {
        let cacheRoot = try FileManager.default.url(
            for: .cachesDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = cacheRoot.appendingPathComponent("Recordings", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        return directory.appendingPathComponent("audio-\(UUID().uuidString).mp4")
    }

    private func log(_ message: String) {
        print("[ContinuousAudioTrackPipeline] \(message)")
    }
}

private final class LiveTranscriptionPipeline {
    private let queue = DispatchQueue(
        label: "com.up200.recording.transcription",
        qos: .utility
    )
    private let restartDelay: TimeInterval = 2
    private let maxPendingBuffers = 12
    private let locale = Locale(identifier: "en_US")
    private let onTranscript: @Sendable (String) -> Void
    private let pendingBufferLock = NSLock()

    private var recognizer: SFSpeechRecognizer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var authorizationStatus = SFSpeechRecognizerAuthorizationStatus.notDetermined
    private var isAuthorizationRequestInFlight = false
    private var pendingBufferCount = 0
    private var committedTranscript = ""
    private var currentPartialTranscript = ""
    private var isRunning = false
    private var isRestartScheduled = false
    private var restartGeneration = 0

    init(onTranscript: @escaping @Sendable (String) -> Void) {
        self.onTranscript = onTranscript
    }

    func start() {
        queue.async { [weak self] in
            guard let self else { return }

            self.committedTranscript = ""
            self.currentPartialTranscript = ""
            self.isRunning = true
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

    func append(_ sampleBuffer: CMSampleBuffer) {
        guard reservePendingBufferSlot() else {
            log("transcription queue full; dropped one sample buffer")
            return
        }

        queue.async { [weak self] in
            defer { self?.releasePendingBufferSlot() }
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
                    self.log("speech recognition unavailable; authorization status \(status.rawValue)")
                }
            }
        }
        return true
    }

    private func startRecognitionIfAllowed() {
        guard isRunning else { return }
        guard request == nil, task == nil else { return }

        guard authorizationStatus == .authorized else {
            log("speech recognition unavailable; authorization status \(authorizationStatus.rawValue)")
            return
        }

        guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
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

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            self?.queue.async {
                self?.handleRecognitionUpdate(result: result, error: error)
            }
        }

        log("speech recognition task started")
    }

    private func appendLocked(_ sampleBuffer: CMSampleBuffer) {
        guard isRunning else { return }

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
            onTranscript(combinedTranscript(committedTranscript, currentPartialTranscript))
        }

        if let error {
            log("speech recognition error: \(error.localizedDescription)")
            resetRecognitionTaskLocked(endAudio: false)
            scheduleRestart(reason: "speech recognition error")
            return
        }

        if result?.isFinal == true {
            committedTranscript = combinedTranscript(committedTranscript, currentPartialTranscript)
            currentPartialTranscript = ""
            resetRecognitionTaskLocked(endAudio: false)
            scheduleRestart(reason: "final speech result")
        }
    }

    private func combinedTranscript(_ committed: String, _ partial: String) -> String {
        if committed.isEmpty { return partial }
        if partial.isEmpty { return committed }
        return committed + "\n" + partial
    }

    private func reservePendingBufferSlot() -> Bool {
        pendingBufferLock.lock()
        defer { pendingBufferLock.unlock() }

        guard pendingBufferCount < maxPendingBuffers else {
            return false
        }

        pendingBufferCount += 1
        return true
    }

    private func releasePendingBufferSlot() {
        pendingBufferLock.lock()
        pendingBufferCount = max(0, pendingBufferCount - 1)
        pendingBufferLock.unlock()
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

    private func resetRecognitionTaskLocked(endAudio: Bool) {
        if endAudio {
            request?.endAudio()
        }
        task?.cancel()
        task = nil
        request = nil
        recognizer = nil
    }

    private func stopLocked(reason: String) {
        guard isRunning || task != nil || request != nil else { return }

        log("stopping transcription pipeline: \(reason)")
        isRunning = false
        isRestartScheduled = false
        isAuthorizationRequestInFlight = false
        restartGeneration += 1
        currentPartialTranscript = ""
        resetRecognitionTaskLocked(endAudio: true)
    }

    private func log(_ message: String) {
        print("[LiveTranscriptionPipeline] \(message)")
    }
}
