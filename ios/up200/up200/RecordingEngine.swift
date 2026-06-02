import Foundation
import AVFoundation
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

    private let instanceID = UUID()
    private let audioPipeline = ContinuousAudioTrackPipeline()
    private var observers: [NSObjectProtocol] = []
    private var hasStartedObserving = false

    private init() {
        log("initialized")
    }

    deinit {
        audioPipeline.stop(reason: "engine deinit")
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
    private let captureSession = AVCaptureSession()
    private var audioOutput: AVCaptureAudioDataOutput?
    private var writer: AVAssetWriter?
    private var writerInput: AVAssetWriterInput?
    private var currentFileURL: URL?
    private var hasStartedWriterSession = false
    private var isRunning = false

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
