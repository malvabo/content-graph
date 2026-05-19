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

/// Notes list + Profile pill. No library, no Create tab, no tag chips —
/// the entire top-level surface in Minimal 1.
struct MinimalHomePage: View {
    var onProfileTap: () -> Void = {}

    @EnvironmentObject private var recording: RecordingController
    @State private var notes: [Note] = []
    @State private var selectedNote: Note? = nil
    @State private var pendingSave: DispatchWorkItem? = nil

    var body: some View {
        NavigationStack {
            ZStack {
                AmbientBackground()

                VStack(spacing: 0) {
                    InlineTopBar(title: "Notes") {
                        TopBarPill {
                            TopBarPillButton(systemImage: "square.and.pencil") {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                startAudioNote()
                            }
                            .accessibilityLabel("New voice note")
                        }
                        TopBarPill {
                            TopBarPillButton(systemImage: "person.crop.circle") {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                onProfileTap()
                            }
                            .accessibilityLabel("Profile")
                        }
                    }

                    Rectangle()
                        .fill(AppInk.solid(0.06))
                        .frame(height: 0.5)

                    if notes.isEmpty {
                        EmptyStateView(
                            illustration: NotesIllustration(),
                            title: "No notes yet",
                            subtitle: "Tap the pencil to capture an idea by voice",
                            actionTitle: "Start recording",
                            action: startAudioNote
                        )
                    } else {
                        List {
                            ForEach(sortedNotes) { note in
                                Button {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    selectedNote = note
                                } label: {
                                    MinimalNoteRow(note: note, generationCount: generationCount(for: note))
                                }
                                .buttonStyle(.plain)
                                .listRowInsets(EdgeInsets())
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.visible)
                                .listRowSeparatorTint(AppInk.solid(0.06))
                                .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                                .alignmentGuide(.listRowSeparatorTrailing) { d in d[.trailing] - 20 }
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        delete(note)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationDestination(item: $selectedNote) { note in
                MinimalNoteDetailPage(
                    initialNote: note,
                    onUpdate: { saved in
                        if let idx = notes.firstIndex(where: { $0.id == saved.id }) {
                            notes[idx] = saved
                        } else {
                            notes.insert(saved, at: 0)
                        }
                        scheduleSave()
                    },
                    onDelete: { delete(note) }
                )
            }
            .task {
                notes = await NotesStore.loadAsync()
            }
            .onReceive(NotificationCenter.default.publisher(for: .notesStoreDidChange)) { _ in
                Task {
                    let fresh = await NotesStore.loadAsync()
                    await MainActor.run { notes = fresh }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .minimalGenStoreDidChange)) { _ in
                generationsTouchTrigger &+= 1
            }
        }
    }

    /// Bumped on every minimal-generations-store change so the row counts
    /// recompute even though the notes array itself didn't move.
    @State private var generationsTouchTrigger: Int = 0

    private var sortedNotes: [Note] {
        notes.sorted { $0.updatedAt > $1.updatedAt }
    }

    /// Voice-first capture, matching classic NotesView. The transcript
    /// callback fires when the user stops the recording sheet — at which
    /// point a new note is materialised with the transcript as the body
    /// and the detail page is pushed so the user can edit / generate
    /// from it immediately.
    private func startAudioNote() {
        recording.begin { transcript in
            var note = Note()
            note.body = transcript
            note.updatedAt = Date()
            notes.insert(note, at: 0)
            scheduleSave()
            selectedNote = note
        }
        recording.showingSheet = true
    }

    private func delete(_ note: Note) {
        withAnimation(AppAnimation.standard) {
            notes.removeAll { $0.id == note.id }
        }
        scheduleSave()
        MinimalGenStore.deleteAll(forNoteID: note.id)
    }

    private func scheduleSave() {
        pendingSave?.cancel()
        let snapshot = notes
        var work: DispatchWorkItem!
        work = DispatchWorkItem {
            NotesStore.saveInBackground(snapshot)
            if pendingSave === work { pendingSave = nil }
        }
        pendingSave = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }

    private func generationCount(for note: Note) -> Int {
        _ = generationsTouchTrigger
        return MinimalGenStore.load().filter { $0.noteId == note.id }.count
    }
}

// MARK: - Notes list row

private struct MinimalNoteRow: View {
    let note: Note
    let generationCount: Int

    var body: some View {
        HStack(spacing: 14) {
            DocCardThumb()

            VStack(alignment: .leading, spacing: 5) {
                Text(note.isEmpty ? "Untitled" : note.displayTitle)
                    .font(.appRowTitle)
                    .foregroundColor(note.isEmpty ? AppText.tertiary : AppInk.solid(0.88))
                    .lineLimit(1)
                    .truncationMode(.tail)

                HStack(spacing: 8) {
                    Text(RowDate.relative(from: note.updatedAt))
                        .font(.appSmall)
                        .foregroundColor(AppText.tertiary)
                    if generationCount > 0 {
                        Text("·")
                            .font(.appSmall)
                            .foregroundColor(AppText.tertiary)
                        Text("\(generationCount) generation\(generationCount == 1 ? "" : "s")")
                            .font(.appSmall)
                            .foregroundColor(BrandColor.amber.opacity(0.85))
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}

// `NoteListRow` and `RowDate` are private to NotesView; the row above is
// the Minimal-specific variant that also surfaces a generation count.
// `RowDate` is duplicated below so this file doesn't depend on NotesView's
// internals.
private enum RowDate {
    private static let time: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "h:mm a"; return f
    }()
    private static let monthDay: DateFormatter = {
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f
    }()
    private static let full: DateFormatter = {
        let f = DateFormatter(); f.dateStyle = .medium; return f
    }()

    static func relative(from date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return time.string(from: date) }
        if cal.component(.year, from: date) == cal.component(.year, from: Date()) {
            return monthDay.string(from: date)
        }
        return full.string(from: date)
    }
}

// MARK: - Note detail page (Note tab + Generation tabs)

struct MinimalNoteDetailPage: View {
    let initialNote: Note
    let onUpdate: (Note) -> Void
    let onDelete: () -> Void

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

    @State private var showGenerateSheet = false
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

    @State private var isGenerating = false
    @State private var generateTask: Task<Void, Never>? = nil

    @State private var aiFailed = false
    @State private var aiFailReason = ""
    @State private var copied = false
    @State private var copiedResetTask: Task<Void, Never>? = nil

    private static let maxPreviewVariants = 5

    init(initialNote: Note, onUpdate: @escaping (Note) -> Void, onDelete: @escaping () -> Void) {
        self.initialNote = initialNote
        self.onUpdate = onUpdate
        self.onDelete = onDelete
        let migrated = Note.migrated(initialNote)
        self._note = State(initialValue: migrated)
        self._editText = State(initialValue: migrated.body)
    }

    private var isNoteTab: Bool { selectedIndex == 0 }
    private var currentGeneration: MinimalGeneration? {
        guard selectedIndex > 0, generations.indices.contains(selectedIndex - 1) else { return nil }
        return generations[selectedIndex - 1]
    }

    private var headerTitle: String {
        let trimmed = note.displayTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed == "Untitled" { return "New note" }
        return trimmed
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
                    .padding(.bottom, 10)

                tabsBar

                contentArea
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            HStack(spacing: 12) {
                aiSparklesButton
                aiChatButton
                aiWandButton
            }
            .padding(.leading, 20)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: editorFocused)
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: isGenerating)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .swipeBackGesture {
            persistCurrent()
            dismiss()
        }
        .onAppear {
            chrome.hideTabBar = true
            reloadGenerations()
        }
        .onDisappear {
            chrome.hideTabBar = false
            persistCurrent()
            generateTask?.cancel()
            aiTransformTask?.cancel()
            copiedResetTask?.cancel()
        }
        .onReceive(NotificationCenter.default.publisher(for: .minimalGenStoreDidChange)) { _ in
            reloadGenerations()
        }
        .sheet(isPresented: $showChat, onDismiss: { reloadGenerations() }) {
            ChatView(initialNoteContextID: note.id)
        }
        .sheet(isPresented: $showGenerateSheet) {
            MinimalGenerateSheet(
                primaryNote: note,
                onGenerate: { formats, extraNotes in
                    showGenerateSheet = false
                    startGeneration(formats: formats, extraNotes: extraNotes)
                }
            )
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
                variants: aiPreviewVariants,
                selectedIndex: $aiPreviewVariantIndex,
                isLoading: isAIProcessing,
                maxVariants: Self.maxPreviewVariants,
                onApply: {
                    let chosen = aiPreviewCurrentVariant
                    guard !chosen.isEmpty else { return }
                    editText = chosen
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

            Text(headerTitle)
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
                    if !editText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
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
        return Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            selectTab(index)
        } label: {
            Text(label)
                .font(.app(size: 14, weight: active ? .semibold : .regular))
                .foregroundColor(active ? .white : AppInk.solid(0.55))
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(active ? AnyShapeStyle(BrandColor.ctaPrimary) : AnyShapeStyle(Color.clear))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .animation(AppAnimation.quick, value: selectedIndex)
    }

    // MARK: Content

    @ViewBuilder
    private var contentArea: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Title strip: format label on a generation tab, source labels
            // (as tags) when multi-source. Hidden on the Note tab — the
            // first line of the note body is its own title.
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
    }

    @ViewBuilder
    private func generationHeader(_ gen: MinimalGeneration) -> some View {
        Text(formatLabel(gen.outputType))
            .font(.appTitle)
            .foregroundColor(AppText.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 6)

        // Source-note tags, same visual language as ChatView's contextTagsBar.
        // Only render when there's actually more than one source — solo
        // generations (created from the current note alone) don't need a
        // tag chip pointing back to the note the user is already inside.
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
            TextEditor(text: $editText)
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
            if editText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(isNoteTab ? "Tap to start typing" : "No content")
                    .font(.appReadingBody)
                    .foregroundColor(AppText.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
            } else {
                Text(AppMarkdown.render(editText))
                    .appReadingBodyText()
                    .textSelection(.enabled)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.top, isNoteTab ? 4 : 8)
                    .padding(.bottom, 96)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            isEditingBody = true
            DispatchQueue.main.async { editorFocused = true }
        }
    }

    // MARK: Floating buttons

    private var aiSparklesButton: some View {
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
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundColor(AppText.primary)
                }
            }
            .frame(width: 56, height: 56)
            .background(glassCircle)
        }
        .buttonStyle(.plain)
        .disabled(isAIProcessing)
        .accessibilityLabel("Quick AI actions")
    }

    private var aiChatButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            persistCurrent()
            showChat = true
        } label: {
            Image(systemName: "message")
                .font(.system(size: 19, weight: .regular))
                .foregroundColor(AppText.primary)
                .frame(width: 56, height: 56)
                .background(glassCircle)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Chat about this note")
    }

    private var aiWandButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            persistCurrent()
            showGenerateSheet = true
        } label: {
            Group {
                if isGenerating {
                    ProgressView()
                        .controlSize(.small)
                        .tint(AppText.primary)
                } else {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 19, weight: .regular))
                        .foregroundColor(AppText.primary)
                }
            }
            .frame(width: 56, height: 56)
            .background(glassCircle)
        }
        .buttonStyle(.plain)
        .disabled(isGenerating)
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
            let trimmed = editText
            if trimmed != note.body {
                note.body = trimmed
                note.updatedAt = Date()
                onUpdate(note)
            }
        } else if let gen = currentGeneration, editText != gen.content {
            MinimalGenStore.updateContent(id: gen.id, content: editText)
        }
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
        onDelete()
        dismiss()
    }

    // MARK: Generation

    private func startGeneration(formats: [String], extraNotes: [Note]) {
        guard !formats.isEmpty else { return }
        guard ContentGenerator.isKeyConfigured else {
            aiFailReason = "Add your Anthropic API key in Profile first."
            aiFailed = true
            return
        }

        // Materialise sources up front so the async task doesn't hold the
        // (mutable) `note` State directly. The current note always counts as
        // a source; extras follow in the order the user picked them.
        let primaryNote = note
        let allSourceNotes = [primaryNote] + extraNotes
        let sourceItems: [SourceItem] = allSourceNotes.map { n in
            SourceItem(
                type: .note,
                label: n.displayTitle,
                content: n.body
            )
        }
        let filteredSources = sourceItems.filter { !$0.content.isEmpty }
        guard !filteredSources.isEmpty else {
            aiFailReason = "The selected notes have no content yet."
            aiFailed = true
            return
        }
        let sourceLabels = allSourceNotes.map(\.displayTitle)
        let sourceIDs = allSourceNotes.map(\.id)
        let primaryID = primaryNote.id

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        isGenerating = true
        let capturedFormats = formats

        generateTask = Task {
            var newGenerations: [MinimalGeneration] = []
            var firstError: APICallError? = nil
            let now = Date()
            for (idx, formatID) in capturedFormats.enumerated() {
                guard !Task.isCancelled else { break }
                let label = allFormats.first { $0.id == formatID }?.label ?? formatID
                let outcome = await ContentGenerator.generate(
                    sources: filteredSources,
                    formatID: formatID,
                    formatLabel: label,
                    customPrompt: "",
                    brand: "Default"
                )
                switch outcome {
                case .success(let text):
                    newGenerations.append(
                        MinimalGeneration(
                            noteId: primaryID,
                            sourceNoteIds: sourceIDs,
                            sourceLabels: sourceLabels,
                            outputType: formatID,
                            content: text,
                            // Stagger by ms so insertion order is stable.
                            date: now.addingTimeInterval(Double(idx) * 0.001)
                        )
                    )
                case .failure(let err):
                    if firstError == nil { firstError = err }
                }
            }
            let cancelled = Task.isCancelled
            await MainActor.run {
                isGenerating = false
                generateTask = nil
                if cancelled { return }
                if newGenerations.isEmpty {
                    aiFailReason = firstError?.userMessage ?? "Generation failed."
                    aiFailed = true
                    return
                }
                MinimalGenStore.insertBatch(newGenerations)
                // Jump to the first newly-created generation so the user
                // sees the result without an extra tap.
                let firstID = newGenerations[0].id
                let refreshed = MinimalGenStore.load()
                    .filter { $0.noteId == primaryID }
                    .sorted { $0.date < $1.date }
                generations = refreshed
                if let i = refreshed.firstIndex(where: { $0.id == firstID }) {
                    selectedIndex = i + 1
                    editText = refreshed[i].content
                }
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
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

// MARK: - Generate sheet

private struct MinimalGenerateSheet: View {
    let primaryNote: Note
    let onGenerate: (_ formats: [String], _ extraNotes: [Note]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var selectedFormatIDs: Set<String> = []
    @State private var extraNotes: [Note] = []
    @State private var showSourcePicker = false

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground.primary.ignoresSafeArea()

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 24) {
                        sourcesSection
                        formatsSection
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 120)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .safeAreaInset(edge: .top, spacing: 0) {
                header
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                generateBar
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(AppBackground.primary)
        .sheet(isPresented: $showSourcePicker) {
            MinimalSourcePicker(
                excludedID: primaryNote.id,
                alreadySelected: extraNotes,
                onDone: { picked in
                    extraNotes = picked
                    showSourcePicker = false
                }
            )
        }
    }

    private var header: some View {
        HStack {
            Text("Generate")
                .font(.app(size: 22, weight: .bold))
                .foregroundColor(AppText.primary)
            Spacer()
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(AppText.primary)
                    .frame(width: 32, height: 32)
                    .background(AppInk.solid(0.10))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 16)
        .background(AppBackground.primary)
    }

    private var sourcesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Sources")
            FlowLayout(spacing: 8) {
                sourceChip(label: primaryNote.displayTitle, isLocked: true)
                ForEach(extraNotes) { n in
                    sourceChip(label: n.displayTitle, isLocked: false, onRemove: {
                        extraNotes.removeAll { $0.id == n.id }
                    })
                }
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showSourcePicker = true
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Add note")
                            .font(.appCaptionMedium)
                    }
                    .foregroundColor(AppText.secondary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(
                        Capsule(style: .continuous)
                            .stroke(AppInk.solid(0.25), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func sourceChip(label: String, isLocked: Bool, onRemove: (() -> Void)? = nil) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "note.text")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(BrandColor.amber)
            Text(label.isEmpty ? "Untitled" : label)
                .font(.appCaptionMedium)
                .foregroundColor(BrandColor.amber)
                .lineLimit(1)
            if let onRemove {
                Button(action: onRemove) {
                    Image(systemName: "xmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(BrandColor.amber.opacity(0.85))
                        .frame(width: 16, height: 16)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else if isLocked {
                Image(systemName: "lock.fill")
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(BrandColor.amber.opacity(0.6))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(BrandColor.amber.opacity(0.10))
        .clipShape(Capsule())
        .overlay(Capsule().stroke(BrandColor.amber.opacity(0.22), lineWidth: 0.5))
    }

    private var formatsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Formats")
            FlowLayout(spacing: 8) {
                ForEach(allFormats) { format in
                    let selected = selectedFormatIDs.contains(format.id)
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        if selected {
                            selectedFormatIDs.remove(format.id)
                        } else {
                            selectedFormatIDs.insert(format.id)
                        }
                    } label: {
                        Text(format.label)
                            .font(.app(size: 14, weight: selected ? .semibold : .regular))
                            .foregroundColor(selected ? .white : AppInk.solid(0.78))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                selected
                                    ? AnyShapeStyle(BrandColor.ctaPrimary)
                                    : AnyShapeStyle(AppInk.solid(0.06))
                            )
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(AppInk.solid(selected ? 0 : 0.10), lineWidth: 0.5)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.app(size: 13, weight: .semibold))
            .foregroundColor(AppText.tertiary)
            .textCase(.uppercase)
            .kerning(0.6)
    }

    private var generateBar: some View {
        let count = selectedFormatIDs.count
        let label = count == 0 ? "Generate" : "Generate \(count)"
        return VStack(spacing: 0) {
            Rectangle().fill(AppInk.solid(0.06)).frame(height: 0.5)
            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                let orderedFormats = allFormats.map(\.id).filter { selectedFormatIDs.contains($0) }
                onGenerate(orderedFormats, extraNotes)
            } label: {
                Text(label)
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        Capsule(style: .continuous)
                            .fill(count == 0 ? AppBackground.ctaDisabled : BrandColor.ctaPrimary)
                    )
            }
            .buttonStyle(.plain)
            .disabled(count == 0)
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 20)
        }
        .background(AppBackground.primary)
    }
}

// MARK: - Source picker

private struct MinimalSourcePicker: View {
    let excludedID: UUID
    let alreadySelected: [Note]
    let onDone: ([Note]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var notes: [Note] = []
    @State private var selectedIDs: Set<UUID> = []

    init(excludedID: UUID, alreadySelected: [Note], onDone: @escaping ([Note]) -> Void) {
        self.excludedID = excludedID
        self.alreadySelected = alreadySelected
        self.onDone = onDone
        self._selectedIDs = State(initialValue: Set(alreadySelected.map(\.id)))
    }

    private var candidates: [Note] {
        notes
            .filter { $0.id != excludedID && !$0.isEmpty }
            .sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground.primary.ignoresSafeArea()
                VStack(spacing: 0) {
                    header
                    if candidates.isEmpty {
                        VStack(spacing: 10) {
                            Spacer()
                            Image(systemName: "note.text")
                                .font(.system(size: 36))
                                .foregroundColor(AppText.tertiary)
                            Text("No other notes yet")
                                .font(.appBody)
                                .foregroundColor(AppText.secondary)
                            Spacer()
                        }
                        .frame(maxWidth: .infinity)
                    } else {
                        List {
                            ForEach(candidates) { note in
                                Button {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    if selectedIDs.contains(note.id) {
                                        selectedIDs.remove(note.id)
                                    } else {
                                        selectedIDs.insert(note.id)
                                    }
                                } label: {
                                    pickerRow(note)
                                }
                                .buttonStyle(.plain)
                                .listRowInsets(EdgeInsets())
                                .listRowBackground(Color.clear)
                                .listRowSeparatorTint(AppInk.solid(0.06))
                                .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(AppBackground.primary)
        .task {
            notes = await NotesStore.loadAsync()
        }
    }

    private var header: some View {
        HStack {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dismiss()
            } label: {
                Text("Cancel")
                    .font(.appLabel)
                    .foregroundColor(AppText.secondary)
            }
            Spacer()
            Text("Add sources")
                .font(.appBodyBold)
                .foregroundColor(AppText.primary)
            Spacer()
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                let picked = candidates.filter { selectedIDs.contains($0.id) }
                onDone(picked)
            } label: {
                Text("Done")
                    .font(.appLabelBold)
                    .foregroundColor(BrandColor.ctaPrimary)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 12)
    }

    private func pickerRow(_ note: Note) -> some View {
        let selected = selectedIDs.contains(note.id)
        return HStack(spacing: 14) {
            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                .font(.system(size: 20, weight: .regular))
                .foregroundColor(selected ? BrandColor.ctaPrimary : AppText.tertiary)
            VStack(alignment: .leading, spacing: 4) {
                Text(note.displayTitle)
                    .font(.appRowTitle)
                    .foregroundColor(AppText.primary)
                    .lineLimit(1)
                Text(RowDate.relative(from: note.updatedAt))
                    .font(.appSmall)
                    .foregroundColor(AppText.tertiary)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}

// MARK: - Flow layout
//
// Simple horizontal wrapping container — chips flow left to right and
// break to the next line when they overflow. SwiftUI doesn't ship a
// stock version so this is a small custom Layout.

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if rowWidth + size.width > maxWidth && rowWidth > 0 {
                totalHeight += rowHeight + spacing
                totalWidth = max(totalWidth, rowWidth - spacing)
                rowWidth = 0
                rowHeight = 0
            }
            rowWidth += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        totalWidth = max(totalWidth, rowWidth - spacing)
        return CGSize(width: totalWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x - bounds.minX + size.width > maxWidth && x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
