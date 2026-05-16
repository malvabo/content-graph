import SwiftUI
import UniformTypeIdentifiers
import PDFKit

// MARK: - Chat Message Model

struct ChatMessage: Identifiable {
    var id = UUID()
    var role: String // "user" or "assistant"
    var content: String
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
struct ChatContextSource: Identifiable, Equatable {
    enum Kind: String { case document, note, file }

    let id: String
    let kind: Kind
    let title: String      // displayed in the @-mention and picker
    let preview: String    // single-line subtitle in the picker
    let content: String    // full body sent to the API
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
        rephrase, or otherwise replace a specific span of text inside the \
        attached context, emit the change as a structured rewrite block \
        instead of (or in addition to) explaining it in prose:

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
        - For broad rewrites of an entire document, do not use this \
        block — answer normally. The block is for surgical edits.
        """
        if !contextItems.isEmpty {
            let ctx = contextItems.map {
                let body = $0.content.isEmpty ? $0.preview : $0.content
                return "[\($0.kind.rawValue)] \($0.title):\n\(body)"
            }.joined(separator: "\n\n---\n\n")
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

// MARK: - Chat View

struct ChatView: View {
    var initialContextIDs: Set<UUID> = []
    var initialNoteContextID: UUID? = nil

    @Environment(\.dismiss) private var dismiss
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var showMentionPicker = false
    @State private var showFilePicker = false
    @State private var selectedContextIDs: Set<String> = []
    @State private var seededContextID: String? = nil
    @State private var didSeedContext = false
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
    @FocusState private var inputFocused: Bool

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
                    content: note.body
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

    /// Render `inputText` with each known `@<source title>` mention given a
    /// subtle background highlight, so mentions read as inline tags inside
    /// the composer. Titles can contain spaces, so we can't use a regex —
    /// instead we match each known source title literally, longest-first
    /// so "@New topic" wins over a stray "@New" prefix.
    private var highlightedInputText: AttributedString {
        let inkColor = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.92)
                : UIColor(white: 0.0, alpha: 0.88)
        }
        let mentionBg = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.16)
                : UIColor(white: 0.0, alpha: 0.08)
        }
        let mentionFg = UIColor { trait in
            trait.userInterfaceStyle == .dark
                ? UIColor(white: 1.0, alpha: 0.96)
                : UIColor(white: 0.0, alpha: 0.78)
        }
        let ns = NSMutableAttributedString(
            string: inputText,
            attributes: [
                .font: UIFont.systemFont(ofSize: 17),
                .foregroundColor: inkColor
            ]
        )
        let titles = allSources.map(\.title).sorted { $0.count > $1.count }
        let nsStr = inputText as NSString
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
        return AttributedString(ns)
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
        guard !didSeedContext else { return }
        if let id = initialContextIDs.first,
           let proj = cachedProjects.first(where: { $0.id == id }) {
            seededContextID = "doc:\(proj.id.uuidString)"
            inputText = "@\(proj.title) "
            didSeedContext = true
            return
        }
        if let id = initialNoteContextID,
           let note = notes.first(where: { $0.id == id }), !note.isEmpty {
            seededContextID = "note:\(note.id.uuidString)"
            inputText = "@\(note.displayTitle) "
            didSeedContext = true
        }
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                Rectangle()
                    .fill(AppInk.solid(0.06))
                    .frame(height: 0.5)

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
        .sheet(isPresented: $showMentionPicker) {
            MentionPickerSheet(
                documents: documentSources,
                notes: noteSources,
                onSelect: { source in
                    attachMention(source)
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

    private var header: some View {
        HStack(spacing: 0) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(AppInk.solid(0.65))
                    .frame(width: 36, height: 36)
                    .background(AppInk.solid(0.08))
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
                presentMentionPicker()
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(
                        selectedContextIDs.isEmpty
                            ? AppInk.solid(availableMentions.isEmpty ? 0.18 : 0.55)
                            : .white
                    )
                    .frame(width: 36, height: 36)
                    .background(AppInk.solid(0.07))
                    .clipShape(Circle())
                    .appIconHitArea()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Library context")
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

    private var inputArea: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                ZStack(alignment: .topLeading) {
                    if inputText.isEmpty {
                        Text("Ask anything\u{2026}")
                            .font(.appBody)
                            .foregroundColor(AppInk.solid(0.28))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .allowsHitTesting(false)
                    } else {
                        Text(highlightedInputText)
                            .font(.appBody)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                            .allowsHitTesting(false)
                    }
                    TextField("", text: $inputText, axis: .vertical)
                        .font(.appBody)
                        .foregroundColor(.clear)
                        .tint(AppText.primary)
                        .focused($inputFocused)
                        .lineLimit(1...5)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                }

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
                            .foregroundColor(ready ? .white : AppInk.solid(0.28))
                            .frame(width: 32, height: 32)
                            .background(ready ? AppInk.solid(0.18) : AppInk.solid(0.06))
                            .clipShape(Circle())
                            .overlay(
                                Circle().stroke(
                                    ready ? AppInk.solid(0.22) : AppInk.solid(0.08),
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

    private func attachMention(_ source: ChatContextSource) {
        if !selectedContextIDs.contains(source.id) {
            selectedContextIDs.insert(source.id)
        }
        let mention = "@\(source.title) "
        // Avoid stacking duplicates when the user re-picks the same item.
        if !inputText.contains(mention) {
            // Strip a dangling "@" the user may have typed before opening
            // the sheet, so we don't leave "@@instagram" behind.
            if inputText.hasSuffix("@") {
                inputText.removeLast()
            }
            inputText += mention
        }
        showMentionPicker = false
        inputFocused = true
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
            MessageBubble(message: msg)
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
        var newProjects = cachedProjects
        var projectsChanged = false
        for idx in newProjects.indices {
            let sourceId = "doc:\(newProjects[idx].id.uuidString)"
            guard attachedIds.contains(sourceId) else { continue }
            if newProjects[idx].content.contains(before) {
                newProjects[idx].content = newProjects[idx]
                    .content.replacingOccurrences(of: before, with: after)
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
                if allNotes[idx].body.contains(before) {
                    allNotes[idx].body = allNotes[idx]
                        .body.replacingOccurrences(of: before, with: after)
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
            if attachedFiles[idx].content.contains(before) {
                let f = attachedFiles[idx]
                attachedFiles[idx] = ChatContextSource(
                    id: f.id,
                    kind: f.kind,
                    title: f.title,
                    preview: f.preview,
                    content: f.content.replacingOccurrences(of: before, with: after)
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
        messages.append(ChatMessage(role: "user", content: text))
        inputText = ""
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
                .font(.appBody)
                .foregroundColor(AppText.primary)
                .lineSpacing(3)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? AppInk.solid(0.12) : AppInk.solid(0.05))
                .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                        .stroke(AppInk.solid(isUser ? 0.14 : 0.08), lineWidth: 0.5)
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
            tagLabel("SUGGESTED REWRITE", icon: "wand.and.stars")

            diffBlock(
                label: "FROM",
                text: suggestion.before,
                fill: AppInk.solid(0.04),
                stroke: AppInk.solid(0.08),
                textColor: AppText.secondary,
                strike: true
            )

            HStack(spacing: 0) {
                Spacer()
                Image(systemName: "arrow.down")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(AppText.tertiary)
                    .frame(width: 22, height: 22)
                    .background(Circle().fill(AppInk.solid(0.06)))
                Spacer()
            }

            diffBlock(
                label: "TO",
                text: suggestion.after,
                fill: AppInk.solid(0.08),
                stroke: BrandColor.amber.opacity(0.35),
                textColor: AppText.primary,
                strike: false
            )

            Button(action: onAccept) {
                HStack(spacing: 8) {
                    Image(systemName: isApplied ? "checkmark" : "arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                    Text(isApplied ? "Applied" : "Accept")
                        .font(.app(size: 15, weight: .semibold))
                }
                .foregroundColor(isApplied ? AppText.secondary : .black)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(isApplied ? AppInk.solid(0.08) : BrandColor.amber)
                )
            }
            .buttonStyle(.plain)
            .disabled(isApplied)
            .accessibilityLabel(isApplied ? "Rewrite applied" : "Accept rewrite")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppInk.solid(0.05))
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .stroke(AppInk.solid(0.10), lineWidth: 0.5)
        )
    }

    /// Small uppercase monospaced label, mirroring the onboarding pill tags.
    @ViewBuilder
    private func tagLabel(_ text: String, icon: String? = nil) -> some View {
        HStack(spacing: 6) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .medium))
            }
            Text(text)
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .kerning(0.6)
        }
        .foregroundColor(AppText.tertiary)
    }

    @ViewBuilder
    private func diffBlock(
        label: String,
        text: String,
        fill: Color,
        stroke: Color,
        textColor: Color,
        strike: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            tagLabel(label)
            // `Text(verbatim:)` so source text containing markdown like
            // `**word**` renders literally instead of as bold — the diff is
            // about the exact bytes that will be replaced, not the rendered form.
            Text(verbatim: text)
                .font(.system(size: 14, weight: .regular, design: .monospaced))
                .foregroundColor(textColor)
                .strikethrough(strike, color: AppText.tertiary)
                .lineSpacing(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(fill)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(stroke, lineWidth: 0.5)
                )
                .textSelection(.enabled)
        }
    }
}

// MARK: - Typing Indicator

private struct TypingIndicator: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(AppInk.solid(phase == i ? 0.60 : 0.18))
                    .frame(width: 6, height: 6)
                    .animation(.easeInOut(duration: 0.28), value: phase)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(AppInk.solid(0.05))
        .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            while true {
                do { try await Task.sleep(nanoseconds: 380_000_000) }
                catch { break }
                phase = (phase + 1) % 3
            }
        }
    }
}

// MARK: - Mention Picker Sheet

private struct MentionPickerSheet: View {
    let documents: [ChatContextSource]
    let notes: [ChatContextSource]
    let onSelect: (ChatContextSource) -> Void
    @Environment(\.dismiss) private var dismiss

    private var isEmpty: Bool { documents.isEmpty && notes.isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.app(size: 13, weight: .semibold))
                        .foregroundColor(AppInk.solid(0.60))
                        .frame(width: 28, height: 28)
                        .background(AppInk.solid(0.10))
                        .clipShape(Circle())
                        .appIconHitArea()
                }
                .accessibilityLabel("Close")
                Spacer(minLength: 0)
                Text("Mention")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(AppText.primary)
                Spacer(minLength: 0)
                Color.clear.frame(width: 28, height: 28)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Rectangle()
                .fill(AppInk.solid(0.06))
                .frame(height: 0.5)

            if isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.app(size: 32, weight: .regular))
                        .foregroundColor(AppInk.solid(0.20))
                    Text("Nothing to mention yet")
                        .font(.app(size: 15))
                        .foregroundColor(AppInk.solid(0.30))
                    Text("Create a note or document to reference it here.")
                        .font(.app(size: 13))
                        .foregroundColor(AppInk.solid(0.22))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 16) {
                        if !documents.isEmpty {
                            section(title: "Documents", items: documents)
                        }
                        if !notes.isEmpty {
                            section(title: "Notes", items: notes)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(AppBackground.primary)
    }

    @ViewBuilder
    private func section(title: String, items: [ChatContextSource]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.app(size: 12, weight: .semibold))
                .foregroundColor(AppInk.solid(0.45))
                .textCase(.uppercase)
                .padding(.horizontal, 4)

            VStack(spacing: 6) {
                ForEach(items) { item in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onSelect(item)
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: icon(for: item.kind))
                                .font(.system(size: 14, weight: .regular))
                                .foregroundColor(AppInk.solid(0.55))
                                .frame(width: 20)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.app(size: 14, weight: .semibold))
                                    .foregroundColor(AppInk.solid(0.88))
                                    .lineLimit(1)
                                if !item.preview.isEmpty {
                                    Text(item.preview)
                                        .font(.app(size: 12))
                                        .foregroundColor(AppInk.solid(0.40))
                                        .lineLimit(1)
                                }
                            }
                            Spacer()
                        }
                        .padding(14)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(AppInk.solid(0.04))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(AppInk.solid(0.06), lineWidth: 0.5)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func icon(for kind: ChatContextSource.Kind) -> String {
        switch kind {
        case .document: return "doc.text"
        case .note: return "note.text"
        case .file: return "paperclip"
        }
    }
}
