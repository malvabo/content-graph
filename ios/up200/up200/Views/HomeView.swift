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

// MARK: - Animated Lights Button

struct AnimatedLightsButton: View {
    let title: String
    var icon: String? = nil
    var action: () -> Void
    @State private var phase = false

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(red: 0.06, green: 0.07, blue: 0.10))

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

                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(0.13), lineWidth: 0.5)

                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 17, weight: .semibold))
                    }
                    Text(title)
                        .font(.system(size: 18, weight: .semibold))
                }
                .foregroundColor(.white)
            }
            .frame(height: 54)
            .clipped()
        }
        .buttonStyle(.plain)
        .onAppear {
            withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) {
                phase = true
            }
        }
    }
}

// MARK: - Import Sheet

private struct ImportSheetView: View {
    var onSelect: (SourceType) -> Void
    @Environment(\.dismiss) private var dismiss

    private let gridItems: [(icon: String, label: String, type: SourceType)] = [
        ("arrow.up.doc",  "Upload a file", .file),
        ("pencil",        "Write text",    .text),
        ("waveform",      "Voice note",    .voice),
        ("photo",         "Image",         .image),
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

            Spacer(minLength: 16)
        }
        .padding(.horizontal, 16)
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

// MARK: - Source Chip

private struct SourceChip: View {
    let item: SourceItem
    var onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: item.icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(Color.white.opacity(0.6))
            Text(item.label)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color.white.opacity(0.75))
                .lineLimit(1)
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color.white.opacity(0.4))
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(item.label)")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.09))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(Color.white.opacity(0.1), lineWidth: 0.5))
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

// MARK: - Section Header

private struct SectionHeader: View {
    let title: String
    @Binding var expanded: Bool

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.22)) { expanded.toggle() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: expanded ? "chevron.down" : "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.35))
                Text(title)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.85))
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Link Input Row

private struct LinkInputRow: View {
    @Binding var link: String
    var onRemove: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "link")
                .font(.system(size: 15))
                .foregroundColor(Color.white.opacity(0.4))
            TextField("https://…", text: $link)
                .font(.system(size: 15))
                .foregroundColor(.white)
                .autocapitalization(.none)
                .keyboardType(.URL)
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 17))
                    .foregroundColor(Color.white.opacity(0.25))
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }
}

// MARK: - Voice Record Row

private struct VoiceRecordRow: View {
    var onFinish: (String) -> Void
    var onCancel: () -> Void

    @State private var isRecording = false
    @State private var seconds = 0
    @State private var lightPhase = false
    @State private var pulse = false

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var timeLabel: String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)
    private let idle  = Color.white

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(isRecording ? amber.opacity(0.85) : Color.white.opacity(0.18))
                .frame(width: 7, height: 7)
                .scaleEffect(isRecording ? (pulse ? 1.35 : 1.0) : 1.0)
                .animation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true), value: pulse)

            Text(isRecording ? timeLabel : "Tap to record")
                .font(.system(size: 16, design: isRecording ? .monospaced : .default))
                .foregroundColor(Color.white.opacity(isRecording ? 0.75 : 0.35))

            Spacer()

            Button {
                let hap = UIImpactFeedbackGenerator(style: .medium)
                hap.impactOccurred()
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
                ZStack {
                    Capsule()
                        .fill(Color(red: 0.10, green: 0.08, blue: 0.07))

                    Ellipse()
                        .fill(
                            (isRecording ? amber : idle)
                                .opacity(isRecording ? 0.45 : 0.18)
                        )
                        .frame(width: 72, height: 36)
                        .blur(radius: 16)
                        .offset(x: lightPhase ? 14 : -14)

                    Capsule()
                        .stroke(Color.white.opacity(0.09), lineWidth: 0.5)

                    Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.8))
                }
                .frame(width: 68, height: 36)
                .clipped()
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
        .padding(.vertical, 10)
        .onReceive(clock) { _ in if isRecording { seconds += 1 } }
        .onAppear {
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                lightPhase = true
            }
        }
    }
}

// MARK: - Source Card

private struct SourceCard: View {
    @Binding var text: String
    @Binding var sources: [SourceItem]
    @Binding var linkText: String
    @State private var expanded = true
    @State private var showImport = false
    @State private var showVoiceRecord = false
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var photoPickerItem: PhotosPickerItem? = nil
    @FocusState private var textFocused: Bool

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                SectionHeader(title: "Source", expanded: $expanded)

                if expanded {
                    VStack(spacing: 0) {
                        if !sources.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(sources) { item in
                                        SourceChip(item: item) {
                                            withAnimation(.spring(duration: 0.25)) {
                                                sources.removeAll { $0.id == item.id }
                                            }
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 10)
                            }
                        }

                        if sources.contains(where: { $0.type == .link }) {
                            LinkInputRow(link: $linkText) {
                                sources.removeAll { $0.type == .link }
                                linkText = ""
                            }
                        }

                        if sources.contains(where: { $0.type == .text }) {
                            ZStack(alignment: .topLeading) {
                                if text.isEmpty {
                                    Text("Paste your text, transcript or notes…")
                                        .font(.system(size: 16))
                                        .foregroundColor(Color.white.opacity(0.25))
                                        .padding(.horizontal, 16)
                                        .padding(.top, 14)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $text)
                                    .font(.system(size: 16))
                                    .foregroundColor(Color.white.opacity(0.85))
                                    .scrollContentBackground(.hidden)
                                    .background(.clear)
                                    .frame(minHeight: 100, maxHeight: 200)
                                    .padding(.horizontal, 12)
                                    .padding(.top, 8)
                                    .padding(.bottom, 10)
                                    .focused($textFocused)
                            }
                        }

                        if showVoiceRecord {
                            VoiceRecordRow {
                                label in
                                withAnimation(.spring(duration: 0.25)) {
                                    sources.append(SourceItem(type: .voice, label: label))
                                    showVoiceRecord = false
                                }
                            } onCancel: {
                                withAnimation { showVoiceRecord = false }
                            }
                        }

                        Button {
                            showImport = true
                        } label: {
                            Label("Add source", systemImage: "plus")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.40))
                                .frame(maxWidth: .infinity)
                                .frame(height: 44)
                                .background(Color.white.opacity(0.05))
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                                )
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, 16)
                        .padding(.top, sources.isEmpty && !showVoiceRecord ? 4 : 8)
                        .padding(.bottom, 12)
                    }
                    .transition(.opacity)
                }
            }
        }
        .sheet(isPresented: $showImport) {
            ImportSheetView { type in
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                switch type {
                case .text:
                    if !sources.contains(where: { $0.type == .text }) {
                        sources.append(SourceItem(type: .text, label: "Write text"))
                    }
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

// MARK: - Tag Pill

private struct TagPill: View {
    let tag: String
    let isSelected: Bool
    var onTap: () -> Void

    private let accent = Color.white

    var body: some View {
        Button(action: onTap) {
            Text(tag)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(isSelected ? accent : Color.white.opacity(0.55))
                .lineLimit(1)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(isSelected ? accent.opacity(0.12) : Color.white.opacity(0.07))
                        .overlay(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(isSelected ? accent.opacity(0.45) : Color.white.opacity(0.08), lineWidth: 0.5)
                        )
                )
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: isSelected)
    }
}

// MARK: - Tag Picker Sheet

private struct TagPickerSheet: View {
    let allTags: [String]
    @Binding var selectedTags: Set<String>
    @Environment(\.dismiss) private var dismiss

    private let accent = Color.white
    private let columns = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.18))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            HStack {
                Text("Content type")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
                Spacer()
                Button("Done") { dismiss() }
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(accent)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 12)

            ScrollView(showsIndicators: false) {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(allTags, id: \.self) { tag in
                        let isSelected = selectedTags.contains(tag)
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            if isSelected { selectedTags.remove(tag) } else { selectedTags.insert(tag) }
                        } label: {
                            Text(tag)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(isSelected ? accent : Color.white.opacity(0.65))
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .fill(isSelected ? accent.opacity(0.12) : Color.white.opacity(0.07))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                                .stroke(isSelected ? accent.opacity(0.45) : Color.white.opacity(0.08), lineWidth: 0.5)
                                        )
                                )
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
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

// MARK: - Generate Card

private struct GenerateCard: View {
    @Binding var prompt: String
    @Binding var selectedTags: Set<String>
    @State private var expanded = true
    @State private var showTagPicker = false

    private let allTags = [
        "Newsletter", "LinkedIn Post", "Twitter Thread", "Twitter Single",
        "Slack Message", "Quote Card", "Infographic", "Video",
        "Blog Post", "Email", "Instagram Caption", "YouTube Script",
        "Press Release", "Summary", "Podcast Script", "Landing Page",
    ]

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                SectionHeader(title: "Generate", expanded: $expanded)
                if expanded {
                    VStack(spacing: 0) {
                        ZStack(alignment: .topLeading) {
                            if prompt.isEmpty {
                                Text("Describe what you want to create…")
                                    .font(.system(size: 16))
                                    .foregroundColor(Color.white.opacity(0.25))
                                    .padding(.horizontal, 16)
                                    .padding(.top, 14)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $prompt)
                                .font(.system(size: 16))
                                .foregroundColor(Color.white.opacity(0.85))
                                .scrollContentBackground(.hidden)
                                .background(.clear)
                                .frame(minHeight: 80, maxHeight: 140)
                                .padding(.horizontal, 12)
                                .padding(.top, 8)
                                .padding(.bottom, 12)
                        }

                        // Tag row
                        HStack(spacing: 0) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(allTags, id: \.self) { tag in
                                        TagPill(tag: tag, isSelected: selectedTags.contains(tag)) {
                                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                            if selectedTags.contains(tag) { selectedTags.remove(tag) }
                                            else { selectedTags.insert(tag) }
                                        }
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                            }

                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                showTagPicker = true
                            } label: {
                                Image(systemName: "square.grid.2x2")
                                    .font(.system(size: 15, weight: .medium))
                                    .foregroundColor(
                                        selectedTags.isEmpty
                                            ? Color.white.opacity(0.4)
                                            : Color.white
                                    )
                                    .frame(width: 48, height: 44)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .transition(.opacity)
                }
            }
        }
        .sheet(isPresented: $showTagPicker) {
            TagPickerSheet(allTags: allTags, selectedTags: $selectedTags)
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.hidden)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
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
    var onNewWorkflow: ((String, String, [String], String) -> Void)?
    var scrollToTopSignal: Int = 0

    @State private var sourceText = ""
    @State private var sources: [SourceItem] = []
    @State private var linkText  = ""
    @State private var genPrompt = ""
    @State private var brand     = "Default"
    @State private var selectedTags: Set<String> = []

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
                            SourceCard(
                                text: $sourceText,
                                sources: $sources,
                                linkText: $linkText
                            )
                            GenerateCard(prompt: $genPrompt, selectedTags: $selectedTags)
                            BrandCard(selectedBrand: $brand)
                        }
                        .padding(.horizontal, 16)

                        AnimatedLightsButton(title: "Build Workflow", icon: "sparkles") {
                            let hap = UIImpactFeedbackGenerator(style: .medium)
                            hap.impactOccurred()
                            onNewWorkflow?(sourceText, genPrompt, Array(selectedTags), brand)
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 20)
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
