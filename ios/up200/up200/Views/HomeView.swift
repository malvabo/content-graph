import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// MARK: - Source Item Model

enum SourceType: String, Identifiable {
    case text, link, file, voice, image
    var id: String { rawValue }
}

struct SourceItem: Identifiable {
    let id = UUID()
    let type: SourceType
    var label: String

    var icon: String {
        switch type {
        case .text:  return "text.alignleft"
        case .link:  return "link"
        case .file:  return "doc.text"
        case .voice: return "mic"
        case .image: return "photo"
        }
    }
}

// MARK: - Format & Template Models

private struct ContentFormat: Identifiable {
    let id: String
    let label: String
}

private let allFormats: [ContentFormat] = [
    ContentFormat(id: "newsletter",     label: "Newsletter"),
    ContentFormat(id: "linkedin",       label: "LinkedIn Post"),
    ContentFormat(id: "twitter",        label: "Twitter Thread"),
    ContentFormat(id: "blog",           label: "Blog Post"),
    ContentFormat(id: "email",          label: "Email"),
    ContentFormat(id: "instagram",      label: "Instagram Caption"),
    ContentFormat(id: "youtube",        label: "YouTube Script"),
    ContentFormat(id: "podcast",        label: "Podcast Script"),
    ContentFormat(id: "press",          label: "Press Release"),
    ContentFormat(id: "landing",        label: "Landing Page"),
    ContentFormat(id: "twitter-single", label: "Twitter Single"),
    ContentFormat(id: "video",          label: "Video Script"),
]

private struct ContentTemplate: Identifiable {
    let id: String
    let name: String
    let description: String
    let formatIDs: [String]
}

private let allTemplates: [ContentTemplate] = [
    ContentTemplate(id: "newsletter",   name: "Newsletter",    description: "Digest with key takeaways from your source",     formatIDs: ["newsletter"]),
    ContentTemplate(id: "social-pack",  name: "Social Pack",   description: "LinkedIn post + Twitter thread from one source", formatIDs: ["linkedin", "twitter"]),
    ContentTemplate(id: "blog",         name: "Blog Post",     description: "Long-form SEO-friendly article",                 formatIDs: ["blog"]),
    ContentTemplate(id: "video-script", name: "Video Script",  description: "Hook, body & CTA for YouTube or Reels",          formatIDs: ["youtube", "video"]),
    ContentTemplate(id: "email",        name: "Email",         description: "Concise campaign or outreach email",             formatIDs: ["email"]),
    ContentTemplate(id: "podcast",      name: "Podcast",       description: "Episode outline and talking points",             formatIDs: ["podcast"]),
    ContentTemplate(id: "press",        name: "Press Release", description: "Formal media announcement",                     formatIDs: ["press"]),
    ContentTemplate(id: "landing",      name: "Landing Page",  description: "Headline, sections and CTA copy",               formatIDs: ["landing"]),
    ContentTemplate(id: "repurpose",    name: "Repurpose All", description: "Every major format from a single source",        formatIDs: ["newsletter", "linkedin", "twitter", "blog", "email"]),
]

// MARK: - Animated Lights Button

struct AnimatedLightsButton: View {
    let title: String
    var icon: String? = nil
    var isEnabled: Bool = true
    var action: () -> Void
    @State private var phase = false

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(red: 0.06, green: 0.07, blue: 0.10))

                if isEnabled {
                    Ellipse()
                        .fill(Color(red: 0.85, green: 0.45, blue: 0.10).opacity(0.60))
                        .frame(width: 220, height: 100)
                        .blur(radius: 44)
                        .offset(x: phase ? -80 : 80)
                    Ellipse()
                        .fill(Color(red: 0.75, green: 0.30, blue: 0.05).opacity(0.45))
                        .frame(width: 220, height: 100)
                        .blur(radius: 44)
                        .offset(x: phase ? 80 : -80)
                }

                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(isEnabled ? 0.13 : 0.06), lineWidth: 0.5)

                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 17, weight: .semibold))
                    }
                    Text(title)
                        .font(.system(size: 18, weight: .semibold))
                }
                .foregroundColor(isEnabled ? .white : Color.white.opacity(0.25))
            }
            .frame(height: 54)
            .clipped()
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onAppear {
            withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) {
                phase = true
            }
        }
    }
}

// MARK: - Import Sheet

struct ImportSheetView: View {
    var onSelect: (SourceType) -> Void
    @Environment(\.dismiss) private var dismiss

    private let gridItems: [(icon: String, label: String, type: SourceType)] = [
        ("arrow.up.doc", "Upload a file", .file),
        ("pencil",       "Write text",    .text),
        ("waveform",     "Voice note",    .voice),
        ("photo",        "Image",         .image),
    ]

    var body: some View {
        VStack(spacing: 16) {
            Capsule()
                .fill(Color.white.opacity(0.12))
                .frame(width: 32, height: 4)
                .padding(.top, 10)

            Text("Import content")
                .font(.system(size: 19, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.bottom, 2)

            Button {
                onSelect(.link)
                dismiss()
            } label: {
                VStack(spacing: 12) {
                    Image(systemName: "link")
                        .font(.system(size: 16, weight: .light))
                        .foregroundColor(Color.white.opacity(0.82))
                    Text("Paste a link")
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(Color.white.opacity(0.52))
                }
                .frame(maxWidth: .infinity)
                .frame(height: 88)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(gridItems, id: \.type) { item in
                    Button {
                        onSelect(item.type)
                        dismiss()
                    } label: {
                        VStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.system(size: 16, weight: .light))
                                .foregroundColor(Color.white.opacity(0.82))
                            Text(item.label)
                                .font(.system(size: 14, weight: .regular))
                                .foregroundColor(Color.white.opacity(0.52))
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 88)
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 32)
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

// MARK: - Glass Card

private struct GlassCard<Content: View>: View {
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

// MARK: - Voice Record Row

private struct VoiceRecordRow: View {
    var onFinish: (String) -> Void
    var onCancel: () -> Void

    @State private var isRecording = false
    @State private var seconds = 0
    @State private var pulse = false

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    private var timeLabel: String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(isRecording ? amber.opacity(0.85) : Color.white.opacity(0.18))
                .frame(width: 7, height: 7)
                .scaleEffect(isRecording ? (pulse ? 1.35 : 1.0) : 1.0)
                .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)

            Text(isRecording ? timeLabel : "Tap to record")
                .font(.system(size: 15, design: isRecording ? .monospaced : .default))
                .foregroundColor(Color.white.opacity(isRecording ? 0.75 : 0.35))

            Spacer()

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                if isRecording {
                    isRecording = false
                    pulse = false
                    onFinish("Voice \(timeLabel)")
                } else {
                    seconds = 0
                    isRecording = true
                    pulse = true
                }
            } label: {
                Image(systemName: isRecording ? "stop.circle" : "mic")
                    .font(.system(size: 22, weight: .light))
                    .foregroundColor(isRecording ? amber : Color.white.opacity(0.55))
            }
            .buttonStyle(.plain)

            Button(action: onCancel) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.3))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .onReceive(clock) { _ in if isRecording { seconds += 1 } }
    }
}

// MARK: - Sources Block

private struct SourcesBlock: View {
    @Binding var sources: [SourceItem]
    @Binding var linkText: String
    @Binding var sourceText: String
    @Binding var voiceTranscript: String

    @State private var showImport = false
    @State private var showVoiceRecord = false
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var photoPickerItem: PhotosPickerItem? = nil
    @FocusState private var textFocused: Bool
    @State private var showTextInput = false

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                ForEach(sources) { item in
                    VStack(spacing: 0) {
                        HStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.system(size: 15))
                                .foregroundColor(Color.white.opacity(0.45))
                                .frame(width: 20)
                            Text(item.label)
                                .font(.system(size: 15))
                                .foregroundColor(Color.white.opacity(0.80))
                                .lineLimit(1)
                            Spacer()
                            Button {
                                withAnimation(.spring(duration: 0.25)) {
                                    sources.removeAll { $0.id == item.id }
                                    if item.type == .link { linkText = "" }
                                }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.28))
                                    .frame(width: 32, height: 32)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)

                        if item.type == .link {
                            HStack(spacing: 8) {
                                Image(systemName: "link")
                                    .font(.system(size: 13))
                                    .foregroundColor(Color.white.opacity(0.30))
                                TextField("https://\u{2026}", text: $linkText)
                                    .font(.system(size: 14))
                                    .foregroundColor(Color.white.opacity(0.75))
                                    .autocapitalization(.none)
                                    .keyboardType(.URL)
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 10)
                        }

                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                    }
                }

                if showTextInput {
                    VStack(spacing: 0) {
                        ZStack(alignment: .topLeading) {
                            if sourceText.isEmpty {
                                Text("Paste your text, transcript or notes\u{2026}")
                                    .font(.system(size: 15))
                                    .foregroundColor(Color.white.opacity(0.25))
                                    .padding(.horizontal, 16)
                                    .padding(.top, 14)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $sourceText)
                                .font(.system(size: 15))
                                .foregroundColor(Color.white.opacity(0.85))
                                .scrollContentBackground(.hidden)
                                .background(.clear)
                                .frame(minHeight: 90, maxHeight: 180)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .focused($textFocused)
                        }
                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                    }
                }

                if showVoiceRecord {
                    VStack(spacing: 0) {
                        VoiceRecordRow { label in
                            withAnimation(.spring(duration: 0.25)) {
                                voiceTranscript = label
                                showVoiceRecord = false
                            }
                        } onCancel: {
                            withAnimation { showVoiceRecord = false }
                        }
                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                    }
                }

                if !voiceTranscript.isEmpty {
                    VStack(spacing: 0) {
                        TextEditor(text: $voiceTranscript)
                            .font(.system(size: 15))
                            .foregroundColor(Color.white.opacity(0.85))
                            .scrollContentBackground(.hidden)
                            .background(.clear)
                            .frame(minHeight: 80, maxHeight: 160)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                    }
                }

                Button { showImport = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 13, weight: .medium))
                        Text("Add source")
                            .font(.system(size: 15, weight: .medium))
                    }
                    .foregroundColor(Color.white.opacity(0.38))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.plain)
            }
        }
        .sheet(isPresented: $showImport) {
            ImportSheetView { type in
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                switch type {
                case .text:
                    showTextInput = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { textFocused = true }
                case .link:
                    if !sources.contains(where: { $0.type == .link }) {
                        sources.append(SourceItem(type: .link, label: "Link"))
                    }
                case .file:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { showFilePicker = true }
                case .voice:
                    showVoiceRecord = true
                case .image:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { showPhotoPicker = true }
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.text, .plainText, .pdf],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                sources.append(SourceItem(type: .file, label: url.lastPathComponent))
            }
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoPickerItem, matching: .images)
        .onChange(of: photoPickerItem) { _, item in
            guard item != nil else { return }
            sources.append(SourceItem(type: .image, label: "Image"))
            photoPickerItem = nil
        }
    }
}

// MARK: - Templates Sheet

private struct TemplatesSheet: View {
    @Binding var selectedFormatIDs: Set<String>
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""

    private var filtered: [ContentTemplate] {
        guard !search.isEmpty else { return allTemplates }
        let q = search.lowercased()
        return allTemplates.filter {
            $0.name.lowercased().contains(q) || $0.description.lowercased().contains(q)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.12))
                .frame(width: 36, height: 4)
                .padding(.top, 10)
                .padding(.bottom, 16)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("Search templates", text: $search)
                    .font(.system(size: 15))
                    .foregroundColor(.white)
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 15))
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.bottom, 4)

            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(filtered) { template in
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            selectedFormatIDs = Set(template.formatIDs)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(template.name)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(Color.white.opacity(0.88))

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 6) {
                                        ForEach(template.formatIDs, id: \.self) { fid in
                                            if let fmt = allFormats.first(where: { $0.id == fid }) {
                                                Text(fmt.label)
                                                    .font(.system(size: 11, weight: .medium))
                                                    .foregroundColor(Color.white.opacity(0.55))
                                                    .padding(.horizontal, 8)
                                                    .padding(.vertical, 3)
                                                    .background(Color.white.opacity(0.08))
                                                    .clipShape(Capsule())
                                            }
                                        }
                                    }
                                }

                                Text(template.description)
                                    .font(.system(size: 13))
                                    .foregroundColor(Color.white.opacity(0.38))
                                    .multilineTextAlignment(.leading)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(.plain)

                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                            .padding(.horizontal, 16)
                    }
                }
                .padding(.top, 4)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

// MARK: - Formats Block

private struct FormatsBlock: View {
    @Binding var selectedFormatIDs: Set<String>
    @State private var showTemplates = false

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                HStack {
                    Text("Format")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.85))
                    Spacer()
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showTemplates = true
                    } label: {
                        Text("Use templates")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.45))
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 10)

                Rectangle()
                    .fill(Color.white.opacity(0.07))
                    .frame(height: 0.5)

                ForEach(allFormats) { format in
                    let selected = selectedFormatIDs.contains(format.id)
                    VStack(spacing: 0) {
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            if selected {
                                selectedFormatIDs.remove(format.id)
                            } else {
                                selectedFormatIDs.insert(format.id)
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: selected ? "checkmark.square.fill" : "square")
                                    .font(.system(size: 17))
                                    .foregroundColor(selected ? .white : Color.white.opacity(0.22))
                                Text(format.label)
                                    .font(.system(size: 15))
                                    .foregroundColor(selected ? Color.white.opacity(0.88) : Color.white.opacity(0.52))
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 13)
                        }
                        .buttonStyle(.plain)
                        .animation(.easeOut(duration: 0.12), value: selected)

                        if format.id != allFormats.last?.id {
                            Rectangle()
                                .fill(Color.white.opacity(0.05))
                                .frame(height: 0.5)
                                .padding(.horizontal, 16)
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $showTemplates) {
            TemplatesSheet(selectedFormatIDs: $selectedFormatIDs)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.hidden)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
    }
}

// MARK: - Prompt Field

private struct PromptField: View {
    @Binding var prompt: String
    @FocusState private var focused: Bool

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 0) {
                Text("Add details (optional)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.40))
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .padding(.bottom, 6)

                ZStack(alignment: .topLeading) {
                    if prompt.isEmpty {
                        Text("Leave empty to generate from sources and format.")
                            .font(.system(size: 15))
                            .foregroundColor(Color.white.opacity(0.20))
                            .padding(.horizontal, 16)
                            .padding(.top, 2)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $prompt)
                        .font(.system(size: 15))
                        .foregroundColor(Color.white.opacity(0.85))
                        .scrollContentBackground(.hidden)
                        .background(.clear)
                        .frame(minHeight: 70, maxHeight: 130)
                        .padding(.horizontal, 12)
                        .padding(.bottom, 10)
                        .focused($focused)
                }
            }
        }
    }
}

// MARK: - Brand Card

private struct BrandCard: View {
    @Binding var selectedBrand: String
    let brands = ["Default", "Personal", "Company", "Startup", "Agency"]

    var body: some View {
        GlassCard {
            HStack(spacing: 12) {
                Text("Brand Voice")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.85))

                Spacer()

                Menu {
                    ForEach(brands, id: \.self) { brand in
                        Button {
                            selectedBrand = brand
                        } label: {
                            if selectedBrand == brand {
                                Label(brand, systemImage: "checkmark")
                            } else {
                                Text(brand)
                            }
                        }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Text(selectedBrand)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.70))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.35))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color.white.opacity(0.09))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(Color.white.opacity(0.10), lineWidth: 0.5))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
    }
}

// MARK: - Home View

struct HomeView: View {
    var scrollToTopSignal: Int = 0

    @State private var sources: [SourceItem] = []
    @State private var sourceText = ""
    @State private var linkText = ""
    @State private var voiceTranscript = ""
    @State private var selectedFormatIDs: Set<String> = []
    @State private var prompt = ""
    @State private var brand = "Default"

    private var hasSources: Bool {
        !sources.isEmpty || !sourceText.isEmpty || !voiceTranscript.isEmpty
    }

    private var canGenerate: Bool {
        hasSources && !selectedFormatIDs.isEmpty
    }

    private var generateLabel: String {
        selectedFormatIDs.isEmpty ? "Generate" : "Generate \(selectedFormatIDs.count)"
    }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.55, green: 0.30, blue: 0.08).opacity(0.35), .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0, endRadius: 380
            ).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.30, green: 0.20, blue: 0.08).opacity(0.22), .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0, endRadius: 320
            ).ignoresSafeArea()

            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        HStack {
                            Text("Create")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .id("top")
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 16)

                        VStack(spacing: 12) {
                            SourcesBlock(
                                sources: $sources,
                                linkText: $linkText,
                                sourceText: $sourceText,
                                voiceTranscript: $voiceTranscript
                            )
                            FormatsBlock(selectedFormatIDs: $selectedFormatIDs)
                            PromptField(prompt: $prompt)
                            BrandCard(selectedBrand: $brand)
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)

                        AnimatedLightsButton(
                            title: generateLabel,
                            icon: "sparkles",
                            isEnabled: canGenerate
                        ) {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 40)
                    }
                }
                .scrollDismissesKeyboard(.immediately)
                .onChange(of: scrollToTopSignal) { _ in
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("top", anchor: .top)
                    }
                }
            }
        }
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
