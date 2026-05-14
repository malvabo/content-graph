import SwiftUI

extension Font {
    static func app(size: CGFloat, weight: Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }

    // ── Type scale ────────────────────────────────────────────────────────────
    // Title
    static let appTitle        = app(size: 26, weight: .bold)      // detail screen heading
    static let appNavTitle     = app(size: 19, weight: .semibold)  // nav bar / modal title

    // Body
    static let appBody         = app(size: 17)
    static let appBodyBold     = app(size: 17, weight: .semibold)

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
            .foregroundColor(Color.white.opacity(0.92))
    }
}

extension View {
    func appBodyText() -> some View {
        modifier(AppBodyTextStyle())
    }
}
