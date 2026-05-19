import SwiftUI
import UniformTypeIdentifiers
import PDFKit

// MARK: - Chat Message Model

struct ChatMessage: Identifiable, Codable {
    var id = UUID()
    var role: String // "user" or "assistant"
    var content: String
    // Snapshot of the context chips attached when this turn was sent.
    // Captured per-message so the chat history can show which sources
    // fed each answer even after the user adds or removes chips in the
    // composer for a later turn. Only populated on user messages.
    var attachedContext: [ChatContextSource] = []

    init(
        id: UUID = UUID(),
        role: String,
        content: String,
        attachedContext: [ChatContextSource] = []
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.attachedContext = attachedContext
    }

    // Tolerate missing fields so saved chats written by earlier schema
    // versions still decode — auto-synth would throw on any absent key.
    private enum CodingKeys: String, CodingKey {
        case id, role, content, attachedContext
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id              = try c.decodeIfPresent(UUID.self,                forKey: .id)              ?? UUID()
        role            = try c.decodeIfPresent(String.self,              forKey: .role)            ?? ""
        content         = try c.decodeIfPresent(String.self,              forKey: .content)         ?? ""
        attachedContext = try c.decodeIfPresent([ChatContextSource].self, forKey: .attachedContext) ?? []
    }
}

// MARK: - Rewrite Suggestion

/// A "before → after" rewrite the assistant proposes against one of the
/// attached context sources. The user can accept it to overwrite the
/// matching text in the underlying document, note, or in-session file.
struct RewriteSuggestion: Equatable {
    let before: String
    let after: String

    /// Stable identity derived from the content, so the "applied" state
    /// survives re-parsing the same message body across body invocations.
    var stableKey: String { "\(before)|→|\(after)" }
}

/// One segment of a parsed assistant message — either plain text (rendered
/// in a normal chat bubble) or a structured rewrite block (rendered as a
/// card the user can accept).
private enum AssistantSegment: Identifiable {
    case text(String)
    case rewrite(RewriteSuggestion)

    var id: String {
        switch self {
        case .text(let t): return "t:\(t.hashValue)"
        case .rewrite(let r): return "r:\(r.stableKey)"
        }
    }
}

private enum AssistantParser {
    /// Splits an assistant message into a sequence of text + rewrite
    /// segments. Rewrites are emitted by the model as
    /// `<rewrite><before>…</before><after>…</after></rewrite>` blocks
    /// (chosen over JSON because it avoids escaping multi-line text).
    static func parse(_ source: String) -> [AssistantSegment] {
        var result: [AssistantSegment] = []
        var remaining = source[...]

        while let openRange = remaining.range(of: "<rewrite>") {
            let pre = remaining[remaining.startIndex..<openRange.lowerBound]
            let preTrim = String(pre).trimmingCharacters(in: .whitespacesAndNewlines)
            if !preTrim.isEmpty {
                result.append(.text(String(pre)))
            }
            guard let closeRange = remaining.range(
                of: "</rewrite>",
                range: openRange.upperBound..<remaining.endIndex
            ) else {
                // Unterminated block — render what's left as text so the
                // user can still see the model output.
                result.append(.text(String(remaining[openRange.lowerBound...])))
                return result
            }
            let inner = remaining[openRange.upperBound..<closeRange.lowerBound]
            if let suggestion = extractSuggestion(from: String(inner)) {
                result.append(.rewrite(suggestion))
            }
            remaining = remaining[closeRange.upperBound...]
        }

        let tail = String(remaining)
        if !tail.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            result.append(.text(tail))
        }
        return result
    }

    private static func extractSuggestion(from inner: String) -> RewriteSuggestion? {
        guard let before = field("before", in: inner),
              let after = field("after", in: inner),
              !before.isEmpty, !after.isEmpty
        else { return nil }
        return RewriteSuggestion(before: before, after: after)
    }

    private static func field(_ name: String, in s: String) -> String? {
        guard let open = s.range(of: "<\(name)>"),
              let close = s.range(of: "</\(name)>", range: open.upperBound..<s.endIndex)
        else { return nil }
        return String(s[open.upperBound..<close.lowerBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

// MARK: - Chat Context Source

/// Unified context attachment. Documents (library projects), notes, and
/// imported files all flow through the same shape so the chat API call
/// stays a single code path.
struct ChatContextSource: Identifiable, Equatable, Codable {
    enum Kind: String, Codable { case document, note, file, selection }

    let id: String
    let kind: Kind
    let title: String      // displayed in the @-mention and picker
    let preview: String    // single-line subtitle in the picker
    let content: String    // full body sent to the API
    var tags: [String] = []  // surfaced atop the chat + appended to the prompt

    init(
        id: String,
        kind: Kind,
        title: String,
        preview: String,
        content: String,
        tags: [String] = []
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.preview = preview
        self.content = content
        self.tags = tags
    }

    private enum CodingKeys: String, CodingKey {
        case id, kind, title, preview, content, tags
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id      = try c.decodeIfPresent(String.self,   forKey: .id)      ?? UUID().uuidString
        kind    = try c.decodeIfPresent(Kind.self,     forKey: .kind)    ?? .file
        title   = try c.decodeIfPresent(String.self,   forKey: .title)   ?? ""
        preview = try c.decodeIfPresent(String.self,   forKey: .preview) ?? ""
        content = try c.decodeIfPresent(String.self,   forKey: .content) ?? ""
        tags    = try c.decodeIfPresent([String].self, forKey: .tags)    ?? []
    }
}

// MARK: - Chat Service

private struct ChatService {
    static func send(messages: [ChatMessage], contextItems: [ChatContextSource]) async -> Result<String, APICallError> {
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

        var systemText = """
        You are a content and writing assistant.

        Reply rules:
        - Lead with the answer. No preamble, no restating the question.
        - Default to one short paragraph. Two only if needed. Go longer \
        only when a complex ask earns it (multi-step rewrite, multiple \
        options explicitly requested).
        - Bulleted list only when items are genuinely discrete.
        - No emojis. No hedging. No marketing voice. Direct, plain.

        Rewrite suggestions:
        - When the user asks you to revise, rewrite, edit, fix, tighten, \
        rephrase, expand, shorten, or otherwise replace a specific span \
        of text inside the attached context, emit the change as a \
        structured rewrite block instead of (or in addition to) \
        explaining it in prose:

          <rewrite>
          <before>exact original text from the source</before>
          <after>your revised text</after>
          </rewrite>

        - The <before> string MUST appear verbatim in one of the attached \
        sources — same wording, punctuation, case, and whitespace — so \
        the app can locate and replace it. Quote a tight span: the \
        sentence, phrase, or paragraph that actually changes, not the \
        whole source.
        - Emit multiple <rewrite> blocks if the user asked for several \
        edits; each block stands alone.
        - When a [selection] context item is attached, the user has \
        flagged that text as the surgical target — the inline-editing \
        pathway. Always answer that request with a <rewrite> block whose \
        <before> is the selection's content (or a tight subset of it), \
        even when your edit covers the entire selection. Do not respond \
        in prose for selection-targeted edits.
        - For broad rewrites of an entire document with no [selection] \
        attached, do not use this block — answer normally. The block is \
        for surgical edits on a specific span.
        - The `kind=… title=…` line on each <source> is metadata, not \
        body text. <before> must quote bytes from inside the <source> \
        tags only — never include the kind/title header line.
        """
        if !contextItems.isEmpty {
            let ctx = contextItems.map { src -> String in
                let body = src.content.isEmpty ? src.preview : src.content
                let tagsAttr = src.tags.isEmpty
                    ? ""
                    : " tags=\"\(src.tags.joined(separator: ", "))\""
                return "<source kind=\"\(src.kind.rawValue)\" title=\"\(src.title)\"\(tagsAttr)>\n\(body)\n</source>"
            }.joined(separator: "\n\n")
            systemText += "\n\nThe user has provided these content pieces as context:\n\n\(ctx)"
        }

        let apiMessages = messages.map { ["role": $0.role, "content": $0.content] }
        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 1024,
            "system": systemText,
            "messages": apiMessages
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

// MARK: - Saved Chats

/// One persisted chat conversation. Saved on each turn so the user can
/// resume a chat from the history button in the chat header. Cap on the
/// store ensures it doesn't grow without bound.
struct SavedChat: Identifiable, Codable {
    var id = UUID()
    var messages: [ChatMessage]
    var updatedAt: Date

    /// First user message, single-line, capped — used as the row title in
    /// the saved-chats sheet. Mirrors how messaging apps name a thread
    /// before the user has given it an explicit title.
    var title: String {
        let firstUser = messages.first(where: { $0.role == "user" })?.content ?? ""
        let trimmed = firstUser.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Untitled chat" }
        let firstLine = trimmed
            .split(whereSeparator: \.isNewline)
            .first
            .map(String.init) ?? trimmed
        return String(firstLine.prefix(80))
    }

    /// Latest message body, single-line, capped — second row used as the
    /// preview subtitle in the saved-chats sheet so the user can scan
    /// what the chat ended on.
    var preview: String {
        let last = messages.last?.content ?? ""
        let trimmed = last.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        let firstLine = trimmed
            .split(whereSeparator: \.isNewline)
            .first
            .map(String.init) ?? trimmed
        return String(firstLine.prefix(140))
    }

    private enum CodingKeys: String, CodingKey {
        case id, messages, updatedAt
    }

    init(id: UUID = UUID(), messages: [ChatMessage], updatedAt: Date = Date()) {
        self.id = id
        self.messages = messages
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id         = try c.decodeIfPresent(UUID.self,          forKey: .id)         ?? UUID()
        messages   = try c.decodeIfPresent([ChatMessage].self, forKey: .messages)   ?? []
        updatedAt  = try c.decodeIfPresent(Date.self,          forKey: .updatedAt)  ?? Date()
    }
}

extension Notification.Name {
    static let savedChatsDidChange = Notification.Name("SavedChatsDidChange")
}

struct SavedChatsStore {
    static let key = "saved_chats_v1"
    static let maxStored = 100
    private static let saveQueue = DispatchQueue(label: "com.up200.savedchats.save", qos: .utility)

    static func load() -> [SavedChat] {
        let data = UserDefaults.standard.data(forKey: key) ?? Data()
        switch loadBlob([SavedChat].self, from: data) {
        case .empty:
            return []
        case .ok(let raw):
            return raw.sorted { $0.updatedAt > $1.updatedAt }
        case .corrupt:
            // Bytes exist but can't decode. Return empty so the UI renders,
            // but `save` will refuse to overwrite — preserving the original
            // blob for any future recovery path. Same contract as NotesStore.
            return []
        }
    }

    static func loadAsync() async -> [SavedChat] {
        await withCheckedContinuation { continuation in
            saveQueue.async { continuation.resume(returning: load()) }
        }
    }

    static func save(_ chats: [SavedChat]) {
        let existing = UserDefaults.standard.data(forKey: key) ?? Data()
        if case .corrupt = loadBlob([SavedChat].self, from: existing) {
            return
        }
        guard let data = try? JSONEncoder().encode(chats) else { return }
        UserDefaults.standard.set(data, forKey: key)
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .savedChatsDidChange, object: nil)
        }
    }

    /// Insert-or-update a single chat, then write the trimmed list back.
    /// Called from `ChatView` after every turn so an interrupted session
    /// is preserved on disk without the user having to "save" explicitly.
    static func upsertInBackground(_ chat: SavedChat) {
        let snapshot = chat
        saveQueue.async {
            var all = load()
            if let idx = all.firstIndex(where: { $0.id == snapshot.id }) {
                all[idx] = snapshot
            } else {
                all.append(snapshot)
            }
            all.sort { $0.updatedAt > $1.updatedAt }
            if all.count > maxStored {
                all = Array(all.prefix(maxStored))
            }
            save(all)
        }
    }

    static func deleteInBackground(_ id: UUID) {
        saveQueue.async {
            var all = load()
            all.removeAll { $0.id == id }
            save(all)
        }
    }
}

// MARK: - Chat View

struct ChatView: View {
    var initialContextIDs: Set<UUID> = []
    var initialNoteContextID: UUID? = nil
    /// Ad-hoc text snippet pre-attached as a `.selection` context chip
    /// when the caller wants the chat to start with a specific piece of
    /// the source visible above the input — see ProjectGroupDetailView's
    /// "ask AI" flow, which seeds the current body so the AI can edit it
    /// directly. Distinct from `initialContextIDs` (a stored document)
    /// because the snippet has no persistent identity of its own.
    var initialSelection: String? = nil
    var initialSelectionTitle: String? = nil
    /// NSRange of `initialSelection` inside its parent document body.
    /// When non-nil, an accepted rewrite is applied back at exactly this
    /// range so the surgical edit doesn't accidentally match — and
    /// replace — a similar string elsewhere in the document.
    var initialSelectionRange: NSRange? = nil

    @Environment(\.dismiss) private var dismiss
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var showMentionPicker = false
    @State private var showSavedChatsPicker = false
    /// Stable identity for the conversation currently visible in this
    /// view. The first `persistActiveChat` call writes a row under this
    /// id; subsequent turns update that same row, so a session is one
    /// entry in the saved-chats list rather than one per message. Reset
    /// when the user picks a different conversation from the sheet.
    @State private var activeSavedChatID: UUID = UUID()
    @State private var showFilePicker = false
    @State private var selectedContextIDs: Set<String> = []
    @State private var seededContextID: String? = nil
    @State private var didSeedContext = false
    @State private var didSeedSelection = false
    /// Source-id of the .selection chip we seeded on appear, paired with
    /// the NSRange the snippet occupied in its parent doc body. Used to
    /// route an accepted rewrite back to that exact range instead of a
    /// document-wide find/replace, so the AI edit lands surgically.
    @State private var seededSelectionSourceID: String? = nil
    @State private var seededSelectionRange: NSRange? = nil
    @State private var sendTask: Task<Void, Never>? = nil
    @State private var fileImportTask: Task<Void, Never>? = nil
    @State private var cachedProjects: [GenerationProject] = []
    @State private var lastDecodedSignature: Data = Data()
    @State private var notes: [Note] = []
    @State private var attachedFiles: [ChatContextSource] = []
    @State private var chatFailed: Bool = false
    @State private var chatFailReason: String = ""
    @State private var appliedRewriteKeys: Set<String> = []
    @State private var rewriteFailed: Bool = false
    @StateObject private var dictation = NoteDictation()
    @State private var inputTextBeforeDictation: String = ""
    @State private var inputFocused: Bool = false

    private let bg = AppBackground.primary

    private var documentSources: [ChatContextSource] {
        cachedProjects.map { proj in
            ChatContextSource(
                id: "doc:\(proj.id.uuidString)",
                kind: .document,
                title: proj.title,
                preview: proj.preview,
                content: proj.content
            )
        }
    }

    private var noteSources: [ChatContextSource] {
        notes
            .filter { !$0.isEmpty }
            .map { note in
                ChatContextSource(
                    id: "note:\(note.id.uuidString)",
                    kind: .note,
                    title: note.displayTitle,
                    preview: note.preview,
                    content: note.body,
                    tags: note.tags
                )
            }
    }

    /// Everything pickable from the @ sheet — documents and notes. Files
    /// live in `attachedFiles` because they're imported per-session.
    private var availableMentions: [ChatContextSource] {
        documentSources + noteSources
    }

    /// Full pool of sources the user has selected this session, used to
    /// resolve `selectedContextIDs` for both the API and pill removal.
    private var allSources: [ChatContextSource] {
        availableMentions + attachedFiles
    }

    /// Build a NSAttributedString from a plain composer string, giving each
    /// `@<source title>` a subtle background + brighter foreground so
    /// mentions read as inline tags. Routed through the MentionTextView's
    /// single render layer so styling stays in lockstep with the cursor —
    /// the previous Text-over-TextField overlay drifted because the two
    /// layers laid out glyphs differently.
    private func styleMentions(in raw: String) -> NSAttributedString {
        let inkColor = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.92)
                : AppInk.lightInk.withAlphaComponent(0.88)
        }
        let mentionBg = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.16)
                : AppInk.lightInk.withAlphaComponent(0.08)
        }
        let mentionFg = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.96)
                : AppInk.lightInk.withAlphaComponent(0.78)
        }
        // Match the message bubble's `.lineSpacing(3)` so typed lines and
        // sent bubbles share one body-text rhythm — without the paragraph
        // style the composer was drawing tighter than the surrounding
        // chat history at the same 17pt.
        let para = NSMutableParagraphStyle()
        para.lineSpacing = 3
        let ns = NSMutableAttributedString(
            string: raw,
            attributes: [
                .font: UIFont.systemFont(ofSize: 17),
                .foregroundColor: inkColor,
                .paragraphStyle: para
            ]
        )
        let titles = allSources.map(\.title).sorted { $0.count > $1.count }
        let nsStr = raw as NSString
        for title in titles {
            let needle = "@\(title)"
            var cursor = 0
            while cursor < nsStr.length {
                let range = nsStr.range(
                    of: needle,
                    range: NSRange(location: cursor, length: nsStr.length - cursor)
                )
                if range.location == NSNotFound { break }
                ns.addAttribute(.backgroundColor, value: mentionBg, range: range)
                ns.addAttribute(.foregroundColor, value: mentionFg, range: range)
                cursor = range.location + range.length
            }
        }
        return ns
    }

    private var contextItems: [ChatContextSource] {
        var ids = selectedContextIDs
        if let s = seededContextID { ids.insert(s) }
        return allSources.filter { ids.contains($0.id) }
    }

    private func rebuildProjects() {
        guard lastDecodedSignature != projectsData else { return }
        cachedProjects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        lastDecodedSignature = projectsData
    }

    /// Seeds the chat with whichever initial context the caller passed —
    /// a library document (matched against cached projects) or a note
    /// (matched once notes finish loading async). Idempotent so it can be
    /// called both synchronously on appear and after notes load.
    private func attemptSeedContext() {
        attemptSeedSelection()
        guard !didSeedContext else { return }
        if let id = initialContextIDs.first,
           let proj = cachedProjects.first(where: { $0.id == id }) {
            seededContextID = "doc:\(proj.id.uuidString)"
            didSeedContext = true
            return
        }
        if let id = initialNoteContextID,
           let note = notes.first(where: { $0.id == id }), !note.isEmpty {
            seededContextID = "note:\(note.id.uuidString)"
            didSeedContext = true
        }
    }

    /// Seeds a free-form text snippet (the "selected text" the user
    /// kicked the chat off from) as a `.selection` context chip so the
    /// AI receives the snippet alongside the parent document and the
    /// composer shows a styled @-mention pointing at it.
    private func attemptSeedSelection() {
        guard !didSeedSelection else { return }
        guard let snippet = initialSelection?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !snippet.isEmpty else { return }
        didSeedSelection = true

        let title = (initialSelectionTitle?
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                        .isEmpty == false)
            ? initialSelectionTitle!
            : "Selected text"
        let source = ChatContextSource(
            id: "selection:\(UUID().uuidString)",
            kind: .selection,
            title: title,
            preview: String(snippet.prefix(120)),
            content: snippet
        )
        attachedFiles.append(source)
        selectedContextIDs.insert(source.id)
        // Carry the parent-document range with the selection chip so
        // a follow-up rewrite lands at this exact offset rather than
        // hunting for the first text match in the document body.
        seededSelectionSourceID = source.id
        seededSelectionRange = initialSelectionRange
        // Strip a dangling "@" the caller may have left in the seed text
        // so a chip + a stray "@" don't visually duplicate the attachment.
        if inputText.hasSuffix("@") { inputText.removeLast() }
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                Rectangle()
                    .fill(AppInk.solid(0.06))
                    .frame(height: 0.5)

                if !contextTags.isEmpty {
                    contextTagsBar
                }

                if messages.isEmpty {
                    welcomeState
                } else {
                    messageList
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { inputFocused = false }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                inputArea
            }
        }
        .fullScreenCover(isPresented: $showMentionPicker) {
            MentionPickerSheet(
                documents: documentSources,
                notes: noteSources,
                onSelect: { source in
                    attachMention(source)
                }
            )
        }
        .sheet(isPresented: $showSavedChatsPicker) {
            SavedChatsSheet(
                currentChatID: activeSavedChatID,
                onSelect: { chat in
                    loadSavedChat(chat)
                }
            )
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.text, .plainText, .pdf],
            allowsMultipleSelection: false
        ) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            importFile(at: url)
        }
        .alert("Message failed", isPresented: $chatFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(chatFailReason.isEmpty
                 ? "Could not reach the API. Check your network connection and try again."
                 : chatFailReason)
        }
        .alert("Couldn't apply rewrite", isPresented: $rewriteFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("The original text in the rewrite wasn't found in any attached source. Try re-attaching the document or note and asking again.")
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
        .onChange(of: dictation.transcript) { _, newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if inputTextBeforeDictation.isEmpty {
                inputText = trimmed
            } else {
                let needsSeparator = !inputTextBeforeDictation.hasSuffix("\n") && !inputTextBeforeDictation.hasSuffix(" ")
                inputText = inputTextBeforeDictation + (needsSeparator ? " " : "") + trimmed
            }
        }
        .presentationBackground(bg)
        .onDisappear {
            sendTask?.cancel()
            fileImportTask?.cancel()
            dictation.cancel()
            // Catch any final state the per-turn saves missed — eg. if a
            // rewrite card was applied (which doesn't itself trigger a
            // save) or a tab swap dismissed the sheet mid-edit.
            persistActiveChat()
        }
        .onAppear {
            rebuildProjects()
            Task {
                let loaded = await NotesStore.loadAsync()
                await MainActor.run {
                    notes = loaded
                    attemptSeedContext()
                }
            }
            attemptSeedContext()
            // Auto-open the keyboard when the chat screen appears. A short
            // delay is needed because @FocusState inside a sheet doesn't
            // reliably take effect until the sheet's presentation transition
            // has settled.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                inputFocused = true
            }
        }
        .onChange(of: projectsData) { rebuildProjects() }
    }

    // MARK: Header

    /// Deduped, order-preserving union of tags carried by every attached
    /// context source. Shown atop the chat so the user can see which
    /// tags travelled into the AI prompt alongside the body content.
    private var contextTags: [String] {
        var seen: Set<String> = []
        var out: [String] = []
        for src in contextItems {
            for tag in src.tags where !tag.isEmpty && seen.insert(tag).inserted {
                out.append(tag)
            }
        }
        return out
    }

    private var contextTagsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(contextTags, id: \.self) { tag in
                    Text(tag)
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
            .padding(.horizontal, 16)
        }
        .padding(.top, 10)
        .padding(.bottom, 4)
    }

    private var header: some View {
        HStack(spacing: 0) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(AppInk.solid(0.70))
                    .frame(width: 36, height: 36)
                    .background(AppInk.solid(0.12))
                    .clipShape(Circle())
                    .appIconHitArea()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")

            Spacer(minLength: 8)

            Text("New chat")
                .font(.app(size: 17, weight: .semibold))
                .foregroundColor(AppText.primary)

            Spacer(minLength: 8)

            Button {
                presentSavedChatsPicker()
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppInk.solid(0.65))
                    .frame(width: 36, height: 36)
                    .background(AppInk.solid(0.12))
                    .clipShape(Circle())
                    .appIconHitArea()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Saved chats")
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .padding(.top, 8)
    }

    // MARK: Welcome state

    private var welcomeState: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .light))
                    .foregroundColor(AppText.tertiary)
                Text("Welcome to Chat")
                    .font(.app(size: 20, weight: .semibold))
                    .foregroundColor(AppInk.solid(0.88))
                Text("Ask anything or tell me what you need")
                    .font(.app(size: 15))
                    .foregroundColor(AppInk.solid(0.42))
                    .multilineTextAlignment(.center)
            }
            Spacer()
            Color.clear.frame(height: 96)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Message list

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    ForEach(messages) { msg in
                        renderMessage(msg)
                            .id(msg.id)
                    }
                    if isLoading {
                        TypingIndicator()
                            .id("typing")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 16)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(messages.last?.id, anchor: .bottom)
                }
            }
            .onChange(of: isLoading) { _, loading in
                if loading {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("typing", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: Input area

    /// Quick-action prompts surfaced above the composer when a
    /// `.selection` chip is attached and the user hasn't sent anything
    /// yet — same pattern Notion AI's inline-edit composer uses to
    /// give one-tap access to the common rewrite verbs without forcing
    /// the user to type the prompt themselves.
    private struct QuickAction {
        let label: String
        let icon: String
        let prompt: String
    }

    private let quickActions: [QuickAction] = [
        QuickAction(label: "Improve writing",
                    icon:  "pencil.line",
                    prompt: "Improve this writing — keep the meaning and voice, sharpen the prose."),
        QuickAction(label: "Proofread",
                    icon:  "checkmark.circle",
                    prompt: "Proofread this and fix any spelling, grammar, or punctuation issues."),
        QuickAction(label: "Expand",
                    icon:  "arrow.up.left.and.arrow.down.right",
                    prompt: "Expand this with more detail while keeping the same voice."),
        QuickAction(label: "Shorten",
                    icon:  "scissors",
                    prompt: "Shorten this — tighter, fewer words, same meaning."),
        QuickAction(label: "Make it punchier",
                    icon:  "bolt",
                    prompt: "Make this punchier — stronger verbs, leaner sentences."),
    ]

    private var shouldShowQuickActions: Bool {
        guard messages.isEmpty, !isLoading else { return false }
        return contextItems.contains { $0.kind == .selection }
    }

    private var quickActionsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(quickActions, id: \.label) { action in
                    Button {
                        applyQuickAction(action)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: action.icon)
                                .font(.system(size: 12, weight: .regular))
                                .foregroundColor(AppInk.solid(0.55))
                            Text(action.label)
                                .font(.app(size: 14, weight: .medium))
                                .foregroundColor(AppText.primary)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(AppInk.solid(0.10))
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().stroke(AppInk.solid(0.14), lineWidth: 0.5)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.bottom, 8)
    }

    /// Submits the action's prompt as the next chat turn, *prepending* any
    /// @-mentions the user (or seeding) had already placed in the composer
    /// so the prompt acts on the attached context rather than firing as a
    /// fresh empty turn that loses the selection chip.
    private func applyQuickAction(_ action: QuickAction) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        let trimmed = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        let prefix = trimmed.isEmpty ? "" : trimmed + " "
        inputText = prefix + action.prompt
        sendMessage()
    }

    /// Horizontal row of removable chips, one per attached context source.
    /// Sits inside the composer bubble above the text field so the
    /// attachment is visually owned by the input — the chip is the user's
    /// affordance to detach it and the icon hints at the source kind
    /// (document, note, imported file, ad-hoc text selection).
    private var contextChipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(contextItems) { source in
                    contextChip(source)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            .padding(.bottom, 2)
        }
    }

    private func contextChip(_ source: ChatContextSource) -> some View {
        HStack(spacing: 8) {
            Image(systemName: contextChipIcon(for: source.kind))
                .font(.system(size: 13, weight: .regular))
                .foregroundColor(AppInk.solid(0.55))
            Text(source.title)
                .font(.appCaptionMedium)
                .foregroundColor(AppInk.solid(0.85))
                .lineLimit(1)
                .truncationMode(.tail)
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                removeContext(source)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(AppInk.solid(0.55))
                    .frame(width: 22, height: 22)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove \(source.title)")
        }
        .padding(.leading, 14)
        .padding(.trailing, 6)
        .padding(.vertical, 7)
        .background(AppInk.solid(0.10), in: Capsule(style: .continuous))
        .overlay(
            Capsule(style: .continuous)
                .stroke(AppInk.solid(0.14), lineWidth: 0.5)
        )
        .frame(maxWidth: 220, alignment: .leading)
    }

    private func contextChipIcon(for kind: ChatContextSource.Kind) -> String {
        switch kind {
        case .document: return "doc.text"
        case .note: return "note.text"
        case .file: return "paperclip"
        case .selection: return "character.cursor.ibeam"
        }
    }

    /// Read-only chip row rendered above a user message bubble in the
    /// chat history. Mirrors the composer's `contextChipsRow` look (same
    /// icon vocabulary, capsule fill) at a smaller scale, and drops the
    /// × button — historical attachments aren't detachable, they're an
    /// attribution marker so the answer below can be read in context.
    private func attachedContextRow(_ items: [ChatContextSource]) -> some View {
        HStack(spacing: 6) {
            ForEach(items) { source in
                HStack(spacing: 6) {
                    Image(systemName: contextChipIcon(for: source.kind))
                        .font(.system(size: 11, weight: .regular))
                        .foregroundColor(AppInk.solid(0.55))
                    Text(source.title)
                        .font(.appCaptionMedium)
                        .foregroundColor(AppInk.solid(0.78))
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(AppInk.solid(0.10), in: Capsule(style: .continuous))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(AppInk.solid(0.14), lineWidth: 0.5)
                )
                .frame(maxWidth: 180, alignment: .leading)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    private var inputArea: some View {
        VStack(spacing: 0) {
            if shouldShowQuickActions {
                quickActionsRow
                    .transition(.opacity)
            }
            VStack(spacing: 0) {
                if !contextItems.isEmpty {
                    contextChipsRow
                }
                MentionTextView(
                    text: $inputText,
                    isFocused: $inputFocused,
                    placeholder: "Ask anything\u{2026}",
                    maxLines: 5,
                    buildAttributed: styleMentions(in:)
                )

                HStack(spacing: 4) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        inputFocused = false
                        showFilePicker = true
                    } label: {
                        Image(systemName: "paperclip")
                            .font(.system(size: 17))
                            .foregroundColor(AppInk.solid(0.45))
                            .frame(width: 32, height: 32)
                            .appIconHitArea()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Attach file")

                    Button {
                        presentMentionPicker()
                    } label: {
                        Image(systemName: "at")
                            .font(.system(size: 17))
                            .foregroundColor(AppInk.solid(0.45))
                            .frame(width: 32, height: 32)
                            .appIconHitArea()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Mention a note or document")

                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        if dictation.isRecording {
                            dictation.stop()
                        } else {
                            inputTextBeforeDictation = inputText
                            inputFocused = false
                            dictation.start()
                        }
                    } label: {
                        let recording = dictation.isRecording
                        Image(systemName: recording ? "stop.fill" : "mic.fill")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(recording ? .white : AppInk.solid(0.45))
                            .frame(width: 32, height: 32)
                            .background(recording ? BrandColor.amber : Color.clear)
                            .clipShape(Circle())
                            .appIconHitArea()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(dictation.isRecording ? "Stop dictation" : "Start dictation")

                    Spacer()

                    Button(action: sendMessage) {
                        let ready = canSend
                        Image(systemName: "arrow.up")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(ready ? .white : AppInk.solid(0.32))
                            .frame(width: 32, height: 32)
                            .background(ready ? AnyShapeStyle(BrandColor.ctaPrimary) : AnyShapeStyle(AppInk.solid(0.08)))
                            .clipShape(Circle())
                            .overlay(
                                Circle().stroke(
                                    ready ? Color.clear : AppInk.solid(0.10),
                                    lineWidth: 0.5
                                )
                            )
                            .appIconHitArea()
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSend)
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 4)
            }
            .background(AppInk.solid(0.06))
            .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                    .stroke(AppInk.solid(0.10), lineWidth: 0.5)
            )
            .padding(.horizontal, 12)
            .padding(.top, 4)
            .padding(.bottom, 10)
        }
        .background(bg)
    }

    // MARK: Actions

    private func presentMentionPicker() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        inputFocused = false
        showMentionPicker = true
    }

    private func presentSavedChatsPicker() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        inputFocused = false
        showSavedChatsPicker = true
    }

    /// Persist the current `messages` array into the saved-chats store
    /// under `activeSavedChatID`. Called after each turn so an interrupted
    /// session is preserved. No-op when there are no messages yet — an
    /// abandoned empty chat doesn't earn a row in the history.
    private func persistActiveChat() {
        guard !messages.isEmpty else { return }
        let snapshot = SavedChat(
            id: activeSavedChatID,
            messages: messages,
            updatedAt: Date()
        )
        SavedChatsStore.upsertInBackground(snapshot)
    }

    /// Replace the visible conversation with a previously saved chat.
    /// Clears the composer's attachments — the loaded chat is a different
    /// thread, so dragging the seeded context chip from the previous
    /// conversation forward would just confuse the next turn.
    private func loadSavedChat(_ chat: SavedChat) {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        // Make sure the current chat is committed before we swap it out
        // for the loaded one, so an in-progress conversation isn't lost.
        persistActiveChat()
        sendTask?.cancel()
        sendTask = nil
        activeSavedChatID = chat.id
        messages = chat.messages
        inputText = ""
        selectedContextIDs = []
        attachedFiles = []
        seededContextID = nil
        seededSelectionSourceID = nil
        seededSelectionRange = nil
        // The seeded selection chip from the parent flow no longer makes
        // sense in the context of a separate loaded conversation. Mark it
        // as already-seeded so attemptSeedSelection won't re-add it.
        didSeedSelection = true
        didSeedContext = true
        appliedRewriteKeys = []
        isLoading = false
        chatFailed = false
        rewriteFailed = false
        showSavedChatsPicker = false
    }

    private func attachMention(_ source: ChatContextSource) {
        if !selectedContextIDs.contains(source.id) {
            selectedContextIDs.insert(source.id)
        }
        // Picker-driven attachments surface as a chip above the input, so
        // we no longer splice "@<title>" into the typed text. The user may
        // have typed a bare "@" to trigger the picker — drop it so it
        // doesn't linger next to the new chip.
        if inputText.hasSuffix("@") {
            inputText.removeLast()
        }
        showMentionPicker = false
        inputFocused = true
    }

    /// Detaches a chip when the user taps its × button. Clears the right
    /// backing store depending on the source's origin: picker selections
    /// live in `selectedContextIDs`, the prefilled doc/note ID in
    /// `seededContextID`, and ad-hoc selection/file attachments also need
    /// removal from `attachedFiles` so they don't re-appear if re-picked.
    private func removeContext(_ source: ChatContextSource) {
        selectedContextIDs.remove(source.id)
        if seededContextID == source.id { seededContextID = nil }
        if seededSelectionSourceID == source.id {
            seededSelectionSourceID = nil
            seededSelectionRange = nil
        }
        if source.kind == .selection || source.kind == .file {
            attachedFiles.removeAll { $0.id == source.id }
        }
    }

    private func importFile(at url: URL) {
        fileImportTask?.cancel()
        fileImportTask = Task {
            let name = url.lastPathComponent
            let content = readFileContent(from: url)
            guard !Task.isCancelled else { return }
            await MainActor.run {
                let source = ChatContextSource(
                    id: "file:\(UUID().uuidString)",
                    kind: .file,
                    title: name,
                    preview: String(content.prefix(120)),
                    content: content
                )
                attachedFiles.append(source)
                attachMention(source)
            }
        }
    }

    private func readFileContent(from url: URL) -> String {
        guard url.startAccessingSecurityScopedResource() else { return "" }
        defer { url.stopAccessingSecurityScopedResource() }
        if url.pathExtension.lowercased() == "pdf" {
            return String((PDFDocument(url: url)?.string ?? "").prefix(8000))
        }
        guard let fh = try? FileHandle(forReadingFrom: url) else { return "" }
        defer { try? fh.close() }
        guard let data = try? fh.read(upToCount: 64_000) else { return "" }
        if let text = String(data: data, encoding: .utf8) { return String(text.prefix(8000)) }
        if let text = String(data: data, encoding: .isoLatin1) { return String(text.prefix(8000)) }
        return ""
    }

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    // MARK: Per-message rendering

    @ViewBuilder
    private func renderMessage(_ msg: ChatMessage) -> some View {
        if msg.role == "user" {
            if msg.attachedContext.isEmpty {
                MessageBubble(message: msg)
            } else {
                VStack(alignment: .trailing, spacing: 6) {
                    attachedContextRow(msg.attachedContext)
                    MessageBubble(message: msg)
                }
            }
        } else {
            let segments = AssistantParser.parse(msg.content)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(segments) { segment in
                    switch segment {
                    case .text(let text):
                        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                        if !trimmed.isEmpty {
                            MessageBubble(
                                message: ChatMessage(role: "assistant", content: trimmed)
                            )
                        }
                    case .rewrite(let suggestion):
                        RewriteSuggestionCard(
                            suggestion: suggestion,
                            isApplied: appliedRewriteKeys.contains(suggestion.stableKey),
                            onAccept: {
                                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                _ = acceptRewrite(suggestion)
                            }
                        )
                    }
                }
            }
        }
    }

    // MARK: Rewrite acceptance

    /// If the chat was seeded with a selection range and the rewrite's
    /// `before` text still matches what's at that range in the supplied
    /// body, returns the body with `after` spliced in at the same range.
    /// Returns nil when the range is unset, out of bounds, or no longer
    /// matches — callers fall back to a generic find/replace.
    private func applyRewriteAtSeededRange(
        in body: String,
        before: String,
        after: String
    ) -> String? {
        guard let nsRange = seededSelectionRange,
              let range = Range(nsRange, in: body) else { return nil }
        let current = String(body[range])
        // Accept either an exact match or the trimmed forms agreeing, so
        // a stray newline at the edge of the user's highlight doesn't
        // bounce a valid surgical edit.
        let normalize: (String) -> String = {
            $0.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard current == before || normalize(current) == normalize(before) else {
            return nil
        }
        var updated = body
        updated.replaceSubrange(range, with: after)
        return updated
    }

    /// Locate `before` inside `body` with a small set of fallbacks so a
    /// near-miss quote from the model still lands. Returns the body with
    /// `after` spliced in at the first matching span, or nil if no
    /// strategy found a span. Strategies, in order:
    /// 1. exact substring
    /// 2. whitespace-trimmed `before`
    /// 3. `before` with a leading "Title-ish:\n" line stripped — the
    ///    common failure where the model quotes the source title header
    ///    along with the body.
    private func applyRewriteByContains(
        in body: String,
        before: String,
        after: String
    ) -> String? {
        if body.contains(before) {
            return body.replacingOccurrences(of: before, with: after)
        }
        let trimmed = before.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty, trimmed != before, body.contains(trimmed) {
            return body.replacingOccurrences(of: trimmed, with: after)
        }
        if let newline = trimmed.range(of: "\n") {
            let firstLine = trimmed[trimmed.startIndex..<newline.lowerBound]
            let rest = String(trimmed[newline.upperBound...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            // Only strip the first line when it looks like a metadata
            // header — short, ends in ":", or is the source's title —
            // so we don't silently drop real body text.
            let looksLikeHeader = firstLine.hasSuffix(":") || firstLine.count <= 80
            if looksLikeHeader, !rest.isEmpty, body.contains(rest) {
                return body.replacingOccurrences(of: rest, with: after)
            }
        }
        return nil
    }

    /// Apply a rewrite suggestion against the attached context sources.
    /// Documents are persisted to `library_projects`; notes to NotesStore;
    /// in-session imported files mutate their local entry. Returns true
    /// if at least one source matched and was updated.
    @discardableResult
    private func acceptRewrite(_ suggestion: RewriteSuggestion) -> Bool {
        let before = suggestion.before
        let after = suggestion.after
        let attached = contextItems
        let attachedIds = Set(attached.map { $0.id })

        // Documents — persisted via @AppStorage("library_projects").
        // When the chat was seeded with a selection range pointing into
        // one of the attached docs, apply the rewrite at that exact
        // range rather than doing a document-wide find/replace, so a
        // surgical edit doesn't accidentally retarget a similar string
        // elsewhere in the body.
        var newProjects = cachedProjects
        var projectsChanged = false
        for idx in newProjects.indices {
            let sourceId = "doc:\(newProjects[idx].id.uuidString)"
            guard attachedIds.contains(sourceId) else { continue }
            if let updated = applyRewriteAtSeededRange(
                in: newProjects[idx].content,
                before: before,
                after: after
            ) {
                newProjects[idx].content = updated
                projectsChanged = true
            } else if let updated = applyRewriteByContains(
                in: newProjects[idx].content,
                before: before,
                after: after
            ) {
                newProjects[idx].content = updated
                projectsChanged = true
            }
        }
        if projectsChanged {
            if let encoded = try? JSONEncoder().encode(newProjects) {
                projectsData = encoded
                cachedProjects = newProjects
            }
            appliedRewriteKeys.insert(suggestion.stableKey)
            return true
        }

        // Notes — persisted via NotesStore.
        let attachedNoteIds = Set(
            attached.filter { $0.kind == .note }.map { $0.id }
        )
        if !attachedNoteIds.isEmpty {
            var allNotes = NotesStore.load()
            var notesChanged = false
            for idx in allNotes.indices {
                let sourceId = "note:\(allNotes[idx].id.uuidString)"
                guard attachedNoteIds.contains(sourceId) else { continue }
                if let updated = applyRewriteAtSeededRange(
                    in: allNotes[idx].body,
                    before: before,
                    after: after
                ) {
                    allNotes[idx].body = updated
                    allNotes[idx].updatedAt = Date()
                    notesChanged = true
                } else if let updated = applyRewriteByContains(
                    in: allNotes[idx].body,
                    before: before,
                    after: after
                ) {
                    allNotes[idx].body = updated
                    allNotes[idx].updatedAt = Date()
                    notesChanged = true
                }
            }
            if notesChanged {
                NotesStore.saveInBackground(allNotes)
                notes = allNotes
                appliedRewriteKeys.insert(suggestion.stableKey)
                return true
            }
        }

        // In-session imported files — no disk side, just patch the local
        // attachment so any follow-up turn sees the new content.
        var filesChanged = false
        for idx in attachedFiles.indices where attachedIds.contains(attachedFiles[idx].id) {
            if let updated = applyRewriteByContains(
                in: attachedFiles[idx].content,
                before: before,
                after: after
            ) {
                let f = attachedFiles[idx]
                attachedFiles[idx] = ChatContextSource(
                    id: f.id,
                    kind: f.kind,
                    title: f.title,
                    preview: f.preview,
                    content: updated
                )
                filesChanged = true
            }
        }
        if filesChanged {
            appliedRewriteKeys.insert(suggestion.stableKey)
            return true
        }

        rewriteFailed = true
        return false
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        messages.append(ChatMessage(role: "user", content: text, attachedContext: contextItems))
        // Persist the user turn immediately so a network drop, an app
        // termination, or a failed assistant call doesn't lose what the
        // user already typed and sent.
        persistActiveChat()
        inputText = ""
        // Dismiss the keyboard once the turn is in flight so the assistant's
        // reply (and any rewrite card) lands in the full screen height
        // instead of being shoved behind a still-raised keyboard.
        inputFocused = false
        isLoading = true
        let snapshot = messages
        let ctx = contextItems
        sendTask = Task {
            let outcome = await ChatService.send(messages: snapshot, contextItems: ctx)
            await MainActor.run {
                isLoading = false
                guard !Task.isCancelled else { return }
                switch outcome {
                case .success(let reply):
                    messages.append(ChatMessage(role: "assistant", content: reply))
                    persistActiveChat()
                case .failure(let err):
                    // Surface as an alert so the error doesn't masquerade as
                    // a model response in the chat history.
                    chatFailReason = err.userMessage
                    chatFailed = true
                }
            }
        }
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: ChatMessage
    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 56) }

            Text(isUser ? AttributedString(message.content) : AppMarkdown.render(message.content))
                // Canonical body-text rhythm (17pt, lineSpacing 12) — same
                // modifier note bodies and other reading copy use, so chat
                // doesn't read denser than the rest of the app. User bubbles
                // get the brand primary fill (iMessage-style) and override
                // the body-text colour to white so the saturated brown reads
                // as the user's "voice" in the thread.
                .appBodyText()
                .foregroundColor(isUser ? .white : AppInk.solid(0.92))
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? AnyShapeStyle(BrandColor.ctaPrimary) : AnyShapeStyle(AppInk.solid(0.05)))
                .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                        .stroke(isUser ? Color.clear : AppInk.solid(0.08), lineWidth: 0.5)
                )
                .textSelection(.enabled)

            if !isUser { Spacer(minLength: 56) }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }
}

// MARK: - Rewrite Suggestion Card

private struct RewriteSuggestionCard: View {
    let suggestion: RewriteSuggestion
    let isApplied: Bool
    let onAccept: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("From:")
                    .font(.app(size: 13, weight: .semibold))
                    .foregroundColor(AppText.secondary)
                Text(Self.renderMarkdown(suggestion.before))
                    .font(.appBody)
                    .foregroundColor(AppText.tertiary)
                    .strikethrough(true, color: AppInk.solid(0.35))
                    .lineSpacing(6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text("To:")
                    .font(.app(size: 13, weight: .semibold))
                    .foregroundColor(AppText.secondary)
                Text(Self.renderMarkdown(suggestion.after))
                    .font(.appBody)
                    .foregroundColor(AppText.primary)
                    .lineSpacing(6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }

            Button(action: onAccept) {
                HStack(spacing: 8) {
                    Image(systemName: isApplied ? "checkmark" : "arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                    Text(isApplied ? "Applied" : "Accept")
                        .font(.app(size: 15, weight: .semibold))
                }
                .foregroundColor(isApplied ? AppText.secondary : .white)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(isApplied ? AppInk.solid(0.08) : BrandColor.ctaPrimary)
                )
            }
            .buttonStyle(.plain)
            .disabled(isApplied)
            .accessibilityLabel(isApplied ? "Rewrite applied" : "Accept rewrite")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private static func renderMarkdown(_ text: String) -> AttributedString {
        let opts = AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .inlineOnlyPreservingWhitespace
        )
        return (try? AttributedString(markdown: text, options: opts))
            ?? AttributedString(text)
    }
}

// MARK: - Typing Indicator

private struct TypingIndicator: View {
    var body: some View {
        OrbitDotsCircle()
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Mention Picker Sheet

private struct MentionPickerSheet: View {
    let documents: [ChatContextSource]
    let notes: [ChatContextSource]
    let onSelect: (ChatContextSource) -> Void
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @FocusState private var fieldFocused: Bool

    private let cardBg = AppBackground.primary

    private var isEmpty: Bool { documents.isEmpty && notes.isEmpty }

    private var filteredDocuments: [ChatContextSource] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return documents }
        return documents.filter {
            $0.title.localizedCaseInsensitiveContains(q) ||
            $0.preview.localizedCaseInsensitiveContains(q)
        }
    }

    private var filteredNotes: [ChatContextSource] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return notes }
        return notes.filter {
            $0.title.localizedCaseInsensitiveContains(q) ||
            $0.preview.localizedCaseInsensitiveContains(q)
        }
    }

    private var hasResults: Bool { !filteredDocuments.isEmpty || !filteredNotes.isEmpty }

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture {
                    fieldFocused = false
                    dismiss()
                }

            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text("Mention")
                        .font(.appBodyBold)
                        .foregroundColor(AppText.primary)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button {
                        fieldFocused = false
                        dismiss()
                    } label: {
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
                    placeholder: "Search",
                    text: $query,
                    isFocused: $fieldFocused
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 12)

                if isEmpty {
                    VStack(spacing: 8) {
                        Spacer().frame(height: 28)
                        Image(systemName: "tray")
                            .font(.system(size: 32, weight: .light))
                            .foregroundColor(AppInk.solid(0.18))
                        Text("Nothing to mention yet")
                            .font(.appSubtext)
                            .foregroundColor(AppInk.solid(0.30))
                        Text("Create a note or document to reference it here.")
                            .font(.appSmall)
                            .foregroundColor(AppInk.solid(0.22))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                        Spacer().frame(height: 28)
                    }
                    .frame(maxWidth: .infinity)
                } else if !hasResults {
                    VStack(spacing: 8) {
                        Spacer().frame(height: 28)
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 32, weight: .light))
                            .foregroundColor(AppInk.solid(0.18))
                        Text("No results")
                            .font(.appSubtext)
                            .foregroundColor(AppInk.solid(0.30))
                        Spacer().frame(height: 28)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 0) {
                            if !filteredDocuments.isEmpty {
                                sectionRows(title: "Documents", items: filteredDocuments)
                            }
                            if !filteredNotes.isEmpty {
                                sectionRows(title: "Notes", items: filteredNotes)
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: 460, maxHeight: 520)
            .background(
                RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
                    .fill(cardBg)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
                    .stroke(AppInk.solid(0.08), lineWidth: 0.5)
            )
            .shadow(color: Color.black.opacity(0.45), radius: 30, y: 10)
            .padding(.horizontal, 14)
            .padding(.top, 72)
            .padding(.bottom, 24)
            .frame(maxHeight: .infinity, alignment: .top)
        }
    }

    @ViewBuilder
    private func sectionRows(title: String, items: [ChatContextSource]) -> some View {
        HStack {
            Text(title)
                .font(.app(size: 11, weight: .semibold))
                .foregroundColor(AppInk.solid(0.40))
                .textCase(.uppercase)
                .tracking(0.5)
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 4)

        ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onSelect(item)
            } label: {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: icon(for: item.kind))
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(AppInk.solid(0.55))
                        .frame(width: 24, height: 24)
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.app(size: 16, weight: .medium))
                            .foregroundColor(AppInk.solid(0.92))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        if !item.preview.isEmpty {
                            Text(item.preview)
                                .font(.appSmall)
                                .foregroundColor(AppText.tertiary)
                                .lineLimit(1)
                        }
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if idx < items.count - 1 {
                Rectangle()
                    .fill(AppInk.solid(0.05))
                    .frame(height: 0.5)
                    .padding(.leading, 54)
            }
        }
    }

    private func icon(for kind: ChatContextSource.Kind) -> String {
        switch kind {
        case .document:  return "doc.text"
        case .note:      return "note.text"
        case .file:      return "paperclip"
        case .selection: return "text.cursor"
        }
    }
}

// MARK: - Saved Chats Sheet

/// Bottom sheet listing previously saved chats so the user can resume
/// one. Grouped by recency (Today / Past week / Older) with a minimal
/// row style — title on the left, short relative stamp on the right —
/// to match the native iOS chat-history feel rather than the heavier
/// card-row pattern used elsewhere in the app.
private struct SavedChatsSheet: View {
    let currentChatID: UUID
    let onSelect: (SavedChat) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var chats: [SavedChat] = []
    @State private var loaded: Bool = false

    private struct Group: Identifiable {
        let label: String
        let chats: [SavedChat]
        var id: String { label }
    }

    var body: some View {
        VStack(spacing: 0) {
            if loaded && chats.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "bubble.left.and.bubble.right")
                        .font(.app(size: 32, weight: .regular))
                        .foregroundColor(AppInk.solid(0.20))
                    Text("No saved chats yet")
                        .font(.app(size: 15))
                        .foregroundColor(AppInk.solid(0.30))
                    Text("Chats are saved automatically as you go. They'll show up here.")
                        .font(.app(size: 13))
                        .foregroundColor(AppInk.solid(0.22))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        ForEach(groupedChats) { group in
                            sectionHeader(group.label)
                            ForEach(group.chats) { chat in
                                row(chat)
                            }
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(AppBackground.primary)
        .task {
            chats = await SavedChatsStore.loadAsync()
            loaded = true
        }
    }

    /// Splits the loaded list into Today / Past week / Older buckets and
    /// drops any bucket that ended up empty so the section divider line
    /// isn't left dangling over nothing.
    private var groupedChats: [Group] {
        let cal = Calendar.current
        let now = Date()
        var today: [SavedChat] = []
        var pastWeek: [SavedChat] = []
        var older: [SavedChat] = []
        for chat in chats {
            if cal.isDateInToday(chat.updatedAt) {
                today.append(chat)
                continue
            }
            let days = cal.dateComponents(
                [.day],
                from: cal.startOfDay(for: chat.updatedAt),
                to: cal.startOfDay(for: now)
            ).day ?? 0
            if days < 7 { pastWeek.append(chat) } else { older.append(chat) }
        }
        var out: [Group] = []
        if !today.isEmpty    { out.append(Group(label: "Today",     chats: today))    }
        if !pastWeek.isEmpty { out.append(Group(label: "Past week", chats: pastWeek)) }
        if !older.isEmpty    { out.append(Group(label: "Older",     chats: older))    }
        return out
    }

    /// Section header with a hairline that extends to the right edge —
    /// the standard "history" list pattern (Apple Maps recents, iMessage
    /// search, etc.) so the sheet reads as native rather than bespoke.
    private func sectionHeader(_ label: String) -> some View {
        HStack(spacing: 12) {
            Text(label)
                .font(.app(size: 13, weight: .medium))
                .foregroundColor(AppInk.solid(0.45))
            Rectangle()
                .fill(AppInk.solid(0.10))
                .frame(height: 0.5)
                .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 20)
        .padding(.top, 18)
        .padding(.bottom, 6)
    }

    private func row(_ chat: SavedChat) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onSelect(chat)
        } label: {
            HStack(spacing: 12) {
                Text(chat.title)
                    .font(.app(size: 17))
                    .foregroundColor(AppInk.solid(0.92))
                    .lineLimit(1)
                    .truncationMode(.tail)
                Spacer(minLength: 8)
                Text(SavedChatsSheet.shortRelative(chat.updatedAt))
                    .font(.app(size: 15))
                    .foregroundColor(AppInk.solid(0.42))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(role: .destructive) {
                deleteChat(chat)
            } label: {
                Label("Delete chat", systemImage: "trash")
            }
        }
    }

    private func deleteChat(_ chat: SavedChat) {
        SavedChatsStore.deleteInBackground(chat.id)
        chats.removeAll { $0.id == chat.id }
    }

    private static let timeFmt: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f
    }()

    /// Compact relative stamp: time for today, then `Nd` for days, `Nw`
    /// for weeks, `Ny` once the chat is more than a year old. Matches the
    /// "4d / 5d / 1w / 7w" abbreviation pattern of native history lists.
    static func shortRelative(_ date: Date) -> String {
        let cal = Calendar.current
        let now = Date()
        if cal.isDateInToday(date) { return timeFmt.string(from: date) }
        let days = cal.dateComponents(
            [.day],
            from: cal.startOfDay(for: date),
            to: cal.startOfDay(for: now)
        ).day ?? 0
        if days < 7 { return "\(max(days, 1))d" }
        let weeks = days / 7
        if weeks < 52 { return "\(weeks)w" }
        return "\(weeks / 52)y"
    }
}

// MARK: - Mention-styled composer text view

/// UITextView-backed editor for the chat composer so we can render
/// `@<source title>` mentions with a different colour while the user
/// types — SwiftUI's TextField only supports a single uniform foreground.
///
/// The previous implementation stacked a styled `Text(AttributedString)`
/// over a transparent TextField; the two layers laid out glyphs
/// differently and taps landed in the wrong character. Wrapping a
/// UITextView keeps editing and rendering in the same view, so the
/// styling can't desync from the cursor.
private struct MentionTextView: UIViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    let placeholder: String
    let maxLines: Int
    let buildAttributed: (String) -> NSAttributedString

    private static let font = UIFont.systemFont(ofSize: 17)
    private static let horizontalInset: CGFloat = 9
    private static let verticalInset: CGFloat = 10
    private static let lineFragmentPadding: CGFloat = 5

    func makeUIView(context: Context) -> ChatComposerUITextView {
        let tv = ChatComposerUITextView()
        tv.delegate = context.coordinator
        tv.backgroundColor = .clear
        tv.font = Self.font
        tv.tintColor = UIColor(AppText.primary)
        tv.isScrollEnabled = false
        tv.textContainer.lineFragmentPadding = Self.lineFragmentPadding
        tv.textContainerInset = UIEdgeInsets(
            top: Self.verticalInset,
            left: Self.horizontalInset,
            bottom: Self.verticalInset,
            right: Self.horizontalInset
        )
        // Hug content vertically so SwiftUI's VStack lays us out at the
        // intrinsic height (one line until we have more) rather than
        // stretching to fill the available space.
        tv.setContentHuggingPriority(.defaultHigh, for: .vertical)
        tv.setContentCompressionResistancePriority(.defaultHigh, for: .vertical)
        // Horizontally, defer to the parent's width so long unbroken text
        // wraps inside the bubble instead of stretching the whole composer
        // (and the sibling quick-actions row) past the screen edges.
        tv.setContentHuggingPriority(.defaultLow, for: .horizontal)
        tv.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        tv.placeholder = placeholder
        tv.maxLines = maxLines
        tv.attributedText = buildAttributed(text)
        return tv
    }

    func updateUIView(_ tv: ChatComposerUITextView, context: Context) {
        let coordinator = context.coordinator
        // Re-style only when the external string actually diverges from
        // what the view holds, otherwise every typed character would
        // bounce through a full attributedText assignment and we'd lose
        // the in-flight selection.
        if tv.text != text {
            let sel = tv.selectedRange
            coordinator.suppressEcho = true
            tv.attributedText = buildAttributed(text)
            let len = (tv.text as NSString).length
            tv.selectedRange = NSRange(
                location: min(sel.location, len),
                length: min(sel.length, max(0, len - sel.location))
            )
            coordinator.suppressEcho = false
        }
        if tv.placeholder != placeholder {
            tv.placeholder = placeholder
        }
        tv.refreshPlaceholderVisibility()
        DispatchQueue.main.async {
            if isFocused && !tv.isFirstResponder {
                tv.becomeFirstResponder()
            } else if !isFocused && tv.isFirstResponder {
                tv.resignFirstResponder()
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        let parent: MentionTextView
        var suppressEcho = false
        init(_ parent: MentionTextView) { self.parent = parent }

        func textViewDidChange(_ tv: UITextView) {
            guard !suppressEcho else { return }
            let newText = tv.text ?? ""
            if parent.text != newText { parent.text = newText }
            let sel = tv.selectedRange
            tv.attributedText = parent.buildAttributed(newText)
            tv.selectedRange = sel
            (tv as? ChatComposerUITextView)?.refreshPlaceholderVisibility()
        }

        func textViewDidBeginEditing(_ tv: UITextView) {
            if !parent.isFocused { parent.isFocused = true }
        }

        func textViewDidEndEditing(_ tv: UITextView) {
            if parent.isFocused { parent.isFocused = false }
        }
    }
}

private final class ChatComposerUITextView: UITextView {
    private let placeholderLabel = UILabel()
    private var placeholderLeading: NSLayoutConstraint!
    private var placeholderTrailing: NSLayoutConstraint!
    private var placeholderTop: NSLayoutConstraint!
    var placeholder: String = "" {
        didSet {
            placeholderLabel.text = placeholder
            refreshPlaceholderVisibility()
        }
    }
    /// Caps the intrinsic height to ~maxLines rows so the field grows
    /// with content but eventually scrolls instead of pushing the whole
    /// input area off screen.
    var maxLines: Int = 5

    override init(frame: CGRect, textContainer: NSTextContainer?) {
        super.init(frame: frame, textContainer: textContainer)
        configure()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        configure()
    }

    // The placeholder mirrors the typed text's font and lead-in inset so
    // "Ask anything…" sits exactly where the first typed glyph will land.
    // Both the textview font and the textContainerInset are assigned by
    // MentionTextView *after* init, so we hook the setters to keep the
    // placeholder in lockstep instead of capturing stale defaults at
    // configure() time.
    override var font: UIFont? {
        didSet { placeholderLabel.font = font ?? .systemFont(ofSize: 17) }
    }

    override var textContainerInset: UIEdgeInsets {
        didSet { syncPlaceholderInsets() }
    }

    private func syncPlaceholderInsets() {
        guard placeholderLeading != nil else { return }
        let pad = textContainer.lineFragmentPadding
        placeholderLeading.constant = textContainerInset.left + pad
        placeholderTrailing.constant = -(textContainerInset.right + pad)
        placeholderTop.constant = textContainerInset.top
    }

    private func configure() {
        placeholderLabel.font = .systemFont(ofSize: 17)
        placeholderLabel.textColor = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.28)
                : AppInk.lightInk.withAlphaComponent(0.36)
        }
        placeholderLabel.numberOfLines = 1
        placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(placeholderLabel)
        placeholderLeading = placeholderLabel.leadingAnchor.constraint(
            equalTo: leadingAnchor,
            constant: textContainerInset.left + textContainer.lineFragmentPadding
        )
        placeholderTrailing = placeholderLabel.trailingAnchor.constraint(
            lessThanOrEqualTo: trailingAnchor,
            constant: -(textContainerInset.right + textContainer.lineFragmentPadding)
        )
        placeholderTop = placeholderLabel.topAnchor.constraint(
            equalTo: topAnchor,
            constant: textContainerInset.top
        )
        NSLayoutConstraint.activate([
            placeholderLeading,
            placeholderTrailing,
            placeholderTop
        ])
    }

    func refreshPlaceholderVisibility() {
        placeholderLabel.isHidden = !(text?.isEmpty ?? true)
    }

    override var intrinsicContentSize: CGSize {
        let base = super.intrinsicContentSize
        let lineHeight = (font ?? .systemFont(ofSize: 17)).lineHeight
        let cap = lineHeight * CGFloat(maxLines) + textContainerInset.top + textContainerInset.bottom
        // Width must be noIntrinsicMetric so SwiftUI gives us the parent's
        // width and the text container wraps; otherwise a long pasted line
        // reports its full unbroken width here and stretches the composer.
        let height: CGFloat
        if base.height > cap {
            isScrollEnabled = true
            height = cap
        } else {
            isScrollEnabled = false
            height = base.height
        }
        return CGSize(width: UIView.noIntrinsicMetric, height: height)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        invalidateIntrinsicContentSize()
    }
}
