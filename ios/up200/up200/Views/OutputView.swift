import SwiftUI

// MARK: - Output Document

struct OutputDocument: Identifiable {
    let id = UUID()
    var format: OutputFormat
    /// For long-form / compact formats, the full body text. For Twitter thread,
    /// concatenated as paragraphs separated by `\n\n` — split into tweets at
    /// render time.
    var body: String
}

extension OutputFormat {
    /// Fourth, contextual action shown in the bottom bar.
    var contextualAction: (label: String, icon: String) {
        switch self {
        case .blogPost, .pressRelease, .landingPage:
            return ("Open in editor", "doc.richtext")
        case .newsletter, .email:
            return ("Send test", "paperplane")
        case .linkedinPost, .twitterSingle, .instagramCaption:
            return ("Schedule", "calendar.badge.clock")
        case .twitterThread:
            return ("Post thread", "paperplane")
        case .youtubeScript, .podcastScript, .video:
            return ("Export script", "square.and.arrow.down")
        case .slackMessage:
            return ("Send to Slack", "paperplane")
        case .quoteCard, .infographic:
            return ("Export image", "square.and.arrow.down")
        case .summary:
            return ("Open in editor", "doc.richtext")
        }
    }

    var isLongForm: Bool {
        switch self {
        case .newsletter, .blogPost, .pressRelease, .landingPage,
             .email, .youtubeScript, .podcastScript, .summary:
            return true
        default:
            return false
        }
    }

    var isTwitterThread: Bool { self == .twitterThread }
}

// MARK: - Source Row Item (lightweight, local to this screen)

struct OutputSourceItem: Identifiable, Equatable {
    let id = UUID()
    var icon: String
    var label: String
}

// MARK: - Glass Card (local)

private struct OutputGlassCard<Content: View>: View {
    @ViewBuilder let content: Content
    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.07))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

// MARK: - Pill Button

private struct OutputPill: View {
    let icon: String
    let text: String
    var action: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.5))
                Text(text)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.8))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.35))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.08))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.10), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Inline Editable Text

/// TextEditor-backed inline editor that grows with content. Used for
/// long-form bodies and individual tweets.
private struct InlineEditor: View {
    @Binding var text: String
    var font: Font
    var lineSpacing: CGFloat = 4
    var placeholder: String = ""

    @State private var measuredHeight: CGFloat = 80

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Hidden measurer
            Text(text.isEmpty ? placeholder : text)
                .font(font)
                .lineSpacing(lineSpacing)
                .foregroundColor(.clear)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    GeometryReader { geo in
                        Color.clear.preference(
                            key: HeightPreferenceKey.self,
                            value: geo.size.height
                        )
                    }
                )

            if text.isEmpty {
                Text(placeholder)
                    .font(font)
                    .foregroundColor(Color.white.opacity(0.25))
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .allowsHitTesting(false)
            }

            TextEditor(text: $text)
                .font(font)
                .lineSpacing(lineSpacing)
                .foregroundColor(Color.white.opacity(0.9))
                .scrollContentBackground(.hidden)
                .background(.clear)
                .padding(.horizontal, 8)
                .frame(height: max(measuredHeight, 60))
        }
        .onPreferenceChange(HeightPreferenceKey.self) { measuredHeight = $0 + 16 }
    }
}

private struct HeightPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

// MARK: - Body Renderers

/// Long-form layout: a single editable surface, generous reading width.
private struct LongFormBody: View {
    @Binding var text: String
    var format: OutputFormat

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(format.rawValue.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(1.2)
                .foregroundColor(Color.white.opacity(0.35))
                .padding(.horizontal, 8)

            InlineEditor(
                text: $text,
                font: .system(size: 17, weight: .regular),
                lineSpacing: 6,
                placeholder: "Start writing…"
            )
        }
    }
}

/// Compact LinkedIn-style: a card-shaped body with a fixed character feel.
private struct CompactBody: View {
    @Binding var text: String
    var format: OutputFormat

    var body: some View {
        OutputGlassCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: format.icon)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.5))
                    Text(format.rawValue)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.55))
                    Spacer()
                    Text("\(text.count) chars")
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.35))
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)

                InlineEditor(
                    text: $text,
                    font: .system(size: 16, weight: .regular),
                    lineSpacing: 5,
                    placeholder: "Write your post…"
                )
                .padding(.bottom, 6)
            }
        }
    }
}

/// Twitter thread: split body on `\n\n` and render each paragraph as its
/// own editable tweet card. Editing reassembles on commit.
private struct TwitterThreadBody: View {
    @Binding var text: String

    @State private var tweets: [String] = []

    var body: some View {
        VStack(spacing: 12) {
            ForEach(tweets.indices, id: \.self) { idx in
                TweetCard(
                    index: idx + 1,
                    total: tweets.count,
                    text: Binding(
                        get: { tweets[idx] },
                        set: { tweets[idx] = $0; flush() }
                    ),
                    onDelete: tweets.count > 1 ? {
                        tweets.remove(at: idx)
                        flush()
                    } : nil
                )
            }

            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                tweets.append("")
                flush()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "plus")
                    Text("Add tweet")
                }
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.55))
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.white.opacity(0.04))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .strokeBorder(
                                    Color.white.opacity(0.15),
                                    style: StrokeStyle(lineWidth: 0.8, dash: [4, 3])
                                )
                        )
                )
            }
            .buttonStyle(.plain)
        }
        .onAppear { hydrate() }
        .onChange(of: text) { _, newValue in
            // External edits (e.g. regenerate) should re-hydrate.
            let split = newValue.components(separatedBy: "\n\n").filter { !$0.isEmpty }
            if split != tweets { tweets = split.isEmpty ? [""] : split }
        }
    }

    private func hydrate() {
        let split = text.components(separatedBy: "\n\n").filter { !$0.isEmpty }
        tweets = split.isEmpty ? [""] : split
    }

    private func flush() {
        text = tweets.joined(separator: "\n\n")
    }
}

private struct TweetCard: View {
    let index: Int
    let total: Int
    @Binding var text: String
    var onDelete: (() -> Void)?

    private let limit = 280

    var body: some View {
        OutputGlassCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    Text("\(index)/\(total)")
                        .font(.system(size: 12, weight: .semibold, design: .monospaced))
                        .foregroundColor(Color.white.opacity(0.45))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.06))
                        .clipShape(Capsule())

                    Spacer()

                    Text("\(text.count)/\(limit)")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(text.count > limit
                                         ? Color(red: 0.85, green: 0.45, blue: 0.10)
                                         : Color.white.opacity(0.35))

                    if let onDelete {
                        Button(action: onDelete) {
                            Image(systemName: "xmark")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Color.white.opacity(0.4))
                                .frame(width: 28, height: 28)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 12)

                InlineEditor(
                    text: $text,
                    font: .system(size: 15, weight: .regular),
                    lineSpacing: 4,
                    placeholder: "Write tweet…"
                )
                .padding(.bottom, 6)
            }
        }
    }
}

// MARK: - Bottom Action Bar

private struct BottomActionBar: View {
    let format: OutputFormat
    var onRegenerate: () -> Void
    var onCopy: () -> Void
    var onShare: () -> Void
    var onContextual: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            BarAction(icon: "arrow.clockwise", label: "Regenerate", action: onRegenerate)
            divider
            BarAction(icon: "doc.on.doc", label: "Copy", action: onCopy)
            divider
            BarAction(icon: "square.and.arrow.up", label: "Share", action: onShare)
            divider
            BarAction(
                icon: format.contextualAction.icon,
                label: format.contextualAction.label,
                action: onContextual
            )
        }
        .frame(height: 56)
        .background(
            ZStack {
                Rectangle().fill(.ultraThinMaterial)
                Rectangle().fill(Color.black.opacity(0.25))
            }
        )
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 0.5)
        }
    }

    private var divider: some View {
        Rectangle()
            .fill(Color.white.opacity(0.06))
            .frame(width: 0.5, height: 22)
    }
}

private struct BarAction: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(spacing: 2) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .foregroundColor(Color.white.opacity(0.75))
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Sheets

/// Format switch sheet — picks a new format and applies (regenerates).
private struct FormatSwitchSheet: View {
    @Binding var current: OutputFormat
    var onApply: (OutputFormat) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var picked: OutputFormat
    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    init(current: Binding<OutputFormat>, onApply: @escaping (OutputFormat) -> Void) {
        self._current = current
        self.onApply = onApply
        self._picked = State(initialValue: current.wrappedValue)
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Switch format")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                    Text("Regenerates this output")
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.45))
                }
                Spacer()
                Button("Apply") {
                    onApply(picked)
                    dismiss()
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(picked == current ? Color.white.opacity(0.3) : accent)
                .disabled(picked == current)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            ScrollView(showsIndicators: false) {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(OutputFormat.allCases) { format in
                        let isSelected = picked == format
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            picked = format
                        } label: {
                            VStack(spacing: 8) {
                                Image(systemName: format.icon)
                                    .font(.system(size: 18, weight: .regular))
                                Text(format.rawValue)
                                    .font(.system(size: 12, weight: .medium))
                                    .multilineTextAlignment(.center)
                                    .lineLimit(2)
                            }
                            .foregroundColor(isSelected ? accent : Color.white.opacity(0.65))
                            .frame(maxWidth: .infinity)
                            .frame(height: 80)
                            .background(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(isSelected ? accent.opacity(0.12) : Color.white.opacity(0.07))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                                            .stroke(
                                                isSelected ? accent.opacity(0.45) : Color.white.opacity(0.08),
                                                lineWidth: 0.5
                                            )
                                    )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .animation(.easeOut(duration: 0.15), value: isSelected)
                    }
                }
                .padding(16)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

/// Voice picker sheet — switch voice and apply (regenerates).
private struct VoicePickerSheet: View {
    @Binding var current: String
    var onApply: (String) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var picked: String
    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)
    private let voices = ["Default", "Personal", "Company", "Startup", "Agency"]

    init(current: Binding<String>, onApply: @escaping (String) -> Void) {
        self._current = current
        self.onApply = onApply
        self._picked = State(initialValue: current.wrappedValue)
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Voice")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                    Text("Regenerates this output")
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.45))
                }
                Spacer()
                Button("Apply") {
                    onApply(picked)
                    dismiss()
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(picked == current ? Color.white.opacity(0.3) : accent)
                .disabled(picked == current)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            VStack(spacing: 8) {
                ForEach(voices, id: \.self) { voice in
                    let isSelected = picked == voice
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        picked = voice
                    } label: {
                        HStack {
                            Text(voice)
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(isSelected ? accent : Color.white.opacity(0.85))
                            Spacer()
                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(accent)
                            }
                        }
                        .padding(.horizontal, 16)
                        .frame(height: 52)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(isSelected ? accent.opacity(0.10) : Color.white.opacity(0.06))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(
                                            isSelected ? accent.opacity(0.4) : Color.white.opacity(0.08),
                                            lineWidth: 0.5
                                        )
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)

            Spacer()
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

/// Sources sheet — list with add/remove. Apply triggers regenerate.
private struct OutputSourcesSheet: View {
    @Binding var sources: [OutputSourceItem]
    var onApply: ([OutputSourceItem]) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var working: [OutputSourceItem]
    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    init(sources: Binding<[OutputSourceItem]>, onApply: @escaping ([OutputSourceItem]) -> Void) {
        self._sources = sources
        self.onApply = onApply
        self._working = State(initialValue: sources.wrappedValue)
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Sources")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                    Text("Changes regenerate this output")
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.45))
                }
                Spacer()
                Button("Apply") {
                    onApply(working)
                    dismiss()
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(working == sources ? Color.white.opacity(0.3) : accent)
                .disabled(working == sources)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            ScrollView(showsIndicators: false) {
                VStack(spacing: 8) {
                    ForEach(working) { item in
                        HStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.5))
                                .frame(width: 28, height: 28)
                                .background(Color.white.opacity(0.06))
                                .clipShape(Circle())

                            Text(item.label)
                                .font(.system(size: 15))
                                .foregroundColor(Color.white.opacity(0.85))
                                .lineLimit(1)

                            Spacer()

                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                working.removeAll { $0.id == item.id }
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .font(.system(size: 18))
                                    .foregroundColor(Color.white.opacity(0.3))
                                    .frame(width: 32, height: 32)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.05))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        working.append(OutputSourceItem(icon: "plus", label: "New source"))
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "plus")
                            Text("Add source")
                        }
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.6))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .fill(Color.white.opacity(0.04))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(
                                            Color.white.opacity(0.15),
                                            style: StrokeStyle(lineWidth: 0.8, dash: [4, 3])
                                        )
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

// MARK: - Output View

struct OutputView: View {
    @State var output: OutputDocument
    @State var voice: String
    @State var sources: [OutputSourceItem]
    var onBack: (() -> Void)? = nil

    @State private var showFormatSheet = false
    @State private var showVoiceSheet = false
    @State private var showSourcesSheet = false
    @State private var isRegenerating = false

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        ZStack {
            // Background — matches Home/Bundle palette
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.55, green: 0.30, blue: 0.08).opacity(0.30), .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0, endRadius: 380
            ).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.05, green: 0.35, blue: 0.15).opacity(0.22), .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0, endRadius: 320
            ).ignoresSafeArea()

            VStack(spacing: 0) {
                topBar
                pillRow
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .padding(.bottom, 10)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        body(for: output.format)
                            .padding(.horizontal, 16)
                            .padding(.top, 4)
                            .padding(.bottom, 80)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomActionBar(
                format: output.format,
                onRegenerate: { regenerate() },
                onCopy: { UIPasteboard.general.string = output.body },
                onShare: { /* present share sheet */ },
                onContextual: { /* contextual action */ }
            )
        }
        .overlay {
            if isRegenerating {
                ZStack {
                    Color.black.opacity(0.35).ignoresSafeArea()
                    VStack(spacing: 12) {
                        ProgressView().tint(accent)
                        Text("Regenerating…")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.7))
                    }
                    .padding(20)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(.ultraThinMaterial)
                    )
                }
                .transition(.opacity)
            }
        }
        .sheet(isPresented: $showFormatSheet) {
            FormatSwitchSheet(current: $output.format) { newFormat in
                output.format = newFormat
                regenerate()
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .sheet(isPresented: $showVoiceSheet) {
            VoicePickerSheet(current: $voice) { newVoice in
                voice = newVoice
                regenerate()
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.hidden)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .sheet(isPresented: $showSourcesSheet) {
            OutputSourcesSheet(sources: $sources) { newSources in
                sources = newSources
                regenerate()
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 8) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onBack?()
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.7))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Spacer()

            Menu {
                Button {
                    // save as
                } label: {
                    Label("Save as…", systemImage: "square.and.arrow.down")
                }
                Divider()
                Button(role: .destructive) {
                    // delete
                } label: {
                    Label("Delete output", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.7))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    // MARK: Pill row

    private var pillRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                OutputPill(
                    icon: output.format.icon,
                    text: output.format.rawValue
                ) { showFormatSheet = true }

                OutputPill(
                    icon: "waveform",
                    text: voice
                ) { showVoiceSheet = true }

                OutputPill(
                    icon: "doc.on.doc",
                    text: "\(sources.count) source\(sources.count == 1 ? "" : "s")"
                ) { showSourcesSheet = true }
            }
        }
    }

    // MARK: Body switch

    @ViewBuilder
    private func body(for format: OutputFormat) -> some View {
        if format.isTwitterThread {
            TwitterThreadBody(text: $output.body)
        } else if format.isLongForm {
            LongFormBody(text: $output.body, format: format)
        } else {
            CompactBody(text: $output.body, format: format)
        }
    }

    // MARK: Regenerate

    private func regenerate() {
        withAnimation(.easeOut(duration: 0.15)) { isRegenerating = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation(.easeOut(duration: 0.2)) { isRegenerating = false }
        }
    }
}

// MARK: - Previews

private let sampleSources: [OutputSourceItem] = [
    OutputSourceItem(icon: "link",     label: "blog.example.com/launch-notes"),
    OutputSourceItem(icon: "mic",      label: "Voice 2:14"),
    OutputSourceItem(icon: "doc.text", label: "Q3-recap.pdf"),
]

#Preview("Newsletter") {
    OutputView(
        output: OutputDocument(
            format: .newsletter,
            body: """
Hi there,

This week was quieter than most, and we needed it to be. We shipped a small \
release on Tuesday — three changes that came directly from the conversations \
we've been having with you over the past month.

The first is the bundle screen. You asked for one place to see every output \
from a single generation, and to be able to add more outputs without starting \
over. It's live now.

The second is voice switching per output. If you generated a LinkedIn post in \
the wrong voice, you no longer have to regenerate the whole bundle.

The third is fully editable outputs. Tap any output, edit inline, ship it.

That's it for this week. Hit reply if anything feels off.

— The team
"""
        ),
        voice: "Default",
        sources: sampleSources
    )
    .preferredColorScheme(.dark)
}

#Preview("LinkedIn") {
    OutputView(
        output: OutputDocument(
            format: .linkedinPost,
            body: """
We just shipped something we've been quietly building for six months.

The new release reshapes how teams turn long-form content into ready-to-publish \
posts in minutes, not hours. Three things changed under the hood:

→ One bundle, many outputs. No more re-uploading sources for every format.
→ Per-output voice control. Tone-shift any single piece without touching the rest.
→ Inline editing. The output is the draft.

If you've been juggling five tabs to repurpose a single transcript, this is for you.
"""
        ),
        voice: "Personal",
        sources: sampleSources
    )
    .preferredColorScheme(.dark)
}

#Preview("Twitter thread") {
    OutputView(
        output: OutputDocument(
            format: .twitterThread,
            body: """
1/ A short thread on what we learned shipping our Q3 release. The shortest path \
between an idea and a publishable post is rarely a straight line — and that's \
the problem we set out to fix.

2/ The first lesson: every team has a different definition of "done." Some \
ship after one pass. Others run three rounds of voice review. The tool has \
to bend, not the team.

3/ The second: regeneration is most useful at the smallest unit. Not the bundle. \
Not the document. The single sentence, the single tweet, the single subject line.

4/ The third: editing is the feature. Not the AI output. People want to land in \
something that's 80% there and finish it themselves. We rebuilt around that.

5/ If any of this sounds like a problem you have, we'd love to hear from you. \
Replies open. ↓
"""
        ),
        voice: "Default",
        sources: sampleSources
    )
    .preferredColorScheme(.dark)
}
