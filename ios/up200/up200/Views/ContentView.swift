import SwiftUI

// MARK: - App Tab

enum AppTab: String {
    case notes, create, library, profile
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
                                // Keep the focus assignment OUT of withAnimation
                                // — pulling a FocusState change into the
                                // animation context makes SwiftUI animate the
                                // keyboard appearance with the same easeInOut,
                                // which drags the overlay layout up from the
                                // bottom instead of letting it fade in cleanly.
                                // SearchOverlay's onAppear handles focus.
                                withAnimation(AppAnimation.standard) {
                                    showSearch.toggle()
                                    if !showSearch { searchText = "" }
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
                .animation(AppAnimation.standard, value: showSearch)
                // The library list never owns the keyboard (only the SearchOverlay
                // does), so don't let the keyboard's safe-area inset reshape the
                // list. Without this, Cancel-ing search makes the keyboard
                // descend and the list's bottom edge animates outward — which
                // reads as content jumping up from below during the overlay fade.
                .ignoresSafeArea(.keyboard)

                if showSearch {
                    SearchOverlay(
                        query: $searchText,
                        placeholder: "Search library",
                        isFocused: $searchFocused,
                        onCancel: {
                            withAnimation(AppAnimation.standard) {
                                showSearch = false
                                searchText = ""
                            }
                        }
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
                    .font(.appRowTitle)
                    .foregroundColor(Color.white.opacity(0.88))
                    .lineLimit(1)
                Text("\(outputTypesList(items)) · \(libraryRelativeTime(items.first?.date ?? Date()))")
                    .font(.appMicro)
                    .foregroundColor(AppText.tertiary)
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

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

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
                            .background(Color.white.opacity(0.08))
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
                                        .foregroundColor(selectedIndex == idx ? .white : Color.white.opacity(0.45))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 7)
                                        .background(selectedIndex == idx ? Color.white.opacity(0.12) : Color.clear)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(selectedIndex == idx ? Color.white.opacity(0.20) : Color.clear, lineWidth: 0.5))
                                }
                                .buttonStyle(.plain)
                                .animation(AppAnimation.quick, value: selectedIndex)
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
                                    .tint(.white)
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
                    .frame(maxWidth: .infinity)
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
                                        .tint(.white)
                                } else {
                                    Image(systemName: "sparkles")
                                        .font(.system(size: 17, weight: .semibold))
                                        .foregroundColor(AppText.primary)
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
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            showChat = true
                        } label: {
                            Image(systemName: "bubble.left.and.text.bubble.right")
                                .font(.system(size: 17, weight: .semibold))
                                .foregroundColor(AppText.primary)
                                .frame(width: 52, height: 52)
                                .background(Color.white.opacity(0.12))
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
                                .background(Color.white.opacity(0.12))
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
                        : "Add your Anthropic API key in the Create tab first."
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
    @AppStorage("custom_templates") private var customData: Data = Data()
    @AppStorage("notifications_enabled") private var notificationsEnabled: Bool = true
    @AppStorage("onboarding_complete") private var onboardingComplete: Bool = false
    @State private var custom: [CustomTemplate] = []
    @State private var path: [ProfileDestination] = []
    @State private var showLogOutConfirm = false

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)
    private let logoutRed = Color(red: 0.95, green: 0.40, blue: 0.32)

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 0) {
                InlineTopBar(title: "Profile") { EmptyView() }

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
                    .listRowSeparatorTint(Color.white.opacity(0.06))
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
                    .listRowSeparatorTint(Color.white.opacity(0.06))
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
                    .listRowSeparatorTint(Color.white.opacity(0.06))
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
            .navigationDestination(for: ProfileDestination.self) { dest in
                switch dest {
                case .templates:
                    TemplatesListPage(custom: custom, path: $path)
                case .templateNew:
                    TemplateEditPage(template: nil) { newTpl in
                        custom.insert(newTpl, at: 0)
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

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    var body: some View {
        VStack(spacing: 0) {
            InlineTopBar(title: "Templates") {
                TopBarPill {
                    TopBarPillButton(systemImage: "plus") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        path.append(.templateNew)
                    }
                }
            }

            List {
                ForEach(custom) { tpl in
                    TemplateRow(title: tpl.title)
                        .onTapGesture { path.append(.templateEdit(tpl.id)) }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(Color.white.opacity(0.06))
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                }
                ForEach(builtInTemplates, id: \.title) { tpl in
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
    @State private var promptBeforeDictation: String = ""
    @State private var isEnhancing: Bool = false
    @State private var enhanceFailed: Bool = false
    @State private var enhanceFailReason: String = ""
    @StateObject private var dictation = NoteDictation()

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController
    @FocusState private var focus: Field?

    private enum Field { case prompt }
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

    private var canEnhance: Bool {
        !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isEnhancing
    }

    private func persist() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPrompt = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalTitle: String
        if !trimmedTitle.isEmpty {
            finalTitle = trimmedTitle
        } else if !trimmedPrompt.isEmpty {
            finalTitle = Self.fallbackTitle(from: trimmedPrompt)
        } else {
            return
        }
        var tpl = CustomTemplate(title: finalTitle, subtitle: existingSubtitle)
        if let id = originalID { tpl.id = id }
        tpl.prompt = prompt
        tpl.formatIDs = Array(formatIDs)
        onSave(tpl)
    }

    private static func fallbackTitle(from prompt: String) -> String {
        let words = prompt.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).map(String.init)
        let pick = words.prefix(5).joined(separator: " ")
        let cleaned = pick.trimmingCharacters(in: .punctuationCharacters)
        return cleaned.isEmpty ? "Untitled template" : String(cleaned.prefix(48))
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
        let titleSnapshot = title
        let formatLabels = allFormats.filter { formatIDs.contains($0.id) }.map(\.label)
        Task {
            async let promptResult = TemplatePromptEnhancer.enhance(
                title: titleSnapshot,
                currentPrompt: trimmed,
                formats: formatLabels
            )
            async let titleResult = TemplatePromptEnhancer.generateTitle(
                prompt: trimmed,
                formats: formatLabels
            )
            let (p, t) = await (promptResult, titleResult)
            await MainActor.run {
                isEnhancing = false
                switch p {
                case .success(let improved):
                    withAnimation(.easeOut(duration: 0.2)) { prompt = improved }
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                case .failure(let err):
                    enhanceFailReason = err.userMessage
                    enhanceFailed = true
                }
                if case .success(let newTitle) = t {
                    withAnimation(.easeOut(duration: 0.2)) { title = newTitle }
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
                    VStack(alignment: .leading, spacing: 32) {
                        // Auto-generated title
                        Text(title.isEmpty ? "Untitled" : title)
                            .font(.appTitle)
                            .foregroundColor(title.isEmpty ? AppText.disabled : AppText.primary)
                            .lineLimit(3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 20)
                            .animation(AppAnimation.quick, value: title)

                        // Merged prompt + format tags
                        VStack(alignment: .leading, spacing: 12) {
                            TemplateTagFlow(items: allFormats, selectedIDs: $formatIDs)
                                .padding(.horizontal, 20)

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
                            .tint(.white)
                            .padding(.horizontal, 20)
                            .focused($focus, equals: .prompt)
                        }
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
        .onAppear { chrome.hideTabBar = true }
        .onDisappear {
            chrome.hideTabBar = false
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
                .foregroundColor(canEnhance ? amber : Color.white.opacity(0.30))
                .padding(.horizontal, 18)
                .frame(height: 56)
                .background(
                    Capsule(style: .continuous)
                        .fill(.regularMaterial)
                        .overlay(
                            Capsule().stroke(
                                Color.white.opacity(0.15),
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

        let system = "You name content-generation prompt templates. Read the draft instructions and return a short, descriptive title that captures what the template produces. Title Case, 2–5 words, no quotes, no trailing punctuation, no preamble. Output only the title."

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

        let cleaned = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "\"'“”‘’`.,"))
        return cleaned.isEmpty ? .failure(.empty) : .success(cleaned)
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
                    withAnimation(AppAnimation.quick) {
                        if selected { selectedIDs.remove(fmt.id) }
                        else { selectedIDs.insert(fmt.id) }
                    }
                } label: {
                    Text(fmt.label)
                        .font(.app(size: 14, weight: selected ? .semibold : .regular))
                        .foregroundColor(selected ? .white : AppText.secondary)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selected ? Color.white.opacity(0.14) : Color.white.opacity(0.07))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(selected ? Color.white.opacity(0.30) : Color.white.opacity(0.10), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                .animation(AppAnimation.quick, value: selected)
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
    let pillNS: Namespace.ID

    @State private var impact = UIImpactFeedbackGenerator(style: .light)

    private let mainItems: [(AppTab, String, String)] = [
        (.notes,     "doc.text",   "Notes"),
        (.library,   "book.closed", "Library"),
        (.profile,   "person.crop.circle", "Profile"),
    ]

    private static let selectSpring = Animation.spring(response: 0.34, dampingFraction: 0.86)

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(mainItems, id: \.0.rawValue) { tab, icon, label in
                    Button {
                        impact.impactOccurred()
                        withAnimation(Self.selectSpring) {
                            selected = tab
                        }
                    } label: {
                        VStack(spacing: 2) {
                            Image(systemName: icon)
                                .symbolVariant(selected == tab ? .fill : .none)
                                .font(.system(size: 17, weight: .regular))
                                .transaction { $0.animation = nil }
                            Text(label)
                                .font(.system(size: 10, weight: .regular))
                        }
                        .foregroundColor(selected == tab ? .white : Color.white.opacity(0.45))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(
                            ZStack {
                                if selected == tab {
                                    Capsule(style: .continuous)
                                        .fill(Color.white.opacity(0.14))
                                        .overlay(
                                            Capsule(style: .continuous)
                                                .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
                                        )
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
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
            .appLiquidGlass(in: Capsule(style: .continuous))
            .overlay(
                Capsule(style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.28), Color.white.opacity(0.08)],
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
                    .font(.system(size: 17, weight: .regular))
                    .foregroundColor(AppText.primary)
                    .frame(width: 50, height: 50)
                    .background(
                        Circle().fill(Color.white.opacity(isActive ? 0.14 : 0))
                    )
                    .appLiquidGlass(in: Circle())
                    .overlay(
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(isActive ? 0.40 : 0.28),
                                        Color.white.opacity(isActive ? 0.14 : 0.08)
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

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .notes
    @State private var keyboardVisible = false
    @StateObject private var bannerController = BannerController()
    @StateObject private var chromeController = ChromeController()
    @StateObject private var recordingController = RecordingController()
    @Namespace private var tabPillNS

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                NotesView().tag(AppTab.notes)
                HomeView().tag(AppTab.create)
                LibraryView().tag(AppTab.library)
                ProfileView().tag(AppTab.profile)
            }
            .environmentObject(bannerController)
            .environmentObject(chromeController)
            .environmentObject(recordingController)
            .sheet(isPresented: $recordingController.showingSheet) {
                NoteVoiceSheet()
                    .environmentObject(recordingController)
            }
            // Tab bar is the inner inset (anchored at screen bottom).
            // Mini bar is the outer inset (stacks above the tab bar naturally).
            // This ordering ensures correct visual stacking on all iOS versions:
            // outer inset content appears above inner inset content.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !keyboardVisible && !chromeController.hideTabBar {
                    AppTabBar(selected: $selectedTab, pillNS: tabPillNS)
                        .padding(.horizontal, 16)
                        .padding(.bottom, -2)
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
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: bannerController.isVisible)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: recordingController.isRecording)
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
                .topBarPillLabel(isActive: isActive)
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
    /// Styles a glyph to sit inside a `TopBarPill` as one of its segments.
    /// Use this for `Menu` / `ShareLink` labels where `TopBarPillButton`'s
    /// action-only API doesn't fit.
    func topBarPillLabel(isActive: Bool = false) -> some View {
        self
            .font(.system(size: 18, weight: .regular))
            .foregroundColor(AppText.primary)
            .frame(width: 44, height: 38)
            .background(isActive ? Color.white.opacity(0.12) : Color.clear)
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
                .foregroundColor(AppText.primary)
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
                    .foregroundColor(AppText.primary)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(AppText.secondary)
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.10))
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
    @ViewBuilder var results: () -> Results

    var body: some View {
        ZStack(alignment: .top) {
            // No tint on top of the material — on this already-dark app even a
            // 30 % wash blacks out the blur. Let the material work unobstructed
            // so the filter chips and list chrome behind it read as a blurred
            // glass surface.
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass")
                            .font(.appLabel)
                            .foregroundColor(Color.white.opacity(0.45))
                        TextField(placeholder, text: $query)
                            .font(.appLabel)
                            .foregroundColor(AppText.primary)
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
                            .accessibilityLabel("Clear search")
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
    AIAction(label: "Explain This in Simple Terms", icon: "lightbulb", instruction: "Rewrite this so a smart non-expert can understand it easily. Keep it concise."),
    AIAction(label: "Make Shorter", icon: "text.alignleft", instruction: "Shorten this while preserving the key points. Aim for roughly half the length."),
    AIAction(label: "Change Tone to Professional", icon: "bubble.left", instruction: "Rewrite this in a polished, professional tone suitable for a business context."),
]

struct AIActionsSheet: View {
    let onAction: (_ label: String, _ icon: String, _ instruction: String) -> Void

    private let sheetBg = Color(red: 0.10, green: 0.08, blue: 0.07)

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
                    .foregroundColor(Color.white.opacity(0.85))
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                Text(action.label)
                    .font(.appBody)
                    .foregroundColor(Color.white.opacity(0.92))
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
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.85))
                    .frame(width: 36, height: 36)
                    .background(Color.white.opacity(0.10))
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
                                .fill(Color.white.opacity(0.06))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color.white.opacity(0.13), lineWidth: 0.5)
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
