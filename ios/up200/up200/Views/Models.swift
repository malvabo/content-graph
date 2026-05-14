import Foundation
import Security
import Speech
import AVFoundation
import SwiftUI

// MARK: - Design tokens

enum BrandColor {
    static let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    /// Golden → amber → deep-orange ramp used by the Generate button's
    /// glow. Apply via `.foregroundStyle` / `.fill` to give icons and
    /// shapes the same two-tone warm feel as the primary CTA.
    static let glowGradient = LinearGradient(
        colors: [
            Color(red: 1.00, green: 0.68, blue: 0.20),
            amber,
            Color(red: 0.62, green: 0.18, blue: 0.04)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum SelectionStyle {
    static let fill = Color.white.opacity(0.14)
    static let stroke = Color.white.opacity(0.30)
}

/// Result of decoding a JSON blob from persistent storage.
///
/// `.empty` and `.ok` are both safe to overwrite; `.corrupt` means the bytes
/// exist but can't be decoded — typically the schema changed, a write was
/// interrupted, or the blob was truncated. Callers MUST NOT save fresh
/// state over a `.corrupt` blob: the existing bytes are the only copy of
/// the user's data and overwriting them with a default-empty state would
/// destroy any chance of recovery.
enum BlobLoad<T> {
    case empty
    case ok(T)
    case corrupt
}

func loadBlob<T: Decodable>(_ type: T.Type, from data: Data) -> BlobLoad<T> {
    if data.isEmpty { return .empty }
    if let value = try? JSONDecoder().decode(type, from: data) { return .ok(value) }
    return .corrupt
}

enum APICallError: Error {
    case network(String)
    case http(Int, String)
    case decode
    case empty

    var userMessage: String {
        switch self {
        case .network(let detail):
            return "Could not reach the API: \(detail)"
        case .http(401, _):
            return "Your API key was rejected. Tap the key icon to update it."
        case .http(403, _):
            return "Your API key isn't authorised for this model or region."
        case .http(429, _):
            return "Rate limit hit. Wait a moment and try again."
        case .http(529, _), .http(503, _):
            return "Anthropic is temporarily overloaded. Try again in a moment."
        case .http(400, let msg):
            return msg.isEmpty ? "The request was rejected (400)." : "Request rejected: \(msg)"
        case .http(let code, let msg):
            return msg.isEmpty ? "Server returned \(code)." : "Server returned \(code): \(msg)"
        case .decode:
            return "Unexpected response from Anthropic. Try again."
        case .empty:
            return "The model returned an empty response. Try again."
        }
    }
}

/// Reads an Anthropic error message from a non-200 response body.
/// Anthropic returns `{"type":"error","error":{"type":"...","message":"..."}}`.
func anthropicErrorMessage(from data: Data) -> String {
    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
       let err = json["error"] as? [String: Any],
       let msg = err["message"] as? String {
        return msg
    }
    return String(data: data, encoding: .utf8).map { String($0.prefix(200)) } ?? ""
}

struct KeychainService {
    private static let account = "com.up200.app.anthropic_api_key"

    @discardableResult
    static func save(_ value: String) -> Bool {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account,
            kSecValueData: data
        ]
        SecItemDelete(query as CFDictionary)
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
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
    var audioLevel: Float = 0
    @Published var seconds: Int = 0
    @Published var permissionDenied: Bool = false
    @Published var startupError: String? = nil
    @Published var showingSheet: Bool = false

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var timer: Timer?
    private var saveHandler: ((String) -> Void)?
    private var teardownTask: Task<Void, Never>? = nil

    var fullTranscript: String {
        if accumulated.isEmpty { return transcript }
        if transcript.isEmpty { return accumulated }
        return accumulated + " " + transcript
    }

    func begin(saveHandler: @escaping (String) -> Void) {
        if isRecording || isPaused {
            finish()
        }
        // Defensive: an earlier session may have left a tap installed and the
        // audio session active (e.g. SFSpeechRecognizer emitted isFinal without
        // a user-driven stop). Re-installing on a tapped input crashes.
        teardownEngine()
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

    /// Stop recording and route a caller-supplied text (e.g. an edited
    /// transcript from the composer view) to the registered save handler.
    func finishWithText(_ text: String) {
        let final = text.trimmingCharacters(in: .whitespacesAndNewlines)
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
        // Set flags immediately (still on MainActor) so any re-entrant call
        // from the recognition task callback sees isRecording=false and bails.
        isRecording = false
        audioLevel = 0
        // Cancel the recognition task so its callback stops firing and can't
        // update transcript or trigger a second teardown after this one.
        task?.cancel()
        task = nil
        // Capture what we need before hopping off the main actor — AVAudioEngine
        // and AVAudioSession calls can block 50-300 ms waiting for the audio
        // subsystem to drain; running them on the main thread freezes gestures.
        let engine = audioEngine
        let req = request
        request = nil
        teardownTask = Task.detached(priority: .userInitiated) {
            engine.stop()
            req?.endAudio()
            engine.inputNode.removeTap(onBus: 0)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func requestAuthAndStart() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                guard status == .authorized else {
                    self.permissionDenied = true
                    self.reset()
                    return
                }
                AVAudioApplication.requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        guard granted else {
                            self.permissionDenied = true
                            self.reset()
                            return
                        }
                        self.startEngine()
                    }
                }
            }
        }
    }

    private func startEngine() {
        task?.cancel()
        task = nil
        startupError = nil
        let prev = teardownTask
        teardownTask = nil
        Task { @MainActor [weak self] in
            await prev?.value
            self?.activateAndStart()
        }
    }

    private func activateAndStart() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            startupError = "Couldn't set up the audio session: \(error.localizedDescription)"
            return
        }

        request = SFSpeechAudioBufferRecognitionRequest()
        guard let req = request, let rec = recognizer else {
            startupError = "Speech recognition isn't available on this device."
            return
        }
        req.shouldReportPartialResults = true

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                // Guard against double teardown: if teardownEngine() was already
                // called (e.g. user tapped End mid-gesture), isRecording and
                // request are already cleared. A second teardown would race
                // with the first detached Task inside teardownEngine().
                if (error != nil || (result?.isFinal ?? false)), self.isRecording || self.isPaused {
                    self.teardownEngine()
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        // Throttle UI updates to 20 Hz. The audio callback fires ~43×/sec
        // (1024 samples @ 44100 Hz); dispatching to main every call floods the
        // main queue and freezes gesture handling (e.g. dragging the sheet down).
        var lastLevelDispatch: Double = 0
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
            let now = CFAbsoluteTimeGetCurrent()
            guard now - lastLevelDispatch >= 1.0 / 20.0 else { return }
            lastLevelDispatch = now
            DispatchQueue.main.async {
                self?.audioLevel = rms
            }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            isRecording = true
        } catch {
            startupError = "Couldn't start the microphone: \(error.localizedDescription)"
            inputNode.removeTap(onBus: 0)
        }
    }
}
