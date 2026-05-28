import Foundation
import Security
import Speech
import AVFoundation
import SwiftUI

// MARK: - Design tokens

enum BrandColor {
    static let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    /// Primary CTA fill — solid brown-amber, used by the Generate button
    /// and the Accept-rewrite button. Single shared token so every
    /// "primary action" surface reads as the same colour rather than
    /// each screen rolling its own.
    static let ctaPrimary = Color(red: 0.55, green: 0.27, blue: 0.07)

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
/// selection fills, and on-background text. White on dark, warm coffee
/// brown on light. Call `AppInk.solid(0.X)` instead of layering `.opacity(0.X)`
/// on top of a constant Color so the alpha is baked into the dynamic
/// UIColor; SwiftUI's `.opacity`
/// modifier resolves the dynamic provider against the screen trait
/// collection *before* the view's `preferredColorScheme` override applies,
/// which would otherwise leave text white in forced-light mode on a
/// system-dark device.
enum AppInk {
    /// Light-mode ink — a dark, warm coffee brown. Every translucent
    /// chrome element (text, glyphs, hairline strokes, chip fills) in
    /// light mode pulls from this single hue so nothing alpha-blends out
    /// to a neutral grey against the cream background.
    static let lightInk = UIColor(red: 0.16, green: 0.10, blue: 0.05, alpha: 1.0)

    static func solid(_ alpha: Double) -> Color {
        Color(uiColor: UIColor { trait in
            if trait.userInterfaceStyle == .dark {
                return UIColor(white: 1.0, alpha: alpha)
            }
            // Light mode uses a warm dark-brown ink instead of pure black so
            // every overlay (chip fills, hairline strokes, glyphs) carries a
            // hint of the brand's warmth — same alpha values still resolve
            // along the design's emphasis ramp, just with a coffee bias
            // instead of a flat neutral grey.
            return lightInk.withAlphaComponent(alpha)
        })
    }
}

/// Adaptive app-background tokens. Dark mode keeps the warm dark-brown
/// wash that gives the brand its identity; light mode is a faintly warm
/// cream — enough to carry the brand into light without bringing back
/// the heavy peach wash an earlier iteration had.
enum AppBackground {
    /// Solid app/sheet background. A faint warm tint on light so the warm
    /// brand CTA doesn't look orphaned against a cold neutral plane, while
    /// staying close enough to off-white that the page still reads as a
    /// clean surface.
    static let primary = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.035, green: 0.030, blue: 0.025, alpha: 1.0)
            : UIColor(red: 0.965, green: 0.955, blue: 0.935, alpha: 1.0)
    })
    /// Top-left radial-glow tint. Bright amber on dark — kept at a low
    /// alpha so the corner reads as a hint of warm light rather than the
    /// previous brown wash; a barely-there neutral lift on light so the
    /// corner doesn't go yellow.
    static let glowTopLeft = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.95, green: 0.62, blue: 0.15, alpha: 0.18)
            : UIColor(white: 1.0, alpha: 0.35)
    })
    /// Bottom-right radial-glow tint. Same amber hue as the top-left
    /// glow, lower alpha — far enough off the warm corner that it adds
    /// depth without doubling the wash.
    static let glowBottomRight = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.90, green: 0.55, blue: 0.12, alpha: 0.07)
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
    /// Disabled CTA fill. Must sit visibly **below** the cards above it
    /// (which are pure white in light) so the button still reads as a
    /// button rather than as another card with missing text. A warm tan
    /// in light keeps it on-brand without competing with the enabled
    /// brown-amber fill.
    static let ctaDisabled = Color(uiColor: UIColor { trait in
        trait.userInterfaceStyle == .dark
            ? UIColor(red: 0.14, green: 0.11, blue: 0.09, alpha: 1.0)
            : UIColor(red: 0.86, green: 0.83, blue: 0.78, alpha: 1.0)
    })
}

/// Text color tokens. Centralized so emphasis levels can be tuned in one
/// place. Text sitting on colored fills (amber CTAs, etc.) should keep
/// pure `.white` for contrast — these tokens are for content on the
/// adaptive app background and translucent chrome.
///
/// Light-mode emphasis ramps off `AppInk.lightInk` (a warm coffee brown)
/// so secondary / tertiary / muted text and icon glyphs don't alpha-blend
/// down to a neutral grey against the cream `AppBackground.primary` —
/// they fade through warm tones the same way the brand's CTAs do.
enum AppText {
    /// Body / titles — primary reading content.
    static let primary   = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.92)
            : AppInk.lightInk.withAlphaComponent(0.88)
    })
    /// Section labels, secondary actions, default icon foregrounds.
    static let secondary = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.55)
            : AppInk.lightInk.withAlphaComponent(0.62)
    })
    /// Subtitles, helper text, group headers.
    static let tertiary  = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.35)
            : AppInk.lightInk.withAlphaComponent(0.48)
    })
    /// Placeholders and very low-emphasis chrome (deep dim).
    static let muted     = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.22)
            : AppInk.lightInk.withAlphaComponent(0.34)
    })
    /// Disabled controls — both labels and icon glyphs.
    static let disabled  = Color(uiColor: UIColor { t in
        t.userInterfaceStyle == .dark
            ? UIColor(white: 1.0, alpha: 0.25)
            : AppInk.lightInk.withAlphaComponent(0.36)
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
/// Spiral binding rings straddle the top edge of the paper (not floating
/// above it as a separate row), with a stack of subtle "text lines"
/// inside — same elegant outline language as iOS system empty
/// illustrations (Inbox basket, Reminders empty, etc.).
struct NotesIllustration: View {
    var body: some View {
        ZStack {
            // Paper. Center at y=6, height 158 → top edge sits at y=-73.
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(AppInk.solid(0.65), lineWidth: 1.4)
                .frame(width: 134, height: 158)
                .overlay(
                    VStack(alignment: .leading, spacing: 14) {
                        ForEach(0..<5, id: \.self) { i in
                            Capsule()
                                .fill(AppInk.solid(0.30))
                                .frame(width: i == 4 ? 52 : 92, height: 4)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 28)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                )
                .offset(y: 6)

            // Binding rings, centered on the paper's top edge so each ring
            // is half above / half below the line. Reads as spiral-binding
            // punched through the top of the page rather than a detached
            // row of dots floating in space.
            HStack(spacing: 14) {
                ForEach(0..<5, id: \.self) { _ in
                    Circle()
                        .stroke(AppInk.solid(0.65), lineWidth: 1.4)
                        .frame(width: 8, height: 8)
                }
            }
            .offset(y: -73)
        }
        .frame(width: 180, height: 190)
        .accessibilityHidden(true)
    }
}

/// Hairline-outline document-stack illustration for the Library empty
/// state. Three overlapping content cards, each with a title bar and a
/// few body lines — same internal vocabulary as the Notes illustration
/// so the two empty states feel like one design family. Replaces the
/// older "book with dot grid + short capsule fragments" composition,
/// which read as broken elements piled together.
struct LibraryIllustration: View {
    var body: some View {
        ZStack {
            card(width: 96,  height: 124, offset: CGSize(width: -32, height: -10), tint: 0.40)
            card(width: 108, height: 138, offset: CGSize(width: 0,   height: 4),   tint: 0.65)
            card(width: 96,  height: 130, offset: CGSize(width: 32,  height: 14),  tint: 0.45)
        }
        .frame(width: 200, height: 180)
        .accessibilityHidden(true)
    }

    private func card(width: CGFloat, height: CGFloat, offset: CGSize, tint: Double) -> some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        return shape
            // Opaque app-background fill so each card occludes the cards behind
            // it. Without this the lower cards' body lines bleed through the
            // upper outlines and the stack reads as a tangle of intersecting
            // strokes instead of overlapping sheets.
            .fill(AppBackground.primary)
            .frame(width: width, height: height)
            .overlay(shape.stroke(AppInk.solid(tint), lineWidth: 1.4))
            .overlay(
                VStack(alignment: .leading, spacing: 8) {
                    // Title bar — heavier weight, ~half-width, so it reads
                    // as a document title rather than another body line.
                    Capsule()
                        .fill(AppInk.solid(tint * 0.85))
                        .frame(width: width * 0.5, height: 4)
                        .padding(.bottom, 2)
                    // Body lines — full-width with the last one short, so
                    // each card scans as a paragraph in miniature.
                    ForEach(0..<4, id: \.self) { i in
                        Capsule()
                            .fill(AppInk.solid(tint * 0.55))
                            .frame(width: i == 3 ? width * 0.40 : width * 0.72, height: 3)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.top, 16)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
                    .fill(AppInk.solid(0.08))
            )
            .overlay(
                Capsule(style: .continuous)
                    .stroke(AppInk.solid(0.35), lineWidth: 1)
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
                    .foregroundColor(AppText.primary)
                if let subtitle {
                    Text(subtitle)
                        .font(.appSubtext)
                        .foregroundColor(AppText.secondary)
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

struct SessionTokenService {
    private static let account = "com.up200.app.session_token"
    static let expiresAtKey = "com.up200.app.session_token_expires_at"

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

    /// True when the stored token will expire within the next 7 days.
    static var needsRefresh: Bool {
        let exp = UserDefaults.standard.integer(forKey: expiresAtKey)
        guard exp > 0 else { return false }
        let sevenDays: TimeInterval = 7 * 24 * 60 * 60
        return TimeInterval(exp) - Date().timeIntervalSince1970 < sevenDays
    }

    static func delete() {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account
        ]
        SecItemDelete(query as CFDictionary)
        UserDefaults.standard.removeObject(forKey: expiresAtKey)
    }
}

// MARK: - Session token refresh

/// Exchanges a near-expiry HMAC session token for a fresh one.
/// Called by AnthropicClient when the proxy returns 401.
enum SessionTokenRefresher {
    private struct RefreshResponse: Decodable {
        let sessionToken: String
        let sessionTokenExpiresAt: Int
    }

    static func refresh() async {
        guard let oldToken = SessionTokenService.load() else { return }
        var req = URLRequest(url: AppConfig.API.tokenRefresh)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(oldToken)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = 15
        guard let (data, response) = try? await URLSession.shared.data(for: req),
              let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              let body = try? JSONDecoder().decode(RefreshResponse.self, from: data) else { return }
        SessionTokenService.save(body.sessionToken)
        UserDefaults.standard.set(body.sessionTokenExpiresAt, forKey: SessionTokenService.expiresAtKey)
    }
}

/// Builds a URLRequest aimed at either the first-party proxy (when a session
/// token is present) or directly at the Anthropic API (BYOK legacy path).
/// Returns nil when neither credential is available.
enum AnthropicClient {
    private static let directURL = URL(string: "https://api.anthropic.com/v1/messages")!

    static func makeRequest(body: [String: Any], timeout: TimeInterval = 60) -> URLRequest? {
        if let token = SessionTokenService.load() {
            return proxyRequest(token: token, body: body, timeout: timeout)
        }
        if let key = KeychainService.load(), !key.isEmpty {
            var req = URLRequest(url: directURL)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue(key, forHTTPHeaderField: "x-api-key")
            req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
            req.timeoutInterval = timeout
            req.httpBody = try? JSONSerialization.data(withJSONObject: body)
            return req
        }
        return nil
    }

    static func proxyRequest(token: String, body: [String: Any], timeout: TimeInterval) -> URLRequest {
        var req = URLRequest(url: AppConfig.API.claude)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.timeoutInterval = timeout
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return req
    }

    static var isConfigured: Bool {
        SessionTokenService.load() != nil || !(KeychainService.load() ?? "").isEmpty
    }
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

    /// Reconcile a sheet-driven dismissal. If the user swipe-dismisses the
    /// voice sheet without tapping Finish or Cancel, `showingSheet` flips
    /// to false but `saveHandler` (and any running engine) lingers — the
    /// closure captures `notes`, etc., leaking those references until the
    /// next begin() call clears them. Call this from the sheet's
    /// `onDismiss` to treat a swipe-dismissal as a Cancel only when no
    /// explicit termination has run yet.
    func reconcileDismissal() {
        if saveHandler != nil { cancel() }
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
        // setCategory + setActive can block the main thread for 50-300ms
        // while the audio subsystem reconciles category, ducks other
        // apps, etc. Running them on a detached task keeps gesture
        // handling responsive — once the session is live we hop back
        // to the main actor and finish wiring the recognizer + engine.
        Task.detached(priority: .userInitiated) { [weak self] in
            let session = AVAudioSession.sharedInstance()
            do {
                try session.setCategory(.record, mode: .measurement, options: .duckOthers)
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                await MainActor.run {
                    self?.startupError = "Couldn't set up the audio session: \(error.localizedDescription)"
                }
                return
            }
            await MainActor.run {
                self?.continueStartingEngine()
            }
        }
    }

    private func continueStartingEngine() {
        // Bail if the user cancelled while the session was activating —
        // saveHandler == nil means cancel()/reset() ran in the gap.
        guard saveHandler != nil else { return }

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
