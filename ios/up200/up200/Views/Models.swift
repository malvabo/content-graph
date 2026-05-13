import Foundation
import Security
import Speech
import AVFoundation

struct KeychainService {
    private static let account = "com.up200.app.anthropic_api_key"

    static func save(_ value: String) {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account,
            kSecValueData: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load() -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty else { return nil }
        return value
    }

    static func delete() {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct Note: Identifiable, Codable, Equatable, Hashable {
    var id = UUID()
    // Legacy field. The composer stores everything in `body`; this stays
    // for decoding stored notes written by earlier versions, and is folded
    // into `body` on load.
    var title: String = ""
    var body: String = ""
    var updatedAt: Date = Date()
    var tags: [String] = []

    var isEmpty: Bool {
        body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var displayTitle: String {
        let firstLine = body.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let cleaned = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "Untitled" : cleaned
    }

    var preview: String {
        let lines = body.split(whereSeparator: \.isNewline).map(String.init)
        guard lines.count > 1 else { return "" }
        return lines.dropFirst()
            .first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    /// Folds a legacy stored `title` into the body.
    static func migrated(_ note: Note) -> Note {
        var out = note
        let t = out.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return out }
        if out.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            out.body = t
        } else {
            out.body = t + "\n" + out.body
        }
        out.title = ""
        return out
    }
}

struct GenerationProject: Identifiable, Codable {
    var id = UUID()
    var title: String
    var outputType: String
    var preview: String
    var content: String = ""
    var date: Date
}

struct CustomTemplate: Identifiable, Codable {
    var id = UUID()
    var title: String
    var subtitle: String
    var prompt: String = ""
    var formatIDs: [String] = []
}

final class BannerController: ObservableObject {
    @Published var isVisible = false
    @Published var isReady = false
    @Published var formatLabels: [String] = []
    var onOpen: (() -> Void)?
    var onCancel: (() -> Void)?
}

final class ChromeController: ObservableObject {
    @Published var hideTabBar = false
}

@MainActor
final class RecordingController: ObservableObject {
    @Published var isRecording: Bool = false
    @Published var isPaused: Bool = false
    @Published var transcript: String = ""
    @Published var accumulated: String = ""
    @Published var audioLevel: Float = 0
    @Published var seconds: Int = 0
    @Published var permissionDenied: Bool = false
    @Published var showingSheet: Bool = false

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var timer: Timer?
    private var saveHandler: ((String) -> Void)?

    var fullTranscript: String {
        if accumulated.isEmpty { return transcript }
        if transcript.isEmpty { return accumulated }
        return accumulated + " " + transcript
    }

    func begin(saveHandler: @escaping (String) -> Void) {
        if isRecording || isPaused {
            finish()
        }
        self.saveHandler = saveHandler
        accumulated = ""
        transcript = ""
        audioLevel = 0
        seconds = 0
        startTimer()
        requestAuthAndStart()
    }

    func pause() {
        guard isRecording, !isPaused else { return }
        accumulated = fullTranscript
        transcript = ""
        teardownEngine()
        stopTimer()
        isPaused = true
    }

    func resume() {
        guard isPaused else { return }
        isPaused = false
        startTimer()
        requestAuthAndStart()
    }

    /// Stop recording and route the transcript to the registered save handler.
    func finish() {
        let final = fullTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        let handler = saveHandler
        teardownEngine()
        stopTimer()
        reset()
        if !final.isEmpty {
            handler?(final)
        }
    }

    /// Stop recording and discard the transcript.
    func cancel() {
        task?.cancel()
        task = nil
        teardownEngine()
        stopTimer()
        reset()
    }

    private func reset() {
        isRecording = false
        isPaused = false
        transcript = ""
        accumulated = ""
        audioLevel = 0
        seconds = 0
        showingSheet = false
        saveHandler = nil
    }

    private func startTimer() {
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.seconds += 1
            }
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func teardownEngine() {
        audioEngine.stop()
        request?.endAudio()
        if audioEngine.inputNode.numberOfInputs > 0 {
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        audioLevel = 0
        isRecording = false
    }

    private func requestAuthAndStart() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                if status == .authorized {
                    self.startEngine()
                } else {
                    self.permissionDenied = true
                    self.reset()
                }
            }
        }
    }

    private func startEngine() {
        task?.cancel()
        task = nil

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try? session.setActive(true, options: .notifyOthersOnDeactivation)

        request = SFSpeechAudioBufferRecognitionRequest()
        guard let req = request, let rec = recognizer else { return }
        req.shouldReportPartialResults = true

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                if let result {
                    self?.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self?.isRecording = false
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            req.append(buffer)
            guard let channels = buffer.floatChannelData else { return }
            let frames = Int(buffer.frameLength)
            guard frames > 0 else { return }
            let samples = channels[0]
            var sum: Float = 0
            for i in 0..<frames {
                let s = samples[i]
                sum += s * s
            }
            let rms = (sum / Float(frames)).squareRoot()
            DispatchQueue.main.async {
                self?.audioLevel = rms
            }
        }

        audioEngine.prepare()
        if (try? audioEngine.start()) != nil {
            isRecording = true
        }
    }
}
