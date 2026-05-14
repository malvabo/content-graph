import SwiftUI

// MARK: - App Tab

enum AppTab: String {
    case notes, create, templates
}

// MARK: - Library View

struct LibraryView: View {
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var searchText = ""
    @State private var showSearch = false
    @State private var cachedGroups: [(title: String, items: [GenerationProject])] = []
    @FocusState private var searchFocused: Bool

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var filteredGroups: [(title: String, items: [GenerationProject])] {
        guard !searchText.isEmpty else { return cachedGroups }
        let q = searchText.lowercased()
        return cachedGroups.filter { $0.title.lowercased().contains(q) }
    }

    private func buildGroups() {
        let projects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        var dict: [String: [GenerationProject]] = [:]
        for p in projects { dict[p.title, default: []].append(p) }
        cachedGroups = dict
            .map { (title: $0.key, items: $0.value.sorted { $0.date > $1.date }) }
            .sorted { ($0.items.first?.date ?? .distantPast) > ($1.items.first?.date ?? .distantPast) }
    }

    @ViewBuilder
    private func libraryList(_ groups: [(title: String, items: [GenerationProject])], emptyTitle: String, emptySubtitle: String?) -> some View {
        if groups.isEmpty {
            VStack {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: searchText.isEmpty && !showSearch ? "tray" : "magnifyingglass")
                        .font(.system(size: 36))
                        .foregroundColor(Color.white.opacity(0.20))
                    Text(emptyTitle)
                        .foregroundColor(Color.white.opacity(0.30))
                    if let sub = emptySubtitle {
                        Text(sub)
                            .font(.footnote)
                            .foregroundColor(Color.white.opacity(0.20))
                    }
                }
                Spacer()
            }
        } else {
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(groups, id: \.title) { group in
                        NavigationLink {
                            ProjectGroupDetailView(groupTitle: group.title, initialItems: group.items)
                        } label: {
                            LibraryGroupRow(title: group.title, items: group.items)
                        }
                        .buttonStyle(.plain)

                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                            .padding(.leading, 20)
                    }
                }
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                bg.ignoresSafeArea()

                VStack(spacing: 0) {
                    InlineTopBar(title: "Library") {
                        TopBarPill {
                            TopBarPillButton(
                                systemImage: showSearch ? "xmark" : "magnifyingglass",
                                isActive: showSearch
                            ) {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                withAnimation(.easeInOut(duration: 0.22)) {
                                    showSearch.toggle()
                                    if !showSearch { searchText = "" }
                                    else { searchFocused = true }
                                }
                            }
                        }
                    }

                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 0.5)

                    libraryList(
                        cachedGroups,
                        emptyTitle: "No generations yet",
                        emptySubtitle: "Your content outputs will appear here"
                    )
                }
                .allowsHitTesting(!showSearch)
                .animation(.easeInOut(duration: 0.22), value: showSearch)

                if showSearch {
                    SearchOverlay(
                        query: $searchText,
                        placeholder: "Search library",
                        isFocused: $searchFocused
                    ) {
                        libraryList(
                            filteredGroups,
                            emptyTitle: searchText.isEmpty ? "Start typing" : "No results",
                            emptySubtitle: nil
                        )
                    }
                    .transition(.opacity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .task { buildGroups() }
            .onChange(of: projectsData) { buildGroups() }
        }
    }
}

private func libraryRelativeTime(_ date: Date) -> String {
    let interval = Date().timeIntervalSince(date)
    if interval < 60 { return "just now" }
    if interval < 3600 { return "\(Int(interval / 60))m ago" }
    if interval < 86400 { return "\(Int(interval / 3600))h ago" }
    let days = Int(interval / 86400)
    return days == 1 ? "yesterday" : "\(days) days ago"
}

private func outputTypesList(_ items: [GenerationProject]) -> String {
    var seen = Set<String>()
    let labels: [String] = items.compactMap { item in
        guard seen.insert(item.outputType).inserted else { return nil }
        return allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType
    }
    return labels.joined(separator: ", ")
}

private struct LibraryGroupRow: View {
    let title: String
    let items: [GenerationProject]

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.app(size: 19, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.88))
                    .lineLimit(1)
                Text("\(outputTypesList(items)) · \(libraryRelativeTime(items.first?.date ?? Date()))")
                    .font(.appMicro)
                    .foregroundColor(Color.white.opacity(0.35))
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
}

struct ProjectGroupDetailView: View {
    let groupTitle: String
    let initialItems: [GenerationProject]
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @Environment(\.dismiss) private var dismiss

    @State private var selectedIndex: Int = 0
    @State private var editText: String = ""
    @State private var copied = false
    @State private var showAIMenu = false
    @State private var isAIProcessing = false
    @State private var aiFailed = false
    @State private var aiFailReason = ""
    @State private var showAIPreview = false
    @State private var aiPreviewText: String = ""
    @State private var aiPreviewLabel: String = ""
    @State private var aiPreviewIcon: String = "sparkles"
    @State private var aiPreviewInstruction: String = ""
    @State private var aiSourceSnapshot: String = ""
    @FocusState private var editorFocused: Bool

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var allProjects: [GenerationProject] {
        (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
    }

    private var items: [GenerationProject] {
        let ids = Set(initialItems.map { $0.id })
        let live = allProjects.filter { ids.contains($0.id) }
        return live.isEmpty ? initialItems : live.sorted { $0.date > $1.date }
    }

    private func tabLabel(_ item: GenerationProject) -> String {
        allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType
    }

    private func bodyText(for item: GenerationProject) -> String {
        item.content.isEmpty ? item.preview : item.content
    }

    private func persistCurrent() {
        guard items.indices.contains(selectedIndex) else { return }
        let item = items[selectedIndex]
        guard editText != bodyText(for: item) else { return }
        var projects: [GenerationProject]
        switch loadBlob([GenerationProject].self, from: projectsData) {
        case .empty: projects = []
        case .ok(let existing): projects = existing
        case .corrupt: return
        }
        if let idx = projects.firstIndex(where: { $0.id == item.id }) {
            projects[idx].content = editText
            projects[idx].preview = String(editText.prefix(120))
        }
        if let data = try? JSONEncoder().encode(projects) { projectsData = data }
    }

    private func selectTab(_ index: Int) {
        persistCurrent()
        selectedIndex = index
        if items.indices.contains(index) { editText = bodyText(for: items[index]) }
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Top bar
                HStack(spacing: 10) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        persistCurrent()
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Text(groupTitle)
                        .font(.appBodyBold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    Spacer()

                    ShareLink(item: editText) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 10)

                // Tabs
                if items.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                                Button { selectTab(idx) } label: {
                                    Text(tabLabel(item))
                                        .font(.app(size: 14, weight: selectedIndex == idx ? .semibold : .regular))
                                        .foregroundColor(selectedIndex == idx ? .white : Color.white.opacity(0.45))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 7)
                                        .background(selectedIndex == idx ? Color.white.opacity(0.12) : Color.clear)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(selectedIndex == idx ? Color.white.opacity(0.20) : Color.clear, lineWidth: 0.5))
                                }
                                .buttonStyle(.plain)
                                .animation(.easeOut(duration: 0.15), value: selectedIndex)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 10)
                    }

                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 0.5)
                }

                // Content
                if items.indices.contains(selectedIndex) {
                    let item = items[selectedIndex]

                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text(allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType)
                                .font(.appTitle)
                                .foregroundColor(.white)
                            Spacer()
                            Text(item.date, style: .date)
                                .font(.appCaption)
                                .foregroundColor(Color.white.opacity(0.35))
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 10)

                        ZStack(alignment: .topLeading) {
                            if editText.isEmpty {
                                Text("No content")
                                    .font(.appBody)
                                    .foregroundColor(Color.white.opacity(0.22))
                                    .padding(.horizontal, 24)
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $editText)
                                .appBodyText()
                                .scrollContentBackground(.hidden)
                                .background(Color.clear)
                                .tint(.white)
                                .padding(.horizontal, 16)
                                .contentMargins(.bottom, 96, for: .scrollContent)
                                .focused($editorFocused)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task {
            if items.indices.contains(selectedIndex) { editText = bodyText(for: items[selectedIndex]) }
        }
        .onChange(of: selectedIndex) {
            if items.indices.contains(selectedIndex) { editText = bodyText(for: items[selectedIndex]) }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            HStack(spacing: 10) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showAIMenu = true
                } label: {
                    Group {
                        if isAIProcessing {
                            ProgressView()
                                .controlSize(.small)
                                .tint(.white)
                        } else {
                            Image(systemName: "sparkles")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(.white)
                        }
                    }
                    .frame(width: 52, height: 52)
                    .background(Color.white.opacity(0.12))
                    .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(isAIProcessing)
                .accessibilityLabel("AI actions")

                Button {
                    UIPasteboard.general.string = editText
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.easeOut(duration: 0.15)) { copied = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { withAnimation { copied = false } }
                } label: {
                    Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                        .font(.appBodyBold)
                        .foregroundColor(copied ? Color.white.opacity(0.70) : .white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(copied ? Color.white.opacity(0.07) : Color.white.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
                .animation(.easeOut(duration: 0.2), value: copied)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(alignment: .top) {
                LinearGradient(colors: [bg.opacity(0), bg], startPoint: .top, endPoint: .bottom)
                    .frame(height: 28).offset(y: -28).allowsHitTesting(false)
            }
            .background(bg)
        }
        .sheet(isPresented: $showAIMenu) {
            AIActionsSheet { label, icon, instruction in
                showAIMenu = false
                runAITransform(instruction: instruction, label: label, icon: icon, source: editText)
            }
        }
        .sheet(isPresented: $showAIPreview) {
            AIPreviewSheet(
                actionLabel: aiPreviewLabel,
                actionIcon: aiPreviewIcon,
                previewText: aiPreviewText,
                isLoading: isAIProcessing,
                onApply: {
                    editText = aiPreviewText
                    persistCurrent()
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    showAIPreview = false
                },
                onCopy: {
                    UIPasteboard.general.string = aiPreviewText
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                },
                onRegenerate: {
                    runAITransform(
                        instruction: aiPreviewInstruction,
                        label: aiPreviewLabel,
                        icon: aiPreviewIcon,
                        source: aiSourceSnapshot
                    )
                },
                onClose: { showAIPreview = false }
            )
        }
        .onChange(of: showAIPreview) { _, newValue in
            if !newValue {
                aiPreviewText = ""
                aiPreviewLabel = ""
                aiPreviewIcon = "sparkles"
                aiPreviewInstruction = ""
                aiSourceSnapshot = ""
            }
        }
        .alert("AI request failed", isPresented: $aiFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(aiFailReason.isEmpty
                 ? "Could not reach the API. Check your network and try again."
                 : aiFailReason)
        }
    }

    private func runAITransform(instruction: String, label: String, icon: String, source: String) {
        let trimmedInstruction = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInstruction.isEmpty else { return }
        guard !source.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            aiFailReason = "There's no text to transform yet."
            aiFailed = true
            return
        }
        aiPreviewLabel = label
        aiPreviewIcon = icon
        aiPreviewInstruction = trimmedInstruction
        aiSourceSnapshot = source
        isAIProcessing = true
        Task {
            let outcome = await AITransformService.transform(text: source, instruction: trimmedInstruction)
            await MainActor.run {
                isAIProcessing = false
                switch outcome {
                case .success(let result):
                    aiPreviewText = result
                    if !showAIPreview { showAIPreview = true }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                case .failure(let err):
                    aiFailReason = AITransformService.isKeyConfigured
                        ? err.userMessage
                        : "Add your Anthropic API key in the Create tab first."
                    aiFailed = true
                }
            }
        }
    }
}

// MARK: - Templates View

private enum TemplateDestination: Hashable {
    case new
    case edit(UUID)
}

struct TemplatesView: View {
    private let builtIn: [(title: String, subtitle: String, icon: String)] = [
        ("Landing page",     "Structured hero + sections copy",  "doc.richtext"),
        ("Short note",       "Concise single-topic summary",      "note.text"),
        ("Newsletter",       "300–500 word scannable digest",     "envelope"),
        ("LinkedIn post",    "150–300 word hook post",            "person.crop.rectangle"),
        ("Twitter thread",   "5–10 tweet thread",                 "text.bubble"),
        ("Brand story",      "Rewrite with consistent voice",     "sparkles"),
        ("Marketing pack",   "Social, email and ad copy",         "megaphone"),
        ("Review document",  "Key decisions and action items",    "checkmark.circle"),
    ]

    @AppStorage("custom_templates") private var customData: Data = Data()
    @State private var custom: [CustomTemplate] = []
    @State private var path: [TemplateDestination] = []

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                InlineTopBar(title: "Templates") {
                    TopBarPill {
                        TopBarPillButton(systemImage: "plus") {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            path.append(.new)
                        }
                    }
                }

                List {
                    ForEach(custom) { tpl in
                        TemplateRow(title: tpl.title)
                            .onTapGesture { path.append(.edit(tpl.id)) }
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Color.white.opacity(0.06))
                            .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                    }
                    ForEach(builtIn, id: \.title) { tpl in
                        TemplateRow(title: tpl.title)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Color.white.opacity(0.06))
                            .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
            .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .onAppear { custom = (try? JSONDecoder().decode([CustomTemplate].self, from: customData)) ?? [] }
            .navigationDestination(for: TemplateDestination.self) { dest in
                switch dest {
                case .new:
                    TemplateEditPage(template: nil) { newTpl in
                        custom.insert(newTpl, at: 0)
                        saveCustom()
                    }
                case .edit(let id):
                    if let tpl = custom.first(where: { $0.id == id }) {
                        TemplateEditPage(template: tpl) { updated in
                            if let idx = custom.firstIndex(where: { $0.id == id }) {
                                custom[idx] = updated
                            }
                            saveCustom()
                        } onDelete: {
                            custom.removeAll { $0.id == id }
                            saveCustom()
                        }
                    }
                }
            }
        }
    }

    private func saveCustom() {
        if case .corrupt = loadBlob([CustomTemplate].self, from: customData) { return }
        if let data = try? JSONEncoder().encode(custom) { customData = data }
    }
}

private struct TemplateRow: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.app(size: 19, weight: .regular))
            .foregroundColor(Color.white.opacity(0.82))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
    }
}

private struct TemplateEditPage: View {
    let originalID: UUID?
    let onSave: (CustomTemplate) -> Void
    let onDelete: (() -> Void)?

    @State private var title: String
    @State private var existingSubtitle: String
    @State private var prompt: String
    @State private var formatIDs: Set<String>

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController
    @FocusState private var focus: Field?

    private enum Field { case title, prompt }
    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)
    private let amber = BrandColor.amber

    init(template: CustomTemplate?, onSave: @escaping (CustomTemplate) -> Void, onDelete: (() -> Void)? = nil) {
        self.originalID = template?.id
        self.onSave = onSave
        self.onDelete = onDelete
        _title = State(initialValue: template?.title ?? "")
        _existingSubtitle = State(initialValue: template?.subtitle ?? "")
        _prompt = State(initialValue: template?.prompt ?? "")
        _formatIDs = State(initialValue: Set(template?.formatIDs ?? []))
    }

    private var isNew: Bool { originalID == nil }

    private func persist() {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        var tpl = CustomTemplate(title: title, subtitle: existingSubtitle)
        if let id = originalID { tpl.id = id }
        tpl.prompt = prompt
        tpl.formatIDs = Array(formatIDs)
        onSave(tpl)
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Top bar
                HStack(spacing: 10) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    if !isNew, let del = onDelete {
                        Button {
                            del()
                            dismiss()
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(Color.red.opacity(0.75))
                                .frame(width: 36, height: 36)
                                .background(Color.white.opacity(0.08))
                                .clipShape(Circle())
                                .frame(minWidth: 44, minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 12)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        // Large title
                        TextField(
                            "",
                            text: $title,
                            prompt: Text("Template name").foregroundColor(Color.white.opacity(0.25)),
                            axis: .vertical
                        )
                        .font(.appTitle)
                        .foregroundColor(.white)
                        .tint(.white)
                        .lineLimit(1...3)
                        .padding(.horizontal, 20)
                        .focused($focus, equals: .title)

                        // Merged prompt + format tags
                        VStack(alignment: .leading, spacing: 12) {
                            TemplateTagFlow(items: allFormats, selectedIDs: $formatIDs)
                                .padding(.horizontal, 20)

                            ZStack(alignment: .topLeading) {
                                if prompt.isEmpty {
                                    Text("Describe what this template should produce\u{2026}")
                                        .font(.appBody)
                                        .foregroundColor(Color.white.opacity(0.22))
                                        .padding(.horizontal, 24)
                                        .padding(.top, 8)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $prompt)
                                    .appBodyText()
                                    .scrollContentBackground(.hidden)
                                    .background(Color.clear)
                                    .tint(.white)
                                    .padding(.horizontal, 16)
                                    .focused($focus, equals: .prompt)
                                    .frame(minHeight: 200)
                            }
                        }
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 48)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .onAppear { chrome.hideTabBar = true }
        .onDisappear {
            chrome.hideTabBar = false
            persist()
        }
    }
}

private struct TemplateTagFlow: View {
    let items: [ContentFormat]
    @Binding var selectedIDs: Set<String>

    var body: some View {
        ChipFlowLayout(spacing: 8) {
            ForEach(items) { fmt in
                let selected = selectedIDs.contains(fmt.id)
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.easeOut(duration: 0.15)) {
                        if selected { selectedIDs.remove(fmt.id) }
                        else { selectedIDs.insert(fmt.id) }
                    }
                } label: {
                    Text(fmt.label)
                        .font(.app(size: 14, weight: selected ? .semibold : .regular))
                        .foregroundColor(selected ? .white : Color.white.opacity(0.55))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selected ? Color.white.opacity(0.14) : Color.white.opacity(0.07))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(selected ? Color.white.opacity(0.30) : Color.white.opacity(0.10), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                .animation(.easeOut(duration: 0.15), value: selected)
            }
        }
    }
}

private struct ChipFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var height: CGFloat = 0
        var x: CGFloat = 0
        var rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 {
                height += rowH + spacing
                x = 0; rowH = 0
            }
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
        return CGSize(width: width, height: height + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                y += rowH + spacing
                x = bounds.minX; rowH = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
    }
}

// MARK: - Custom Tab Bar

private struct AppTabBar: View {
    @Binding var selected: AppTab

    private let mainItems: [(AppTab, String, String)] = [
        (.notes,     "house",                "Home"),
        (.create,    "sparkles",             "Creator"),
        (.templates, "square.grid.2x2.fill", "Templates"),
    ]

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(mainItems, id: \.0.rawValue) { tab, icon, label in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        selected = tab
                    } label: {
                        VStack(spacing: 2) {
                            if tab == .create {
                                SparkRaysShape()
                                    .stroke(style: StrokeStyle(
                                        lineWidth: selected == tab ? 1.8 : 1.5,
                                        lineCap: .round
                                    ))
                                    .frame(width: 18, height: 18)
                            } else {
                                Image(systemName: icon)
                                    .font(.system(size: 17, weight: selected == tab ? .semibold : .regular))
                            }
                            Text(label)
                                .font(.system(size: 10, weight: selected == tab ? .semibold : .regular))
                        }
                        .foregroundColor(selected == tab ? .white : Color.white.opacity(0.45))
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .background(
                            Group {
                                if selected == tab {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(Color.white.opacity(0.16))
                                }
                            }
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
            .appLiquidGlass(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.22), Color.white.opacity(0.06)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 0.5
                    )
            )

            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                selected = .create
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(.white)
                    .frame(width: 50, height: 50)
                    .appLiquidGlass(in: Circle())
                    .overlay(
                        Circle()
                            .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
                    )
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .notes
    @State private var keyboardVisible = false
    @StateObject private var bannerController = BannerController()
    @StateObject private var chromeController = ChromeController()
    @StateObject private var recordingController = RecordingController()

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                NotesView().tag(AppTab.notes)
                HomeView().tag(AppTab.create)
                TemplatesView().tag(AppTab.templates)
            }
            .environmentObject(bannerController)
            .environmentObject(chromeController)
            .environmentObject(recordingController)
            .sheet(isPresented: $recordingController.showingSheet) {
                NoteVoiceSheet()
                    .environmentObject(recordingController)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !keyboardVisible && !chromeController.hideTabBar {
                    AppTabBar(selected: $selectedTab)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                keyboardVisible = true
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                keyboardVisible = false
            }

            if bannerController.isVisible {
                GenerationBanner(
                    formatLabels: bannerController.formatLabels,
                    isReady: bannerController.isReady,
                    onTap: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        bannerController.onOpen?()
                    },
                    onDismiss: {
                        bannerController.onCancel?()
                    }
                )
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(2)
            }

            if (recordingController.isRecording || recordingController.isPaused) && !recordingController.showingSheet {
                VStack {
                    Spacer()
                    RecordingMiniBar(
                        onTap: {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            selectedTab = .notes
                            recordingController.showingSheet = true
                        },
                        onStop: {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            recordingController.finish()
                        }
                    )
                    .padding(.horizontal, 12)
                    .padding(.bottom, (!keyboardVisible && !chromeController.hideTabBar) ? 96 : 12)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(3)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: bannerController.isVisible)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: recordingController.isRecording)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: recordingController.showingSheet)
    }
}

// MARK: - Recording Mini Bar

private struct RecordingMiniBar: View {
    @EnvironmentObject private var recording: RecordingController
    let onTap: () -> Void
    let onStop: () -> Void

    private let amber = BrandColor.amber
    @State private var dragOffset: CGSize = .zero
    @GestureState private var dragTranslation: CGSize = .zero

    private var timeLabel: String {
        String(format: "%02d:%02d", recording.seconds / 60, recording.seconds % 60)
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                PulsingDot(active: recording.isRecording)
                    .frame(width: 10, height: 10)
                Text(recording.isPaused ? "Paused" : "Recording")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                Text(timeLabel)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.55))
                Spacer(minLength: 8)
                Button {
                    onStop()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(amber)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.leading, 16)
            .padding(.trailing, 6)
            .frame(height: 52)
            .background(
                Capsule(style: .continuous)
                    .fill(Color(red: 0.18, green: 0.14, blue: 0.12))
                    .shadow(color: Color.black.opacity(0.45), radius: 18, y: 6)
            )
        }
        .buttonStyle(.plain)
        .offset(
            x: dragOffset.width + dragTranslation.width,
            y: dragOffset.height + dragTranslation.height
        )
        .simultaneousGesture(
            DragGesture(minimumDistance: 10)
                .updating($dragTranslation) { value, state, _ in
                    state = value.translation
                }
                .onEnded { _ in
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.82)) {
                        dragOffset = .zero
                    }
                }
        )
        .animation(.interactiveSpring(response: 0.28, dampingFraction: 0.86), value: dragTranslation)
        .accessibilityLabel(recording.isPaused ? "Paused recording" : "Recording in progress")
        .accessibilityHint("Tap to expand, stop button to finish")
    }
}

private struct PulsingDot: View {
    let active: Bool
    @State private var pulse: Bool = false

    var body: some View {
        Circle()
            .fill(Color.red)
            .opacity(active && pulse ? 0.45 : 1.0)
            .scaleEffect(active && pulse ? 1.25 : 1.0)
            .animation(active ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true) : .default, value: pulse)
            .onAppear { pulse = true }
    }
}

// MARK: - Top bar primitives

struct TopBarPill<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        HStack(spacing: 0) { content() }
            .background(
                Capsule(style: .continuous)
                    .fill(Color.white.opacity(0.08))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                    )
            )
    }
}

struct TopBarPillButton: View {
    let systemImage: String
    let isActive: Bool
    let action: () -> Void
    init(systemImage: String, isActive: Bool = false, action: @escaping () -> Void) {
        self.systemImage = systemImage
        self.isActive = isActive
        self.action = action
    }
    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 15, weight: .regular))
                .foregroundColor(.white)
                .frame(width: 38, height: 32)
                .background(isActive ? Color.white.opacity(0.12) : Color.clear)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct TopBarPillDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.white.opacity(0.10))
            .frame(width: 0.5, height: 18)
    }
}

extension View {
    /// Applies iOS 26 Liquid Glass when available; on older iOS the view
    /// falls back to a `.regularMaterial` fill behind the same shape so the
    /// chrome still reads as glass-like.
    @ViewBuilder
    func appLiquidGlass<S: Shape>(in shape: S) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular, in: shape)
        } else {
            self.background(shape.fill(.regularMaterial))
        }
    }
}

struct InlineTopBar<Trailing: View>: View {
    let title: String
    @ViewBuilder var trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 12) {
            Text(title)
                .font(.app(size: 30, weight: .bold))
                .foregroundColor(.white)
                .fixedSize(horizontal: true, vertical: false)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 8)
            trailing()
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 14)
    }
}

struct AppSearchField: View {
    let placeholder: String
    @Binding var text: String
    let isFocused: FocusState<Bool>.Binding
    var submitLabel: SubmitLabel = .search
    var onSubmit: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .font(.appLabel)
                .foregroundColor(Color.white.opacity(0.45))
            TextField(placeholder, text: $text)
                .font(.appLabel)
                .foregroundColor(.white)
                .tint(.white)
                .focused(isFocused)
                .submitLabel(submitLabel)
                .onSubmit { onSubmit?() }
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.appSubtext)
                        .foregroundColor(Color.white.opacity(0.40))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            Capsule(style: .continuous)
                .fill(Color.white.opacity(0.08))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                )
        )
    }
}

struct AppPickerSheet<Results: View>: View {
    let title: String
    @Binding var query: String
    let placeholder: String
    var submitLabel: SubmitLabel = .search
    var onSubmit: (() -> Void)? = nil
    let onClose: () -> Void
    @ViewBuilder var results: () -> Results

    @FocusState private var fieldFocused: Bool

    private let sheetBg = Color(red: 0.10, green: 0.08, blue: 0.07)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(title)
                    .font(.appBodyBold)
                    .foregroundColor(.white)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.55))
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            AppSearchField(
                placeholder: placeholder,
                text: $query,
                isFocused: $fieldFocused,
                submitLabel: submitLabel,
                onSubmit: onSubmit
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 12)

            results()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(sheetBg)
        .presentationBackground(sheetBg)
        .presentationCornerRadius(22)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                fieldFocused = true
            }
        }
    }
}

struct SearchOverlay<Results: View>: View {
    @Binding var query: String
    let placeholder: String
    let isFocused: FocusState<Bool>.Binding
    @ViewBuilder var results: () -> Results

    var body: some View {
        ZStack(alignment: .top) {
            Rectangle()
                .fill(.ultraThinMaterial)
                .overlay(Color.black.opacity(0.15))
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .font(.appLabel)
                        .foregroundColor(Color.white.opacity(0.45))
                    TextField(placeholder, text: $query)
                        .font(.appLabel)
                        .foregroundColor(.white)
                        .tint(.white)
                        .focused(isFocused)
                        .submitLabel(.search)
                    if !query.isEmpty {
                        Button { query = "" } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.appSubtext)
                                .foregroundColor(Color.white.opacity(0.40))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    Capsule(style: .continuous)
                        .fill(Color.white.opacity(0.10))
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                        )
                )
                .padding(.horizontal, 16)
                .padding(.top, 10)
                .padding(.bottom, 12)

                results()
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                isFocused.wrappedValue = true
            }
        }
    }
}

// MARK: - AI transform service

struct AITransformService {
    static var isKeyConfigured: Bool {
        guard let key = KeychainService.load() else { return false }
        return !key.isEmpty && !key.hasPrefix("$(")
    }

    static func transform(text: String, instruction: String) async -> Result<String, APICallError> {
        let apiKey = KeychainService.load() ?? ""
        guard !apiKey.isEmpty, let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            return .failure(.http(401, "Missing API key"))
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 60

        let system = "You rewrite the user's text following their instruction. Preserve formatting, structure, and tone unless the instruction asks to change them. Output only the rewritten text, no preamble, no commentary, no quotes around the output."
        let user = "Instruction: \(instruction)\n\nText:\n\(text)"

        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 4096,
            "system": system,
            "messages": [["role": "user", "content": user]]
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else {
            return .failure(.decode)
        }
        req.httpBody = httpBody

        let data: Data
        let resp: URLResponse
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            return .failure(.network(error.localizedDescription))
        }

        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            return .failure(.http(status, anthropicErrorMessage(from: data)))
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return .failure(.decode) }

        let result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? .failure(.empty) : .success(result)
    }
}

// MARK: - AI actions sheet

private struct AIAction: Identifiable {
    let id = UUID()
    let label: String
    let icon: String
    let instruction: String
}

private let quickAIActions: [AIAction] = [
    AIAction(label: "Fix Spelling and Grammar", icon: "checkmark.seal", instruction: "Fix any spelling and grammar mistakes. Make no other changes."),
    AIAction(label: "Make Longer", icon: "text.append", instruction: "Make this text longer, adding more detail and context while preserving the original voice."),
]

private let builtInAIActions: [AIAction] = [
    AIAction(label: "Improve Writing", icon: "wand.and.stars", instruction: "Improve the writing: clearer sentences, stronger word choice, better flow. Preserve the meaning and roughly the same length."),
    AIAction(label: "Explain This in Simple Terms", icon: "lightbulb", instruction: "Rewrite this so a smart non-expert can understand it easily. Keep it concise."),
    AIAction(label: "Make Shorter", icon: "text.alignleft", instruction: "Shorten this while preserving the key points. Aim for roughly half the length."),
    AIAction(label: "Change Tone to Professional", icon: "bubble.left", instruction: "Rewrite this in a polished, professional tone suitable for a business context."),
]

struct AIActionsSheet: View {
    let onAction: (_ label: String, _ icon: String, _ instruction: String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var customPrompt: String = ""

    var body: some View {
        AppPickerSheet(
            title: "Ask AI",
            query: $customPrompt,
            placeholder: "Search or Ask AI…",
            submitLabel: .send,
            onSubmit: submitCustom,
            onClose: { dismiss() }
        ) {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(spacing: 2) {
                        ForEach(quickAIActions) { action in
                            actionRow(action)
                        }
                    }

                    Text("Built-In")
                        .font(.app(size: 13, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.40))
                        .padding(.horizontal, 20)

                    VStack(spacing: 2) {
                        ForEach(builtInAIActions) { action in
                            actionRow(action)
                        }
                    }
                }
                .padding(.bottom, 24)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func submitCustom() {
        let trimmed = customPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let short = String(trimmed.prefix(40))
        onAction("Ask AI: \(short)", "sparkles", trimmed)
    }

    private func actionRow(_ action: AIAction) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onAction(action.label, action.icon, action.instruction)
        } label: {
            HStack(spacing: 14) {
                Image(systemName: action.icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(BrandColor.amber)
                    .frame(width: 34, height: 34)
                    .background(BrandColor.amber.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(action.label)
                    .font(.app(size: 16, weight: .regular))
                    .foregroundColor(.white)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - AI preview sheet

struct AIPreviewSheet: View {
    let actionLabel: String
    let actionIcon: String
    let previewText: String
    let isLoading: Bool
    let onApply: () -> Void
    let onCopy: () -> Void
    let onRegenerate: () -> Void
    let onClose: () -> Void

    @State private var didCopy = false

    private let sheetBg = Color(red: 0.10, green: 0.08, blue: 0.07)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: actionIcon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(BrandColor.amber)
                    .frame(width: 34, height: 34)
                    .background(BrandColor.amber.opacity(0.14))
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                Text(actionLabel)
                    .font(.appBodyBold)
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.55))
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            ZStack {
                ScrollView(showsIndicators: false) {
                    Text(previewText.isEmpty ? " " : previewText)
                        .appBodyText()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .textSelection(.enabled)
                }
                if isLoading {
                    Color.black.opacity(0.25).allowsHitTesting(false)
                    ProgressView().tint(.white)
                }
            }

            HStack(spacing: 12) {
                Button {
                    onRegenerate()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.70))
                        .frame(width: 40, height: 40)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(isLoading)

                Spacer()

                Button {
                    onCopy()
                    withAnimation(.easeOut(duration: 0.15)) { didCopy = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        withAnimation { didCopy = false }
                    }
                } label: {
                    Text(didCopy ? "Copied" : "Copy")
                        .font(.appBodyBold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 22)
                        .frame(height: 40)
                        .overlay(Capsule().stroke(Color.white.opacity(0.20), lineWidth: 0.5))
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(isLoading)

                Button(action: onApply) {
                    Text("Apply")
                        .font(.appBodyBold)
                        .foregroundColor(.black)
                        .padding(.horizontal, 22)
                        .frame(height: 40)
                        .background(.white)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
                .disabled(isLoading)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(sheetBg)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(sheetBg)
        .presentationCornerRadius(22)
    }
}

#Preview {
    ContentView()
}
