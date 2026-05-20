import SwiftUI

// MARK: - Minimal 1 — Generations live on notes
//
// A self-contained alternative to the Standard / Simple layouts. The whole
// experience is two screens — a notes list and a per-note detail page —
// with generations rendered as tabs inside the note they were created
// from. Selecting "Minimal 1" in Profile → Layout swaps the root view in
// ContentView to MinimalHomePage. Old library data (library_projects) is
// not touched; new generations made in Minimal 1 land in their own store
// (minimal_generations_v1) so flipping back to Standard restores the
// previous app verbatim.

// MARK: Data model

/// A piece of generated content attached to one or more source notes.
/// `noteId` is the primary note the generation appears under (its tab
/// row); `sourceNoteIds` carries every note that fed the generation
/// (including the primary), and `sourceLabels` snapshots their titles at
/// generation time so the tag chips keep rendering after a source note
/// is renamed or deleted.
struct MinimalGeneration: Identifiable, Codable, Equatable {
    var id = UUID()
    var noteId: UUID
    var sourceNoteIds: [UUID]
    var sourceLabels: [String]
    var outputType: String
    var content: String
    var date: Date
}

enum MinimalGenStore {
    static let key = "minimal_generations_v1"

    static func load() -> [MinimalGeneration] {
        let data = UserDefaults.standard.data(forKey: key) ?? Data()
        switch loadBlob([MinimalGeneration].self, from: data) {
        case .empty: return []
        case .ok(let v): return v
        case .corrupt: return []
        }
    }

    /// Refuses to overwrite a corrupt blob — same posture as NotesStore.
    static func save(_ generations: [MinimalGeneration]) {
        let existing = UserDefaults.standard.data(forKey: key) ?? Data()
        if case .corrupt = loadBlob([MinimalGeneration].self, from: existing) { return }
        guard let encoded = try? JSONEncoder().encode(generations) else { return }
        UserDefaults.standard.set(encoded, forKey: key)
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .minimalGenStoreDidChange, object: nil)
        }
    }

    static func insertBatch(_ batch: [MinimalGeneration]) {
        var all = load()
        all.insert(contentsOf: batch, at: 0)
        save(all)
    }

    static func updateContent(id: UUID, content: String) {
        var all = load()
        guard let idx = all.firstIndex(where: { $0.id == id }) else { return }
        all[idx].content = content
        save(all)
    }

    static func delete(id: UUID) {
        var all = load()
        all.removeAll { $0.id == id }
        save(all)
    }

    static func deleteAll(forNoteID noteId: UUID) {
        var all = load()
        all.removeAll { $0.noteId == noteId }
        save(all)
    }
}

extension Notification.Name {
    static let minimalGenStoreDidChange = Notification.Name("MinimalGenStoreDidChange")
}

// MARK: - Home Page

/// Notes list + Profile pill. Minimal 1's top-level surface. Hosts the
/// classic `NotesView` in embedded mode so the user keeps the same row
/// titles, pinned section, swipe actions, tag chips, custom tags, and
/// search overlay they had in Standard / Simple; only the per-note
/// navigation destination differs — tapping a note pushes
/// `MinimalNoteDetailPage` (with generation tabs) instead of the
/// classic single-note editor.
struct MinimalHomePage: View {
    /// Bumped externally (by ContentView when the floating mic capture
    /// fires) to ask the embedded NotesView to begin a voice note. Same
    /// hand-off pattern Simple mode uses with `SimpleCreateBar`.
    var newNoteTrigger: Int = 0
    var onProfileTap: () -> Void = {}

    @State private var showSearch = false
    @State private var searchText = ""
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                AmbientBackground()

                VStack(spacing: 0) {
                    header

                    Rectangle()
                        .fill(AppInk.solid(0.06))
                        .frame(height: 0.5)

                    NotesView(
                        newNoteTrigger: newNoteTrigger,
                        embedded: true,
                        externalShowSearch: $showSearch,
                        externalSearchText: $searchText,
                        // Minimal-specific destination — keep every other
                        // NotesView behaviour (filter chips, pinned/other
                        // split, swipe actions, search overlay results)
                        // and only swap the per-note page. Sketched notes
                        // still route to the canvas; opening a drawing in
                        // the text editor would orphan its PKDrawing data.
                        detailFor: { note in
                            if note.kind == .drawing {
                                AnyView(
                                    DrawingCanvasView(
                                        initialNote: note,
                                        onSave: { saved in
                                            var fresh = NotesStore.load()
                                            if let idx = fresh.firstIndex(where: { $0.id == saved.id }) {
                                                fresh[idx] = saved
                                            } else {
                                                fresh.insert(saved, at: 0)
                                            }
                                            NotesStore.saveInBackground(fresh)
                                        },
                                        onCancel: {}
                                    )
                                    .toolbar(.hidden, for: .navigationBar)
                                )
                            } else {
                                AnyView(MinimalNoteDetailPage(initialNote: note))
                            }
                        }
                    )
                }
                // Match SimpleHomePage's posture so the keyboard rising
                // for search doesn't shove the list up and slam it back.
                .ignoresSafeArea(.keyboard)
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .onChange(of: showSearch) { _, newVal in
            // Search field doesn't exist in the view tree until the
            // toggle flips on; defer focus by one runloop so SwiftUI
            // mounts the TextField before we try to focus it.
            if newVal {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                    searchFocused = true
                }
            }
        }
    }

    /// Top bar. Two layouts crossfade off `showSearch` (same pattern as
    /// SimpleHomeHeader) so the bar morphs from "title + pills" to
    /// "search field + Cancel" without snapping.
    @ViewBuilder
    private var header: some View {
        ZStack {
            HStack(spacing: 12) {
                Text("Notes")
                    .font(.app(size: 26, weight: .bold))
                    .foregroundColor(AppText.primary)
                    .fixedSize(horizontal: true, vertical: false)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                // No pencil here — voice capture lives in the floating
                // mic that ContentView parks at the bottom (same as
                // Simple mode). Top bar carries only search + profile.
                TopBarPill {
                    TopBarPillButton(
                        systemImage: showSearch ? "xmark" : "magnifyingglass",
                        isActive: showSearch
                    ) {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(AppAnimation.standard) {
                            showSearch.toggle()
                            if !showSearch {
                                searchText = ""
                                searchFocused = false
                            }
                        }
                    }
                    .accessibilityLabel(showSearch ? "Close search" : "Search")
                }
                TopBarPill {
                    TopBarPillButton(systemImage: "person.crop.circle") {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onProfileTap()
                    }
                    .accessibilityLabel("Profile")
                }
            }
            .opacity(showSearch ? 0 : 1)
            .allowsHitTesting(!showSearch)
            .accessibilityHidden(showSearch)

            HStack(spacing: 12) {
                AppSearchField(
                    placeholder: "Search notes",
                    text: $searchText,
                    isFocused: $searchFocused
                )
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(AppAnimation.standard) {
                        showSearch = false
                        searchText = ""
                        searchFocused = false
                    }
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
            .opacity(showSearch ? 1 : 0)
            .allowsHitTesting(showSearch)
            .accessibilityHidden(!showSearch)
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 12)
        .animation(AppAnimation.standard, value: showSearch)
    }
}

// MARK: - Note detail page (Note tab + Generation tabs)

struct MinimalNoteDetailPage: View {
    let initialNote: Note

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController

    @State private var note: Note
    @State private var generations: [MinimalGeneration] = []
    /// 0 = Note tab; 1+N = generations[N-1].
    @State private var selectedIndex: Int = 0
    /// Mirror of the active tab's text. Edits here flow back to either
    /// `note.body` or the matching generation's `content` on persist.
    @State private var editText: String = ""
    @State private var isEditingBody: Bool = false
    @FocusState private var editorFocused: Bool

    /// Live cursor / selection state in the body editor. When the user
    /// has highlighted a range, both the sparkles AI menu and the chat
    /// sheet operate on that substring (rather than the whole tab) and
    /// a follow-up rewrite is spliced back at the same range.
    @State private var editSelection: TextSelection? = nil
    /// Frozen copy of `editSelection`'s range, captured at the moment an
    /// AI sheet opens. The live selection collapses to a cursor as soon
    /// as the user taps a button — without this snapshot the AI flow
    /// would receive an empty range and silently overwrite the whole body.
    @State private var aiSelectionRange: Range<String.Index>? = nil

    /// In-editor dictation. Mirrors NoteEditorPage's pattern: a small
    /// `mic.badge.plus` glass button parks itself bottom-right whenever
    /// the editor is focused or recording; tapping it begins live
    /// transcription that lands at the current insertion point in
    /// `editText`. `bodyBeforeDictation` snapshots the prefix so an
    /// interrupted / cancelled dictation reverts cleanly without
    /// eating any pre-existing body content.
    @StateObject private var dictation = NoteDictation()
    @State private var bodyBeforeDictation: String = ""

    @State private var showCreateModal = false
    @State private var showChat = false
    @State private var showAIMenu = false
    @State private var isAIProcessing = false
    @State private var aiTransformTask: Task<Void, Never>? = nil
    @State private var showAIPreview = false
    @State private var aiPreviewVariants: [String] = []
    @State private var aiPreviewVariantIndex: Int = 0
    @State private var aiPreviewLabel: String = ""
    @State private var aiPreviewIcon: String = "sparkles"
    @State private var aiPreviewInstruction: String = ""
    @State private var aiSourceSnapshot: String = ""

    @State private var aiFailed = false
    @State private var aiFailReason = ""

    private static let maxPreviewVariants = 5

    init(initialNote: Note) {
        self.initialNote = initialNote
        let migrated = Note.migrated(initialNote)
        self._note = State(initialValue: migrated)
        self._editText = State(initialValue: migrated.body)
    }

    private var isNoteTab: Bool { selectedIndex == 0 }

    /// True while the Note tab's body editor is active. The editor binds
    /// the whole `editText`, so its first line *is* the title — rendering
    /// the `visibleTitle` heading at the same time would echo that first
    /// line twice (once big, once in the editor). Generation tabs are
    /// unaffected: their editor holds the generation content, not the
    /// note body, so the heading never duplicates anything there.
    private var isEditingNoteTab: Bool {
        isNoteTab && (isEditingBody || editorFocused)
    }
    private var currentGeneration: MinimalGeneration? {
        guard selectedIndex > 0, generations.indices.contains(selectedIndex - 1) else { return nil }
        return generations[selectedIndex - 1]
    }

    /// Title shown in the prominent row between the top bar and the tabs.
    /// On the Note tab it tracks `editText`'s first line live so the
    /// heading updates as the user types; on generation tabs it shows
    /// the source note's title (the format label already lives in the
    /// tab pill, so we don't repeat it here).
    private var visibleTitle: String {
        if isNoteTab {
            let firstLine = editText.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
            return firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let trimmed = note.displayTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed == "Untitled" ? "" : trimmed
    }

    /// Note-tab body with the title line stripped so the reader doesn't
    /// echo the heading shown above the tabs. Returns "" when the body
    /// has no newline (the whole text is the title with nothing after).
    private var noteBodyWithoutTitle: String {
        let body = editText
        guard let nl = body.firstIndex(of: "\n") else { return "" }
        var rest = String(body[body.index(after: nl)...])
        while let c = rest.first, c == "\n" || c == "\r" { rest.removeFirst() }
        return rest
    }

    private func formatLabel(_ outputType: String) -> String {
        allFormats.first(where: { $0.id == outputType })?.label ?? outputType
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            AppBackground.primary.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                topBar
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .padding(.bottom, 6)

                if !visibleTitle.isEmpty && !isEditingNoteTab {
                    Text(visibleTitle)
                        .font(.appTitle)
                        .foregroundColor(AppText.primary)
                        // Cap at 2 lines so a long note title doesn't
                        // push the tab strip below the fold on smaller
                        // phones (or under AX Dynamic Type). The scale
                        // factor lets a moderately-long title squeeze
                        // onto one line before wrapping.
                        .lineLimit(2)
                        .minimumScaleFactor(0.85)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 12)
                }

                tabsBar

                contentArea
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            // Unified bottom bar with three persistent components: the
            // Create wand on the left, the "Ask AI" chat pill in the
            // middle, and the dictation mic on the right. All three
            // stay visible whether or not the editor is focused so the
            // user can pick a generation path without first tapping
            // into the body. Dictation's recording row takes the whole
            // bar over while it's live so the user can't tap into the
            // chat sheet mid-utterance.
            HStack(alignment: .center, spacing: 12) {
                if !dictation.isRecording && !hasActiveTextSelection {
                    if isNoteTab {
                        // The Note tab's wand opens the full Create
                        // modal — it targets the whole body, not the
                        // highlighted span, so we still hide it while
                        // a live selection is active (the in-selection
                        // AI menu the system surfaces would otherwise
                        // duplicate it).
                        aiWandButton
                            .transition(.scale(scale: 0.85).combined(with: .opacity))
                    } else {
                        // Generation tabs offer quick rewrite actions
                        // (Make Shorter, Fix Grammar, …) instead of the
                        // Create flow — the user is already inside an
                        // AI output and the natural next step is to
                        // refine it, not generate something new.
                        aiSparklesButton
                            .transition(.scale(scale: 0.85).combined(with: .opacity))
                    }
                }

                // Keep the pill in the layout (its inner frame(maxWidth:
                // .infinity) absorbs the slack and pushes DictationControls
                // to the trailing edge) but fade it out and disable taps
                // while dictation is live. Previous version conditionally
                // swapped to a Spacer, and the Spacer's silent insertion
                // popped the dictation row visibly each time the user
                // started or finished recording.
                aiChatPill
                    .opacity(dictation.isRecording ? 0 : 1)
                    .allowsHitTesting(!dictation.isRecording)

                DictationControls(
                    dictation: dictation,
                    onStart: {
                        bodyBeforeDictation = editText
                        dictation.start()
                    },
                    onCancel: {
                        dictation.cancel()
                        editText = bodyBeforeDictation
                    },
                    onConfirm: {
                        dictation.stop()
                    },
                    idleDiameter: 52
                )
                .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: editorFocused)
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: dictation.isRecording)
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: hasActiveTextSelection)
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: isNoteTab)
        .onChange(of: dictation.transcript) { _, newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if bodyBeforeDictation.isEmpty {
                editText = trimmed
            } else {
                let needsSeparator = !bodyBeforeDictation.hasSuffix("\n") && !bodyBeforeDictation.hasSuffix(" ")
                editText = bodyBeforeDictation + (needsSeparator ? " " : "") + trimmed
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
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .swipeBackGesture {
            dictation.stop()
            persistCurrent()
            dismiss()
        }
        .onAppear {
            chrome.hideTabBar = true
            reloadGenerations()
        }
        .onDisappear {
            chrome.hideTabBar = false
            dictation.stop()
            persistCurrent()
            maybeGenerateTitle()
            maybeDiscardEmptyNote()
            aiTransformTask?.cancel()
        }
        .onReceive(NotificationCenter.default.publisher(for: .minimalGenStoreDidChange)) { _ in
            reloadGenerations()
        }
        .sheet(isPresented: $showChat, onDismiss: {
            reloadGenerations()
            // Don't let a stale chat range leak into a subsequent
            // sparkles tap — the AI preview sheet clears its own
            // range on close; this is the parallel for chat.
            aiSelectionRange = nil
        }) {
            // Forward any active highlight as the chat's seed snippet so
            // a rewrite the user accepts lands surgically at that exact
            // range instead of a document-wide find/replace. The chat
            // also gets a "Selection in <tab>" chip pointing back to the
            // tab the user was viewing.
            let (snippet, range) = chatSelectionPayload()
            let selectionTitle: String? = {
                guard snippet != nil else { return nil }
                if isNoteTab {
                    let titled = note.displayTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                    return titled.isEmpty ? nil : "Selection in \(titled)"
                }
                if let gen = currentGeneration {
                    return "Selection in \(formatLabel(gen.outputType))"
                }
                return nil
            }()
            ChatView(
                initialContextIDs: [],
                initialNoteContextID: note.id,
                initialSelection: snippet,
                initialSelectionTitle: selectionTitle,
                initialSelectionRange: range
            )
        }
        .fullScreenCover(isPresented: $showCreateModal) {
            // Classic Create modal (HomeView) with the current note seeded
            // as the first source. The host (this page) takes the results
            // through `resultsHandler` and writes them into
            // `minimal_generations_v1` tied to this note's id — HomeView
            // itself never touches `library_projects` in this flow.
            HomeView(
                isModal: true,
                initialSources: [noteAsSource],
                resultsHandler: { results, sources in
                    persistGeneratedResults(results, sources: sources)
                }
            )
        }
        .sheet(isPresented: $showAIMenu) {
            AIActionsSheet { label, icon, instruction in
                showAIMenu = false
                // When a range was frozen on tap, slice the source from
                // it so the rewrite stays surgical; otherwise fall back
                // to the whole tab body and clear the (stale or empty)
                // range so apply doesn't try to splice into nothing.
                let source: String
                if let range = aiSelectionRange,
                   range.lowerBound != range.upperBound,
                   editText.indices.contains(range.lowerBound),
                   range.upperBound <= editText.endIndex {
                    source = String(editText[range])
                } else {
                    aiSelectionRange = nil
                    source = editText
                }
                runAITransform(instruction: instruction, label: label, icon: icon, source: source)
            }
        }
        .sheet(isPresented: $showAIPreview) {
            AIPreviewSheet(
                actionLabel: aiPreviewLabel,
                actionIcon: aiPreviewIcon,
                variants: aiPreviewVariants,
                selectedIndex: $aiPreviewVariantIndex,
                isLoading: isAIProcessing,
                maxVariants: Self.maxPreviewVariants,
                onApply: {
                    let chosen = aiPreviewCurrentVariant
                    guard !chosen.isEmpty else { return }
                    // Splice into the captured selection range when we
                    // have a valid one; otherwise overwrite the whole
                    // tab. The bounds check defends against the editor
                    // having mutated since the range was frozen.
                    if let range = aiSelectionRange,
                       editText.indices.contains(range.lowerBound),
                       range.upperBound <= editText.endIndex {
                        editText.replaceSubrange(range, with: chosen)
                    } else {
                        editText = chosen
                    }
                    persistCurrent()
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    showAIPreview = false
                },
                onCopy: {
                    UIPasteboard.general.string = aiPreviewCurrentVariant
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                },
                onRegenerate: {
                    runAITransform(
                        instruction: aiPreviewInstruction,
                        label: aiPreviewLabel,
                        icon: aiPreviewIcon,
                        source: aiSourceSnapshot,
                        mode: .replaceCurrent
                    )
                },
                onAddVariant: { delta in
                    runAITransform(
                        instruction: aiPreviewInstruction,
                        label: aiPreviewLabel,
                        icon: aiPreviewIcon,
                        source: aiSourceSnapshot,
                        mode: .appendVariant,
                        userDelta: delta
                    )
                },
                onClose: { showAIPreview = false }
            )
        }
        .onChange(of: showAIPreview) { _, newValue in
            if !newValue {
                aiPreviewVariants = []
                aiPreviewVariantIndex = 0
                aiPreviewLabel = ""
                aiPreviewIcon = "sparkles"
                aiPreviewInstruction = ""
                aiSourceSnapshot = ""
                aiSelectionRange = nil
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

    private var aiPreviewCurrentVariant: String {
        aiPreviewVariants.indices.contains(aiPreviewVariantIndex)
            ? aiPreviewVariants[aiPreviewVariantIndex]
            : ""
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 10) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dictation.stop()
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
            .accessibilityLabel("Back")

            Spacer()

            TopBarPill {
                Menu {
                    if !editText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Button {
                            UIPasteboard.general.string = editText
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                        ShareLink(item: editText) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                    if let gen = currentGeneration {
                        Button(role: .destructive) {
                            MinimalGenStore.delete(id: gen.id)
                            // store change triggers a reload that snaps
                            // selection back to a safe index.
                        } label: {
                            Label("Delete this generation", systemImage: "trash")
                        }
                    } else {
                        Button(role: .destructive) {
                            performDelete()
                        } label: {
                            Label("Delete Note", systemImage: "trash")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .topBarPillLabel()
                }
                .accessibilityLabel("More")
            }
        }
    }

    // MARK: Tabs

    @ViewBuilder
    private var tabsBar: some View {
        if generations.isEmpty {
            EmptyView()
        } else {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    tabPill(index: 0, label: "Note")
                    ForEach(Array(generations.enumerated()), id: \.element.id) { idx, gen in
                        tabPill(index: idx + 1, label: formatLabel(gen.outputType))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 10)
            }

            Rectangle()
                .fill(AppInk.solid(0.06))
                .frame(height: 0.5)
        }
    }

    private func tabPill(index: Int, label: String) -> some View {
        let active = selectedIndex == index
        // Generation tabs (index > 0) get a sparkles glyph after the label
        // so the AI-authored tabs read distinctly from the source Note tab.
        let isGeneration = index > 0
        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            selectTab(index)
        } label: {
            HStack(spacing: 4) {
                Text(label)
                if isGeneration {
                    Image(systemName: "sparkles")
                        .font(.system(size: 11, weight: active ? .semibold : .regular))
                }
            }
            .font(.app(size: 14, weight: active ? .semibold : .regular))
            .foregroundColor(active ? AppText.primary : AppText.secondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                ZStack {
                    if active {
                        Capsule(style: .continuous)
                            .fill(AppInk.solid(0.14))
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(AppInk.solid(0.22), lineWidth: 0.5)
                            )
                    }
                }
            )
            .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
        .animation(AppAnimation.quick, value: selectedIndex)
    }

    // MARK: Content

    @ViewBuilder
    private var contentArea: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Source-note chips when a generation pulls from more than
            // one note. The format label and the note title both live
            // above the tabs row now, so this is the only label strip
            // the body itself carries.
            if let gen = currentGeneration {
                generationHeader(gen)
            }

            if isEditingBody || (editorFocused && isNoteTab) {
                editorView
            } else {
                readerView
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        // Breathing room under the grey divider that closes the tab strip
        // when generations exist; without it the body would hug the line.
        .padding(.top, generations.isEmpty ? 0 : 12)
    }

    @ViewBuilder
    private func generationHeader(_ gen: MinimalGeneration) -> some View {
        // The format label already lives in the tab pill above, so we no
        // longer repeat it as a heading here — only render the
        // multi-source chips when they're needed for context.
        if gen.sourceLabels.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(gen.sourceLabels, id: \.self) { label in
                        Text(label)
                            .font(.appCaptionMedium)
                            .foregroundColor(BrandColor.amber)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(BrandColor.amber.opacity(0.10))
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(BrandColor.amber.opacity(0.22), lineWidth: 0.5)
                            )
                    }
                }
                .padding(.horizontal, 20)
            }
            .padding(.bottom, 8)
        }
    }

    private var editorView: some View {
        ZStack(alignment: .topLeading) {
            if editText.isEmpty {
                Text(isNoteTab ? "Start typing\u{2026}" : "No content")
                    .font(.appReadingBody)
                    .foregroundColor(AppText.muted)
                    .padding(.horizontal, 24)
                    .padding(.top, 8)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $editText, selection: $editSelection)
                .appReadingBodyText()
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .tint(AppText.primary)
                .padding(.horizontal, 16)
                .contentMargins(.bottom, 96, for: .scrollContent)
                .focused($editorFocused)
                .onChange(of: editorFocused) { _, focused in
                    if !focused { isEditingBody = false }
                }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var readerView: some View {
        ScrollView {
            // On the Note tab the first line is the heading shown above
            // the tabs row, so the reader renders the body without it
            // to avoid echoing the title. Generation tabs already have
            // standalone content, so they render as-is.
            let displayText = isNoteTab ? noteBodyWithoutTitle : editText
            if displayText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(isNoteTab ? "Tap to start typing" : "No content")
                    .font(.appReadingBody)
                    .foregroundColor(AppText.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
            } else {
                BodyParagraphsView(raw: displayText)
                    .padding(.horizontal, 20)
                    .padding(.top, isNoteTab ? 4 : 8)
                    .padding(.bottom, 96)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            isEditingBody = true
            // SwiftUI's TextEditor with a nil selection lands the cursor
            // at the end of the document on focus and scrolls the editor
            // to it — which reads as the view yanking to the bottom when
            // the user just wanted to tap into the prose. Anchor the
            // insertion point at the top so the editor opens where the
            // reader was instead of jumping past the visible content.
            editSelection = TextSelection(insertionPoint: editText.startIndex)
            DispatchQueue.main.async { editorFocused = true }
        }
    }

    // MARK: Floating buttons

    /// True iff the user has a non-collapsed highlight in the editor.
    /// Drives the Create / wand button's visibility — that action
    /// targets the whole note, so it shouldn't compete with the
    /// in-selection AI menu the system surfaces over the highlight.
    private var hasActiveTextSelection: Bool {
        currentEditorSelectionRange() != nil
    }

    /// Pulls a contiguous, non-collapsed range out of the live selection.
    /// Returns nil when there's just a cursor (lower == upper) or no
    /// selection at all — in which case AI flows fall back to operating
    /// on the whole tab body.
    private func currentEditorSelectionRange() -> Range<String.Index>? {
        guard let selection = editSelection else { return nil }
        let range: Range<String.Index>?
        switch selection.indices {
        case .selection(let r):
            range = r
        case .multiSelection(let set):
            range = set.ranges.first
        @unknown default:
            range = nil
        }
        guard let r = range, r.lowerBound != r.upperBound else { return nil }
        // Tolerate the editor reshuffling indices between selection
        // capture and the AI button tap by validating against the
        // current editText bounds.
        guard editText.indices.contains(r.lowerBound), r.upperBound <= editText.endIndex else { return nil }
        return r
    }

    private var aiSparklesButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            // Freeze the live selection before SwiftUI presents the
            // action sheet — by the time the sheet's onAction fires the
            // editor has lost focus and the live selection has collapsed.
            aiSelectionRange = currentEditorSelectionRange()
            showAIMenu = true
        } label: {
            Group {
                if isAIProcessing {
                    ProgressView()
                        .controlSize(.small)
                        .tint(AppText.primary)
                } else {
                    Image(systemName: "sparkles")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundColor(AppText.primary)
                }
            }
            .frame(width: 52, height: 52)
            .background(glassCircle)
        }
        .buttonStyle(.plain)
        .disabled(isAIProcessing)
        .accessibilityLabel("Quick AI actions")
    }

    /// Resolves the snippet + NSRange the chat sheet should receive when
    /// the chat button fires. Reads the *frozen* `aiSelectionRange` that
    /// the button's onTap captured — by the time SwiftUI renders the
    /// sheet, the editor has lost focus and the live `editSelection`
    /// has collapsed. Returns nil for both when no real highlight was
    /// active, so the chat falls back to its document-wide posture.
    private func chatSelectionPayload() -> (snippet: String?, range: NSRange?) {
        guard let range = aiSelectionRange,
              range.lowerBound != range.upperBound,
              editText.indices.contains(range.lowerBound),
              range.upperBound <= editText.endIndex
        else { return (nil, nil) }
        let snippet = String(editText[range])
        let trimmed = snippet.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return (nil, nil) }
        return (snippet, NSRange(range, in: editText))
    }

    /// Bottom "Ask AI" pill — the chat entry point styled as a
    /// fillable field. Leading `OrbitDotsCircle` reuses the loading
    /// glyph from `GenerationBanner` so the chat surface shares the
    /// same visual idiom as content generation. Tapping anywhere on
    /// the pill opens the existing chat sheet; the user types in the
    /// sheet's composer (the "existing chat form field"), so the
    /// chat history and attachment plumbing stay untouched.
    private var aiChatPill: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            // Same as sparkles: freeze the live selection before SwiftUI
            // presents the sheet so the editor losing focus doesn't
            // wipe the range we're about to forward.
            aiSelectionRange = currentEditorSelectionRange()
            persistCurrent()
            showChat = true
        } label: {
            HStack(spacing: 10) {
                OrbitDotsCircle(diameter: 36)
                Text("Ask AI")
                    .font(.appBody)
                    .foregroundColor(AppInk.solid(0.45))
                Spacer(minLength: 0)
            }
            .padding(.leading, 8)
            .padding(.trailing, 16)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(
                Capsule(style: .continuous)
                    .fill(.regularMaterial)
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(AppInk.solid(0.15), lineWidth: 0.5)
                    )
                    .shadow(color: Color.black.opacity(0.22), radius: 10, y: 3)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Ask AI about this note")
    }

    private var aiWandButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            persistCurrent()
            showCreateModal = true
        } label: {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 19, weight: .regular))
                .foregroundColor(AppText.primary)
                .frame(width: 52, height: 52)
                .background(glassCircle)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Generate content from this note")
    }

    private var glassCircle: some View {
        Circle()
            .fill(.regularMaterial)
            .overlay(Circle().stroke(AppInk.solid(0.15), lineWidth: 0.5))
            .shadow(color: Color.black.opacity(0.22), radius: 10, y: 3)
    }

    // MARK: Tab switching & persistence

    private func selectTab(_ index: Int) {
        // Abandon any in-flight dictation before swapping editText —
        // otherwise the transcript callback would overwrite the new
        // tab's text with the previous tab's pre-dictation snapshot +
        // the partial transcript.
        if dictation.isRecording {
            dictation.cancel()
            editText = bodyBeforeDictation
        }
        persistCurrent()
        selectedIndex = index
        editText = currentTextForTab(index)
        isEditingBody = false
    }

    private func currentTextForTab(_ index: Int) -> String {
        if index == 0 { return note.body }
        guard generations.indices.contains(index - 1) else { return "" }
        return generations[index - 1].content
    }

    private func persistCurrent() {
        if isNoteTab {
            guard editText != note.body else { return }
            note.body = editText
            note.updatedAt = Date()
            persistNoteToStore()
        } else if let gen = currentGeneration, editText != gen.content {
            MinimalGenStore.updateContent(id: gen.id, content: editText)
        }
    }

    /// Writes the in-memory `note` back into the shared notes blob. The
    /// embedded NotesView listens for `.notesStoreDidChange` (posted by
    /// NotesStore.save) and reloads, so the list row refreshes without
    /// any extra plumbing.
    private func persistNoteToStore() {
        var fresh = NotesStore.load()
        if let idx = fresh.firstIndex(where: { $0.id == note.id }) {
            fresh[idx] = note
        } else {
            fresh.insert(note, at: 0)
        }
        NotesStore.saveInBackground(fresh)
    }

    private func reloadGenerations() {
        let priorID = currentGeneration?.id
        let all = MinimalGenStore.load()
            .filter { $0.noteId == note.id }
            .sorted { $0.date < $1.date }
        generations = all

        // Re-anchor the selected tab so it survives store reloads (e.g.
        // after deleting a generation or appending a fresh batch).
        if let priorID, let newIdx = generations.firstIndex(where: { $0.id == priorID }) {
            selectedIndex = newIdx + 1
        } else if selectedIndex > generations.count {
            selectedIndex = max(0, generations.count)
        }
        editText = currentTextForTab(selectedIndex)
    }

    private func performDelete() {
        MinimalGenStore.deleteAll(forNoteID: note.id)
        var fresh = NotesStore.load()
        fresh.removeAll { $0.id == note.id }
        NotesStore.saveInBackground(fresh)
        dismiss()
    }

    /// Same logic as NoteEditorPage.persistIfNeeded — if the note body
    /// reads like prose with no user-supplied title (first line >4 words),
    /// ask the model for a 3-word title and prepend it once. Runs only
    /// when leaving the screen so the user's editing isn't interrupted
    /// mid-flow.
    private func maybeGenerateTitle() {
        let trimmedBody = note.body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedBody.isEmpty else { return }
        let firstLine = trimmedBody.split(whereSeparator: \.isNewline).first.map(String.init) ?? trimmedBody
        let wordCount = firstLine.split(whereSeparator: \.isWhitespace).count
        guard wordCount > 4 else { return }

        let snapshotBody = note.body
        let baseNote = note
        Task {
            let aiTitle = await AIService.generateTitle(from: trimmedBody)
            let cleaned = aiTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { return }
            guard !AIService.titleDuplicatesFirstLine(cleaned, firstLine: firstLine) else { return }
            await MainActor.run {
                var fresh = NotesStore.load()
                guard let idx = fresh.firstIndex(where: { $0.id == baseNote.id }) else { return }
                // Skip if the body changed underneath us while the
                // model was thinking — don't overwrite the user's
                // post-disappear edits with a stale title.
                guard fresh[idx].body == snapshotBody else { return }
                fresh[idx].body = cleaned + "\n" + snapshotBody
                fresh[idx].updatedAt = Date()
                NotesStore.saveInBackground(fresh)
            }
        }
    }

    /// New notes captured but left empty (cancelled recording, pencil tap
    /// with no follow-through) shouldn't pile up as Untitled rows. Only
    /// fires for notes that *started* empty — clearing an existing note's
    /// body shouldn't auto-delete it. Generations attached to the note
    /// also keep it alive even if the body itself was emptied.
    private func maybeDiscardEmptyNote() {
        guard initialNote.isEmpty, note.isEmpty else { return }
        guard MinimalGenStore.load().allSatisfy({ $0.noteId != note.id }) else { return }
        var fresh = NotesStore.load()
        fresh.removeAll { $0.id == note.id }
        NotesStore.saveInBackground(fresh)
    }

    // MARK: Generation handoff

    /// Builds the `SourceItem` HomeView consumes for its sources block —
    /// the current note, with its title as the chip label and body as
    /// the content. Same shape NoteEditorPage's `noteAsSource` uses, so
    /// HomeView treats it identically.
    private var noteAsSource: SourceItem {
        SourceItem(
            type: .note,
            label: note.displayTitle,
            content: note.body
        )
    }

    /// Called by HomeView's `resultsHandler` after a successful generation.
    /// Wraps each result into a `MinimalGeneration` anchored to this note's
    /// id, snapshots the source labels for the tag-chip strip, and jumps
    /// the active tab to the first new generation so the user sees the
    /// output as soon as the modal dismisses.
    private func persistGeneratedResults(_ results: [GeneratedResult], sources: [SourceItem]) {
        guard !results.isEmpty else { return }
        let noteID = note.id
        // Source labels carry every chip the user added in the modal —
        // including text snippets, links, files, images — so the tag
        // strip on the new generation tab reflects everything that fed
        // it, not just the originating note.
        let sourceLabels = sources.map(\.label)
        // We only have a reliable note id for the *primary* source (the
        // note we came from). Other sources picked in the modal (text /
        // link / file / image / voice / unrelated notes) don't expose
        // their UUIDs through SourceItem, so `sourceNoteIds` records
        // just the anchor.
        let sourceIDs: [UUID] = [noteID]
        let now = Date()
        let batch: [MinimalGeneration] = results.enumerated().map { idx, r in
            MinimalGeneration(
                noteId: noteID,
                sourceNoteIds: sourceIDs,
                sourceLabels: sourceLabels,
                outputType: r.formatID,
                content: r.content,
                // Stagger by ms so insertion order is stable across
                // a multi-format batch.
                date: now.addingTimeInterval(Double(idx) * 0.001)
            )
        }
        MinimalGenStore.insertBatch(batch)
        // Re-read so the displayed list matches what's on disk and
        // jump straight to the first new generation.
        let firstID = batch[0].id
        let refreshed = MinimalGenStore.load()
            .filter { $0.noteId == noteID }
            .sorted { $0.date < $1.date }
        generations = refreshed
        if let i = refreshed.firstIndex(where: { $0.id == firstID }) {
            selectedIndex = i + 1
            editText = refreshed[i].content
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    // MARK: Quick AI transform

    private enum AITransformMode { case fresh, replaceCurrent, appendVariant }

    private func runAITransform(
        instruction: String,
        label: String,
        icon: String,
        source: String,
        mode: AITransformMode = .fresh,
        userDelta: String? = nil
    ) {
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

        let existingForDifferenceHint: [String]
        switch mode {
        case .fresh:
            existingForDifferenceHint = []
        case .replaceCurrent:
            existingForDifferenceHint = aiPreviewVariants.enumerated()
                .filter { $0.offset != aiPreviewVariantIndex }
                .map(\.element)
        case .appendVariant:
            existingForDifferenceHint = aiPreviewVariants
        }
        let trimmedDelta = userDelta?.trimmingCharacters(in: .whitespacesAndNewlines)
        let deltaForCall = (trimmedDelta?.isEmpty == false) ? trimmedDelta : nil

        aiTransformTask = Task {
            let outcome: Result<String, APICallError>
            if existingForDifferenceHint.isEmpty && deltaForCall == nil {
                outcome = await AITransformService.transform(text: source, instruction: trimmedInstruction)
            } else {
                outcome = await AITransformService.variant(text: source, instruction: trimmedInstruction, existing: existingForDifferenceHint, userDelta: deltaForCall)
            }
            await MainActor.run {
                isAIProcessing = false
                guard !Task.isCancelled else { return }
                switch outcome {
                case .success(let result):
                    switch mode {
                    case .fresh:
                        aiPreviewVariants = [result]
                        aiPreviewVariantIndex = 0
                    case .replaceCurrent:
                        if aiPreviewVariants.indices.contains(aiPreviewVariantIndex) {
                            aiPreviewVariants[aiPreviewVariantIndex] = result
                        } else {
                            aiPreviewVariants = [result]
                            aiPreviewVariantIndex = 0
                        }
                    case .appendVariant:
                        guard aiPreviewVariants.count < Self.maxPreviewVariants else { return }
                        aiPreviewVariants.append(result)
                        aiPreviewVariantIndex = aiPreviewVariants.count - 1
                    }
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

