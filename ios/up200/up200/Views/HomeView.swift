import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

// MARK: - Color Helper

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

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

// MARK: - Import Sheet

private struct ImportSheetView: View {
    var onSelect: (SourceType) -> Void
    @Environment(\.dismiss) private var dismiss

    private let gridItems: [(icon: String, label: String, type: SourceType)] = [
        ("square.and.arrow.up",  "Upload a file",  .file),
        ("character.cursor.ibeam", "Write text",   .text),
        ("mic",                  "Voice note",     .voice),
        ("photo",                "Image",          .image),
    ]

    var body: some View {
        VStack(spacing: 14) {
            Capsule()
                .fill(Color.white.opacity(0.2))
                .frame(width: 36, height: 4)
                .padding(.top, 10)

            Text("Import content")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.white)

            Button {
                onSelect(.link)
                dismiss()
            } label: {
                VStack(spacing: 10) {
                    Image(systemName: "globe")
                        .font(.system(size: 26, weight: .medium))
                    Text("Paste a link")
                        .font(.system(size: 15, weight: .medium))
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .frame(height: 100)
                .background(Color.white.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(gridItems, id: \.type) { item in
                    Button {
                        onSelect(item.type)
                        dismiss()
                    } label: {
                        VStack(spacing: 10) {
                            Image(systemName: item.icon)
                                .font(.system(size: 26, weight: .medium))
                            Text(item.label)
                                .font(.system(size: 15, weight: .medium))
                                .multilineTextAlignment(.center)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 100)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }

            Spacer(minLength: 20)
        }
        .padding(.horizontal, 16)
        .background(Color(red: 0.13, green: 0.11, blue: 0.10).ignoresSafeArea())
    }
}

// MARK: - Source Chip

private struct SourceChip: View {
    let item: SourceItem
    var onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: item.icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color.white.opacity(0.6))
            Text(item.label)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(Color.white.opacity(0.75))
                .lineLimit(1)
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color.white.opacity(0.4))
            }
            .buttonStyle(.plain)
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
            withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: expanded ? "chevron.down" : "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.35))
                Text(title)
                    .font(.system(size: 16, weight: .medium))
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
                .font(.system(size: 13))
                .foregroundColor(Color.white.opacity(0.4))
            TextField("https://…", text: $link)
                .font(.system(size: 13))
                .foregroundColor(.white)
                .autocapitalization(.none)
                .keyboardType(.URL)
            Button(action: onRemove) {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 15))
                    .foregroundColor(Color.white.opacity(0.25))
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

// MARK: - Source Card

private struct SourceCard: View {
    @Binding var text: String
    @Binding var sources: [SourceItem]
    @Binding var linkText: String
    @State private var expanded = true
    @State private var showImport = false
    @State private var showWriteText = false
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var photoPickerItem: PhotosPickerItem? = nil
    @FocusState private var textFocused: Bool
    var onBuild: () -> Void

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                HStack {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: expanded ? "chevron.down" : "chevron.right")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Color.white.opacity(0.35))
                            Text("Source")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.85))
                        }
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Button {
                        showImport = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.6))
                            .frame(width: 30, height: 30)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

                if expanded {
                    Divider().background(Color.white.opacity(0.07))

                    if !sources.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(sources) { item in
                                    SourceChip(item: item) {
                                        sources.removeAll { $0.id == item.id }
                                        if item.type == .text { showWriteText = false }
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 10)
                        }
                        Divider().background(Color.white.opacity(0.07))
                    }

                    if sources.contains(where: { $0.type == .link }) {
                        LinkInputRow(link: $linkText) {
                            sources.removeAll { $0.type == .link }
                            linkText = ""
                        }
                    }

                    if showWriteText || sources.contains(where: { $0.type == .text }) {
                        ZStack(alignment: .topLeading) {
                            if text.isEmpty {
                                Text("Paste your text, transcript or notes…")
                                    .font(.system(size: 14))
                                    .foregroundColor(Color.white.opacity(0.25))
                                    .padding(.horizontal, 16)
                                    .padding(.top, 14)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $text)
                                .font(.system(size: 14))
                                .foregroundColor(Color.white.opacity(0.85))
                                .scrollContentBackground(.hidden)
                                .background(.clear)
                                .frame(minHeight: 100, maxHeight: 200)
                                .padding(.horizontal, 12)
                                .padding(.top, 8)
                                .focused($textFocused)
                        }
                    }

                    if sources.isEmpty && !showWriteText {
                        HStack {
                            Text("Tap + to add source content")
                                .font(.system(size: 13))
                                .foregroundColor(Color.white.opacity(0.22))
                            Spacer()
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 16)
                    }

                    Button(action: onBuild) {
                        Text("Build Workflow")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.85))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Color.white.opacity(0.09))
                            .overlay(
                                Rectangle().fill(Color.white.opacity(0.07)).frame(height: 0.5),
                                alignment: .top
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .sheet(isPresented: $showImport) {
            ImportSheetView { type in
                let feedback = UIImpactFeedbackGenerator(style: .light)
                feedback.impactOccurred()
                switch type {
                case .text:
                    if !sources.contains(where: { $0.type == .text }) {
                        sources.append(SourceItem(type: .text, label: "Write text"))
                        showWriteText = true
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { textFocused = true }
                case .link:
                    if !sources.contains(where: { $0.type == .link }) {
                        sources.append(SourceItem(type: .link, label: "Link"))
                    }
                case .file:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { showFilePicker = true }
                case .voice:
                    sources.append(SourceItem(type: .voice, label: "Voice note"))
                case .image:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { showPhotoPicker = true }
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
            .presentationBackground(Color(red: 0.13, green: 0.11, blue: 0.10))
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.text, .plainText, .pdf, .data],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                let name = url.lastPathComponent
                sources.append(SourceItem(type: .file, label: name))
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

// MARK: - Generate Card

private struct GenerateCard: View {
    @Binding var prompt: String
    @State private var expanded = true

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                SectionHeader(title: "Generate", expanded: $expanded)
                if expanded {
                    Divider().background(Color.white.opacity(0.07))
                    ZStack(alignment: .topLeading) {
                        if prompt.isEmpty {
                            Text("Describe what you want to create…")
                                .font(.system(size: 14))
                                .foregroundColor(Color.white.opacity(0.25))
                                .padding(.horizontal, 16)
                                .padding(.top, 14)
                                .allowsHitTesting(false)
                        }
                        TextEditor(text: $prompt)
                            .font(.system(size: 14))
                            .foregroundColor(Color.white.opacity(0.85))
                            .scrollContentBackground(.hidden)
                            .background(.clear)
                            .frame(minHeight: 80, maxHeight: 140)
                            .padding(.horizontal, 12)
                            .padding(.top, 8)
                            .padding(.bottom, 12)
                    }
                }
            }
        }
    }
}

// MARK: - Brand Card

private struct BrandCard: View {
    @Binding var selectedBrand: String
    let brands = ["None", "Personal", "Company", "Startup", "Agency"]

    var body: some View {
        GlassCard {
            HStack(spacing: 12) {
                Text("Brand Voice")
                    .font(.system(size: 16, weight: .medium))
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
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.70))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 9, weight: .semibold))
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
    var onNewWorkflow: (() -> Void)?

    @State private var sourceText = ""
    @State private var sources: [SourceItem] = []
    @State private var linkText  = ""
    @State private var genPrompt = ""
    @State private var brand     = "None"

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.55, green: 0.30, blue: 0.08).opacity(0.35), .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0, endRadius: 380
            ).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.05, green: 0.35, blue: 0.15).opacity(0.28), .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0, endRadius: 320
            ).ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    SourceCard(
                        text: $sourceText,
                        sources: $sources,
                        linkText: $linkText,
                        onBuild: { onNewWorkflow?() }
                    )
                    GenerateCard(prompt: $genPrompt)
                    BrandCard(selectedBrand: $brand)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
