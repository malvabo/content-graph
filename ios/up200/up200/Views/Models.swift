import Foundation
import Security
import Speech
import AVFoundation
import SwiftUI

// MARK: - Design tokens

enum BrandColor {
    static let amber = Color(red: 0.78, green: 0.78, blue: 0.80)

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

    /// Same warm ramp as `glowGradient`, raised in value so small foreground
    /// glyphs (mic, recorder icons) read as a brighter, more saturated version
    /// of the Generate button's center glow.
    static let glowGradientBright = LinearGradient(
        colors: [
            Color(red: 1.00, green: 0.84, blue: 0.42),
            Color(red: 1.00, green: 0.62, blue: 0.22),
            Color(red: 0.92, green: 0.36, blue: 0.10)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum SelectionStyle {
    static let fill = AppInk.solid(0.14)
    static let stroke = AppInk.solid(0.30)
}

/// Adaptive "ink" — the base hue for translucent overlays, separators,
/// selection fills, and on-background text. White on dark, near-black on
/// light. Call `AppInk.solid(0.X)` instead of layering `.opacity(0.X)`
/// on top of a constant Color so the alpha is baked into the dynamic
/// UIColor; SwiftUI's `.opacity`
/// modifier resolves the dynamic provider against the screen trait
/// collection *before* the view's `preferredColorScheme` override applies,
/// which would otherwise leave text white in forced-light mode on a
/// system-dark device.
enum AppInk {
    static func solid(_ alpha: Double) -> Color {
        Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: alpha)
                : UIColor(white: 0.0, alpha: alpha)
        })
    }
}

/// Adaptive app-background tokens. Dark mode keeps the warm dark-brown
/// wash that gives the brand its identity; light mode is a clean
/// neutral grey — no warm tint, no peach glow — so the page reads as
/// a flat off-white plane like Apple's own light surfaces.
enum AppBackground {
    /// Solid app/sheet background. Neutral RGB on light so the warm
    /// brand colors (amber chips, CTA) pop against a true grey ground
    /// instead of fighting a beige tint.
    static let primary = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.10, green: 0.08, blue: 0.07, alpha: 1.0)
            : UIColor(white: 0.96, alpha: 1.0)
    })
    /// Top-left radial-glow tint. Warm amber on dark; a barely-there
    /// neutral lift on light so the corner doesn't go yellow.
    static let glowTopLeft = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.55, green: 0.30, blue: 0.08, alpha: 0.35)
            : UIColor(white: 1.0, alpha: 0.35)
    })
    /// Bottom-right radial-glow tint.
    static let glowBottomRight = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.30, green: 0.20, blue: 0.08, alpha: 0.22)
            : UIColor(white: 0.88, alpha: 0.30)
    })

    /// Raised card / pill surface that sits on top of `primary`. Near-black
    /// on dark; pure white on light so cards read as a clean lifted plane.
    static let surface = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.11, green: 0.09, blue: 0.08, alpha: 1.0)
            : UIColor(white: 1.0, alpha: 1.0)
    })

    /// Slightly cooler/deeper card variant used by the prompt-field pill.
    static let surfaceCool = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.06, green: 0.07, blue: 0.10, alpha: 1.0)
            : UIColor(red: 0.975, green: 0.975, blue: 0.985, alpha: 1.0)
    })

    /// Capsule / button surface used by the floating capsule control.
    static let capsule = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.18, green: 0.14, blue: 0.12, alpha: 1.0)
            : UIColor(white: 1.0, alpha: 1.0)
    })

    /// Generate CTA base fill. Stays brand-amber in both modes so the
    /// primary action keeps its identity — the radial glow on top just
    /// makes the center bloom. Light mode shifts a touch deeper so the
    /// glow still reads as "lighter than the rim".
    static let ctaEnabled = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.24, green: 0.14, blue: 0.07, alpha: 1.0)
            : UIColor(red: 0.78, green: 0.42, blue: 0.10, alpha: 1.0)
    })
    static let ctaDisabled = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.14, green: 0.11, blue: 0.09, alpha: 1.0)
            : UIColor(red: 0.90, green: 0.89, blue: 0.87, alpha: 1.0)
    })
}

/// Text color tokens. Centralized so emphasis levels can be tuned in one
/// place. Text sitting on colored fills (amber CTAs, etc.) should keep
/// pure `.white` for contrast — these tokens are for content on the
/// adaptive app background and translucent chrome.
enum AppText {
    /// Body / titles — primary reading content.
    static let primary   = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.92) : UIColor(white: 0.0, alpha: 0.88)
    })
    /// Section labels, secondary actions, default icon foregrounds.
    static let secondary = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.55) : UIColor(white: 0.0, alpha: 0.58)
    })
    /// Subtitles, helper text, group headers.
    static let tertiary  = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.35) : UIColor(white: 0.0, alpha: 0.42)
    })
    /// Placeholders and very low-emphasis chrome (deep dim).
    static let muted     = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.22) : UIColor(white: 0.0, alpha: 0.28)
    })
    /// Disabled controls — both labels and icon glyphs.
    static let disabled  = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark ? UIColor(white: 1.0, alpha: 0.25) : UIColor(white: 0.0, alpha: 0.30)
    })
}

/// Canonical corner-radius scale. Pick the role, not the literal — that way
/// raising the "card" radius from 16 → 18 is one diff instead of forty.
enum Radius {
    /// Inputs and small chips (text fields, search bar pills).
    static let input: CGFloat = 12
    /// Cards, buttons, content blocks.
    static let card: CGFloat = 16
    /// Message bubbles and large containers.
    static let bubble: CGFloat = 18
    /// Sheets and large CTA buttons (the AnimatedLightsButton, format picker sheet).
    static let sheet: CGFloat = 22
    /// Voice-recorder controls and capsule buttons.
    static let pill: CGFloat = 28
}

/// Canonical animation timings. Comments describe the feel — pick by intent.
enum AppAnimation {
    /// Snappy feedback: tap haptics, button state flips. ~150 ms.
    static let quick    = Animation.easeOut(duration: 0.15)
    /// Standard transitions: section toggles, sheet detents. ~220 ms.
    static let standard = Animation.easeInOut(duration: 0.22)
    /// Entrances and reveals: onboarding stage in, large layout shifts.
    static let entrance = Animation.easeOut(duration: 0.6)
}

/// Reusable circular icon-button hit-area treatment. Visible chrome stays the
/// caller's; the modifier just guarantees a 44×44 tap target with a
/// rectangular hit shape, satisfying Apple HIG and our own consistency rules.
struct AppIconHitArea: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(minWidth: 44, minHeight: 44)
            .contentShape(Rectangle())
    }
}

extension View {
    /// Apply on a Button label or Image to enforce the 44pt touch target.
    func appIconHitArea() -> some View { modifier(AppIconHitArea()) }
}

/// Shared app background with two soft radial glows. Place at the bottom
/// of a screen-level ZStack so the same atmosphere reads across Create,
/// Notes, and Library without duplicating the gradient stack. Adaptive:
/// warm dark brown on dark, a smooth grey wash on light.
struct AmbientBackground: View {
    var body: some View {
        ZStack {
            AppBackground.primary
            RadialGradient(
                colors: [AppBackground.glowTopLeft, .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0, endRadius: 380
            )
            RadialGradient(
                colors: [AppBackground.glowBottomRight, .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0, endRadius: 320
            )
        }
        .ignoresSafeArea()
    }
}

// MARK: - Empty-state illustrations

/// Hairline-outline notepad illustration for the Notes empty state.
/// Spiral binding dots on top, a paper outline with a stack of subtle
/// "text lines" inside — same elegant outline language as iOS system
/// empty illustrations (Inbox basket, Reminders empty, etc.).
struct NotesIllustration: View {
    var body: some View {
        ZStack {
            HStack(spacing: 14) {
                ForEach(0..<5, id: \.self) { _ in
                    Circle()
                        .stroke(AppInk.solid(0.24), lineWidth: 1.2)
                        .frame(width: 7, height: 7)
                }
            }
            .offset(y: -82)

            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppInk.solid(0.26), lineWidth: 1.4)
                .frame(width: 134, height: 158)
                .overlay(
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(0..<5, id: \.self) { i in
                            Capsule()
                                .fill(AppInk.solid(0.14))
                                .frame(width: i == 4 ? 52 : 92, height: 4)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 24)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                )
                .offset(y: 6)
        }
        .frame(width: 180, height: 190)
        .accessibilityHidden(true)
    }
}

/// Hairline-outline book-stack illustration for the Library empty state.
/// Three offset book outlines with a subtle dotted texture on the middle
/// volume — echoes the "container + perforated surface" of the reference.
struct LibraryIllustration: View {
    var body: some View {
        ZStack {
            book(width: 96,  height: 124, offset: CGSize(width: -32, height: -10), tint: 0.16, withDots: false)
            book(width: 108, height: 138, offset: CGSize(width: 0,   height: 4),   tint: 0.22, withDots: true)
            book(width: 96,  height: 130, offset: CGSize(width: 32,  height: 14),  tint: 0.18, withDots: false)
        }
        .frame(width: 200, height: 180)
        .accessibilityHidden(true)
    }

    private func book(width: CGFloat, height: CGFloat, offset: CGSize, tint: Double, withDots: Bool) -> some View {
        RoundedRectangle(cornerRadius: 6, style: .continuous)
            .stroke(AppInk.solid(tint), lineWidth: 1.4)
            .frame(width: width, height: height)
            .overlay(
                VStack(spacing: 0) {
                    Capsule()
                        .fill(AppInk.solid(tint * 0.7))
                        .frame(width: width * 0.5, height: 3)
                        .padding(.top, 14)
                    if withDots {
                        Spacer(minLength: 8)
                        VStack(spacing: 6) {
                            ForEach(0..<4, id: \.self) { _ in
                                HStack(spacing: 6) {
                                    ForEach(0..<6, id: \.self) { _ in
                                        Circle()
                                            .fill(AppInk.solid(tint * 0.55))
                                            .frame(width: 2.4, height: 2.4)
                                    }
                                }
                            }
                        }
                        Spacer(minLength: 8)
                    } else {
                        Spacer()
                    }
                    Capsule()
                        .fill(AppInk.solid(tint * 0.7))
                        .frame(width: width * 0.28, height: 3)
                        .padding(.bottom, 14)
                }
            )
            .offset(offset)
    }
}

/// Outline-style plus CTA used by empty states. Thin hairline stroke,
/// no fill — preserves the illustration's outline language. Optional
/// `subtitle` for a one-word affordance like "New note".
struct EmptyStatePlusButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .semibold))
                Text(title)
                    .font(.appLabelBold)
            }
            .foregroundColor(AppText.primary)
            .padding(.horizontal, 22)
            .padding(.vertical, 12)
            .background(
                Capsule(style: .continuous)
                    .stroke(AppInk.solid(0.22), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

/// Composed empty-state block: illustration + title + optional subtitle +
/// optional plus CTA. Keeps the empty branches in NotesView/LibraryView
/// declarative and visually consistent.
struct EmptyStateView<Illustration: View>: View {
    let illustration: Illustration
    let title: String
    let subtitle: String?
    let actionTitle: String?
    let action: (() -> Void)?

    init(
        illustration: Illustration,
        title: String,
        subtitle: String? = nil,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.illustration = illustration
        self.title = title
        self.subtitle = subtitle
        self.actionTitle = actionTitle
        self.action = action
    }

    var body: some View {
        VStack(spacing: 22) {
            illustration
            VStack(spacing: 6) {
                Text(title)
                    .font(.appBodyBold)
                    .foregroundColor(AppText.secondary)
                if let subtitle {
                    Text(subtitle)
                        .font(.appSubtext)
                        .foregroundColor(AppText.tertiary)
                        .multilineTextAlignment(.center)
                }
            }
            if let actionTitle, let action {
                EmptyStatePlusButton(title: actionTitle, action: action)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
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
            return "Your API key was rejected. Update it in Profile."
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

enum NoteKind: String, Codable {
    case text
    case drawing
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
    var isPinned: Bool = false
    /// Text vs sketched note. Drawing notes carry a serialized `PKDrawing`
    /// in `drawingData`; `body` holds any audio transcript captured while
    /// drawing.
    var kind: NoteKind = .text
    var drawingData: Data? = nil

    var isEmpty: Bool {
        body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && (drawingData?.isEmpty ?? true)
    }

    var displayTitle: String {
        let firstLine = body.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let cleaned = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        if !cleaned.isEmpty { return cleaned }
        return kind == .drawing ? "Sketch" : "Untitled"
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

    // Custom init tolerates missing keys for fields added after release —
    // Swift's synthesized decoder requires every key to be present.
    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(UUID.self,     forKey: .id)          ?? UUID()
        title       = try c.decodeIfPresent(String.self,   forKey: .title)       ?? ""
        body        = try c.decodeIfPresent(String.self,   forKey: .body)        ?? ""
        updatedAt   = try c.decodeIfPresent(Date.self,     forKey: .updatedAt)   ?? Date()
        tags        = try c.decodeIfPresent([String].self, forKey: .tags)        ?? []
        isPinned    = try c.decodeIfPresent(Bool.self,     forKey: .isPinned)    ?? false
        kind        = try c.decodeIfPresent(NoteKind.self, forKey: .kind)        ?? .text
        drawingData = try c.decodeIfPresent(Data.self,     forKey: .drawingData)
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
                // Guard: cancel() or finish() may have cleared saveHandler while the
                // auth dialog was on screen. Don't start the engine for a dead session.
                guard self.saveHandler != nil else { return }
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
                        guard self.saveHandler != nil else { return }
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
                // Drop late callbacks after cancel/reset — they would otherwise
                // overwrite an intentionally cleared transcript with stale text.
                guard self.isRecording || self.isPaused else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                // Guard against double teardown: if teardownEngine() was already
                // called (e.g. user tapped End mid-gesture), isRecording and
                // request are already cleared. A second teardown would race
                // with the first detached Task inside teardownEngine().
                if error != nil || (result?.isFinal ?? false) {
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
