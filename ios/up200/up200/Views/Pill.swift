import SwiftUI

/// Canonical pill component used across the app for filter chips, tab strips,
/// suggestion chips, removable tags, menu triggers, and capsule-shaped action
/// buttons. Every pill the user sees should go through this struct so
/// paddings, fonts, fills, and selection styling stay in lockstep.
///
/// Pills are always `Capsule`-shaped. Pick a `Style` for the visual treatment
/// and a `Size` for the footprint (`.compact` for inline tags, `.regular` for
/// chips, `.large` for primary/secondary action buttons in sheets).
struct Pill: View {
    enum Style {
        /// Selectable filter / option chip. Opaque even when unselected.
        case filter(Bool)
        /// Tab strip pill. Transparent until selected.
        case tab(Bool)
        /// Subtle non-selectable suggestion chip (tap-to-add).
        case suggestion
        /// Static neutral pill — e.g. a menu trigger or removable tag.
        case neutral
        /// Solid primary action pill (white fill, dark text).
        case solid
        /// Outline secondary action pill.
        case outline
    }

    enum Size {
        case compact   // 10×6 padding, 12pt label — inline context chips
        case regular   // 14×8 padding, 14pt label — filter/tab/suggestion chips
        case large     // 22×0 padding (fixed 40pt height), 17pt label — sheet CTAs
    }

    let title: String
    var style: Style
    var size: Size = .regular
    var leadingSystemImage: String? = nil
    var trailingSystemImage: String? = nil
    var onRemove: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: contentSpacing) {
            if let leadingSystemImage {
                Image(systemName: leadingSystemImage)
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundColor(foregroundColor)
            }
            Text(title)
                .font(font)
                .foregroundColor(foregroundColor)
                .lineLimit(1)
            if let trailingSystemImage {
                Image(systemName: trailingSystemImage)
                    .font(.system(size: iconSize, weight: .semibold))
                    .foregroundColor(secondaryColor)
            }
            if let onRemove {
                Button(action: onRemove) {
                    Image(systemName: "xmark")
                        .font(.system(size: removeIconSize, weight: .bold))
                        .foregroundColor(secondaryColor)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        .frame(minHeight: minHeight)
        .background(Capsule(style: .continuous).fill(backgroundFill))
        .overlay(Capsule(style: .continuous).stroke(borderStroke, lineWidth: 0.5))
    }

    private var horizontalPadding: CGFloat {
        switch size {
        case .compact: return 10
        case .regular: return 14
        case .large:   return 22
        }
    }
    private var verticalPadding: CGFloat {
        switch size {
        case .compact: return 6
        case .regular: return 8
        case .large:   return 0
        }
    }
    private var minHeight: CGFloat? { size == .large ? 40 : nil }
    private var contentSpacing: CGFloat { size == .compact ? 6 : 8 }
    private var iconSize: CGFloat { size == .compact ? 10 : 11 }
    private var removeIconSize: CGFloat { size == .compact ? 9 : 10 }
    private var font: Font {
        switch size {
        case .compact: return .app(size: 12, weight: weight)
        case .regular: return .app(size: 14, weight: weight)
        case .large:   return .appBodyBold
        }
    }

    private var weight: Font.Weight {
        switch style {
        case .filter(let s), .tab(let s):
            return s ? .semibold : .regular
        case .suggestion, .neutral:
            return .medium
        case .solid, .outline:
            return .semibold
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .filter(let s), .tab(let s):
            return s ? .white : Color.white.opacity(0.55)
        case .suggestion:
            return Color.white.opacity(0.65)
        case .neutral:
            return Color.white.opacity(0.75)
        case .solid:
            return .black
        case .outline:
            return .white
        }
    }

    private var secondaryColor: Color {
        if case .solid = style { return Color.black.opacity(0.45) }
        return Color.white.opacity(0.45)
    }

    private var backgroundFill: Color {
        switch style {
        case .filter(let s):
            return s ? SelectionStyle.fill : Color.white.opacity(0.08)
        case .tab(let s):
            return s ? SelectionStyle.fill : Color.clear
        case .suggestion:
            return Color.white.opacity(0.07)
        case .neutral:
            return Color.white.opacity(0.08)
        case .solid:
            return .white
        case .outline:
            return .clear
        }
    }

    private var borderStroke: Color {
        switch style {
        case .filter(let s):
            return s ? SelectionStyle.stroke : Color.white.opacity(0.10)
        case .tab(let s):
            return s ? SelectionStyle.stroke : Color.clear
        case .suggestion, .neutral:
            return Color.white.opacity(0.10)
        case .solid:
            return .clear
        case .outline:
            return Color.white.opacity(0.20)
        }
    }
}
