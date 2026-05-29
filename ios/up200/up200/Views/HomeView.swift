import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Speech
import AVFoundation
import PDFKit
import Vision

// MARK: - Source Item Model

enum SourceType: String, Identifiable {
    case text, link, file, voice, image, note
    var id: String { rawValue }
}

// Sheet states for the Sources block. The picker case opens the import
// chooser; the others present the input UIs. Files and photos use the
// system fileImporter / photosPicker and stay on their own Bools.
enum SourceSheet: Identifiable, Hashable {
    case picker, text, link, voice, note
    var id: Self { self }
}

struct SourceItem: Identifiable {
    let id = UUID()
    let type: SourceType
    var label: String
    var content: String = ""

    var icon: String {
        switch type {
        case .text:  return "text.alignleft"
        case .link:  return "link"
        case .file:  return "doc.text"
        case .voice: return "mic"
        case .image: return "photo"
        case .note:  return "note.text"
        }
    }
}

// MARK: - Format & Template Models

struct ContentFormat: Identifiable {
    let id: String
    let label: String
    let description: String
}

let allFormats: [ContentFormat] = [
    ContentFormat(id: "newsletter",     label: "Newsletter",         description: "Digest with key takeaways from your source"),
    ContentFormat(id: "linkedin",       label: "LinkedIn Post",      description: "Professional hook post, 150–300 words"),
    ContentFormat(id: "twitter",        label: "Twitter Thread",     description: "5–10 tweet thread from your source"),
    ContentFormat(id: "blog",           label: "Blog Post",          description: "Long-form SEO-friendly article"),
    ContentFormat(id: "email",          label: "Email",              description: "Concise campaign or outreach email"),
    ContentFormat(id: "instagram",      label: "Instagram Caption",  description: "Short engaging caption with hashtags"),
    ContentFormat(id: "youtube",        label: "YouTube Script",     description: "Hook, body & CTA for video"),
    ContentFormat(id: "podcast",        label: "Podcast Script",     description: "Episode outline and talking points"),
    ContentFormat(id: "press",          label: "Press Release",      description: "Formal media announcement"),
    ContentFormat(id: "landing",        label: "Landing Page",       description: "Headline, sections and CTA copy"),
    ContentFormat(id: "twitter-single", label: "Twitter Single",     description: "Most quotable insight, one tweet"),
    ContentFormat(id: "video",          label: "Video Script",       description: "AI video generation script"),
    ContentFormat(id: "message",        label: "Message",            description: "Short conversational message or text"),
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

// MARK: - AI Title Service

struct AIService {
    private static var apiKey: String { KeychainService.load() ?? "" }

    /// Treat an AI-generated title as redundant when it just rephrases
    /// the body's first line — exact match, one containing the other,
    /// or matching once case and punctuation are stripped. Without this
    /// fuzzier check a body starting with "Fragmented speech workflow"
    /// can still get an AI title like "Fragmented Speech Workflow." or
    /// "Fragmented speech workflow notes" prepended, leaving two
    /// near-identical title-looking lines at the top of the note.
    static func titleDuplicatesFirstLine(_ aiTitle: String, firstLine: String) -> Bool {
        let normalize: (String) -> String = { s in
            s.lowercased()
                .components(separatedBy: .punctuationCharacters).joined()
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }
                .joined(separator: " ")
        }
        let t = normalize(aiTitle)
        let f = normalize(firstLine)
        guard !t.isEmpty, !f.isEmpty else { return t == f }
        return t == f || f.contains(t) || t.contains(f)
    }

    static func generateTitle(from text: String) async -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Untitled" }
        if !apiKey.isEmpty, let title = await callAnthropic(text: trimmed), !title.isEmpty {
            return title
        }
        return fallback(from: trimmed)
    }

    private static func callAnthropic(text: String) async -> String? {
        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 50,
            "system": titleSystemPrompt,
            "messages": [["role": "user", "content": String(text.prefix(1200))]]
        ]
        let req = AnthropicClient.makeRequest(body: body, timeout: 8)

        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return nil }

        return sanitize(text)
    }

    /// Embodies the `note-titler` skill: the title sits in a note app, so it
    /// has to read well in a list of fifty other notes and help the user
    /// find this one later.
    private static let titleSystemPrompt = """
    You title notes. The title sits in a note app, so it has to read well in a list of fifty other notes and help the user find this one later.

    Output exactly one title and nothing else:
    - 2 to 6 words — always a complete, self-contained phrase (never end on a preposition, conjunction, or article)
    - Sentence case: capitalize the first word and proper nouns only
    - No quotes, no trailing punctuation, no emoji, no preamble
    - No em-dashes; use a colon if you need separation
    - Match the language of the input

    The title passes two tests: a glance reads it in under a second (scannability), and two notes on neighboring topics get titles you can tell apart (specificity).

    Lead with the concrete subject. "Q3 hiring plan" beats "Thoughts on hiring." For meetings, name the meeting. For journals, name the event or feeling. For reading, name the source or claim. For code, name the function or thing being built. If the document already opens with a clear heading, tighten and reuse it.

    Avoid: generic openers ("Notes on", "Thoughts about", "Reflections on"), throat-clearing ("some", "various", "miscellaneous"), filler adjectives ("interesting", "important", "useful", "quick"), date stamps, and punctuation theatrics. For sensitive content, keep the title discreet — it may be visible on a lock screen.

    Examples:
    Input: free-writing about feeling stuck waiting on agency responses for a visa petition
    Output: Visa petition stuck

    Input: SceneKit camera setup with commented lens choices and field of view math
    Output: SceneKit camera setup

    Input: long brainstorm on onboarding flow ideas for a new plant care app
    Output: Plant care onboarding

    Input: notes on building design culture and psychological safety in a team
    Output: Building design culture
    """

    /// Strips the wrappers a model sometimes adds — surrounding quotes, leading
    /// "Title:" labels, trailing punctuation — collapses to one line, and
    /// trims to at most six words. Trailing connectors/articles (and, or, the…)
    /// are stripped so a cut phrase never ends mid-thought.
    /// Connector/article words that should never appear at the end of a title.
    /// Shared by sanitize() and indirectly related to the stop list in fallback().
    private static let trailingStopWords: Set<String> = [
        "and","or","the","a","an","of","in","on","at","to","for","by","with","from","but","nor"
    ]

    static func sanitize(_ raw: String) -> String {
        var t = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let nl = t.firstIndex(where: \.isNewline) { t = String(t[..<nl]) }
        // Strip surrounding quotes FIRST so ‘”Title: foo”’ doesn’t fool the
        // prefix check below (leading ‘”’ would make hasPrefix(“title:”) false).
        let trimChars = CharacterSet(charactersIn: "\"'\u{201C}\u{201D}\u{2018}\u{2019}`.,;:!?\u{2014}\u{2013}-")
        t = t.trimmingCharacters(in: trimChars).trimmingCharacters(in: .whitespacesAndNewlines)
        if t.lowercased().hasPrefix("title:") {
            t = String(t.dropFirst("title:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        t = t.trimmingCharacters(in: trimChars).trimmingCharacters(in: .whitespacesAndNewlines)
        var words = t.split(whereSeparator: \.isWhitespace).prefix(6).map(String.init)
        while let last = words.last, trailingStopWords.contains(last.lowercased()) {
            words.removeLast()
        }
        return words.joined(separator: " ")
    }

    private static let fallbackStopWords: Set<String> = [
        "the","a","an","is","it","in","on","at","to","for","of","and","or","but",
        "i","you","we","they","this","that","with","from","by","as","be","are",
        "was","were","have","has","had","do","did","will","would","could","should"
    ]

    static func fallback(from text: String) -> String {
        let stop = fallbackStopWords
        let firstLine = text.split(whereSeparator: \.isNewline).first.map(String.init) ?? text
        let words = firstLine.split { !$0.isLetter && !$0.isNumber }
            .map(String.init)
            .filter { $0.count > 2 && !stop.contains($0.lowercased()) }
        let picked = Array(words.prefix(5))
        guard !picked.isEmpty else { return "Untitled" }
        // Sentence case: first word capitalized, rest lowercase except all-caps
        // tokens (likely acronyms) which we preserve.
        let cased: [String] = picked.enumerated().map { idx, w in
            let isAcronym = w.count <= 5 && w == w.uppercased() && w.contains(where: \.isLetter)
            if isAcronym { return w }
            return idx == 0 ? w.prefix(1).uppercased() + w.dropFirst().lowercased() : w.lowercased()
        }
        return cased.joined(separator: " ")
    }

    /// Returns a body with a fresh AI title (2–6 words) prepended as the first
    /// line, or nil when the body already looks titled, when the generated
    /// title duplicates the existing first line, or when generation fails.
    /// Shared by every call site that lands a raw transcript on disk so the
    /// notes list never shows a "first line" instead of a summary.
    static func prependTitleIfMissing(to body: String) async -> String? {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        // Treat a short (≤6 word) first line as an existing title — whether or
        // not a newline follows. A note like "Buy milk tomorrow" (no newline,
        // ≤6 words) is complete on its own and should not get a title prepended.
        // Keep this threshold in sync with needsTitle() in NotesView.swift.
        let existingFirstLine = trimmed.firstIndex(of: "\n")
            .map { String(trimmed[..<$0]) } ?? trimmed
        if existingFirstLine.split(whereSeparator: \.isWhitespace).count <= 6 { return nil }
        let aiTitle = await generateTitle(from: trimmed)
        let cleaned = aiTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return nil }
        let firstLine = trimmed.split(whereSeparator: \.isNewline).first
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } ?? ""
        guard !titleDuplicatesFirstLine(cleaned, firstLine: firstLine) else { return nil }
        return cleaned + "\n" + body
    }
}

// MARK: - Content Generator

/// Module-internal so a custom host (Minimal 1's note detail page) can
/// receive results directly via `HomeView.resultsHandler` instead of
/// letting HomeView write to the shared `library_projects` blob.
struct GeneratedResult: Identifiable {
    let id = UUID()
    let formatID: String
    let formatLabel: String
    let content: String
}

struct ContentGenerator {
    static var isKeyConfigured: Bool { AnthropicClient.isConfigured }

    static func generate(
        sources: [SourceItem],
        formatID: String,
        formatLabel: String,
        customPrompt: String,
        brand: String
    ) async -> Result<String, APICallError> {
        let sourceText = sources
            .filter { !$0.content.isEmpty }
            .enumerated()
            .map { idx, s in "Source \(idx + 1) — \(s.label):\n\(s.content)" }
            .joined(separator: "\n\n---\n\n")

        var userParts: [String] = []
        if !sourceText.isEmpty { userParts.append(sourceText) }
        let trimmedPrompt = customPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedPrompt.isEmpty { userParts.append("Additional instructions: \(trimmedPrompt)") }
        if brand != "Default" { userParts.append("Brand voice: \(brandDescription(for: brand))") }
        userParts.append("Write the \(formatLabel) now. Output only the content, no preamble.")

        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": maxTokens(for: formatID),
            "system": systemPrompt(for: formatID),
            "messages": [["role": "user", "content": userParts.joined(separator: "\n\n")]]
        ]
        let req = AnthropicClient.makeRequest(body: body)

        let data: Data
        let resp: URLResponse
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            return .failure(.network(error.localizedDescription))
        }

        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            return .failure(anthropicAPIError(from: data, statusCode: status))
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return .failure(.decode) }

        let result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? .failure(.empty) : .success(result)
    }

    private static func systemPrompt(for formatID: String) -> String {
        switch formatID {
        case "newsletter":
            return "You are an expert newsletter writer. Write a 300–500 word digest. First line is the subject (prefix 'Subject: '). Then 2–3 short sections with bold headers and a clear takeaway. Plain prose, no bullet soup."
        case "linkedin":
            return "You are a LinkedIn content strategist. Write a 150–300 word hook post. Open with a bold or surprising first line — never 'I am excited to share'. Tell a story or insight. End with an open question. Line breaks between paragraphs. No hashtag spam."
        case "twitter":
            return "You are a Twitter thread writer. Write 5–10 numbered tweets (1/, 2/, …). Tweet 1 is the hook. Final tweet is a summary or CTA. Each tweet under 280 characters. Output each tweet on its own line with a blank line between."
        case "twitter-single":
            return "You are a Twitter copywriter. Write one punchy tweet under 280 characters that captures the sharpest insight. No hashtags unless they add genuine meaning."
        case "blog":
            return "You are an SEO content writer. Write a 600–1000 word blog post with a compelling intro, 3–5 ## sections, and a short conclusion. Conversational but authoritative."
        case "email":
            return "You are an email copywriter. First line is the subject (prefix 'Subject: '). Then: short greeting, 2–3 tight paragraphs, a clear CTA, and a sign-off placeholder. Under 300 words total."
        case "instagram":
            return "You are an Instagram content creator. Write a caption: hook opening line, 3–5 short paragraphs, end with a question. Blank line then 5–8 relevant hashtags."
        case "youtube":
            return "You are a YouTube script writer. Structure: HOOK (0–15s), INTRO (what we cover), BODY (3–5 sections with [B-ROLL] notes), OUTRO (recap + subscribe CTA). Include [PAUSE] markers."
        case "podcast":
            return "You are a podcast producer. Write an episode outline: Title, 3-sentence Teaser, Cold Open quote, 5–7 talking points each with 2–3 sub-bullets, 3 guest questions if applicable, Outro."
        case "press":
            return "You are a PR professional. Write a press release: HEADLINE in caps, Subheadline, City/Date dateline, Lead paragraph (5 Ws), 2 body paragraphs, executive quote, About boilerplate placeholder, ### end marker."
        case "landing":
            return "You are a conversion copywriter. Write landing page copy: Hero headline + subheadline, 3 benefit blocks (bold title + 1-sentence description), social proof placeholder, CTA button text + supporting micro-copy."
        case "video":
            return "You are a short-form video script writer. Write a 60–90 second script: HOOK (5s bold statement), PROBLEM (10s), SOLUTION (30s with 3 points), CTA (15s). Include [VISUAL] direction notes."
        case "message":
            return "You are a concise messaging assistant. Write a short, natural message (1–4 sentences) in a warm conversational tone, as if texting or messaging a friend or colleague. No subject line, no sign-off, no formatting — just the message text."
        default:
            return "You are a professional content writer. Write clear, high-quality content based on the provided source material."
        }
    }

    private static func brandDescription(for brand: String) -> String {
        switch brand {
        case "Personal":  return "Conversational and first-person. Write like a thoughtful individual sharing genuine experience, not a brand. Use 'I', be direct, show personality."
        case "Company":   return "Professional and authoritative. Represent an established organisation. Confident, polished, third-person where appropriate. No slang."
        case "Startup":   return "Energetic and mission-driven. Bold language, active voice, optimistic. Speak to builders and early adopters. Avoid corporate stiffness."
        case "Agency":    return "Creative and results-focused. Demonstrate expertise and strategic thinking. Balance creativity with measurable outcomes. Speak to marketing decision-makers."
        default:          return brand
        }
    }

    private static func maxTokens(for formatID: String) -> Int {
        switch formatID {
        case "blog":               return 2000
        case "youtube", "podcast": return 1500
        case "landing", "press":   return 1200
        case "twitter":            return 700
        case "twitter-single":     return 120
        default:                   return 900
        }
    }
}

// MARK: - Generation Banner

/// Animated cluster of dots orbiting inside a 36pt circle. Reused both
/// as the loading glyph inside `GenerationBanner` and as the chat
/// thinking indicator so the two surfaces share the same visual idiom.
struct OrbitDotsCircle: View {
    var diameter: CGFloat = 36

    private struct DotConfig {
        let radius: Double
        let size: Double
        let speed: Double
        let phase: Double
        let opacity: Double
    }
    private let dotConfigs: [DotConfig] = [
        DotConfig(radius: 9,  size: 3.5, speed: 1.1,  phase: 0.0,  opacity: 0.95),
        DotConfig(radius: 7,  size: 2.5, speed: 1.7,  phase: 0.4,  opacity: 0.70),
        DotConfig(radius: 11, size: 2.0, speed: 0.85, phase: 0.9,  opacity: 0.55),
        DotConfig(radius: 6,  size: 3.0, speed: 2.2,  phase: 1.4,  opacity: 0.80),
        DotConfig(radius: 10, size: 2.0, speed: 1.45, phase: 1.9,  opacity: 0.60),
        DotConfig(radius: 8,  size: 2.5, speed: 0.95, phase: 2.5,  opacity: 0.75),
    ]

    var body: some View {
        ZStack {
            Circle()
                .fill(AppInk.solid(0.06))
                .frame(width: diameter, height: diameter)
            TimelineView(.animation(minimumInterval: 1.0/30.0)) { tl in
                let t = tl.date.timeIntervalSinceReferenceDate
                ZStack {
                    ForEach(dotConfigs.indices, id: \.self) { i in
                        let cfg = dotConfigs[i]
                        let angle = t * cfg.speed + cfg.phase
                        let x = cfg.radius * cos(angle)
                        let y = cfg.radius * sin(angle)
                        let pulse = (sin(t * cfg.speed * 2.3 + cfg.phase) + 1) / 2
                        Circle()
                            .fill(AppInk.solid(cfg.opacity * (0.5 + 0.5 * pulse)))
                            .frame(width: cfg.size * (0.75 + 0.25 * pulse),
                                   height: cfg.size * (0.75 + 0.25 * pulse))
                            .blur(radius: 0.8)
                            .offset(x: x, y: y)
                    }
                }
            }
        }
        .frame(width: diameter, height: diameter)
        .clipShape(Circle())
    }
}

struct GenerationBanner: View {
    let isReady: Bool
    var onTap: () -> Void
    var onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                if !isReady {
                    OrbitDotsCircle()
                } else {
                    Circle()
                        .fill(AppInk.solid(0.06))
                        .frame(width: 36, height: 36)
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(AppText.primary)
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            Text(isReady ? "Content ready" : "Creating your content")
                .font(.appSubtextBold)
                .foregroundColor(AppText.primary)
                .lineLimit(1)

            Spacer(minLength: 0)

            if isReady {
                Button(action: onTap) {
                    ZStack {
                        RoundedRectangle(cornerRadius: Radius.input, style: .continuous)
                            .fill(BrandColor.ctaPrimary)
                        RoundedRectangle(cornerRadius: Radius.input, style: .continuous)
                            .stroke(AppInk.solid(0.28), lineWidth: 0.75)
                        Text("Open")
                            .font(.appCaptionMedium)
                            .foregroundColor(.white)
                    }
                    .frame(width: 68, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: Radius.input, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(AppInk.solid(0.50))
                        .frame(width: 26, height: 26)
                        .background(AppInk.solid(0.08))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(AppBackground.surface)
                Ellipse()
                    .fill(BrandColor.amber.opacity(0.06))
                    .blur(radius: 20)
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(AppInk.solid(0.09), lineWidth: 0.5)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: Color.black.opacity(0.40), radius: 16, x: 0, y: 8)
        .contentShape(Rectangle())
        .onTapGesture { if isReady { onTap() } }
    }
}

// MARK: - Voice Recorder

@MainActor
final class VoiceRecorder: ObservableObject {
    @Published var transcript = ""
    @Published var isRecording = false
    @Published var permissionDenied = false
    @Published var startupError: String? = nil
    var audioLevel: Float = 0.0  // plain var — read inside TimelineView, not @Published

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var teardownTask: Task<Void, Never>? = nil
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    func start() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                guard status == .authorized else {
                    self.permissionDenied = true
                    return
                }
                AVAudioApplication.requestRecordPermission { granted in
                    DispatchQueue.main.async {
                        guard granted else {
                            self.permissionDenied = true
                            return
                        }
                        self.startEngine()
                    }
                }
            }
        }
    }

    func stop() {
        guard isRecording else { return }
        isRecording = false
        audioLevel = 0
        // End the audio buffer synchronously so SFSpeechRecognizer flushes
        // its final isFinal callback — the last 200-500ms of speech rides
        // on that result. The previous version called recognitionTask?.cancel()
        // here, which preempted the flush and silently dropped the user's
        // last sentence. We release our reference but let the underlying
        // task live until it self-completes via line 597; any orphan is
        // cancelled by startEngine() at the start of the next recording.
        recognitionRequest?.endAudio()
        recognitionTask = nil
        let engine = audioEngine
        recognitionRequest = nil
        teardownTask = Task.detached(priority: .userInitiated) {
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func startEngine() {
        recognitionTask?.cancel()
        recognitionTask = nil
        startupError = nil
        // Await any in-flight teardown before activating the session — the
        // previous stop()'s setActive(false) runs in a detached task (50-300ms)
        // and will silently cancel a new setActive(true) that races with it.
        let prev = teardownTask
        teardownTask = nil
        Task { @MainActor [weak self] in
            await prev?.value
            self?.activateAndStart()
        }
    }

    private func activateAndStart() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            startupError = "Couldn't set up the audio session: \(error.localizedDescription)"
            return
        }

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let request = recognitionRequest, let rec = recognizer else {
            startupError = "Speech recognition isn't available on this device."
            return
        }
        request.shouldReportPartialResults = true

        recognitionTask = rec.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if (error != nil || (result?.isFinal ?? false)), self.isRecording {
                    self.stop()
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        var lastLevelDispatch: Double = 0
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frames = Int(buffer.frameLength)
            var rms: Float = 0
            for i in 0..<frames { rms += channelData[i] * channelData[i] }
            let level = sqrt(rms / Float(max(frames, 1)))
            let now = CFAbsoluteTimeGetCurrent()
            guard now - lastLevelDispatch >= 1.0 / 20.0 else { return }
            lastLevelDispatch = now
            DispatchQueue.main.async { self?.audioLevel = level }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            isRecording = true
        } catch {
            startupError = "Couldn't start the microphone: \(error.localizedDescription)"
            inputNode.removeTap(onBus: 0)
        }
    }
}

// MARK: - Voice Recorder Waveform

// Reads audioLevel directly inside TimelineView so VoiceRecordSheet doesn't
// re-render at 20 Hz. Mirrors NoteWaveform but reads from VoiceRecorder
// (not RecordingController) since VoiceRecordSheet has its own audio stack.
private struct VoiceRecorderWaveform: View {
    let recorder: VoiceRecorder
    private let particleCount = 55

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = recorder.audioLevel
            Canvas { ctx, size in
                let cy = size.height / 2
                let amplified = min(1.0, pow(Double(max(level, 0.005)), 0.28) * 2.8)
                let amplitude = amplified * cy * 0.80
                for i in 0..<particleCount {
                    let fi = Double(i)
                    let progress = fi / Double(particleCount - 1)
                    let baseX = progress * size.width
                    let envelope = sin(progress * .pi)
                    let phase1 = t * 3.5 + progress * .pi * 4.0
                    let phase2 = t * 2.1 + progress * .pi * 7.0
                    let targetY = cy + sin(phase1) * amplitude * 0.65 * envelope + sin(phase2) * amplitude * 0.35 * envelope
                    let seed1 = fi * 13.7; let seed2 = fi * 29.1
                    let scatterY = 4.0 + amplified * 10.0
                    let jitterX = sin(t * 0.7 + seed1) * 2.5
                    let jitterY = sin(t * 0.9 + seed2) * scatterY + cos(t * 1.3 + seed1 * 0.5) * scatterY * 0.4
                    let px = baseX + jitterX; let py = targetY + jitterY
                    let pr = pseudoRandom(i * 3)
                    let waveMag = (sin(phase1) + 1.0) / 2.0
                    let radius = 1.0 + pr * 1.8 + waveMag * 2.0 * amplified
                    let normJitter = abs(jitterY) / max(scatterY * 1.5, 1.0)
                    let proximityAlpha = max(0.0, 1.0 - normJitter) * envelope
                    let pulse = 0.65 + 0.35 * sin(t * 1.8 + fi * 0.35)
                    let alpha = proximityAlpha * pulse * (0.35 + amplified * 0.60)
                    ctx.fill(Path(ellipseIn: CGRect(x: px - radius, y: py - radius,
                                                    width: radius * 2, height: radius * 2)),
                             with: .color(BrandColor.amber.opacity(alpha)))
                }
            }
        }
        .frame(height: 75)
        .accessibilityHidden(true)
    }

    private func pseudoRandom(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

// MARK: - Animated Lights Button

/// Sun-rays mark — 8 short rays radiating from a centre gap, scaled to the
/// shape's bounds. Mirrors the web's `<SparkIcon>` SVG path.
struct SparkRaysShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let pt: (Double, Double) -> CGPoint = { x, y in
            CGPoint(x: rect.minX + w * x / 24, y: rect.minY + w * y / 24)
        }
        let rays: [(Double, Double, Double, Double)] = [
            (12,   3,   12,   6),
            (12,  18,   12,  21),
            ( 3,  12,    6,  12),
            (18,  12,   21,  12),
            ( 5.6, 5.6,  7.7, 7.7),
            (16.3, 16.3, 18.4, 18.4),
            ( 5.6, 18.4, 7.7, 16.3),
            (16.3, 7.7, 18.4, 5.6),
        ]
        var p = Path()
        for r in rays {
            p.move(to: pt(r.0, r.1))
            p.addLine(to: pt(r.2, r.3))
        }
        return p
    }
}

struct AnimatedLightsButton: View {
    let title: String
    var showSparks: Bool = false
    var isEnabled: Bool = true
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                // Flat brown-amber CTA fill — shared token, also used by
                // the Accept-rewrite button in chat so the two primary
                // actions read as one visual. Disabled uses its own
                // adaptive token so the button stays visible as a button;
                // the prior fallback to `surface` rendered it pure white
                // on white in light mode, indistinguishable from the cards
                // above it.
                RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
                    .fill(isEnabled ? BrandColor.ctaPrimary : AppBackground.ctaDisabled)

                RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
                    .stroke(AppInk.solid(isEnabled ? 0.28 : 0.14), lineWidth: isEnabled ? 0.75 : 1)

                HStack(spacing: 8) {
                    if showSparks {
                        SparkRaysShape()
                            .stroke(
                                isEnabled ? Color.white : AppInk.solid(0.45),
                                style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round)
                            )
                            .frame(width: 17, height: 17)
                    }
                    Text(title)
                        .font(.app(size: 18, weight: .semibold))
                        .foregroundColor(isEnabled ? .white : AppInk.solid(0.55))
                }
            }
            .frame(height: 54)
            .clipShape(RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
    }
}

// MARK: - Import Sheet

struct ImportSheetView: View {
    var onSelect: (SourceType) -> Void

    private let sourceItems: [(icon: String, label: String, type: SourceType)] = [
        ("link",          "Paste a link",   .link),
        ("arrow.up.doc",  "Upload a file",  .file),
        ("pencil",        "Write text",     .text),
        ("note.text",     "Add note",       .note),
    ]

    var body: some View {
        VStack(spacing: 10) {
            Text("Import content")
                .font(.appNavTitle)
                .foregroundColor(AppInk.solid(0.88))
                .padding(.top, 20)
                .padding(.bottom, 14)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(sourceItems, id: \.type) { item in
                    Button {
                        onSelect(item.type)
                    } label: {
                        VStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.appLabel)
                                .foregroundColor(AppInk.solid(0.82))
                            Text(item.label)
                                .font(.appSmall)
                                .foregroundColor(AppInk.solid(0.52))
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 88)
                        .background(AppInk.solid(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }
}

// MARK: - Text Input Sheet

private struct TextInputSheet: View {
    var onSave: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var titleText = ""
    @State private var bodyText = ""
    @State private var bodyBeforeDictation = ""
    @State private var isGenerating = false
    @StateObject private var dictation = NoteDictation()
    @FocusState private var focusedField: InputField?

    private enum InputField { case title, body }
    private let sheetBackground = AppBackground.primary

    private var canSave: Bool {
        !titleText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                header

                Rectangle()
                    .fill(AppInk.solid(0.06))
                    .frame(height: 0.5)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 0) {
                        TextField("Title", text: $titleText)
                            .font(.appTitle)
                            .foregroundColor(AppText.primary)
                            .tint(AppText.primary)
                            .focused($focusedField, equals: .title)
                            .submitLabel(.next)
                            .onSubmit { focusedField = .body }
                            .padding(.horizontal, 20)
                            .padding(.top, 20)
                            .padding(.bottom, 14)
                            .disabled(isGenerating)

                        ZStack(alignment: .topLeading) {
                            if bodyText.isEmpty {
                                Text("Start writing\u{2026}")
                                    .font(.appReadingBody)
                                    .foregroundColor(AppInk.solid(0.28))
                                    .padding(.horizontal, 20)
                                    .padding(.top, 2)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $bodyText)
                                .appReadingBodyText()
                                .tint(AppText.primary)
                                .scrollContentBackground(.hidden)
                                .background(.clear)
                                .focused($focusedField, equals: .body)
                                .disabled(isGenerating)
                                .padding(.horizontal, 16)
                                .frame(minHeight: 300)
                        }
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .toolbar {
                    ToolbarItemGroup(placement: .keyboard) {
                        keyboardToolbar
                    }
                }
            }

            DictationControls(
                dictation: dictation,
                onStart: {
                    bodyBeforeDictation = bodyText
                    focusedField = nil
                    dictation.start()
                },
                onCancel: {
                    dictation.cancel()
                    bodyText = bodyBeforeDictation
                },
                onConfirm: {
                    dictation.stop()
                }
            )
            .padding(.trailing, 20)
            .padding(.bottom, 20)
            .opacity(isGenerating ? 0 : 1)
            .allowsHitTesting(!isGenerating)
        }
        .background(sheetBackground.ignoresSafeArea())
        .interactiveDismissDisabled(canSave || isGenerating)
        .onChange(of: dictation.transcript) { _, newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if bodyBeforeDictation.isEmpty {
                bodyText = trimmed
            } else {
                let needsSeparator = !bodyBeforeDictation.hasSuffix("\n") && !bodyBeforeDictation.hasSuffix(" ")
                bodyText = bodyBeforeDictation + (needsSeparator ? " " : "") + trimmed
            }
        }
        .alert("Microphone access denied", isPresented: $dictation.permissionDenied) {
            Button("Open Settings") { openSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enable Microphone and Speech Recognition in Settings to dictate notes.")
        }
        .onDisappear { dictation.stop() }
        .task { focusedField = .title }
    }

    private var header: some View {
        HStack(spacing: 0) {
            Button {
                guard !isGenerating else { return }
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppInk.solid(0.65))
                    .frame(width: 32, height: 32)
                    .background(AppInk.solid(0.08))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")

            Spacer(minLength: 8)

            Text("Text source")
                .font(.appBodyBold)
                .foregroundColor(AppText.primary)

            Spacer(minLength: 8)

            Button(action: handleSave) {
                Group {
                    if isGenerating {
                        ProgressView().scaleEffect(0.65).tint(AppText.primary)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(canSave ? .white : AppInk.solid(0.28))
                    }
                }
                .frame(width: 32, height: 32)
                .background(canSave ? AppInk.solid(0.12) : AppInk.solid(0.05))
                .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSave || isGenerating)
            .accessibilityLabel("Save")
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .padding(.top, 8)
    }

    private var keyboardToolbar: some View {
        HStack(spacing: 0) {
            kbButton(icon: "doc.on.clipboard") {
                if let clip = UIPasteboard.general.string, !clip.isEmpty {
                    bodyText += String(clip.prefix(50_000))
                    focusedField = .body
                }
            }
            kbButton(icon: "at") {
                bodyText += "@"
                focusedField = .body
            }
            kbButton(icon: "list.bullet") {
                bodyText += bodyText.isEmpty || bodyText.hasSuffix("\n") ? "• " : "\n• "
                focusedField = .body
            }
            kbButton(icon: "checklist") {
                bodyText += bodyText.isEmpty || bodyText.hasSuffix("\n") ? "- [ ] " : "\n- [ ] "
                focusedField = .body
            }
            kbButton(icon: "chevron.left.forwardslash.chevron.right") {
                bodyText += "`"
                focusedField = .body
            }
            kbButton(icon: "quote.closing") {
                bodyText += bodyText.isEmpty || bodyText.hasSuffix("\n") ? "> " : "\n> "
                focusedField = .body
            }
            Spacer()
        }
    }

    private func kbButton(icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 17))
                .foregroundColor(AppInk.solid(0.60))
                .frame(width: 44, height: 36)
        }
        .buttonStyle(.plain)
    }

    private func handleSave() {
        let trimmedTitle = titleText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBody  = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = trimmedBody.isEmpty ? trimmedTitle : trimmedBody
        guard !content.isEmpty else { return }
        focusedField = nil
        isGenerating = true
        Task {
            let finalTitle: String
            if trimmedTitle.isEmpty {
                finalTitle = await AIService.generateTitle(from: content)
            } else {
                finalTitle = trimmedTitle
            }
            await MainActor.run {
                isGenerating = false
                onSave(finalTitle, content)
                dismiss()
            }
        }
    }
}

// Wrapping flow layout: chips lay out left-to-right and wrap to the next
// row when they would overflow the available width.
private struct FlowLayout: Layout {
    var horizontalSpacing: CGFloat = 8
    var verticalSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        var widestLine: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                widestLine = max(widestLine, x - horizontalSpacing)
                y += lineHeight + verticalSpacing
                x = 0
                lineHeight = 0
            }
            x += size.width + horizontalSpacing
            lineHeight = max(lineHeight, size.height)
        }
        widestLine = max(widestLine, x - horizontalSpacing)
        return CGSize(width: min(widestLine, maxWidth), height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        // Group into lines first so each line can be horizontally centred —
        // a single left-aligned wrap would look off-axis next to the
        // centred title / subtitle / helper text above and below.
        var lines: [[(index: Int, size: CGSize)]] = [[]]
        var lineWidth: CGFloat = 0
        for (index, subview) in subviews.enumerated() {
            let size = subview.sizeThatFits(.unspecified)
            let prospective = lineWidth == 0 ? size.width : lineWidth + horizontalSpacing + size.width
            if !lines.last!.isEmpty, prospective > bounds.width {
                lines.append([(index, size)])
                lineWidth = size.width
            } else {
                lines[lines.count - 1].append((index, size))
                lineWidth = prospective
            }
        }

        var y: CGFloat = bounds.minY
        for line in lines {
            let totalWidth = line.reduce(CGFloat(0)) { $0 + $1.size.width }
                + CGFloat(max(line.count - 1, 0)) * horizontalSpacing
            let lineHeight = line.map { $0.size.height }.max() ?? 0
            var x = bounds.minX + max((bounds.width - totalWidth) / 2, 0)
            for item in line {
                subviews[item.index].place(
                    at: CGPoint(x: x, y: y),
                    proposal: ProposedViewSize(item.size)
                )
                x += item.size.width + horizontalSpacing
            }
            y += lineHeight + verticalSpacing
        }
    }
}

// MARK: - Link Input Sheet

private struct LinkInputSheet: View {
    var onSave: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var urlText = ""
    @State private var stagedURLs: [String] = []
    @State private var isFetching = false
    @FocusState private var focused: Bool

    private var trimmedInput: String {
        urlText.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    private func isValidURL(_ s: String) -> Bool {
        (s.hasPrefix("http://") || s.hasPrefix("https://")) && s.count > 11
    }
    private var canStage: Bool {
        isValidURL(trimmedInput) && !stagedURLs.contains(trimmedInput)
    }
    private var canSave: Bool {
        !stagedURLs.isEmpty || canStage
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") {
                    guard !isFetching else { return }
                    dismiss()
                }
                .foregroundColor(AppText.secondary)
                Spacer()
                Text(stagedURLs.count > 1 ? "Link sources" : "Link source")
                    .font(.appLabelBold)
                    .foregroundColor(AppText.primary)
                Spacer()
                Button {
                    guard !isFetching else { return }
                    saveAll()
                } label: {
                    if isFetching {
                        ProgressView()
                            .scaleEffect(0.75)
                            .tint(AppText.secondary)
                            .frame(width: 40)
                    } else {
                        Text("Save")
                            .foregroundColor(canSave ? AppInk.solid(0.88) : AppText.disabled)
                    }
                }
                .disabled(!canSave || isFetching)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Rectangle()
                .fill(AppInk.solid(0.07))
                .frame(height: 0.5)

            HStack(spacing: 10) {
                Image(systemName: "link")
                    .font(.appSubtext)
                    .foregroundColor(AppText.tertiary)
                TextField("https://", text: $urlText)
                    .font(.appLabel)
                    .foregroundColor(AppInk.solid(0.88))
                    .autocapitalization(.none)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .submitLabel(.next)
                    .onSubmit { stageCurrent() }
                Button { stageCurrent() } label: {
                    Image(systemName: "plus")
                        .font(.app(size: 14, weight: .semibold))
                        .foregroundColor(canStage ? .white : AppText.disabled)
                        .frame(width: 30, height: 30)
                        .background(canStage ? AppInk.solid(0.12) : AppInk.solid(0.04))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(!canStage)
                .accessibilityLabel("Add another link")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 18)

            if !stagedURLs.isEmpty {
                Rectangle()
                    .fill(AppInk.solid(0.07))
                    .frame(height: 0.5)
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(stagedURLs.enumerated()), id: \.element) { idx, link in
                            HStack(spacing: 12) {
                                Image(systemName: "link")
                                    .font(.appCaption)
                                    .foregroundColor(AppInk.solid(0.45))
                                    .frame(width: 20)
                                Text(link)
                                    .font(.appSmall)
                                    .foregroundColor(AppInk.solid(0.80))
                                    .lineLimit(1)
                                    .truncationMode(.middle)
                                Spacer(minLength: 8)
                                Button {
                                    withAnimation(.easeOut(duration: 0.2)) {
                                        stagedURLs.removeAll { $0 == link }
                                    }
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.appBadge)
                                        .foregroundColor(AppInk.solid(0.30))
                                        .frame(width: 32, height: 32)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)

                            if idx < stagedURLs.count - 1 {
                                Rectangle()
                                    .fill(AppInk.solid(0.05))
                                    .frame(height: 0.5)
                            }
                        }
                    }
                }
                .frame(maxHeight: .infinity)
            } else {
                Spacer()
            }

            if isFetching {
                HStack(spacing: 6) {
                    Image(systemName: "globe").font(.appMicro)
                    Text("Fetching page content\u{2026}").font(.appCaption)
                }
                .foregroundColor(AppText.tertiary)
                .padding(.bottom, 12)
            }
        }
        .task { focused = true }
        .interactiveDismissDisabled(canSave || isFetching)
    }

    private func stageCurrent() {
        guard canStage else { return }
        let t = trimmedInput
        withAnimation(.spring(duration: 0.25)) {
            stagedURLs.append(t)
        }
        urlText = ""
        focused = true
    }

    private func saveAll() {
        if canStage {
            stagedURLs.append(trimmedInput)
            urlText = ""
        }
        let pending = stagedURLs
        guard !pending.isEmpty else { return }
        isFetching = true
        Task {
            var results: [(String, String)] = []
            for link in pending {
                guard let url = URL(string: link) else {
                    results.append((link, ""))
                    continue
                }
                let pair = await fetchPageContent(from: url)
                results.append(pair)
            }
            await MainActor.run {
                isFetching = false
                for (label, content) in results {
                    onSave(label, content)
                }
                dismiss()
            }
        }
    }

    private func fetchPageContent(from url: URL) async -> (label: String, content: String) {
        var req = URLRequest(url: url)
        req.timeoutInterval = 10
        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1)
        else { return (domainLabel(from: url), "") }
        let label = extractTitle(from: html) ?? domainLabel(from: url)
        let content = extractBodyText(from: html)
        return (label, content)
    }

    private func extractTitle(from html: String) -> String? {
        guard let start = html.range(of: "<title", options: .caseInsensitive),
              let tagEnd = html[start.upperBound...].range(of: ">"),
              let titleEnd = html[tagEnd.upperBound...].range(of: "</title>", options: .caseInsensitive)
        else { return nil }
        let title = String(html[tagEnd.upperBound..<titleEnd.lowerBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return title.isEmpty ? nil : title
    }

    private static let htmlBlockRegexes: [NSRegularExpression] = {
        ["script", "style", "nav", "header", "footer", "noscript"].compactMap {
            try? NSRegularExpression(pattern: "<\($0)[^>]*>[\\s\\S]*?</\($0)>", options: .caseInsensitive)
        }
    }()
    private static let htmlTagRegex = try? NSRegularExpression(pattern: "<[^>]+>")

    private func extractBodyText(from html: String) -> String {
        var text = html
        for re in Self.htmlBlockRegexes {
            text = re.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text), withTemplate: " ")
        }
        if let re = Self.htmlTagRegex {
            text = re.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text), withTemplate: " ")
        }
        text = text
            .replacingOccurrences(of: "&amp;", with: "&")
            .replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&nbsp;", with: " ")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "&quot;", with: "\"")
        let lines = text.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        return String(lines.joined(separator: "\n").prefix(8000))
    }

    private func domainLabel(from url: URL) -> String {
        url.host ?? url.absoluteString
    }
}

// MARK: - Voice Record Sheet

struct VoiceRecordSheet: View {
    var onSave: (String, String) -> Void
    var autoStart: Bool = false
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceRecorder()
    @State private var seconds = 0
    @State private var isGenerating = false

    private let amber = BrandColor.amber

    private var timeLabel: String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    var body: some View {
        ZStack {
            AppBackground.primary.ignoresSafeArea()
            RadialGradient(
                colors: [amber.opacity(recorder.isRecording ? 0.16 : 0.0), .clear],
                center: .center, startRadius: 0, endRadius: 300
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 0.6), value: recorder.isRecording)

            VStack(spacing: 0) {
                // Header
                HStack {
                    Spacer()
                    Text(recorder.isRecording ? "Recording…" : recorder.transcript.isEmpty ? "Voice Note" : "Done recording")
                        .font(.subheadline)
                        .foregroundColor(AppText.tertiary)
                    Spacer()
                    Button {
                        guard !isGenerating else { return }
                        recorder.stop()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(AppText.secondary)
                            .frame(width: 44, height: 44)
                            .background(AppInk.solid(0.12))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(isGenerating)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                Spacer(minLength: 24)

                // Waveform or mic button
                if recorder.isRecording {
                    VoiceRecorderWaveform(recorder: recorder)
                        .padding(.horizontal, 28)
                        .transition(.opacity.combined(with: .scale(scale: 0.95)))
                } else if !recorder.transcript.isEmpty {
                    VoiceRecorderWaveform(recorder: recorder)
                        .padding(.horizontal, 28)
                        .opacity(0.3)
                        .transition(.opacity)
                } else {
                    Button(action: handleMicTap) {
                        // 88pt outer hit area around the 76pt visible
                        // disc. Without it, the Circle()'s default hit
                        // shape *is* the circle, so taps landing on the
                        // bounding-box corners (each ~12pt) silently miss.
                        Circle()
                            .fill(amber.opacity(0.18))
                            .frame(width: 76, height: 76)
                            .overlay(
                                Image(systemName: "mic.fill")
                                    .font(.app(size: 28, weight: .medium))
                                    .foregroundColor(amber)
                            )
                            .overlay(Circle().stroke(amber.opacity(0.35), lineWidth: 1))
                            .frame(width: 88, height: 88)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(isGenerating)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                }

                Spacer(minLength: 20)

                // Timer
                if recorder.isRecording || !recorder.transcript.isEmpty {
                    Text(timeLabel)
                        .font(.system(.title2, design: .monospaced))
                        .fontWeight(.medium)
                        .foregroundColor(AppInk.solid(0.70))
                        .transition(.opacity)
                } else {
                    Text("Tap to record")
                        .font(.appBody)
                        .foregroundColor(AppInk.solid(0.40))
                        .transition(.opacity)
                }

                if !recorder.transcript.isEmpty {
                    ScrollView(showsIndicators: false) {
                        Text(recorder.transcript)
                            .font(.appSmall)
                            .foregroundColor(AppInk.solid(0.50))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                            .padding(.top, 16)
                            .frame(maxWidth: .infinity)
                    }
                    .frame(maxHeight: 100)
                    .transition(.opacity)
                }

                Spacer(minLength: 24)

                // Bottom buttons
                if isGenerating {
                    Label("Generating title\u{2026}", systemImage: "sparkles")
                        .font(.appSubtext)
                        .foregroundColor(AppInk.solid(0.50))
                        .padding(.bottom, 40)
                        .transition(.opacity)
                } else if recorder.isRecording {
                    HStack(spacing: 12) {
                        Button(action: handleMicTap) {
                            HStack(spacing: 8) {
                                Image(systemName: "pause.fill")
                                    .font(.system(size: 15, weight: .semibold))
                                Text("Pause")
                                    .font(.system(size: 17, weight: .semibold))
                                    .frame(minWidth: 60)
                            }
                            .foregroundColor(AppText.primary)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(AppInk.solid(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: Radius.pill, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        Button(action: handleDone) {
                            HStack(spacing: 8) {
                                Image(systemName: "stop.fill")
                                    .font(.system(size: 15, weight: .semibold))
                                Text("End")
                                    .font(.system(size: 17, weight: .semibold))
                            }
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(.white)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.pill, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if !recorder.transcript.isEmpty {
                    Button(action: handleDone) {
                        Text("Use this")
                            .font(.appLabelBold)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(amber)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.pill, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 40)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    Color.clear.frame(height: 96)
                }
            }
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.75), value: recorder.isRecording)
        .animation(.easeOut(duration: 0.2), value: isGenerating)
        .task {
            if autoStart { recorder.start() }
            while true {
                do { try await Task.sleep(nanoseconds: 1_000_000_000) }
                catch { break }
                if recorder.isRecording { seconds += 1 }
            }
        }
        .onDisappear { recorder.stop() }
        .onChange(of: recorder.isRecording) { _, recording in
            if recording { seconds = 0 }
        }
        .alert("Microphone Access", isPresented: $recorder.permissionDenied) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) { dismiss() }
        } message: {
            Text("Microphone and speech recognition access is required to record a voice note.")
        }
        .interactiveDismissDisabled(recorder.isRecording || !recorder.transcript.isEmpty || isGenerating)
    }

    private func handleMicTap() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        if recorder.isRecording {
            recorder.stop()
        } else {
            recorder.start()
        }
    }

    private func handleDone() {
        // Snapshot transcript BEFORE stop() — the final isFinal callback from
        // SFSpeechRecognizer arrives asynchronously after endAudio() and would
        // race with the synchronous read below, potentially returning "" even
        // when the user spoke. The snapshot captures the last partial result.
        let transcript = recorder.transcript
        recorder.stop()
        guard !transcript.isEmpty else { dismiss(); return }
        isGenerating = true
        Task {
            let title = await AIService.generateTitle(from: transcript)
            await MainActor.run {
                isGenerating = false
                onSave(title, transcript)
                dismiss()
            }
        }
    }
}

// MARK: - Glass Card

private struct GlassCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    @ViewBuilder let content: Content
    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                    .fill(colorScheme == .dark
                          ? AnyShapeStyle(AppInk.solid(0.04))
                          : AnyShapeStyle(AppBackground.surface))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                            .stroke(AppInk.solid(colorScheme == .dark ? 0.06 : 0.05), lineWidth: 0.5)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
            .shadow(
                color: AppInk.solid(colorScheme == .dark ? 0 : 0.06),
                radius: 14, x: 0, y: 6
            )
            .shadow(
                color: AppInk.solid(colorScheme == .dark ? 0 : 0.04),
                radius: 1.5, x: 0, y: 0.5
            )
    }
}

// MARK: - Sources Block

private struct SourcesBlock: View {
    @Binding var sources: [SourceItem]
    var pendingSheet: Binding<SourceSheet?> = .constant(nil)

    @State private var activeSheet: SourceSheet? = nil
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var showNotePicker = false
    @State private var photoPickerItem: PhotosPickerItem? = nil
    @State private var photoExtractTask: Task<Void, Never>? = nil
    @State private var fileImportTask: Task<Void, Never>? = nil

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    Text("Sources")
                        .font(.appSubtextMedium)
                        .foregroundColor(AppInk.solid(0.85))
                    Spacer()
                    Button { activeSheet = .picker } label: {
                        Image(systemName: "plus")
                            .font(.appCaptionMedium)
                            .foregroundColor(AppInk.solid(0.80))
                            .frame(width: 30, height: 30)
                            .background(AppInk.solid(0.10))
                            .overlay(
                                Circle().stroke(AppInk.solid(0.14), lineWidth: 0.5)
                            )
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Add source")
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

                ForEach(sources) { item in
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(AppInk.solid(0.06))
                            .frame(height: 0.5)

                        HStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.appSubtext)
                                .foregroundColor(AppInk.solid(0.45))
                                .frame(width: 20)
                            Text(item.label)
                                .font(.appSubtext)
                                .foregroundColor(AppInk.solid(0.80))
                                .lineLimit(1)
                            Spacer()
                            Button {
                                withAnimation(.spring(duration: 0.25)) {
                                    sources.removeAll { $0.id == item.id }
                                }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.appBadge)
                                    .foregroundColor(AppInk.solid(0.42))
                                    .frame(width: 32, height: 32)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)
                    }
                }
            }
        }
        .sheet(item: $activeSheet) { sheet in
            Group {
                switch sheet {
                case .picker:
                    ImportSheetView { type in
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        switch type {
                        case .text:  activeSheet = .text
                        case .link:  activeSheet = .link
                        case .voice: activeSheet = .voice
                        case .note:
                            activeSheet = nil
                            showNotePicker = true
                        case .file:
                            activeSheet = nil
                            showFilePicker = true
                        case .image:
                            activeSheet = nil
                            showPhotoPicker = true
                        }
                    }
                case .text:
                    TextInputSheet { label, content in
                        withAnimation(.spring(duration: 0.25)) {
                            sources.append(SourceItem(type: .text, label: label, content: content))
                        }
                    }
                case .link:
                    LinkInputSheet { label, url in
                        withAnimation(.spring(duration: 0.25)) {
                            sources.append(SourceItem(type: .link, label: label, content: url))
                        }
                    }
                case .voice:
                    VoiceRecordSheet { label, transcript in
                        withAnimation(.spring(duration: 0.25)) {
                            sources.append(SourceItem(type: .voice, label: label, content: transcript))
                        }
                    }
                case .note:
                    // The note picker is presented as a separate floating
                    // modal (see `.fullScreenCover` below). If `.note` somehow
                    // lands here, redirect to that flow instead of showing a
                    // blank sheet.
                    Color.clear
                        .onAppear {
                            activeSheet = nil
                            showNotePicker = true
                        }
                }
            }
            .presentationDetents(
                sheet == .picker ? [.height(286)] : [.large]
            )
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(sheet == .text ? 10 : 22)
            .presentationBackground(AppBackground.primary)
        }
        .fullScreenCover(isPresented: $showNotePicker) {
            NotePickerSheet(
                onSelect: { note in
                    withAnimation(.spring(duration: 0.25)) {
                        sources.append(SourceItem(type: .note, label: note.displayTitle, content: note.body))
                    }
                },
                onClose: { showNotePicker = false }
            )
            .presentationBackground(.clear)
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.text, .plainText, .pdf],
            allowsMultipleSelection: false
        ) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            let name = url.lastPathComponent
            fileImportTask?.cancel()
            fileImportTask = Task {
                let content = readFileContent(from: url)
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    withAnimation(.spring(duration: 0.25)) {
                        sources.append(SourceItem(type: .file, label: name, content: content))
                    }
                }
            }
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoPickerItem, matching: .images)
        .onChange(of: photoPickerItem) { _, item in
            guard let item else { return }
            photoExtractTask?.cancel()
            photoExtractTask = Task {
                let content = await extractTextFromPhoto(item: item)
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    withAnimation(.spring(duration: 0.25)) {
                        sources.append(SourceItem(type: .image, label: "Image", content: content))
                    }
                    photoPickerItem = nil
                }
            }
        }
        // `.task(id:)` fires on mount AND on id change, so externally
        // triggered opens still work even if HomeView was being created in
        // the same pass (tab switch + signal). `.onChange` would miss that
        // race.
        .task(id: pendingSheet.wrappedValue) {
            guard let s = pendingSheet.wrappedValue else { return }
            pendingSheet.wrappedValue = nil
            if s == .note {
                showNotePicker = true
            } else {
                activeSheet = s
            }
        }
    }

    private func readFileContent(from url: URL) -> String {
        guard url.startAccessingSecurityScopedResource() else { return "" }
        defer { url.stopAccessingSecurityScopedResource() }
        if url.pathExtension.lowercased() == "pdf" {
            return String((PDFDocument(url: url)?.string ?? "").prefix(8000))
        }
        // Cap at 64 KB read — we only keep 8000 chars after decoding, so there
        // is no point loading a multi-GB log file entirely into memory.
        guard let fh = try? FileHandle(forReadingFrom: url) else { return "" }
        defer { try? fh.close() }
        guard let data = try? fh.read(upToCount: 64_000) else { return "" }
        // String(data:encoding:.utf8) returns nil when the 64 KB boundary lands
        // mid-sequence. String(decoding:as:) replaces the broken tail with U+FFFD
        // instead of falling back to ISO-Latin-1, which would mojibake the whole
        // file for any non-ASCII UTF-8 content.
        if let text = String(data: data, encoding: .utf8) { return String(text.prefix(8000)) }
        return String(String(decoding: data, as: UTF8.self).prefix(8000))
    }

    private func extractTextFromPhoto(item: PhotosPickerItem) async -> String {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let cgImage = UIImage(data: data)?.cgImage else { return "" }
        return await withCheckedContinuation { continuation in
            var resumed = false
            let request = VNRecognizeTextRequest { req, _ in
                guard !resumed else { return }
                resumed = true
                let text = (req.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n") ?? ""
                continuation.resume(returning: text)
            }
            request.recognitionLevel = .accurate
            // VNImageRequestHandler.perform invokes the request's completion
            // handler synchronously on success. If it throws, the handler is
            // never called — so without this catch + safety-net the
            // continuation would leak on any unrecognised image format.
            do {
                try VNImageRequestHandler(cgImage: cgImage).perform([request])
            } catch {
                // fall through to safety net
            }
            if !resumed {
                resumed = true
                continuation.resume(returning: "")
            }
        }
    }
}

// MARK: - Note Picker Sheet

// Floating card modal that sits over the Create page. It does not fill the
// screen the way a system .sheet does — the dim backdrop + centred card
// match the inline picker used elsewhere when typing `@` to attach context.
private struct NotePickerSheet: View {
    var onSelect: (Note) -> Void
    var onClose: () -> Void

    @State private var query = ""
    @State private var notes: [Note] = []
    @State private var reloadTask: Task<Void, Never>? = nil
    @FocusState private var fieldFocused: Bool

    private let cardBg = AppBackground.primary

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .none
        f.doesRelativeDateFormatting = true
        return f
    }()

    private var filtered: [Note] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return notes }
        return notes.filter {
            $0.displayTitle.localizedCaseInsensitiveContains(q) ||
            $0.body.localizedCaseInsensitiveContains(q)
        }
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture {
                    fieldFocused = false
                    onClose()
                }

            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text("Pick a note")
                        .font(.appBodyBold)
                        .foregroundColor(AppText.primary)
                        .accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button {
                        fieldFocused = false
                        onClose()
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
                    placeholder: "Search notes",
                    text: $query,
                    isFocused: $fieldFocused
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 12)

                if filtered.isEmpty {
                    VStack(spacing: 8) {
                        Spacer().frame(height: 28)
                        Image(systemName: "note.text")
                            .font(.system(size: 32, weight: .light))
                            .foregroundColor(AppInk.solid(0.18))
                        Text(notes.isEmpty ? "No notes yet" : "No results")
                            .font(.appSubtext)
                            .foregroundColor(AppInk.solid(0.30))
                        Spacer().frame(height: 28)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 0) {
                            ForEach(Array(filtered.enumerated()), id: \.element.id) { idx, note in
                                Button {
                                    onSelect(note)
                                    fieldFocused = false
                                    onClose()
                                } label: {
                                    HStack(alignment: .top, spacing: 14) {
                                        Image(systemName: "note.text")
                                            .font(.system(size: 16, weight: .regular))
                                            .foregroundColor(AppInk.solid(0.55))
                                            .frame(width: 24, height: 24)
                                            .padding(.top, 1)
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(note.displayTitle)
                                                .font(.app(size: 16, weight: .medium))
                                                .foregroundColor(AppInk.solid(0.92))
                                                .lineLimit(2)
                                                .multilineTextAlignment(.leading)
                                            Text(Self.dateFormatter.string(from: note.updatedAt))
                                                .font(.appSmall)
                                                .foregroundColor(AppText.tertiary)
                                        }
                                        Spacer(minLength: 0)
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)

                                if idx < filtered.count - 1 {
                                    Rectangle()
                                        .fill(AppInk.solid(0.05))
                                        .frame(height: 0.5)
                                        .padding(.leading, 54)
                                }
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
        .task {
            notes = await NotesStore.loadAsync().filter { !$0.isEmpty }
        }
        .onReceive(NotificationCenter.default.publisher(for: .notesStoreDidChange)) { _ in
            reloadTask?.cancel()
            reloadTask = Task {
                let fresh = await NotesStore.loadAsync().filter { !$0.isEmpty }
                guard !Task.isCancelled else { return }
                await MainActor.run { notes = fresh }
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                fieldFocused = true
            }
        }
    }
}

// MARK: - Format Picker Sheet

private struct FormatPickerSheet: View {
    @Binding var selectedFormatIDs: Set<String>
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Set<String>
    @State private var search = ""
    @State private var showAllTemplates = false

    init(selectedFormatIDs: Binding<Set<String>>) {
        _selectedFormatIDs = selectedFormatIDs
        _draft = State(initialValue: selectedFormatIDs.wrappedValue)
    }

    private enum SelectionState { case none, partial, all }

    private let sheetBackground = AppBackground.primary
    private let amber = BrandColor.amber

    private var filteredTemplates: [ContentTemplate] {
        guard !search.isEmpty else { return allTemplates }
        let q = search.lowercased()
        return allTemplates.filter {
            $0.name.lowercased().contains(q) || $0.description.lowercased().contains(q) ||
            $0.formatIDs.compactMap { fid in allFormats.first { $0.id == fid }?.label }.joined(separator: " ").lowercased().contains(q)
        }
    }

    private var filteredFormats: [ContentFormat] {
        guard !search.isEmpty else { return allFormats }
        let q = search.lowercased()
        return allFormats.filter { $0.label.lowercased().contains(q) || $0.description.lowercased().contains(q) }
    }

    private var displayedTemplates: [ContentTemplate] {
        if !search.isEmpty || showAllTemplates { return filteredTemplates }
        return Array(filteredTemplates.prefix(5))
    }

    private var ctaLabel: String {
        switch draft.count {
        case 0: return "Pick at least one"
        case 1: return "Add 1 format"
        default: return "Add \(draft.count) formats"
        }
    }

    private var isDirty: Bool { draft != selectedFormatIDs }

    var body: some View {
        AppPickerSheet(
            title: "Choose formats",
            query: $search,
            placeholder: "Search formats and templates",
            onClose: { dismiss() }
        ) {
            if filteredTemplates.isEmpty && filteredFormats.isEmpty {
                ContentUnavailableView.search(text: search)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView(showsIndicators: false) {
                    // Nested VStacks make every gap explicit: 8pt header→card,
                    // 10pt card→card, 22pt section→section. Avoid LazyVStack
                    // here — its spacing across ConditionalContent boundaries
                    // wasn't consistent on iOS and produced visible dead space
                    // below the "All formats" header.
                    VStack(alignment: .leading, spacing: 22) {
                        if !filteredTemplates.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                sectionHeader("My presets")
                                VStack(spacing: 10) {
                                    ForEach(displayedTemplates) { template in
                                        templateBlock(template)
                                    }
                                }
                                if search.isEmpty && allTemplates.count > 5 {
                                    seeAllToggle
                                }
                            }
                        }
                        if !filteredFormats.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                sectionHeader("All formats")
                                VStack(spacing: 10) {
                                    ForEach(filteredFormats) { format in
                                        formatBlock(format)
                                    }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 6)
                    .padding(.bottom, 12)
                }
            }
        }
        .interactiveDismissDisabled(isDirty)
        // Sticky CTA in the safe area with a soft scroll-edge fade so list
        // content fades into the sheet background instead of crashing into
        // the button.
        .safeAreaInset(edge: .bottom, spacing: 0) {
            primaryCTA
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 8)
                .background(alignment: .top) {
                    LinearGradient(
                        colors: [sheetBackground.opacity(0), sheetBackground],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 24)
                    .offset(y: -24)
                    .allowsHitTesting(false)
                }
                .background(sheetBackground)
        }
    }

    private var primaryCTA: some View {
        AnimatedLightsButton(
            title: ctaLabel,
            showSparks: true,
            isEnabled: !draft.isEmpty,
            action: commit
        )
        .animation(.easeOut(duration: 0.2), value: draft.count)
    }

    private var seeAllToggle: some View {
        Button {
            withAnimation(.easeOut(duration: 0.25)) { showAllTemplates.toggle() }
        } label: {
            HStack(spacing: 6) {
                Text(showAllTemplates ? "Show less" : "See all templates")
                    .font(.app(size: 14, weight: .medium))
                    .foregroundColor(AppInk.solid(0.65))
                Image(systemName: showAllTemplates ? "chevron.up" : "chevron.down")
                    .font(.appBadge)
                    .foregroundColor(AppInk.solid(0.40))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }

    private func commit() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        selectedFormatIDs = draft
        dismiss()
    }

    private func templateState(_ template: ContentTemplate) -> SelectionState {
        let hit = Set(template.formatIDs).intersection(draft)
        if hit.isEmpty { return .none }
        if hit.count == template.formatIDs.count { return .all }
        return .partial
    }

    @ViewBuilder
    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.appCaptionMedium)
            .foregroundColor(AppText.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func selectionIndicator(_ state: SelectionState) -> some View {
        ZStack {
            switch state {
            case .all:
                Circle().fill(.white)
                Image(systemName: "checkmark")
                    .font(.app(size: 11, weight: .bold))
                    .foregroundColor(sheetBackground)
            case .partial:
                Circle().fill(AppInk.solid(0.45))
                Image(systemName: "minus")
                    .font(.app(size: 11, weight: .bold))
                    .foregroundColor(sheetBackground)
            case .none:
                Circle().stroke(AppInk.solid(0.22), lineWidth: 1.5)
            }
        }
        .frame(width: 24, height: 24)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private func templateBlock(_ template: ContentTemplate) -> some View {
        let state = templateState(template)
        let fillOpacity: Double = {
            switch state {
            case .all: return 0.10
            case .partial: return 0.07
            case .none: return 0.04
            }
        }()
        let strokeOpacity: Double = {
            switch state {
            case .all: return 0.30
            case .partial: return 0.18
            case .none: return 0.06
            }
        }()
        Button {
            withAnimation(AppAnimation.standard) {
                if state == .all {
                    draft.subtract(template.formatIDs)
                } else {
                    draft.formUnion(template.formatIDs)
                }
            }
        } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(template.name)
                        .font(.appSubtextBold)
                        .foregroundColor(AppText.primary)
                    Text(template.description)
                        .font(.appCaption)
                        .foregroundColor(AppInk.solid(0.50))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                selectionIndicator(state)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .fill(AppInk.solid(fillOpacity))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .stroke(AppInk.solid(strokeOpacity), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(state == .all ? .isSelected : [])
        .accessibilityHint("Template with \(template.formatIDs.count) formats")
    }

    @ViewBuilder
    private func formatBlock(_ format: ContentFormat) -> some View {
        let selected = draft.contains(format.id)
        Button {
            withAnimation(AppAnimation.standard) {
                if selected { draft.remove(format.id) }
                else { draft.insert(format.id) }
            }
        } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(format.label)
                        .font(.appSubtextBold)
                        .foregroundColor(AppText.primary)
                    Text(format.description)
                        .font(.appCaption)
                        .foregroundColor(AppInk.solid(0.50))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                selectionIndicator(selected ? .all : .none)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .fill(AppInk.solid(selected ? 0.10 : 0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .stroke(AppInk.solid(selected ? 0.30 : 0.06), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

// MARK: - Formats Block

private struct FormatsBlock: View {
    @Binding var selectedFormatIDs: Set<String>
    @Binding var prompt: String
    @State private var showPicker = false
    @State private var suggestions: [ContentFormat] = []
    // Last value that `displayText` synced into `prompt`. The format-chip
    // → prompt sync only fires when the user hasn't typed over it — i.e.
    // when `prompt` still matches the previously-synced text. Once the
    // user edits the prompt, format selections stop overwriting it.
    @State private var lastSyncedDisplayText: String = ""
    // Stable shuffled order computed once; the displayed suggestions list
    // is just this filtered by what's currently selected. The previous
    // implementation re-shuffled on every selection change, which made
    // the chip row visibly jumble on each tap.
    @State private var shuffledOrder: [ContentFormat] = []

    private var selectedFormats: [ContentFormat] {
        allFormats.filter { selectedFormatIDs.contains($0.id) }
    }

    private var displayText: String {
        selectedFormats.map(\.label).joined(separator: ", ")
    }

    private func refreshSuggestions() {
        if shuffledOrder.isEmpty { shuffledOrder = allFormats.shuffled() }
        suggestions = Array(
            shuffledOrder.filter { !selectedFormatIDs.contains($0.id) }.prefix(4)
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text("Format")
                    .font(.appSubtextMedium)
                    .foregroundColor(AppInk.solid(0.85))
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 14)

            // Suggestion chip row with the expand button floating over the
            // trailing edge. Chips fade to transparent behind it via a mask;
            // the expand button gets its own opaque material backing so any
            // chip still partially visible at the fade edge can't bleed through.
            ZStack(alignment: .trailing) {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(suggestions) { fmt in
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                withAnimation(chipAnim) {
                                    selectedFormatIDs.insert(fmt.id)
                                    refreshSuggestions()
                                }
                            } label: {
                                Text(fmt.label)
                                    .font(.appCaptionMedium)
                                    .foregroundColor(AppInk.solid(0.78))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 11)
                                    .background(AppInk.solid(0.10), in: Capsule(style: .continuous))
                                    .overlay(
                                        Capsule(style: .continuous)
                                            .stroke(AppInk.solid(0.14), lineWidth: 0.5)
                                    )
                            }
                            .buttonStyle(.plain)
                            .transition(.opacity)
                        }
                    }
                    .padding(.leading, 16)
                    .padding(.trailing, 64)
                }
                .mask(
                    HStack(spacing: 0) {
                        Rectangle()
                        LinearGradient(
                            stops: [
                                .init(color: .black, location: 0.0),
                                .init(color: .clear, location: 0.55)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: 72)
                    }
                )

                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showPicker = true
                } label: {
                    Image(systemName: "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(AppText.primary)
                        .frame(width: 36, height: 36)
                        .background(AppBackground.surface, in: Circle())
                        .overlay(
                            Circle().stroke(AppInk.solid(0.18), lineWidth: 0.5)
                        )
                }
                .buttonStyle(.plain)
                .padding(.trailing, 16)
            }
            .padding(.bottom, 6)
        }
        .animation(chipAnim, value: displayText)
        .onAppear { refreshSuggestions() }
        .onChange(of: selectedFormatIDs) {
            withAnimation(chipAnim) {
                refreshSuggestions()
                // Only auto-write the format list into the prompt if the
                // user hasn't typed over it. If `prompt` no longer matches
                // the last value we synced, the user has edited the
                // field — leave their text alone.
                if prompt.isEmpty || prompt == lastSyncedDisplayText {
                    prompt = displayText
                    lastSyncedDisplayText = displayText
                }
            }
        }
        .sheet(isPresented: $showPicker) {
            FormatPickerSheet(selectedFormatIDs: $selectedFormatIDs)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(Radius.sheet)
                .presentationBackground(AppBackground.primary)
        }
    }

    private var chipAnim: Animation { .easeInOut(duration: 0.28) }
}

// MARK: - Prompt Field

private struct PromptField: View {
    @Binding var prompt: String
    @FocusState private var focused: Bool

    var body: some View {
        // Multi-line TextField with axis:.vertical grows with content
        // and doesn't engage its own scroll, so it plays nicely with
        // the page-level ScrollView. TextEditor inside a height cap
        // fights the parent for scroll gestures.
        TextField(
            text: $prompt,
            axis: .vertical
        ) {
            // Placeholder sits on the card's pure-white surface with no input
            // chrome around it, so the alpha has to do all the work of marking
            // this row as low-emphasis. 0.22 fell well below the 3:1 floor
            // for non-text UI in light mode (~1.8:1 against #FFF); 0.40 keeps
            // the hint clearly secondary while staying readable.
            Text("Leave empty to generate from sources and format.")
                .foregroundStyle(AppInk.solid(0.40))
        }
        .font(.appSubtext)
        .lineSpacing(4)
        .foregroundColor(AppInk.solid(0.92))
        .tint(AppText.primary)
        .lineLimit(3...6)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .focused($focused)
    }
}

// MARK: - Brand Card

private struct BrandCard: View {
    @Binding var selectedBrand: String
    let brands = ["Default", "Personal", "Company", "Startup", "Agency"]

    var body: some View {
        GlassCard {
            HStack(spacing: 12) {
                Text("Brand voice")
                    .font(.appSubtextMedium)
                    .foregroundColor(AppInk.solid(0.85))

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
                            .font(.appSubtextMedium)
                            .foregroundColor(AppInk.solid(0.78))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.app(size: 11, weight: .semibold))
                            .foregroundColor(AppInk.solid(0.50))
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(AppInk.solid(0.14))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(AppInk.solid(0.16), lineWidth: 0.5))
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
    var pendingSheet: Binding<SourceSheet?> = .constant(nil)
    var isModal: Bool = false
    /// Minimal 1 hook. When set, generation results are handed to this
    /// closure instead of being written to `library_projects`, and the
    /// result-detail fullScreenCover is suppressed — Minimal anchors
    /// generations to their source note (`minimal_generations_v1`) and
    /// dismisses straight back to that note instead of opening a
    /// classic library detail page.
    var resultsHandler: (([GeneratedResult], [SourceItem]) -> Void)? = nil
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var bannerController: BannerController

    @State private var sources: [SourceItem]
    @State private var selectedFormatIDs: Set<String> = []
    @State private var prompt = ""
    @State private var brand = "Default"

    @State private var isGenerating = false
    @State private var resultBatch: ResultBatch? = nil
    @State private var lastBatchIDs: [UUID] = []
    @State private var generationFailed = false
    @State private var generationFailReason = ""
    @State private var generationTask: Task<Void, Never>? = nil
    @State private var showNoKeySheet = false
    @State private var showSignUpSheet = false

    @AppStorage("library_projects") private var projectsData: Data = Data()

    init(
        scrollToTopSignal: Int = 0,
        pendingSheet: Binding<SourceSheet?> = .constant(nil),
        isModal: Bool = false,
        initialSources: [SourceItem] = [],
        resultsHandler: (([GeneratedResult], [SourceItem]) -> Void)? = nil
    ) {
        self.scrollToTopSignal = scrollToTopSignal
        self.pendingSheet = pendingSheet
        self.isModal = isModal
        self.resultsHandler = resultsHandler
        self._sources = State(initialValue: initialSources)
    }

    private var canGenerate: Bool {
        !sources.isEmpty && !selectedFormatIDs.isEmpty && !isGenerating
    }

    private var generateLabel: String {
        if isGenerating { return "Generating\u{2026}" }
        return selectedFormatIDs.isEmpty ? "Generate" : "Generate \(selectedFormatIDs.count)"
    }

    var body: some View {
        // When presented as a fullScreenCover (from the note page), the cover
        // sits above ContentView's banner overlay, so the generation pill at
        // ContentView.swift is hidden behind us. Render our own copy inside
        // the modal so the user still sees progress + can open the result.
        ZStack(alignment: .top) {
            modalBody
            if isModal && bannerController.isVisible {
                GenerationBanner(
                    isReady: bannerController.isReady,
                    onTap: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        bannerController.onOpen?()
                    },
                    onDismiss: { bannerController.onCancel?() }
                )
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(2)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: bannerController.isVisible)
    }

    private var modalBody: some View {
        NavigationStack {
            ZStack {
                AmbientBackground()

                VStack(spacing: 0) {
                    InlineTopBar(title: "Create") {
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

                    ScrollViewReader { proxy in
                        ScrollView(showsIndicators: false) {
                            VStack(spacing: 0) {
                                VStack(spacing: 12) {
                                    SourcesBlock(sources: $sources, pendingSheet: pendingSheet)
                                    GlassCard {
                                        VStack(spacing: 0) {
                                            FormatsBlock(selectedFormatIDs: $selectedFormatIDs, prompt: $prompt)
                                            PromptField(prompt: $prompt)
                                        }
                                    }
                                    BrandCard(selectedBrand: $brand)
                                }
                                .id("top")
                                .padding(.horizontal, 16)
                                .padding(.top, 8)
                                .padding(.bottom, 16)

                                AnimatedLightsButton(
                                    title: generateLabel,
                                    showSparks: !isGenerating,
                                    isEnabled: canGenerate
                                ) {
                                    startGeneration()
                                }
                                .padding(.horizontal, 16)
                                .padding(.bottom, 40)
                            }
                        }
                        .scrollDismissesKeyboard(.immediately)
                        .onChange(of: scrollToTopSignal) { _, _ in
                            withAnimation(.easeOut(duration: 0.3)) {
                                proxy.scrollTo("top", anchor: .top)
                            }
                        }
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
        .fullScreenCover(item: $resultBatch) { batch in
            ProjectGroupDetailView(groupTitle: batch.title, initialItems: batch.items)
        }
        .alert("Generation failed", isPresented: $generationFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(generationFailReason.isEmpty
                 ? "Could not reach the API. Check your network connection and try again."
                 : generationFailReason)
        }
        .fullScreenCover(isPresented: $showNoKeySheet) {
            APIKeySetupView(
                onSaved: {
                    showNoKeySheet = false
                    startGeneration()
                },
                onDismiss: { showNoKeySheet = false }
            )
        }
        .fullScreenCover(isPresented: $showSignUpSheet) {
            OnboardingView(
                onGetStarted: { showSignUpSheet = false },
                onLogin: { showSignUpSheet = false }
            )
        }
    }

    private func startGeneration() {
        guard canGenerate else { return }

        let effectiveSources = sources.filter { !$0.content.isEmpty }
        guard !effectiveSources.isEmpty else {
            generationFailReason = "Your sources have no content — the fetch or read may have failed. Try adding a text source manually."
            generationFailed = true
            return
        }

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        isGenerating = true
        bannerController.isReady = false
        bannerController.isVisible = true
        if resultsHandler != nil {
            // Minimal 1 host: tapping the ready banner just dismisses
            // this modal — the host (note detail page) is what shows
            // the new generation as a tab, not a library-detail surface.
            bannerController.onOpen = { [self] in
                bannerController.isVisible = false
                dismiss()
            }
        } else {
            bannerController.onOpen = { [self] in
                let projects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
                let batchItems = lastBatchIDs.compactMap { id in projects.first { $0.id == id } }
                let items = batchItems.isEmpty ? (projects.first.map { [$0] } ?? []) : batchItems
                if let first = items.first {
                    resultBatch = ResultBatch(title: first.title, items: items)
                }
                bannerController.isVisible = false
            }
        }
        bannerController.onCancel = { [self] in generationTask?.cancel(); generationTask = nil; isGenerating = false; bannerController.isVisible = false }

        let capturedSources = effectiveSources
        let capturedIDs = Array(selectedFormatIDs)
        let capturedPrompt = prompt
        let capturedBrand = brand

        generationTask = Task {
            var results: [GeneratedResult] = []
            var firstError: APICallError? = nil
            for formatID in capturedIDs {
                guard !Task.isCancelled else { break }
                let label = allFormats.first { $0.id == formatID }?.label ?? formatID
                switch await ContentGenerator.generate(
                    sources: capturedSources,
                    formatID: formatID,
                    formatLabel: label,
                    customPrompt: capturedPrompt,
                    brand: capturedBrand
                ) {
                case .success(let text):
                    results.append(GeneratedResult(formatID: formatID, formatLabel: label, content: text))
                case .failure(let err):
                    if firstError == nil { firstError = err }
                }
            }
            let cancelled = Task.isCancelled
            await MainActor.run {
                isGenerating = false
                generationTask = nil
                if cancelled {
                    bannerController.isVisible = false
                    return
                }
                if results.isEmpty {
                    bannerController.isVisible = false
                    if case .signupRequired = firstError {
                        showSignUpSheet = true
                    } else {
                        generationFailReason = firstError?.userMessage ?? ""
                        generationFailed = true
                    }
                } else if let resultsHandler {
                    // Minimal 1 host owns persistence — hand the results
                    // over, mark the banner ready (taps just dismiss),
                    // and never touch library_projects.
                    resultsHandler(results, capturedSources)
                    bannerController.isReady = true
                } else if saveToLibrary(results, sources: capturedSources) {
                    bannerController.isReady = true
                } else {
                    // Persistence refused (corrupt blob) or JSON encode failed.
                    // Showing "Content ready" here would mislead the user into
                    // tapping Open and seeing stale content because the new
                    // batch never landed in projectsData.
                    bannerController.isVisible = false
                    generationFailReason = "Couldn't save the generated content. Your library file may be corrupted — try restarting the app."
                    generationFailed = true
                }
            }
        }
    }

    /// Returns true if the new batch was persisted to projectsData,
    /// false if the existing blob is corrupt (we refuse to overwrite —
    /// see BlobLoad doc) or the JSON encode of the combined array fails.
    private func saveToLibrary(_ results: [GeneratedResult], sources: [SourceItem]) -> Bool {
        var projects: [GenerationProject]
        switch loadBlob([GenerationProject].self, from: projectsData) {
        case .empty: projects = []
        case .ok(let existing): projects = existing
        case .corrupt: return false
        }

        let sourceTitle = sources.first?.label ?? "Untitled"
        let now = Date()
        let newProjects: [GenerationProject] = results.enumerated().map { idx, r in
            GenerationProject(
                title: sourceTitle,
                outputType: r.formatID,
                preview: String(r.content.prefix(160)),
                content: r.content,
                date: now.addingTimeInterval(-Double(idx) * 0.001)
            )
        }
        projects.insert(contentsOf: newProjects, at: 0)
        guard let encoded = try? JSONEncoder().encode(projects) else { return false }
        projectsData = encoded
        lastBatchIDs = newProjects.map { $0.id }
        return true
    }
}

private struct ResultBatch: Identifiable {
    let id = UUID()
    let title: String
    let items: [GenerationProject]
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
