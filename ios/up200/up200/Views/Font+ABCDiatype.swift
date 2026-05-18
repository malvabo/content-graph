import SwiftUI

extension Font {
    static func app(size: CGFloat, weight: Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }

    /// Lora — the serif used for onboarding headlines. Bundled as static
    /// cuts (Regular / Medium / SemiBold / Bold); weights outside that
    /// set fall back to the nearest available cut rather than letting the
    /// system synthesize, since synthesized weights look smeared on a
    /// hairline serif.
    static func lora(size: CGFloat, weight: Weight = .regular) -> Font {
        let postScriptName: String = {
            switch weight {
            case .bold, .heavy, .black: return "Lora-Bold"
            case .semibold:             return "Lora-SemiBold"
            case .medium:               return "Lora-Medium"
            default:                    return "Lora-Regular"
            }
        }()
        return .custom(postScriptName, size: size)
    }

    // ── Type scale ────────────────────────────────────────────────────────────
    // Title
    static let appTitle        = app(size: 26, weight: .bold)      // detail screen heading
    static let appNavTitle     = app(size: 19, weight: .semibold)  // nav bar / modal title

    // Row title  (notes / library / templates list rows)
    static let appRowTitle     = app(size: 17, weight: .semibold)

    // Body
    static let appBody         = app(size: 17)
    static let appBodyBold     = app(size: 17, weight: .semibold)

    // Reading body — a notch larger than `appBody` for long-form content
    // surfaces (note bodies, generated content, markdown read views).
    // Chat keeps `appBody` so message bubbles don't grow.
    static let appReadingBody  = app(size: 18)

    // Label  (UI controls, buttons)
    static let appLabel        = app(size: 16)
    static let appLabelBold    = app(size: 16, weight: .semibold)

    // Subtext  (list rows, secondary content)
    static let appSubtext      = app(size: 15)
    static let appSubtextMedium = app(size: 15, weight: .medium)
    static let appSubtextBold  = app(size: 15, weight: .semibold)

    // Small  (supporting text, inline metadata)
    static let appSmall        = app(size: 14)

    // Caption  (dates, timestamps, minor labels)
    static let appCaption      = app(size: 13)
    static let appCaptionMedium = app(size: 13, weight: .medium)

    // Micro  (overlines, badges)
    static let appMicro        = app(size: 12)
    static let appBadge        = app(size: 11, weight: .medium)
}

struct AppBodyTextStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.appBody)
            .lineSpacing(8)
            .foregroundColor(AppInk.solid(0.92))
    }
}

struct AppReadingBodyTextStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.appReadingBody)
            .lineSpacing(8)
            .foregroundColor(AppInk.solid(0.92))
    }
}

extension View {
    func appBodyText() -> some View {
        modifier(AppBodyTextStyle())
    }

    func appReadingBodyText() -> some View {
        modifier(AppReadingBodyTextStyle())
    }
}
