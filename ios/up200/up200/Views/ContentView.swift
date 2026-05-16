import SwiftUI

// MARK: - App Tab

enum AppTab: String {
    case notes, create, library, profile
}

// MARK: - Library View

struct LibraryView: View {
    var onProfileTap: (() -> Void)? = nil
    /// When true, the view is hosted inside another container (the Simple
    /// home page) that owns the NavigationStack, title, and profile pill —
    /// so this view skips those pieces of chrome.
    var embedded: Bool = false
    /// See `NotesView.externalShowSearch`.
    var externalShowSearch: Binding<Bool>? = nil
    var externalSearchText: Binding<String>? = nil
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var localSearchText = ""
    @State private var localShowSearch = false
    @State private var cachedGroups: [(title: String, items: [GenerationProject])] = []
    @FocusState private var searchFocused: Bool

    private var showSearchBinding: Binding<Bool> {
        externalShowSearch ?? $localShowSearch
    }
    private var searchTextBinding: Binding<String> {
        externalSearchText ?? $localSearchText
    }
    private var showSearch: Bool {
        get { showSearchBinding.wrappedValue }
        nonmutating set { showSearchBinding.wrappedValue = newValue }
    }
    private var searchText: String {
        get { searchTextBinding.wrappedValue }
        nonmutating set { searchTextBinding.wrappedValue = newValue }
    }

    private var filteredGroups: [(title: String, items: [GenerationProject])] {
        guard !searchText.isEmpty else { return cachedGroups }
        let q = searchText.lowercased()
        return cachedGroups.filter { $0.title.lowercased().contains(q) }
    }

    private func buildGroups() {
        switch loadBlob([GenerationProject].self, from: projectsData) {
        case .empty:
            cachedGroups = []
        case .ok(let projects):
            var dict: [String: [GenerationProject]] = [:]
            for p in projects { dict[p.title, default: []].append(p) }
            cachedGroups = dict
                .map { (title: $0.key, items: $0.value.sorted { $0.date > $1.date }) }
                .sorted { ($0.items.first?.date ?? .distantPast) > ($1.items.first?.date ?? .distantPast) }
        case .corrupt:
            break // preserve existing cachedGroups; don't silently clear user data
        }
    }

    @ViewBuilder
    private func libraryList(_ groups: [(title: String, items: [GenerationProject])], emptyTitle: String, emptySubtitle: String?) -> some View {
        let isPristineEmpty = searchText.isEmpty && !showSearch

        if groups.isEmpty {
            if isPristineEmpty {
                EmptyStateView(
                    illustration: LibraryIllustration(),
                    title: emptyTitle,
                    subtitle: emptySubtitle
                )
            } else {
                VStack {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 36))
                            .foregroundColor(AppInk.solid(0.20))
                        Text(emptyTitle)
                            .foregroundColor(AppInk.solid(0.30))
                        if let sub = emptySubtitle {
                            Text(sub)
                                .font(.footnote)
                                .foregroundColor(AppInk.solid(0.20))
                        }
                    }
                    Spacer()
                }
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
                            .fill(AppInk.solid(0.06))
                            .frame(height: 0.5)
                            .padding(.leading, 20)
                    }
                }
            }
        }
    }

    @ViewBuilder
    var body: some View {
        if embedded {
            content
        } else {
            NavigationStack { content }
        }
    }

    private var content: some View {
        ZStack {
            AmbientBackground()

            VStack(spacing: 0) {
                // In Simple mode (embedded) the SimpleHomePage header owns
                // search and profile, so this view skips its own top bar.
                if !embedded {
                    InlineTopBar(title: "Library") {
                        TopBarPill {
                            TopBarPillButton(
                                systemImage: showSearch ? "xmark" : "magnifyingglass",
                                isActive: showSearch
                            ) {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                withAnimation(AppAnimation.standard) {
                                    showSearch.toggle()
                                    if !showSearch { searchText = "" }
                                }
                            }
                        }

                        if let onProfileTap {
                            TopBarPill {
                                TopBarPillButton(systemImage: "person.crop.circle") {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    onProfileTap()
                                }
                                .accessibilityLabel("Profile")
                            }
                        }
                    }
                }

                Rectangle()
                    .fill(AppInk.solid(0.06))
                    .frame(height: 0.5)

                libraryList(
                        cachedGroups,
                        emptyTitle: "No generations yet",
                        emptySubtitle: "Your content outputs will appear here"
                    )
                }
                .allowsHitTesting(!showSearch)
                .animation(AppAnimation.standard, value: showSearch)
                // The library list never owns the keyboard (only the SearchOverlay
                // does), so don't let the keyboard's safe-area inset reshape the
                // list. Without this, Cancel-ing search makes the keyboard
                // descend and the list's bottom edge animates outward — which
                // reads as content jumping up from below during the overlay fade.
                .ignoresSafeArea(.keyboard)

                if showSearch {
                    SearchOverlay(
                        query: searchTextBinding,
                        placeholder: "Search library",
                        isFocused: $searchFocused,
                        onCancel: {
                            withAnimation(AppAnimation.standard) {
                                showSearch = false
                                searchText = ""
                            }
                        },
                        omitField: embedded
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

private struct LibraryDocCard: View {
    let seed: Int
    var width: CGFloat = 42
    var height: CGFloat = 52

    var body: some View {
        let widths = Self.lineWidths(for: seed)
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(AppInk.solid(0.07))
            .overlay(
                VStack(alignment: .leading, spacing: 3) {
                    ForEach(0..<5, id: \.self) { i in
                        Capsule()
                            .fill(AppInk.solid(i == 0 ? 0.55 : 0.20))
                            .frame(width: widths[i], height: i == 0 ? 2.5 : 1.5)
                    }
                }
                .padding(8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(AppInk.solid(0.09), lineWidth: 0.5)
            )
            .frame(width: width, height: height)
    }

    private static func lineWidths(for seed: Int) -> [CGFloat] {
        var h = seed
        return (0..<5).map { _ in
            h = h &* 1664525 &+ 1013904223
            return 8 + CGFloat(h & 0x17)
        }
    }
}

private struct LibraryLandingThumb: View {
    let seed: Int

    var body: some View {
        let lineWidths = Self.bodyLineWidths(for: seed)
        RoundedRectangle(cornerRadius: 7, style: .continuous)
            .fill(AppInk.solid(0.07))
            .overlay(
                VStack(spacing: 3) {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(AppInk.solid(0.32))
                        .frame(height: 14)
                    Capsule()
                        .fill(AppInk.solid(0.55))
                        .frame(width: 22, height: 2.5)
                    ForEach(0..<2, id: \.self) { i in
                        Capsule()
                            .fill(AppInk.solid(0.20))
                            .frame(width: lineWidths[i], height: 1.5)
                    }
                    RoundedRectangle(cornerRadius: 2, style: .continuous)
                        .fill(BrandColor.amber.opacity(0.85))
                        .frame(width: 14, height: 5)
                        .padding(.top, 1)
                    ForEach(2..<4, id: \.self) { i in
                        Capsule()
                            .fill(AppInk.solid(0.16))
                            .frame(width: lineWidths[i], height: 1.2)
                    }
                }
                .padding(.horizontal, 5)
                .padding(.vertical, 5)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .stroke(AppInk.solid(0.09), lineWidth: 0.5)
            )
            .frame(width: 34, height: 56)
    }

    private static func bodyLineWidths(for seed: Int) -> [CGFloat] {
        var h = seed
        return (0..<4).map { _ in
            h = h &* 1664525 &+ 1013904223
            return 14 + CGFloat(h & 0x0B)
        }
    }
}

private struct LibraryFolderThumb: View {
    let seed: Int

    var body: some View {
        // Folder sits inside the same 52×56 frame as the doc card. Body is
        // centered horizontally; the tab pokes up from its top-left. Mini
        // doc cards fan out inside with a fixed symmetric tilt so the
        // rotated bounding boxes stay within the body and never spill into
        // the row's text column.
        ZStack(alignment: .topLeading) {
            // Tab
            UnevenRoundedRectangle(
                cornerRadii: .init(topLeading: 3, bottomLeading: 0, bottomTrailing: 0, topTrailing: 3),
                style: .continuous
            )
            .fill(AppInk.solid(0.18))
            .frame(width: 18, height: 8)
            .offset(x: 6, y: 0)

            // Body
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(AppInk.solid(0.12))
                .overlay(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .stroke(AppInk.solid(0.14), lineWidth: 0.5)
                )
                .frame(width: 46, height: 44)
                .offset(x: 3, y: 6)

            // Mini files inside. Placed directly in the outer .topLeading
            // ZStack so each offset is measured from (0,0) — a nested ZStack
            // would re-center them and break the layout.
            miniDoc(seed: seed &+ 31, rotation: -6)
                .offset(x: 6, y: 20)
            miniDoc(seed: seed &+ 17, rotation: 0)
                .offset(x: 18, y: 16)
            miniDoc(seed: seed &+ 7, rotation: 6)
                .offset(x: 30, y: 20)
        }
        .frame(width: 52, height: 56)
        .clipped()
    }

    @ViewBuilder
    private func miniDoc(seed: Int, rotation: Double) -> some View {
        let w = Self.lineWidths(for: seed)
        RoundedRectangle(cornerRadius: 2.5, style: .continuous)
            .fill(AppInk.solid(0.22))
            .overlay(
                VStack(alignment: .leading, spacing: 1.5) {
                    Capsule()
                        .fill(AppInk.solid(0.55))
                        .frame(width: w[0], height: 1.4)
                    Capsule()
                        .fill(AppInk.solid(0.30))
                        .frame(width: w[1], height: 1.0)
                    Capsule()
                        .fill(AppInk.solid(0.30))
                        .frame(width: w[2], height: 1.0)
                }
                .padding(.horizontal, 2)
                .padding(.top, 3)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                    .stroke(AppInk.solid(0.18), lineWidth: 0.4)
            )
            .frame(width: 16, height: 20)
            .rotationEffect(.degrees(rotation))
    }

    private static func lineWidths(for seed: Int) -> [CGFloat] {
        var h = seed
        return (0..<3).map { _ in
            h = h &* 1664525 &+ 1013904223
            return 6 + CGFloat(h & 0x05)
        }
    }
}

private struct LibraryGroupThumb: View {
    let title: String
    let items: [GenerationProject]

    private var seed: Int {
        title.unicodeScalars.reduce(0) { $0 &* 31 &+ Int($1.value) }
    }

    var body: some View {
        Group {
            if items.count > 1 {
                LibraryFolderThumb(seed: seed)
            } else if items.first?.outputType == "landing" {
                LibraryLandingThumb(seed: seed)
            } else {
                LibraryDocCard(seed: seed)
            }
        }
        .frame(width: 52, height: 56)
    }
}

private struct LibraryGroupRow: View {
    let title: String
    let items: [GenerationProject]

    var body: some View {
        HStack(spacing: 16) {
            LibraryGroupThumb(title: title, items: items)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.appRowTitle)
                    .foregroundColor(AppInk.solid(0.88))
                    .lineLimit(1)
                Text("\(outputTypesList(items)) · \(libraryRelativeTime(items.first?.date ?? Date()))")
                    .font(.appMicro)
                    .foregroundColor(AppText.tertiary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
    }
}

struct ProjectGroupDetailView: View {
    let groupTitle: String
    let initialItems: [GenerationProject]
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController

    @State private var selectedIndex: Int = 0
    @State private var editText: String = ""
    @State private var copied = false
    @State private var copiedResetTask: Task<Void, Never>? = nil
    @State private var showAIMenu = false
    @State private var showChat = false
    @State private var isAIProcessing = false
    @State private var aiTransformTask: Task<Void, Never>? = nil
    @State private var aiFailed = false
    @State private var aiFailReason = ""
    @State private var showAIPreview = false
    @State private var aiPreviewText: String = ""
    @State private var aiPreviewLabel: String = ""
    @State private var aiPreviewIcon: String = "sparkles"
    @State private var aiPreviewInstruction: String = ""
    @State private var aiSourceSnapshot: String = ""
    @State private var editTextBeforeDictation: String = ""
    @StateObject private var dictation = NoteDictation()
    @FocusState private var editorFocused: Bool
    @State private var isEditingBody: Bool = false

    private let bg = AppBackground.primary

    @State private var cachedAllProjects: [GenerationProject] = []
    @State private var lastDecodedSignature: Data = Data()

    private var items: [GenerationProject] {
        let ids = Set(initialItems.map { $0.id })
        let live = cachedAllProjects.filter { ids.contains($0.id) }
        return live.isEmpty ? initialItems : live.sorted { $0.date > $1.date }
    }

    private func rebuildAllProjects() {
        guard lastDecodedSignature != projectsData else { return }
        cachedAllProjects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        lastDecodedSignature = projectsData
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

    private func deleteGroup() {
        var projects: [GenerationProject]
        switch loadBlob([GenerationProject].self, from: projectsData) {
        case .empty: projects = []
        case .ok(let existing): projects = existing
        case .corrupt: return
        }
        let idsToDelete = Set(initialItems.map { $0.id })
        projects.removeAll { idsToDelete.contains($0.id) }
        if let data = try? JSONEncoder().encode(projects) { projectsData = data }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        dismiss()
    }

    private func selectTab(_ index: Int) {
        // If a dictation is in progress, abandon it before switching tabs;
        // otherwise the next .onChange(of: dictation.transcript) would
        // overwrite the new tab's text with the previous tab's pre-dictation
        // snapshot + the partial transcript.
        if dictation.isRecording {
            dictation.cancel()
            editText = editTextBeforeDictation
        }
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
                            .foregroundColor(AppText.primary)
                            .frame(width: 36, height: 36)
                            .background(AppInk.solid(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Text(groupTitle)
                        .font(.appBodyBold)
                        .foregroundColor(AppText.primary)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    Spacer()

                    TopBarPill {
                        Button {
                            UIPasteboard.general.string = editText
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            withAnimation(AppAnimation.quick) { copied = true }
                            copiedResetTask?.cancel()
                            copiedResetTask = Task { @MainActor in
                                try? await Task.sleep(nanoseconds: 2_000_000_000)
                                guard !Task.isCancelled else { return }
                                withAnimation { copied = false }
                            }
                        } label: {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                                .contentTransition(.symbolEffect(.replace))
                                .topBarPillLabel()
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(copied ? "Copied" : "Copy")

                        TopBarPillDivider()

                        Menu {
                            ShareLink(item: editText) {
                                Label("Share", systemImage: "square.and.arrow.up")
                            }
                            Button(role: .destructive) {
                                deleteGroup()
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .topBarPillLabel()
                        }
                        .accessibilityLabel("More")
                    }
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
                                        .foregroundColor(selectedIndex == idx ? .white : AppInk.solid(0.45))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 7)
                                        .background(selectedIndex == idx ? AppInk.solid(0.12) : Color.clear)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(selectedIndex == idx ? AppInk.solid(0.20) : Color.clear, lineWidth: 0.5))
                                }
                                .buttonStyle(.plain)
                                .animation(AppAnimation.quick, value: selectedIndex)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 10)
                    }

                    Rectangle()
                        .fill(AppInk.solid(0.06))
                        .frame(height: 0.5)
                }

                // Content
                if items.indices.contains(selectedIndex) {
                    let item = items[selectedIndex]

                    VStack(alignment: .leading, spacing: 0) {
                        Text(allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType)
                            .font(.appTitle)
                            .foregroundColor(AppText.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                            .padding(.top, 16)
                            .padding(.bottom, 10)

                        ZStack(alignment: .topLeading) {
                            if editText.isEmpty {
                                Text("No content")
                                    .font(.appBody)
                                    .foregroundColor(AppText.muted)
                                    .padding(.horizontal, 24)
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }
                            if isEditingBody || dictation.isRecording {
                                TextEditor(text: $editText)
                                    .appBodyText()
                                    .scrollContentBackground(.hidden)
                                    .background(Color.clear)
                                    .tint(AppText.primary)
                                    .padding(.horizontal, 16)
                                    .contentMargins(.bottom, 96, for: .scrollContent)
                                    .focused($editorFocused)
                                    .onChange(of: editorFocused) { _, focused in
                                        if !focused && !dictation.isRecording {
                                            isEditingBody = false
                                        }
                                    }
                            } else {
                                ScrollView {
                                    Text(AppMarkdown.render(editText))
                                        .appBodyText()
                                        .textSelection(.enabled)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, 20)
                                        .padding(.top, 8)
                                        .padding(.bottom, 96)
                                }
                                .contentShape(Rectangle())
                                .onTapGesture {
                                    isEditingBody = true
                                    DispatchQueue.main.async { editorFocused = true }
                                }
                            }
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
            rebuildAllProjects()
            if items.indices.contains(selectedIndex) { editText = bodyText(for: items[selectedIndex]) }
        }
        .onChange(of: projectsData) { rebuildAllProjects() }
        .onChange(of: selectedIndex) {
            if items.indices.contains(selectedIndex) { editText = bodyText(for: items[selectedIndex]) }
        }
        .onChange(of: dictation.transcript) { _, newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if editTextBeforeDictation.isEmpty {
                editText = trimmed
            } else {
                let needsSeparator = !editTextBeforeDictation.hasSuffix("\n") && !editTextBeforeDictation.hasSuffix(" ")
                editText = editTextBeforeDictation + (needsSeparator ? " " : "") + trimmed
            }
        }
        .alert("Microphone access denied", isPresented: $dictation.permissionDenied) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enable Microphone and Speech Recognition in Settings to dictate.")
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Group {
                if dictation.isRecording {
                    HStack(spacing: 0) {
                        Spacer(minLength: 0)
                        DictationControls(
                            dictation: dictation,
                            onStart: {},
                            onCancel: {
                                dictation.cancel()
                                editText = editTextBeforeDictation
                            },
                            onConfirm: {
                                dictation.stop()
                            }
                        )
                        .fixedSize(horizontal: true, vertical: false)
                    }
                } else {
                    HStack(spacing: 10) {
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            showAIMenu = true
                        } label: {
                            Group {
                                if isAIProcessing {
                                    ProgressView()
                                        .controlSize(.small)
                                        .tint(AppText.primary)
                                } else {
                                    Image(systemName: "sparkles")
                                        .font(.system(size: 17, weight: .semibold))
                                        .foregroundColor(AppText.primary)
                                }
                            }
                            .frame(width: 52, height: 52)
                            .background(AppInk.solid(0.12))
                            .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .disabled(isAIProcessing)
                        .accessibilityLabel("AI actions")

                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            showChat = true
                        } label: {
                            Image(systemName: "message")
                                .font(.system(size: 17, weight: .regular))
                                .foregroundColor(AppText.primary)
                                .frame(width: 52, height: 52)
                                .background(AppInk.solid(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Ask AI chat")

                        Spacer()

                        Button {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            editTextBeforeDictation = editText
                            dictation.start()
                        } label: {
                            Image(systemName: "mic.fill")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(AppText.primary)
                                .frame(width: 52, height: 52)
                                .background(AppInk.solid(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Dictate into this content")
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(alignment: .top) {
                LinearGradient(colors: [bg.opacity(0), bg], startPoint: .top, endPoint: .bottom)
                    .frame(height: 28).offset(y: -28).allowsHitTesting(false)
            }
            .background(bg)
            .animation(.spring(response: 0.36, dampingFraction: 0.82), value: dictation.isRecording)
        }
        .sheet(isPresented: $showAIMenu) {
            AIActionsSheet { label, icon, instruction in
                showAIMenu = false
                runAITransform(instruction: instruction, label: label, icon: icon, source: editText)
            }
        }
        .sheet(isPresented: $showChat) {
            let seedID = items.indices.contains(selectedIndex) ? items[selectedIndex].id : nil
            ChatView(initialContextIDs: seedID.map { Set([$0]) } ?? [])
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
        .onAppear { chrome.hideTabBar = true }
        .onDisappear {
            chrome.hideTabBar = false
            aiTransformTask?.cancel()
            copiedResetTask?.cancel()
            dictation.stop()
        }
    }

    private func runAITransform(instruction: String, label: String, icon: String, source: String) {
        guard !isAIProcessing else { return }
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
        aiTransformTask = Task {
            let outcome = await AITransformService.transform(text: source, instruction: trimmedInstruction)
            await MainActor.run {
                // Always clear the loading flag — even on cancellation — so a
                // subsequent transform can run instead of being blocked by a
                // stuck isAIProcessing=true.
                isAIProcessing = false
                guard !Task.isCancelled else { return }
                switch outcome {
                case .success(let result):
                    aiPreviewText = result
                    if !showAIPreview { showAIPreview = true }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                case .failure(let err):
                    aiFailReason = AITransformService.isKeyConfigured
                        ? err.userMessage
                        : "Add your Anthropic API key in Profile first."
                    aiFailed = true
                }
            }
        }
    }
}

// MARK: - Profile View

private enum ProfileDestination: Hashable {
    case templates
    case templateNew
    case templateEdit(UUID)
}

private let builtInTemplates: [(title: String, subtitle: String, icon: String)] = [
    ("Landing page",     "Structured hero + sections copy",  "doc.richtext"),
    ("Short note",       "Concise single-topic summary",      "note.text"),
    ("Newsletter",       "300–500 word scannable digest",     "envelope"),
    ("LinkedIn post",    "150–300 word hook post",            "person.crop.rectangle"),
    ("Twitter thread",   "5–10 tweet thread",                 "text.bubble"),
    ("Brand story",      "Rewrite with consistent voice",     "sparkles"),
    ("Marketing pack",   "Social, email and ad copy",         "megaphone"),
    ("Review document",  "Key decisions and action items",    "checkmark.circle"),
]

struct ProfileView: View {
    /// Bound to ContentView's current tab. In Classic mode this drives the
    /// nav-path reset when the user leaves the Profile tab. In Simple mode
    /// (`isModal == true`) it lets the Layout toggle pre-select the Profile
    /// tab before dismissing, so the user keeps seeing Profile across the
    /// transition.
    @Binding var selectedTab: AppTab
    var isModal: Bool = false
    @Environment(\.dismiss) private var dismiss
    @AppStorage("custom_templates") private var customData: Data = Data()
    @AppStorage("notifications_enabled") private var notificationsEnabled: Bool = true
    @AppStorage("appearance_dark_mode") private var darkModeEnabled: Bool = true
    @AppStorage("simple_mode") private var simpleMode: Bool = false
    @AppStorage("onboarding_complete") private var onboardingComplete: Bool = false
    @State private var custom: [CustomTemplate] = []
    @State private var path: [ProfileDestination] = []
    @State private var showLogOutConfirm = false
    @State private var showKeyUpdate = false
    @State private var showOnboarding = false
    @EnvironmentObject private var chrome: ChromeController

    private let bg = AppBackground.primary
    private let logoutRed = Color(red: 0.95, green: 0.40, blue: 0.32)

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                InlineTopBar(title: "Profile") {
                    if isModal {
                        TopBarPill {
                            TopBarPillButton(systemImage: "xmark") {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                dismiss()
                            }
                            .accessibilityLabel("Close")
                        }
                    }
                }

                List {
                    SettingsRow(
                        title: "Templates",
                        trailing: .chevron
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        path.append(.templates)
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                    SettingsRow(
                        title: "Notifications",
                        trailing: .value(notificationsEnabled ? "Enabled" : "Disabled")
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        notificationsEnabled.toggle()
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                    SettingsRow(
                        title: "Appearance",
                        trailing: .value(darkModeEnabled ? "Dark mode" : "Light mode")
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        darkModeEnabled.toggle()
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                    SettingsRow(
                        title: "Layout",
                        trailing: .value(simpleMode ? "Simple" : "Standard")
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        if isModal {
                            // Simple → Classic: pre-select the Profile tab so
                            // when the cover dismisses the user lands on the
                            // (now-classic) Profile tab — preserving context.
                            selectedTab = .profile
                            simpleMode.toggle()
                            dismiss()
                        } else {
                            // Classic → Simple: ContentView's onChange will
                            // open the modal Profile so the user keeps
                            // seeing it through the transition.
                            simpleMode.toggle()
                        }
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                    SettingsRow(
                        title: "Onboarding",
                        trailing: .icon("sun.max")
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showOnboarding = true
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                    SettingsRow(
                        title: "API key",
                        trailing: .icon("key.horizontal")
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showKeyUpdate = true
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                    SettingsRow(
                        title: "Log out",
                        trailing: .icon("rectangle.portrait.and.arrow.right"),
                        titleColor: logoutRed,
                        trailingColor: logoutRed
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        showLogOutConfirm = true
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(AppInk.solid(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
            }
            .background(bg.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .onChange(of: customData, initial: true) {
                custom = (try? JSONDecoder().decode([CustomTemplate].self, from: customData)) ?? []
            }
            // Classic mode: returning to the Profile tab should land on the
            // settings root, not whatever sub-page the user pushed last time.
            // Reset the nav stack as soon as the selection leaves this tab.
            // Skip in modal mode — there's no tab swap to react to.
            .onChange(of: selectedTab) { _, new in
                if !isModal && new != .profile { path.removeAll() }
            }
            // Single source of truth for the AppTabBar: any non-empty path
            // means a settings sub-page is on screen, so hide the bar.
            // Destinations must NOT toggle hideTabBar in their own
            // onAppear/onDisappear — those interleave during a push and the
            // outgoing page's onDisappear would flip the bar back on under
            // the incoming page.
            .onChange(of: path, initial: true) { _, newPath in
                chrome.hideTabBar = !newPath.isEmpty
            }
            .onDisappear { chrome.hideTabBar = false }
            .navigationDestination(for: ProfileDestination.self) { dest in
                switch dest {
                case .templates:
                    TemplatesListPage(custom: custom, path: $path)
                case .templateNew:
                    TemplateEditPage(template: nil) { newTpl in
                        if let idx = custom.firstIndex(where: { $0.id == newTpl.id }) {
                            custom[idx] = newTpl
                        } else {
                            custom.insert(newTpl, at: 0)
                        }
                        saveCustom()
                    }
                case .templateEdit(let id):
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
            .alert("Log out?", isPresented: $showLogOutConfirm) {
                Button("Cancel", role: .cancel) {}
                Button("Log out", role: .destructive) {
                    KeychainService.delete()
                    onboardingComplete = false
                }
            } message: {
                Text("Your API key will be removed from this device.")
            }
            .sheet(isPresented: $showKeyUpdate) {
                APIKeySetupView {
                    showKeyUpdate = false
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(Radius.sheet)
                .presentationBackground(AppBackground.primary)
            }
            .fullScreenCover(isPresented: $showOnboarding) {
                OnboardingView(onGetStarted: { showOnboarding = false }, onLogin: { showOnboarding = false })
                    .preferredColorScheme(.dark)
            }
        }
    }

    private func saveCustom() {
        if case .corrupt = loadBlob([CustomTemplate].self, from: customData) { return }
        if let data = try? JSONEncoder().encode(custom) { customData = data }
    }
}

private enum SettingsRowTrailing {
    case none
    case chevron
    case value(String)
    case icon(String)
}

private struct SettingsRow: View {
    let title: String
    let trailing: SettingsRowTrailing
    var titleColor: Color = AppText.primary
    var trailingColor: Color = AppText.tertiary
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(title)
                    .font(.appRowTitle)
                    .foregroundColor(titleColor)
                Spacer(minLength: 8)
                switch trailing {
                case .none:
                    EmptyView()
                case .chevron:
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(trailingColor)
                case .value(let text):
                    HStack(spacing: 6) {
                        Text(text)
                            .font(.appLabel)
                            .foregroundColor(trailingColor)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(trailingColor)
                    }
                case .icon(let name):
                    Image(systemName: name)
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(trailingColor)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct TemplatesListPage: View {
    let custom: [CustomTemplate]
    @Binding var path: [ProfileDestination]

    @Environment(\.dismiss) private var dismiss
    private let bg = AppBackground.primary

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppText.primary)
                        .frame(width: 36, height: 36)
                        .background(AppInk.solid(0.08))
                        .clipShape(Circle())
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Text("Templates")
                    .font(.appBodyBold)
                    .foregroundColor(AppText.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer()

                TopBarPill {
                    TopBarPillButton(systemImage: "plus") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        path.append(.templateNew)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 12)

            List {
                ForEach(custom) { tpl in
                    TemplateRow(title: tpl.title)
                        .onTapGesture { path.append(.templateEdit(tpl.id)) }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(AppInk.solid(0.06))
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                }
                ForEach(builtInTemplates, id: \.title) { tpl in
                    TemplateRow(title: tpl.title)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(AppInk.solid(0.06))
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .background(bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
    }
}

private struct TemplateRow: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.appRowTitle)
            .foregroundColor(AppInk.solid(0.82))
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

    @State private var existingSubtitle: String
    @State private var prompt: String
    private let originalFormatIDs: [String]
    @State private var promptBeforeDictation: String = ""
    @State private var isEnhancing: Bool = false
    @State private var enhanceFailed: Bool = false
    @State private var enhanceFailReason: String = ""
    @StateObject private var dictation = NoteDictation()

    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: Field?

    private enum Field { case prompt }
    private let bg = AppBackground.primary
    private let amber = BrandColor.amber

    init(template: CustomTemplate?, onSave: @escaping (CustomTemplate) -> Void, onDelete: (() -> Void)? = nil) {
        self.originalID = template?.id
        self.onSave = onSave
        self.onDelete = onDelete
        _existingSubtitle = State(initialValue: template?.subtitle ?? "")
        _prompt = State(initialValue: template?.prompt ?? "")
        self.originalFormatIDs = template?.formatIDs ?? []
    }

    private var isNew: Bool { originalID == nil }

    private var canEnhance: Bool {
        !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isEnhancing
    }

    // Mirror of `Note.displayTitle`: first non-empty line of the body becomes
    // the title. Visual truncation comes from the parent view's lineLimit.
    private var derivedTitle: String {
        let firstLine = prompt.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        return firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func persist() {
        guard !derivedTitle.isEmpty else { return }
        let id = originalID ?? UUID()
        var tpl = CustomTemplate(title: derivedTitle, subtitle: existingSubtitle)
        tpl.id = id
        tpl.prompt = prompt
        tpl.formatIDs = originalFormatIDs
        onSave(tpl)

        // If there's enough body, ask the model for a tighter summary title
        // and update the saved row once it returns. The first-line derivation
        // above means the template is already in the list immediately.
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let lineCount = trimmed.split(whereSeparator: \.isNewline)
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .count
        guard trimmed.count >= 40 || lineCount >= 2 else { return }

        let snapshotPrompt = prompt
        let snapshotFormatIDs = originalFormatIDs
        let snapshotSubtitle = existingSubtitle
        let formatLabels = allFormats.filter { originalFormatIDs.contains($0.id) }.map(\.label)
        let save = onSave
        Task {
            let result = await TemplatePromptEnhancer.generateTitle(
                prompt: trimmed,
                formats: formatLabels
            )
            guard case .success(let aiTitle) = result else { return }
            var updated = CustomTemplate(title: aiTitle, subtitle: snapshotSubtitle)
            updated.id = id
            updated.prompt = snapshotPrompt
            updated.formatIDs = snapshotFormatIDs
            await MainActor.run { save(updated) }
        }
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func enhancePrompt() {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isEnhancing else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        isEnhancing = true
        let titleSnapshot = derivedTitle
        let formatLabels = allFormats.filter { originalFormatIDs.contains($0.id) }.map(\.label)
        Task {
            let result = await TemplatePromptEnhancer.enhance(
                title: titleSnapshot,
                currentPrompt: trimmed,
                formats: formatLabels
            )
            await MainActor.run {
                isEnhancing = false
                switch result {
                case .success(let improved):
                    withAnimation(.easeOut(duration: 0.2)) { prompt = improved }
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                case .failure(let err):
                    enhanceFailReason = err.userMessage
                    enhanceFailed = true
                }
            }
        }
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
                            .foregroundColor(AppText.primary)
                            .frame(width: 36, height: 36)
                            .background(AppInk.solid(0.08))
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
                                .background(AppInk.solid(0.08))
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
                    VStack(alignment: .leading, spacing: 32) {
                        // Title is derived from the first line of the prompt
                        // (same rule as `Note.displayTitle`).
                        Text(derivedTitle.isEmpty ? "Untitled" : derivedTitle)
                            .font(.appTitle)
                            .foregroundColor(derivedTitle.isEmpty ? AppText.disabled : AppText.primary)
                            .lineLimit(3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                            .animation(AppAnimation.quick, value: derivedTitle)

                        // TextField with axis:.vertical grows with content
                        // and lets the page-level ScrollView handle scrolling.
                        // TextEditor here would engage its own scroll and
                        // fight the parent for scroll gestures.
                        TextField(
                            text: $prompt,
                            axis: .vertical
                        ) {
                            Text("Describe what this template should produce\u{2026}")
                                .foregroundColor(AppText.muted)
                        }
                        .appBodyText()
                        .tint(AppText.primary)
                        .padding(.horizontal, 20)
                        .focused($focus, equals: .prompt)
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 96)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar
        }
        .onChange(of: dictation.transcript) { _, newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if promptBeforeDictation.isEmpty {
                prompt = trimmed
            } else {
                let needsSeparator = !promptBeforeDictation.hasSuffix("\n") && !promptBeforeDictation.hasSuffix(" ")
                prompt = promptBeforeDictation + (needsSeparator ? " " : "") + trimmed
            }
        }
        .alert("Microphone access denied", isPresented: $dictation.permissionDenied) {
            Button("Open Settings") { openSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enable Microphone and Speech Recognition in Settings to dictate.")
        }
        .alert("Couldn't enhance prompt", isPresented: $enhanceFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(enhanceFailReason)
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .onDisappear {
            dictation.stop()
            persist()
        }
    }

    private var bottomBar: some View {
        HStack(alignment: .center, spacing: 12) {
            Button(action: enhancePrompt) {
                HStack(spacing: 6) {
                    if isEnhancing {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .controlSize(.mini)
                            .tint(amber)
                    } else {
                        Image(systemName: "wand.and.stars")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    Text(isEnhancing ? "Enhancing\u{2026}" : "Enhance prompt")
                        .font(.appSubtextMedium)
                }
                .foregroundColor(canEnhance ? amber : AppInk.solid(0.30))
                .padding(.horizontal, 18)
                .frame(height: 56)
                .background(
                    Capsule(style: .continuous)
                        .fill(.regularMaterial)
                        .overlay(
                            Capsule().stroke(
                                AppInk.solid(0.15),
                                lineWidth: 0.5
                            )
                        )
                        .shadow(color: Color.black.opacity(0.22), radius: 10, y: 3)
                        .opacity(canEnhance ? 1.0 : 0.6)
                )
            }
            .buttonStyle(.plain)
            .disabled(!canEnhance)
            .animation(AppAnimation.quick, value: canEnhance)

            Spacer(minLength: 8)

            DictationControls(
                dictation: dictation,
                onStart: {
                    promptBeforeDictation = prompt
                    dictation.start()
                },
                onCancel: {
                    dictation.cancel()
                    prompt = promptBeforeDictation
                },
                onConfirm: {
                    dictation.stop()
                }
            )
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .background(
            LinearGradient(
                colors: [bg.opacity(0), bg],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
}

private struct TemplatePromptEnhancer {
    static func enhance(title: String, currentPrompt: String, formats: [String]) async -> Result<String, APICallError> {
        guard let apiKey = KeychainService.load(), !apiKey.isEmpty,
              let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            return .failure(.http(401, "Missing API key"))
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 60

        let system = "You rewrite content-generation template prompts so an AI can follow them reliably. Keep the user's intent, voice, and any concrete requirements they specified. Make the instructions clearer, more specific, and actionable — never add new requirements they didn't imply. Output only the improved prompt text, no preamble, no quotes, no explanation."

        var userParts: [String] = []
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedTitle.isEmpty { userParts.append("Template name: \(trimmedTitle)") }
        if !formats.isEmpty { userParts.append("Target output formats: \(formats.joined(separator: ", "))") }
        userParts.append("Draft instructions:\n\n\(currentPrompt)")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 600,
            "system": system,
            "messages": [["role": "user", "content": userParts.joined(separator: "\n\n")]]
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

    static func generateTitle(prompt: String, formats: [String]) async -> Result<String, APICallError> {
        guard let apiKey = KeychainService.load(), !apiKey.isEmpty,
              let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            return .failure(.http(401, "Missing API key"))
        }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 30

        // Same titling rules as `AIService.titleSystemPrompt`, specialized for
        // prompt templates — the title names what the template *produces*, so
        // the user can scan a list of templates and pick the right one.
        let system = """
        You title content-generation prompt templates. The title sits in a list of templates the user picks from, so it has to name what the template produces.

        Output exactly one title and nothing else:
        - 3 to 7 words
        - Sentence case: capitalize the first word and proper nouns only
        - No quotes, no trailing punctuation, no emoji, no preamble
        - No em-dashes; use a colon if you need separation

        Lead with the concrete output. "LinkedIn hook post from research notes" beats "Template for posts." Two templates with neighboring purposes should get titles you can tell apart.

        Avoid: generic openers ("Template for", "Prompt to"), throat-clearing ("some", "various"), filler adjectives ("powerful", "useful", "quick"), and the literal word "template" or "prompt" — the user already knows it's one.
        """

        var userParts: [String] = []
        if !formats.isEmpty { userParts.append("Target output formats: \(formats.joined(separator: ", "))") }
        userParts.append("Draft instructions:\n\n\(prompt)")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 30,
            "system": system,
            "messages": [["role": "user", "content": userParts.joined(separator: "\n\n")]]
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

        let cleaned = AIService.sanitize(text)
        return cleaned.isEmpty ? .failure(.empty) : .success(cleaned)
    }
}

// MARK: - Classic Tab Bar (4 tabs)

private struct ClassicAppTabBar: View {
    @Binding var selected: AppTab
    let pillNS: Namespace.ID

    @State private var impact = UIImpactFeedbackGenerator(style: .light)

    private let mainItems: [(AppTab, String, String)] = [
        (.notes,     "doc.text",   "Notes"),
        (.library,   "book.closed", "Library"),
        (.profile,   "person.crop.circle", "Profile"),
    ]

    private static let selectSpring = Animation.spring(response: 0.34, dampingFraction: 0.86)

    var body: some View {
        HStack(spacing: 12) {
            HStack(spacing: 4) {
                ForEach(mainItems, id: \.0.rawValue) { tab, icon, label in
                    Button {
                        impact.impactOccurred()
                        withAnimation(Self.selectSpring) {
                            selected = tab
                        }
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: icon)
                                .symbolVariant(selected == tab ? .fill : .none)
                                .font(.system(size: 19, weight: .regular))
                                .transaction { $0.animation = nil }
                            Text(label)
                                .font(.system(size: 11, weight: .regular))
                        }
                        .foregroundColor(selected == tab ? AppText.primary : AppInk.solid(0.45))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(
                            ZStack {
                                if selected == tab {
                                    Capsule(style: .continuous)
                                        .fill(AppInk.solid(0.14))
                                        .overlay(
                                            Capsule(style: .continuous)
                                                .stroke(AppInk.solid(0.18), lineWidth: 0.5)
                                        )
                                        .padding(.horizontal, 2)
                                        .padding(.vertical, 1)
                                        .matchedGeometryEffect(id: "tabPill", in: pillNS)
                                }
                            }
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(label)
                    .accessibilityAddTraits(selected == tab ? [.isButton, .isSelected] : .isButton)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 6)
            .appLiquidGlass(in: Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [AppInk.solid(0.28), AppInk.solid(0.08)],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 0.5
                    )
            )

            Button {
                impact.impactOccurred()
                withAnimation(Self.selectSpring) {
                    selected = .create
                }
            } label: {
                let isActive = selected == .create
                Image(systemName: "plus")
                    .font(.system(size: 19, weight: .regular))
                    .foregroundColor(AppText.primary)
                    .frame(width: 60, height: 60)
                    .background(
                        Circle().fill(AppInk.solid(isActive ? 0.14 : 0))
                    )
                    .appLiquidGlass(in: Circle())
                    .overlay(
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        AppInk.solid(isActive ? 0.40 : 0.28),
                                        AppInk.solid(isActive ? 0.14 : 0.08)
                                    ],
                                    startPoint: .top,
                                    endPoint: .bottom
                                ),
                                lineWidth: 0.5
                            )
                    )
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Create")
            .accessibilityAddTraits(selected == .create ? [.isButton, .isSelected] : .isButton)
        }
        .onAppear { impact.prepare() }
    }
}

// MARK: - Simple Home Page (Notes + Library on one screen)

/// The Simple-mode "home" — a single page with top segmented tabs
/// (Notes / Library) and a Profile icon, hosting the embedded NotesView
/// or LibraryView below. The bottom bar contributes only the plus button.
private struct SimpleHomePage: View {
    var newNoteTrigger: Int = 0
    var onProfileTap: () -> Void = {}

    @State private var section: AppTab = .notes
    @State private var showSearch = false
    @State private var searchText = ""
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                AmbientBackground()

                VStack(spacing: 0) {
                    SimpleHomeHeader(
                        section: $section,
                        showSearch: $showSearch,
                        searchText: $searchText,
                        searchFocused: $searchFocused,
                        onProfileTap: onProfileTap,
                        onSearchToggle: {
                            withAnimation(AppAnimation.standard) {
                                showSearch.toggle()
                                if !showSearch { searchText = "" }
                            }
                            // Focus is owned by the header now; flip it
                            // alongside the toggle so the keyboard rises on
                            // entry and dismisses on exit.
                            if showSearch {
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                                    searchFocused = true
                                }
                            } else {
                                searchFocused = false
                            }
                        }
                    )

                    Rectangle()
                        .fill(AppInk.solid(0.06))
                        .frame(height: 0.5)

                    Group {
                        if section == .notes {
                            NotesView(
                                newNoteTrigger: newNoteTrigger,
                                embedded: true,
                                externalShowSearch: $showSearch,
                                externalSearchText: $searchText
                            )
                        } else {
                            LibraryView(
                                embedded: true,
                                externalShowSearch: $showSearch,
                                externalSearchText: $searchText
                            )
                        }
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        // Section change should not leak stale search state from the
        // previously-active section.
        .onChange(of: section) { _, _ in
            withAnimation(AppAnimation.standard) {
                showSearch = false
                searchText = ""
            }
            searchFocused = false
        }
    }
}

private struct SimpleHomeHeader: View {
    @Binding var section: AppTab
    @Binding var showSearch: Bool
    @Binding var searchText: String
    var searchFocused: FocusState<Bool>.Binding
    let onProfileTap: () -> Void
    let onSearchToggle: () -> Void

    private static let selectSpring = Animation.spring(response: 0.34, dampingFraction: 0.86)

    var body: some View {
        HStack(spacing: 12) {
            if showSearch {
                AppSearchField(
                    placeholder: section == .notes ? "Search notes" : "Search library",
                    text: $searchText,
                    isFocused: searchFocused
                )

                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    onSearchToggle()
                } label: {
                    Text("Cancel")
                        .font(.appLabel)
                        .foregroundColor(AppText.primary)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 10)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cancel search")
            } else {
                segmentedTabs
                Spacer(minLength: 8)
                TopBarPill {
                    TopBarPillButton(
                        systemImage: "magnifyingglass",
                        isActive: false
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onSearchToggle()
                    }
                    .accessibilityLabel("Search")
                }
                TopBarPill {
                    TopBarPillButton(systemImage: "person.crop.circle") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onProfileTap()
                    }
                    .accessibilityLabel("Profile")
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .animation(AppAnimation.standard, value: showSearch)
    }

    private var segmentedTabs: some View {
        HStack(spacing: 4) {
            segment(.notes, label: "Notes")
            segment(.library, label: "Library")
        }
        .padding(4)
        .appLiquidGlass(in: Capsule(style: .continuous))
        .overlay(
            Capsule(style: .continuous)
                .stroke(AppInk.solid(0.12), lineWidth: 0.5)
        )
    }

    @ViewBuilder
    private func segment(_ tab: AppTab, label: String) -> some View {
        let selected = section == tab
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(Self.selectSpring) { section = tab }
        } label: {
            Text(label)
                .font(.system(size: 14, weight: .semibold))
                // White text on the active pill — same contrast pair the
                // FilterChip "All" uses, so both highlighted controls on
                // this page share a single selection idiom.
                .foregroundColor(selected ? .white : AppText.tertiary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    Capsule(style: .continuous)
                        // BrandColor.amber is the brand "lifted" fill —
                        // matches the selected FilterChip pill above the
                        // list. Drops the dark `AppBackground.surface` fill
                        // that read as a charcoal-grey submerged tab.
                        .fill(selected ? BrandColor.amber : Color.clear)
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - Simple bottom create button

/// Bottom chrome in Simple mode: a single floating capture button parked
/// at the bottom-right corner. Tapping it begins voice recording right
/// away — no intermediate menu. Styled as a flat amber-tinted glass disc
/// with `livephoto` concentric rings as the glyph (recorder-coded but
/// visually distinct from the typical mic / record-dot icons).
private struct SimpleCreateBar: View {
    let onTap: () -> Void

    @State private var impact = UIImpactFeedbackGenerator(style: .light)

    var body: some View {
        HStack(spacing: 0) {
            Spacer()
            captureButton
        }
    }

    private var captureButton: some View {
        Button {
            impact.impactOccurred()
            onTap()
        } label: {
            // waveform.and.mic = a microphone paired with a waveform —
            // reads as "voice recorder" at a glance, distinct from the
            // bare `mic.fill` glyph used inline elsewhere in the app.
            Image(systemName: "waveform.and.mic")
                .font(.system(size: 24, weight: .regular))
                .foregroundColor(BrandColor.amber)
                .frame(width: 64, height: 64)
                .background(Circle().fill(BrandColor.amber.opacity(0.12)))
                .appLiquidGlass(in: Circle())
                .overlay(
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [
                                    BrandColor.amber.opacity(0.42),
                                    BrandColor.amber.opacity(0.12)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            ),
                            lineWidth: 0.6
                        )
                )
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Record a note")
        .onAppear { impact.prepare() }
    }
}

// MARK: - Content View

struct ContentView: View {
    @AppStorage("simple_mode") private var simpleMode: Bool = false
    @State private var selectedTab: AppTab = .notes
    @State private var keyboardVisible = false
    @State private var showProfile = false
    @State private var newNoteTrigger = 0
    @StateObject private var bannerController = BannerController()
    @StateObject private var chromeController = ChromeController()
    @StateObject private var recordingController = RecordingController()
    @Namespace private var tabPillNS

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .top) {
            tabsLayer
                .environmentObject(bannerController)
                .environmentObject(chromeController)
                .environmentObject(recordingController)
                .sheet(isPresented: $recordingController.showingSheet) {
                    NoteVoiceSheet()
                        .environmentObject(recordingController)
                }
                .fullScreenCover(isPresented: $showProfile) {
                    ProfileView(selectedTab: $selectedTab, isModal: true)
                        .environmentObject(chromeController)
                }
                // Tab bar is the inner inset (anchored at screen bottom).
                // Mini bar is the outer inset (stacks above the tab bar naturally).
                // This ordering ensures correct visual stacking on all iOS versions:
                // outer inset content appears above inner inset content.
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if !keyboardVisible && !chromeController.hideTabBar {
                        Group {
                            if simpleMode {
                                SimpleCreateBar(onTap: {
                                    selectedTab = .notes
                                    newNoteTrigger &+= 1
                                })
                            } else {
                                ClassicAppTabBar(selected: $selectedTab, pillNS: tabPillNS)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 6)
                    }
                }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                let show = (recordingController.isRecording || recordingController.isPaused) && !recordingController.showingSheet
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
                // safeAreaInset content is rendered as a sibling layer to the
                // modified view, so it does NOT inherit the .environmentObject
                // applied to the TabView above. Without this explicit forward,
                // RecordingMiniBar's @EnvironmentObject lookup fatal-errors on
                // launch ("No ObservableObject of type RecordingController
                // found").
                .environmentObject(recordingController)
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .padding(.bottom, 8)
                .opacity(show ? 1 : 0)
                .frame(height: show ? nil : 0, alignment: .top)
                .clipped()
                .animation(.spring(response: 0.38, dampingFraction: 0.82), value: show)
                .transaction { $0.disablesAnimations = !show && recordingController.showingSheet }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                keyboardVisible = true
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                keyboardVisible = false
            }

            if bannerController.isVisible {
                GenerationBanner(
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
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: bannerController.isVisible)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: recordingController.isRecording)
        .onChange(of: simpleMode) { _, isSimple in
            if isSimple {
                // Classic → Simple. Simple's TabView doesn't include
                // .create / .profile, so move the user off those tabs.
                // For Profile we also re-open it as the Simple-mode modal
                // so the screen they were on stays visible across the
                // transition. The Simple → Classic direction is handled
                // in ProfileView's Layout row, which pre-selects the
                // Profile tab before dismissing the modal.
                if selectedTab == .profile {
                    selectedTab = .notes
                    showProfile = true
                } else if selectedTab == .create {
                    selectedTab = .notes
                }
            } else {
                // Tear down any Simple-only chrome left over from the
                // previous mode.
                showProfile = false
            }
        }
    }

    @ViewBuilder
    private var tabsLayer: some View {
        if simpleMode {
            SimpleHomePage(
                newNoteTrigger: newNoteTrigger,
                onProfileTap: { showProfile = true }
            )
        } else {
            TabView(selection: $selectedTab) {
                NotesView().tag(AppTab.notes)
                HomeView().tag(AppTab.create)
                LibraryView().tag(AppTab.library)
                ProfileView(selectedTab: $selectedTab).tag(AppTab.profile)
            }
        }
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
                    .foregroundColor(AppText.primary)
                Text(timeLabel)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(AppText.secondary)
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
                    .fill(AppBackground.capsule)
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
            .onAppear { pulse = active }
            .onChange(of: active) { _, newActive in pulse = newActive }
    }
}

// MARK: - Top bar primitives

struct TopBarPill<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        HStack(spacing: 0) { content() }
            .background(
                Capsule(style: .continuous)
                    .fill(AppInk.solid(0.08))
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(AppInk.solid(0.10), lineWidth: 0.5)
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
                .topBarPillLabel(isActive: isActive)
        }
        .buttonStyle(.plain)
    }
}

struct TopBarPillDivider: View {
    var body: some View {
        Rectangle()
            .fill(AppInk.solid(0.10))
            .frame(width: 0.5, height: 18)
    }
}

extension View {
    /// Styles a glyph to sit inside a `TopBarPill` as one of its segments.
    /// Use this for `Menu` / `ShareLink` labels where `TopBarPillButton`'s
    /// action-only API doesn't fit.
    func topBarPillLabel(isActive: Bool = false) -> some View {
        self
            .font(.system(size: 18, weight: .regular))
            .foregroundColor(AppText.primary)
            .frame(width: 44, height: 38)
            .background(isActive ? AppInk.solid(0.12) : Color.clear)
            .clipShape(Capsule())
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
                .font(.app(size: 26, weight: .bold))
                .foregroundColor(AppText.primary)
                .fixedSize(horizontal: true, vertical: false)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 8)
            trailing()
        }
        .padding(.horizontal, 20)
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
                .foregroundColor(AppInk.solid(0.45))
            TextField(placeholder, text: $text)
                .font(.appLabel)
                .foregroundColor(AppText.primary)
                .tint(AppText.primary)
                .focused(isFocused)
                .submitLabel(submitLabel)
                .onSubmit { onSubmit?() }
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.appSubtext)
                        .foregroundColor(AppInk.solid(0.40))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(
            Capsule(style: .continuous)
                .fill(AppInk.solid(0.08))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(AppInk.solid(0.14), lineWidth: 0.5)
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

    private let sheetBg = AppBackground.primary

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text(title)
                    .font(.appBodyBold)
                    .foregroundColor(AppText.primary)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppText.secondary)
                        .frame(width: 30, height: 30)
                        .background(AppInk.solid(0.10))
                        .clipShape(Circle())
                        .appIconHitArea()
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
        .presentationCornerRadius(Radius.sheet)
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
    var onCancel: (() -> Void)? = nil
    /// When true, the host (e.g. SimpleHomeHeader) already renders the search
    /// field inline in the top bar, so this overlay just supplies the blurred
    /// surface and results below. Keeps focus management with the host.
    var omitField: Bool = false
    @ViewBuilder var results: () -> Results

    var body: some View {
        ZStack(alignment: .top) {
            // `.regularMaterial` matches the standard iOS `.searchable`
            // pattern — translucent blur over the underlying chrome rather
            // than an opaque card. The ambient background's amber radial
            // tints bleed through, giving the surface a sense of depth.
            Rectangle()
                .fill(.regularMaterial)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                if !omitField {
                    HStack(spacing: 10) {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.appLabel)
                                .foregroundColor(AppInk.solid(0.45))
                            TextField(placeholder, text: $query)
                                .font(.appLabel)
                                .foregroundColor(AppText.primary)
                                .tint(AppText.primary)
                                .focused(isFocused)
                                .submitLabel(.search)
                            if !query.isEmpty {
                                Button { query = "" } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.appSubtext)
                                        .foregroundColor(AppInk.solid(0.40))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Clear search")
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(
                            Capsule(style: .continuous)
                                .fill(AppInk.solid(0.10))
                                .overlay(
                                    Capsule(style: .continuous)
                                        .stroke(AppInk.solid(0.14), lineWidth: 0.5)
                                )
                        )

                        if let onCancel {
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                isFocused.wrappedValue = false
                                onCancel()
                            } label: {
                                Text("Cancel")
                                    .font(.appLabel)
                                    .foregroundColor(AppText.primary)
                                    .padding(.horizontal, 4)
                                    .padding(.vertical, 10)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Cancel search")
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 10)
                    .padding(.bottom, 12)
                }

                results()
            }
        }
        .onAppear {
            // Host owns focus when the field is inline; don't fight it.
            guard !omitField else { return }
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
    AIAction(label: "Explain This in Simple Terms", icon: "lightbulb", instruction: "Rewrite this so a smart non-expert can understand it easily. Keep it concise."),
    AIAction(label: "Make Shorter", icon: "text.alignleft", instruction: "Shorten this while preserving the key points. Aim for roughly half the length."),
    AIAction(label: "Change Tone to Professional", icon: "bubble.left", instruction: "Rewrite this in a polished, professional tone suitable for a business context."),
]

struct AIActionsSheet: View {
    let onAction: (_ label: String, _ icon: String, _ instruction: String) -> Void

    private let sheetBg = AppBackground.primary

    private var fittedHeight: CGFloat {
        let rowHeight: CGFloat = 52
        let rowSpacing: CGFloat = 2
        let count = CGFloat(quickAIActions.count)
        return rowHeight * count
            + rowSpacing * max(0, count - 1)
            + 32  // top padding
            + 24  // bottom padding
            + 24  // drag indicator
    }

    var body: some View {
        VStack(spacing: 2) {
            ForEach(quickAIActions) { action in
                actionRow(action)
            }
        }
        .padding(.top, 32)
        .padding(.bottom, 24)
        .frame(maxWidth: .infinity, alignment: .top)
        .background(sheetBg)
        .presentationBackground(sheetBg)
        .presentationCornerRadius(32)
        .presentationDetents([.height(fittedHeight)])
        .presentationDragIndicator(.visible)
    }

    private func actionRow(_ action: AIAction) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onAction(action.label, action.icon, action.instruction)
        } label: {
            HStack(spacing: 14) {
                Image(systemName: action.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppInk.solid(0.85))
                    .frame(width: 36, height: 36)
                    .background(AppInk.solid(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                Text(action.label)
                    .font(.appBody)
                    .foregroundColor(AppInk.solid(0.92))
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

    private let sheetBg = AppBackground.primary

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: actionIcon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppInk.solid(0.85))
                    .frame(width: 36, height: 36)
                    .background(AppInk.solid(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                Text(actionLabel)
                    .font(.appBodyBold)
                    .foregroundColor(AppText.primary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppText.secondary)
                        .frame(width: 30, height: 30)
                        .background(AppInk.solid(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            ZStack {
                ScrollView(showsIndicators: false) {
                    Text(previewText.isEmpty ? AttributedString(" ") : AppMarkdown.render(previewText))
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
                        .foregroundColor(AppInk.solid(0.70))
                        .frame(width: 40, height: 40)
                        .background(AppInk.solid(0.10))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(isLoading)

                Spacer()

                Button {
                    onCopy()
                    withAnimation(AppAnimation.quick) { didCopy = true }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        withAnimation { didCopy = false }
                    }
                } label: {
                    Text(didCopy ? "Copied" : "Copy")
                        .font(.app(size: 15, weight: .semibold))
                        .foregroundColor(AppText.primary)
                        .padding(.horizontal, 20)
                        .frame(height: 40)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(AppInk.solid(0.06))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(AppInk.solid(0.13), lineWidth: 0.5)
                        )
                }
                .buttonStyle(.plain)
                .disabled(isLoading)

                Button(action: onApply) {
                    Text("Apply")
                        .font(.app(size: 15, weight: .semibold))
                        .foregroundColor(.black)
                        .padding(.horizontal, 20)
                        .frame(height: 40)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(.white)
                        )
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
        .presentationCornerRadius(Radius.sheet)
        // Let the inner ScrollView consume vertical pans first so the user
        // can read long previews without the sheet jumping to its large
        // detent on every swipe up.
        .presentationContentInteraction(.scrolls)
    }
}

#Preview {
    ContentView()
}

// MARK: - Markdown rendering

enum AppMarkdown {
    static func render(_ raw: String) -> AttributedString {
        let processed = promoteHeadersToBold(raw)
        let opts = AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .inlineOnlyPreservingWhitespace
        )
        if let attr = try? AttributedString(markdown: processed, options: opts) {
            return attr
        }
        return AttributedString(raw)
    }

    // The inline-only markdown parser doesn't understand "## Header" lines,
    // so we rewrite them as **Header** before parsing. That way users see a
    // bolded header instead of literal hashes.
    private static func promoteHeadersToBold(_ raw: String) -> String {
        raw.split(separator: "\n", omittingEmptySubsequences: false)
            .map(boldedHeaderLine)
            .joined(separator: "\n")
    }

    private static func boldedHeaderLine(_ line: Substring) -> String {
        var idx = line.startIndex
        while idx < line.endIndex, line[idx] == " " { idx = line.index(after: idx) }
        let indent = line[line.startIndex..<idx]
        let rest = line[idx...]
        var hashCount = 0
        var cursor = rest.startIndex
        while cursor < rest.endIndex, rest[cursor] == "#", hashCount < 6 {
            hashCount += 1
            cursor = rest.index(after: cursor)
        }
        guard hashCount >= 1,
              cursor < rest.endIndex,
              rest[cursor] == " "
        else { return String(line) }
        let content = rest[rest.index(after: cursor)...]
            .trimmingCharacters(in: .whitespaces)
        guard !content.isEmpty else { return String(line) }
        if content.hasPrefix("**") && content.hasSuffix("**") {
            return "\(indent)\(content)"
        }
        return "\(indent)**\(content)**"
    }
}
