import SwiftUI

// MARK: - Quick Pick

struct QuickPick: Identifiable {
    let id = UUID()
    var name: String
    var description: String
    var formats: [OutputFormat]
}

extension QuickPick {
    static let featured: [QuickPick] = [
        QuickPick(
            name: "Newsletter",
            description: "Digest with key takeaways from your source",
            formats: [.newsletter]
        ),
        QuickPick(
            name: "Social Pack",
            description: "LinkedIn post + Twitter thread from one source",
            formats: [.linkedinPost, .twitterThread]
        ),
        QuickPick(
            name: "Blog Post",
            description: "Long-form SEO-friendly article",
            formats: [.blogPost]
        ),
        QuickPick(
            name: "Video Script",
            description: "Hook, body & CTA for YouTube or Reels",
            formats: [.youtubeScript, .video]
        ),
        QuickPick(
            name: "Email",
            description: "Concise campaign or outreach email",
            formats: [.email]
        ),
    ]

    static let extra: [QuickPick] = [
        QuickPick(
            name: "Quote Card",
            description: "Pull quote with branded backdrop",
            formats: [.quoteCard]
        ),
        QuickPick(
            name: "Press Release",
            description: "Standard PR format with quote and boilerplate",
            formats: [.pressRelease]
        ),
        QuickPick(
            name: "Podcast repurpose",
            description: "Thread, quote card, and newsletter recap",
            formats: [.twitterThread, .quoteCard, .newsletter]
        ),
        QuickPick(
            name: "All-hands recap",
            description: "Slack update, summary, and team email",
            formats: [.slackMessage, .summary, .email]
        ),
    ]
}

// MARK: - Mini Format Pill (inside Quick Pick rows)

private struct MiniFormatPill: View {
    let format: OutputFormat
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: format.icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color.white.opacity(0.5))
            Text(format.rawValue)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(Color.white.opacity(0.75))
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 4)
        .background(Color.white.opacity(0.08))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.10), lineWidth: 0.5))
    }
}

// MARK: - Quick Pick Row (tap whole block to select)

private struct QuickPickRow: View {
    let pick: QuickPick
    let isSelected: Bool
    var action: () -> Void

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                Text(pick.name)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(isSelected ? accent : Color.white.opacity(0.92))

                if !pick.formats.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(pick.formats, id: \.self) { format in
                            MiniFormatPill(format: format)
                        }
                    }
                }

                Text(pick.description)
                    .font(.system(size: 14))
                    .foregroundColor(Color.white.opacity(0.55))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? accent.opacity(0.10) : Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                isSelected ? accent.opacity(0.55) : Color.white.opacity(0.08),
                                lineWidth: isSelected ? 1 : 0.5
                            )
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - Format Tile (All Formats grid; tap whole block)

private struct FormatTile: View {
    let format: OutputFormat
    let isSelected: Bool
    var action: () -> Void

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            VStack(spacing: 10) {
                Image(systemName: format.icon)
                    .font(.system(size: 22, weight: .regular))
                Text(format.rawValue)
                    .font(.system(size: 14, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .foregroundColor(isSelected ? accent : Color.white.opacity(0.85))
            .frame(maxWidth: .infinity)
            .frame(height: 92)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? accent.opacity(0.12) : Color.white.opacity(0.05))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(
                                isSelected ? accent.opacity(0.55) : Color.white.opacity(0.08),
                                lineWidth: isSelected ? 1 : 0.5
                            )
                    )
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - Format Sheet

struct FormatSheet: View {
    @Binding var selected: Set<OutputFormat>
    var quickPicks: [QuickPick] = QuickPick.featured
    var extraPicks: [QuickPick] = QuickPick.extra
    var onDone: ((Set<OutputFormat>) -> Void)? = nil

    @Environment(\.dismiss) private var dismiss

    @State private var query: String = ""
    @State private var showAllTemplates: Bool = false

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)
    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    private var visibleQuickPicks: [QuickPick] {
        let pool = showAllTemplates ? (quickPicks + extraPicks) : quickPicks
        guard !query.isEmpty else { return pool }
        let q = query.lowercased()
        return pool.filter {
            $0.name.lowercased().contains(q) ||
            $0.description.lowercased().contains(q) ||
            $0.formats.contains { $0.rawValue.lowercased().contains(q) }
        }
    }

    private var visibleFormats: [OutputFormat] {
        guard !query.isEmpty else { return OutputFormat.allCases }
        let q = query.lowercased()
        return OutputFormat.allCases.filter { $0.rawValue.lowercased().contains(q) }
    }

    private func isPickFullySelected(_ pick: QuickPick) -> Bool {
        !pick.formats.isEmpty && pick.formats.allSatisfy { selected.contains($0) }
    }

    private func toggle(_ pick: QuickPick) {
        if isPickFullySelected(pick) {
            for f in pick.formats { selected.remove(f) }
        } else {
            for f in pick.formats { selected.insert(f) }
        }
    }

    private func toggle(_ format: OutputFormat) {
        if selected.contains(format) { selected.remove(format) }
        else { selected.insert(format) }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

            VStack(spacing: 0) {
                header

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        searchField

                        if !visibleQuickPicks.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                sectionHeader("Quick picks")
                                VStack(spacing: 8) {
                                    ForEach(visibleQuickPicks) { pick in
                                        QuickPickRow(
                                            pick: pick,
                                            isSelected: isPickFullySelected(pick)
                                        ) { toggle(pick) }
                                    }
                                }

                                if query.isEmpty && !extraPicks.isEmpty {
                                    Button {
                                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                        withAnimation(.easeOut(duration: 0.18)) {
                                            showAllTemplates.toggle()
                                        }
                                    } label: {
                                        HStack {
                                            Text(showAllTemplates ? "Show fewer" : "See all templates")
                                                .font(.system(size: 15, weight: .medium))
                                            Spacer()
                                            Image(systemName: showAllTemplates ? "chevron.up" : "chevron.down")
                                                .font(.system(size: 13, weight: .semibold))
                                        }
                                        .foregroundColor(Color.white.opacity(0.6))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 12)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .fill(Color.white.opacity(0.04))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                        .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
                                                )
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }

                        if !visibleFormats.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                sectionHeader("All formats")
                                LazyVGrid(columns: columns, spacing: 10) {
                                    ForEach(visibleFormats) { format in
                                        FormatTile(
                                            format: format,
                                            isSelected: selected.contains(format)
                                        ) { toggle(format) }
                                    }
                                }
                            }
                        }

                        if visibleQuickPicks.isEmpty && visibleFormats.isEmpty {
                            VStack(spacing: 8) {
                                Image(systemName: "magnifyingglass")
                                    .font(.system(size: 22))
                                    .foregroundColor(Color.white.opacity(0.3))
                                Text("No matches for \"\(query)\"")
                                    .font(.system(size: 15))
                                    .foregroundColor(Color.white.opacity(0.5))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 60)
                        }

                        // Bottom spacer so the sticky Done button never overlaps content
                        Color.clear.frame(height: 88)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                }
            }

            doneBar
        }
        .onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        }
    }

    // MARK: Header

    private var header: some View {
        ZStack {
            Text("Format")
                .font(.system(size: 22, weight: .semibold))
                .foregroundColor(.white)

            HStack {
                Spacer()
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.7))
                        .frame(width: 32, height: 32)
                        .background(Color.white.opacity(0.08))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
        }
        .padding(.top, 18)
        .padding(.bottom, 12)
    }

    // MARK: Section header

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .tracking(1.0)
            .foregroundColor(Color.white.opacity(0.42))
            .padding(.horizontal, 4)
    }

    // MARK: Search

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .medium))
                .foregroundColor(Color.white.opacity(0.4))
            TextField("", text: $query, prompt: Text("Search formats and templates")
                .foregroundColor(Color.white.opacity(0.3))
            )
            .font(.system(size: 16))
            .foregroundColor(.white)
            .autocapitalization(.none)
            .submitLabel(.search)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(Color.white.opacity(0.3))
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
        )
    }

    // MARK: Done bar

    private var doneBar: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onDone?(selected)
                dismiss()
            } label: {
                HStack(spacing: 8) {
                    Text(doneTitle)
                        .font(.system(size: 17, weight: .semibold))
                }
                .foregroundColor(selected.isEmpty ? Color.white.opacity(0.4) : .white)
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(selected.isEmpty ? Color.white.opacity(0.06) : accent.opacity(0.85))
                )
            }
            .buttonStyle(.plain)
            .disabled(selected.isEmpty)
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 6)
        }
        .background(
            Color(red: 0.10, green: 0.08, blue: 0.07)
                .opacity(0.96)
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var doneTitle: String {
        switch selected.count {
        case 0:  return "Select a format"
        case 1:  return "Done · 1 format"
        default: return "Done · \(selected.count) formats"
        }
    }
}

// MARK: - Previews

#Preview("Empty") {
    StatePreviewWrapper(initialSelection: []) { selection in
        FormatSheet(selected: selection)
    }
    .preferredColorScheme(.dark)
}

#Preview("With selection") {
    StatePreviewWrapper(
        initialSelection: [.linkedinPost, .twitterThread, .blogPost]
    ) { selection in
        FormatSheet(selected: selection)
    }
    .preferredColorScheme(.dark)
}

private struct StatePreviewWrapper<Content: View>: View {
    @State var selection: Set<OutputFormat>
    let content: (Binding<Set<OutputFormat>>) -> Content

    init(
        initialSelection: Set<OutputFormat>,
        @ViewBuilder content: @escaping (Binding<Set<OutputFormat>>) -> Content
    ) {
        self._selection = State(initialValue: initialSelection)
        self.content = content
    }

    var body: some View {
        content($selection)
    }
}
