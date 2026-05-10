import SwiftUI

// MARK: - Output Format

enum OutputFormat: String, Identifiable, CaseIterable {
    case newsletter      = "Newsletter"
    case linkedinPost    = "LinkedIn Post"
    case twitterThread   = "Twitter Thread"
    case twitterSingle   = "Twitter Single"
    case slackMessage    = "Slack Message"
    case quoteCard       = "Quote Card"
    case infographic     = "Infographic"
    case video           = "Video"
    case blogPost        = "Blog Post"
    case email           = "Email"
    case instagramCaption = "Instagram Caption"
    case youtubeScript   = "YouTube Script"
    case pressRelease    = "Press Release"
    case summary         = "Summary"
    case podcastScript   = "Podcast Script"
    case landingPage     = "Landing Page"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .newsletter:       return "envelope"
        case .linkedinPost:     return "briefcase"
        case .twitterThread:    return "text.bubble"
        case .twitterSingle:    return "bubble.left"
        case .slackMessage:     return "number"
        case .quoteCard:        return "quote.bubble"
        case .infographic:      return "chart.bar.doc.horizontal"
        case .video:            return "video"
        case .blogPost:         return "doc.richtext"
        case .email:            return "tray"
        case .instagramCaption: return "camera"
        case .youtubeScript:    return "play.rectangle"
        case .pressRelease:     return "megaphone"
        case .summary:          return "list.bullet.rectangle"
        case .podcastScript:    return "waveform"
        case .landingPage:      return "rectangle.on.rectangle"
        }
    }
}

// MARK: - Output Model

struct BundleOutput: Identifiable {
    let id = UUID()
    let format: OutputFormat
    var preview: String
    var isGenerating: Bool
}

struct ContentBundle: Identifiable {
    let id = UUID()
    var name: String
    var sourceCount: Int
    var voice: String
    var createdAt: Date
    var outputs: [BundleOutput]
}

// MARK: - Glass Card (local)

private struct BundleGlassCard<Content: View>: View {
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

// MARK: - Shimmer

private struct Shimmer: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geo in
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.0),
                            Color.white.opacity(0.06),
                            Color.white.opacity(0.0),
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geo.size.width * 1.4)
                    .offset(x: phase * geo.size.width)
                    .blendMode(.plusLighter)
                }
                .mask(content)
            )
            .onAppear {
                withAnimation(.linear(duration: 1.6).repeatForever(autoreverses: false)) {
                    phase = 1.4
                }
            }
    }
}

private extension View {
    func shimmer() -> some View { modifier(Shimmer()) }
}

// MARK: - Skeleton Bar

private struct SkeletonBar: View {
    var width: CGFloat? = nil
    var height: CGFloat = 10

    var body: some View {
        RoundedRectangle(cornerRadius: 4, style: .continuous)
            .fill(Color.white.opacity(0.08))
            .frame(width: width, height: height)
            .frame(maxWidth: width == nil ? .infinity : nil, alignment: .leading)
    }
}

// MARK: - Output Card

private struct OutputCard: View {
    let output: BundleOutput
    var onOpen: () -> Void
    var onCopy: () -> Void
    var onRegenerate: () -> Void

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        BundleGlassCard {
            VStack(alignment: .leading, spacing: 0) {
                // Header: format icon + name
                HStack(spacing: 10) {
                    ZStack {
                        Circle()
                            .fill(Color.white.opacity(0.08))
                            .frame(width: 30, height: 30)
                        Image(systemName: output.format.icon)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.7))
                    }
                    Text(output.format.rawValue)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.85))
                    Spacer()
                    if output.isGenerating {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(accent.opacity(0.9))
                                .frame(width: 6, height: 6)
                            Text("Generating")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundColor(accent.opacity(0.85))
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 12)

                // Body: preview or skeleton
                Group {
                    if output.isGenerating {
                        VStack(alignment: .leading, spacing: 8) {
                            SkeletonBar()
                            SkeletonBar()
                            SkeletonBar(width: 180)
                        }
                        .shimmer()
                    } else {
                        Text(output.preview)
                            .font(.system(size: 14))
                            .foregroundColor(Color.white.opacity(0.65))
                            .lineLimit(3)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, 16)
                .frame(height: 60, alignment: .top)

                // Action row
                HStack(spacing: 0) {
                    OutputActionButton(icon: "arrow.up.right.square", label: "Open", action: onOpen)
                    Divider()
                        .frame(width: 0.5, height: 18)
                        .overlay(Color.white.opacity(0.08))
                    OutputActionButton(icon: "doc.on.doc", label: "Copy", action: onCopy)
                    Divider()
                        .frame(width: 0.5, height: 18)
                        .overlay(Color.white.opacity(0.08))
                    OutputActionButton(icon: "arrow.clockwise", label: "Regenerate", action: onRegenerate)
                }
                .padding(.top, 14)
                .background(
                    Color.white.opacity(0.025)
                        .overlay(alignment: .top) {
                            Rectangle()
                                .fill(Color.white.opacity(0.06))
                                .frame(height: 0.5)
                        }
                )
                .opacity(output.isGenerating ? 0.4 : 1)
                .allowsHitTesting(!output.isGenerating)
            }
        }
        .frame(height: 168)
    }
}

private struct OutputActionButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                Text(label)
                    .font(.system(size: 13, weight: .medium))
            }
            .foregroundColor(Color.white.opacity(0.6))
            .frame(maxWidth: .infinity)
            .frame(height: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Add Output Button

private struct AddOutputButton: View {
    var action: () -> Void

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                Text("Add output")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundColor(Color.white.opacity(0.7))
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .strokeBorder(
                                Color.white.opacity(0.18),
                                style: StrokeStyle(lineWidth: 0.8, dash: [4, 3])
                            )
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Metadata Chip

private struct MetadataChip: View {
    let icon: String
    let text: String
    var tappable: Bool = false
    var action: (() -> Void)? = nil

    var body: some View {
        Button {
            if tappable {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                action?()
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.45))
                Text(text)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.6))
                if tappable {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.3))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Color.white.opacity(0.06))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.08), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .allowsHitTesting(tappable)
    }
}

// MARK: - Format Popover (Add Output)

private struct FormatPopover: View {
    @Binding var selectedFormats: Set<OutputFormat>
    var sourceCount: Int
    var voice: String
    var onDone: ([OutputFormat]) -> Void
    @Environment(\.dismiss) private var dismiss

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Add outputs")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                    Text("Using \(sourceCount) source\(sourceCount == 1 ? "" : "s") • \(voice)")
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.45))
                }
                Spacer()
                Button("Done") {
                    let picked = Array(selectedFormats)
                    onDone(picked)
                    dismiss()
                }
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(selectedFormats.isEmpty ? Color.white.opacity(0.3) : accent)
                .disabled(selectedFormats.isEmpty)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            ScrollView(showsIndicators: false) {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(OutputFormat.allCases) { format in
                        let isSelected = selectedFormats.contains(format)
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            if isSelected {
                                selectedFormats.remove(format)
                            } else {
                                selectedFormats.insert(format)
                            }
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

// MARK: - Bundle View

struct BundleView: View {
    @State var bundle: ContentBundle
    var onBack: (() -> Void)? = nil

    @State private var isEditingTitle = false
    @State private var draftTitle = ""
    @State private var showAddOutputs = false
    @State private var pendingFormats: Set<OutputFormat> = []
    @FocusState private var titleFocused: Bool

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    private var dateLabel: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: bundle.createdAt)
    }

    var body: some View {
        ZStack {
            // Background — matches HomeView palette
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
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 12) {
                        metadataRow
                            .padding(.horizontal, 16)
                            .padding(.top, 4)
                            .padding(.bottom, 8)

                        ForEach($bundle.outputs) { $output in
                            OutputCard(
                                output: output,
                                onOpen: { /* open detail */ },
                                onCopy: { UIPasteboard.general.string = output.preview },
                                onRegenerate: {
                                    output.isGenerating = true
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                                        output.isGenerating = false
                                    }
                                }
                            )
                            .padding(.horizontal, 16)
                        }

                        AddOutputButton {
                            pendingFormats = []
                            showAddOutputs = true
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 4)
                        .padding(.bottom, 40)
                    }
                    .padding(.top, 8)
                }
            }
        }
        .sheet(isPresented: $showAddOutputs) {
            FormatPopover(
                selectedFormats: $pendingFormats,
                sourceCount: bundle.sourceCount,
                voice: bundle.voice
            ) { formats in
                for format in formats {
                    let placeholder = BundleOutput(
                        format: format,
                        preview: "",
                        isGenerating: true
                    )
                    bundle.outputs.append(placeholder)
                    let id = placeholder.id
                    DispatchQueue.main.asyncAfter(deadline: .now() + Double.random(in: 1.4...3.0)) {
                        if let idx = bundle.outputs.firstIndex(where: { $0.id == id }) {
                            bundle.outputs[idx].preview = "Generated \(format.rawValue.lowercased()) preview content based on your sources."
                            bundle.outputs[idx].isGenerating = false
                        }
                    }
                }
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

            if isEditingTitle {
                TextField("", text: $draftTitle)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                    .focused($titleFocused)
                    .submitLabel(.done)
                    .onSubmit { commitTitle() }
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                            titleFocused = true
                        }
                    }
            } else {
                Text(bundle.name)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .onTapGesture {
                        draftTitle = bundle.name
                        withAnimation(.easeOut(duration: 0.15)) { isEditingTitle = true }
                    }
            }

            Spacer()

            if isEditingTitle {
                Button("Done") { commitTitle() }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(accent)
                    .padding(.horizontal, 8)
            } else {
                Menu {
                    Button {
                        draftTitle = bundle.name
                        isEditingTitle = true
                    } label: {
                        Label("Rename", systemImage: "pencil")
                    }
                    Button {
                        // share
                    } label: {
                        Label("Share bundle", systemImage: "square.and.arrow.up")
                    }
                    Divider()
                    Button(role: .destructive) {
                        // delete
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.7))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    private func commitTitle() {
        let trimmed = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            bundle.name = trimmed
        }
        withAnimation(.easeOut(duration: 0.15)) { isEditingTitle = false }
        titleFocused = false
    }

    // MARK: Metadata row

    private var metadataRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                MetadataChip(
                    icon: "doc.on.doc",
                    text: "\(bundle.sourceCount) source\(bundle.sourceCount == 1 ? "" : "s")",
                    tappable: true
                ) {
                    // open sources sheet
                }
                MetadataChip(
                    icon: "waveform",
                    text: bundle.voice,
                    tappable: true
                ) {
                    // open voice sheet
                }
                MetadataChip(icon: "calendar", text: dateLabel)
            }
        }
    }
}

// MARK: - Previews

#Preview("Completed bundle") {
    BundleView(bundle: ContentBundle(
        name: "Q3 launch announcement",
        sourceCount: 3,
        voice: "Default",
        createdAt: Date(),
        outputs: [
            BundleOutput(
                format: .linkedinPost,
                preview: "We just shipped something we've been quietly building for six months. The new release reshapes how teams turn long-form content into ready-to-publish posts in minutes, not hours.",
                isGenerating: false
            ),
            BundleOutput(
                format: .twitterThread,
                preview: "1/ A small thread on what we learned shipping our Q3 release. The shortest path between an idea and a publishable post is rarely a straight line — and that's the problem we set out to fix.",
                isGenerating: false
            ),
            BundleOutput(
                format: .newsletter,
                preview: "Hi there — this week's edition is short. We shipped the Q3 launch, and instead of telling you what's in it, we'd rather show you the three things that actually changed how we work.",
                isGenerating: false
            ),
        ]
    ))
    .preferredColorScheme(.dark)
}

#Preview("Generating") {
    BundleView(bundle: ContentBundle(
        name: "New bundle",
        sourceCount: 2,
        voice: "Default",
        createdAt: Date(),
        outputs: [
            BundleOutput(format: .linkedinPost, preview: "", isGenerating: true),
            BundleOutput(format: .twitterThread, preview: "", isGenerating: true),
            BundleOutput(
                format: .summary,
                preview: "A concise summary of the source material covering the three main themes and the supporting evidence drawn from each transcript.",
                isGenerating: false
            ),
            BundleOutput(format: .blogPost, preview: "", isGenerating: true),
        ]
    ))
    .preferredColorScheme(.dark)
}
