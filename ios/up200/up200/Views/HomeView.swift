import SwiftUI
import PhotosUI
import UniformTypeIdentifiers
import Speech
import AVFoundation
import PDFKit
import Vision

// MARK: - Source Item Model

enum SourceType: String, Identifiable {
    case text, link, file, voice, image
    var id: String { rawValue }
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
        }
    }
}

// MARK: - Format & Template Models

private struct ContentFormat: Identifiable {
    let id: String
    let label: String
    let description: String
}

private let allFormats: [ContentFormat] = [
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

private struct AIService {
    private static var apiKey: String { KeychainService.load() ?? "" }

    static func generateTitle(from text: String) async -> String {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Note" }
        if !apiKey.isEmpty, let title = await callAnthropic(text: trimmed) {
            return title
        }
        return fallback(from: trimmed)
    }

    private static func callAnthropic(text: String) async -> String? {
        guard let url = URL(string: "https://api.anthropic.com/v1/messages") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 8

        let prompt = "Give a concise 3-6 word title for this content. Reply with only the title, no quotes, no punctuation at the end:\n\n\(text.prefix(800))"
        let body: [String: Any] = [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 25,
            "messages": [["role": "user", "content": prompt]]
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        req.httpBody = httpBody

        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return nil }

        let title = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return title.isEmpty ? nil : title
    }

    static func fallback(from text: String) -> String {
        let stop = Set(["the","a","an","is","it","in","on","at","to","for","of","and","or","but",
                        "i","you","we","they","this","that","with","from","by","as","be","are",
                        "was","were","have","has","had","do","did","will","would","could","should"])
        let words = text.split { !$0.isLetter }
            .map(String.init)
            .filter { $0.count > 2 && !stop.contains($0.lowercased()) }
        let title = Array(words.prefix(5)).joined(separator: " ")
        return title.isEmpty ? "Note" : title
    }
}

// MARK: - Content Generator

private struct GeneratedResult: Identifiable {
    let id = UUID()
    let formatID: String
    let formatLabel: String
    let content: String
}

private struct ContentGenerator {
    static var isKeyConfigured: Bool {
        guard let key = KeychainService.load() else { return false }
        return !key.isEmpty && !key.hasPrefix("$(")
    }

    static func generate(
        sources: [SourceItem],
        formatID: String,
        formatLabel: String,
        customPrompt: String,
        brand: String
    ) async -> String? {
        let apiKey = KeychainService.load() ?? ""
        guard !apiKey.isEmpty, let url = URL(string: "https://api.anthropic.com/v1/messages") else { return nil }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 60

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
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        req.httpBody = httpBody

        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return nil }

        let result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? nil : result
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

// MARK: - Generating Sheet

private struct GeneratingSheet: View {
    let formatLabels: [String]
    var onCancel: () -> Void

    @State private var pulse = false
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [amber.opacity(0.15), .clear],
                center: .center, startRadius: 0, endRadius: 340
            ).ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Button("Cancel", action: onCancel)
                        .font(.app(size: 16, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.45))
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)

                Spacer()

                VStack(spacing: 28) {
                    ZStack {
                        Circle()
                            .fill(amber.opacity(0.10))
                            .frame(width: 130, height: 130)
                            .scaleEffect(pulse ? 1.28 : 1.0)
                            .animation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true), value: pulse)
                        Circle()
                            .fill(amber.opacity(0.18))
                            .frame(width: 88, height: 88)
                        Image(systemName: "sparkles")
                            .font(.app(size: 32, weight: .light))
                            .foregroundColor(amber)
                    }
                    .onAppear { pulse = true }

                    VStack(spacing: 10) {
                        Text("Creating your content")
                            .font(.app(size: 19, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.88))
                        Text(formatLabels.joined(separator: " · "))
                            .font(.app(size: 13))
                            .foregroundColor(Color.white.opacity(0.38))
                    }
                }

                Spacer()
            }
        }
    }
}

// MARK: - Generation Result Sheet

private struct GenerationResultSheet: View {
    let results: [GeneratedResult]
    @Environment(\.dismiss) private var dismiss
    @State private var copiedID: UUID? = nil

    private let green = Color(red: 0.27, green: 0.70, blue: 0.42)

    var body: some View {
        VStack(spacing: 0) {
            // Header: close · title · count
            HStack(spacing: 12) {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.app(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.60))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }

                Spacer(minLength: 0)

                Text("Outputs")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Spacer(minLength: 0)

                Text("\(results.count)")
                    .font(.app(size: 14))
                    .foregroundColor(Color.white.opacity(0.45))
                    .frame(width: 28, alignment: .trailing)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 14)

            // Block list
            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    ForEach(results) { result in
                        resultBlock(result)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
            }

            // Saved indicator
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.app(size: 12))
                    .foregroundColor(green)
                Text("Saved to Library")
                    .font(.app(size: 12))
                    .foregroundColor(Color.white.opacity(0.32))
            }
            .padding(.vertical, 12)
        }
    }

    @ViewBuilder
    private func resultBlock(_ result: GeneratedResult) -> some View {
        let isCopied = copiedID == result.id
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(result.formatLabel)
                    .font(.app(size: 15, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                Spacer(minLength: 8)
                Button {
                    UIPasteboard.general.string = result.content
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.easeOut(duration: 0.15)) { copiedID = result.id }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        withAnimation {
                            if copiedID == result.id { copiedID = nil }
                        }
                    }
                } label: {
                    Label(isCopied ? "Copied" : "Copy",
                          systemImage: isCopied ? "checkmark" : "doc.on.doc")
                        .font(.app(size: 12, weight: .medium))
                        .foregroundColor(isCopied ? green : Color.white.opacity(0.55))
                }
                .buttonStyle(.plain)
            }

            Text(result.content)
                .font(.app(size: 14))
                .foregroundColor(Color.white.opacity(0.82))
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
        )
    }
}

// MARK: - Voice Recorder

@MainActor
private final class VoiceRecorder: ObservableObject {
    @Published var transcript = ""
    @Published var isRecording = false
    @Published var permissionDenied = false

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    func start() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                if status == .authorized {
                    self.startEngine()
                } else {
                    self.permissionDenied = true
                }
            }
        }
    }

    func stop() {
        audioEngine.stop()
        recognitionRequest?.endAudio()
        if audioEngine.inputNode.numberOfInputs > 0 {
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        isRecording = false
    }

    private func startEngine() {
        recognitionTask?.cancel()
        recognitionTask = nil

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try? session.setActive(true, options: .notifyOthersOnDeactivation)

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let request = recognitionRequest, let rec = recognizer else { return }
        request.shouldReportPartialResults = true

        recognitionTask = rec.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                if let result {
                    self?.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self?.isRecording = false
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }

        audioEngine.prepare()
        if (try? audioEngine.start()) != nil {
            isRecording = true
        }
    }
}

// MARK: - Animated Lights Button

struct AnimatedLightsButton: View {
    let title: String
    var icon: String? = nil
    var isEnabled: Bool = true
    var action: () -> Void
    @State private var phase = false

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(red: 0.06, green: 0.07, blue: 0.10))

                if isEnabled {
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
                }

                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.white.opacity(isEnabled ? 0.13 : 0.06), lineWidth: 0.5)

                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon)
                            .font(.app(size: 17, weight: .semibold))
                    }
                    Text(title)
                        .font(.app(size: 18, weight: .semibold))
                }
                .foregroundColor(isEnabled ? .white : Color.white.opacity(0.25))
            }
            .frame(height: 54)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .onAppear {
            withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) {
                phase = true
            }
        }
    }
}

// MARK: - Import Sheet

struct ImportSheetView: View {
    var onSelect: (SourceType) -> Void
    @Environment(\.dismiss) private var dismiss

    private let gridItems: [(icon: String, label: String, type: SourceType)] = [
        ("arrow.up.doc", "Upload a file", .file),
        ("pencil",       "Write text",    .text),
        ("waveform",     "Voice note",    .voice),
        ("photo",        "Image",         .image),
    ]

    var body: some View {
        VStack(spacing: 16) {
            Capsule()
                .fill(Color.white.opacity(0.12))
                .frame(width: 32, height: 4)
                .padding(.top, 10)

            Text("Import content")
                .font(.app(size: 19, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.bottom, 2)

            Button {
                onSelect(.link)
                dismiss()
            } label: {
                VStack(spacing: 12) {
                    Image(systemName: "link")
                        .font(.app(size: 16, weight: .light))
                        .foregroundColor(Color.white.opacity(0.82))
                    Text("Paste a link")
                        .font(.app(size: 14, weight: .regular))
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
                                .font(.app(size: 16, weight: .light))
                                .foregroundColor(Color.white.opacity(0.82))
                            Text(item.label)
                                .font(.app(size: 14, weight: .regular))
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
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 32)
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

// MARK: - Text Input Sheet

private struct TextInputSheet: View {
    var onSave: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var isGenerating = false
    @FocusState private var focused: Bool

    private var wordCount: Int { text.split { $0.isWhitespace }.count }
    private var canSave: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") {
                    guard !isGenerating else { return }
                    dismiss()
                }
                .foregroundColor(Color.white.opacity(0.55))

                Spacer()

                Text("Text source")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Spacer()

                Button {
                    handleSave()
                } label: {
                    if isGenerating {
                        ProgressView()
                            .scaleEffect(0.75)
                            .tint(Color.white.opacity(0.55))
                            .frame(width: 40)
                    } else {
                        Text("Save")
                            .foregroundColor(canSave ? Color.white.opacity(0.88) : Color.white.opacity(0.25))
                    }
                }
                .disabled(!canSave || isGenerating)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 14)

            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 0.5)

            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Paste your text, transcript or notes\u{2026}")
                        .font(.app(size: 16))
                        .foregroundColor(Color.white.opacity(0.22))
                        .padding(.horizontal, 20)
                        .padding(.top, 18)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(.app(size: 16))
                    .foregroundColor(Color.white.opacity(0.88))
                    .scrollContentBackground(.hidden)
                    .background(.clear)
                    .padding(.horizontal, 16)
                    .focused($focused)
                    .disabled(isGenerating)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if wordCount > 0 {
                HStack {
                    if isGenerating {
                        Label("Generating title\u{2026}", systemImage: "sparkles")
                            .font(.app(size: 12))
                            .foregroundColor(Color.white.opacity(0.40))
                    }
                    Spacer()
                    Text("\(wordCount) words")
                        .font(.app(size: 12))
                        .foregroundColor(Color.white.opacity(0.28))
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 12)
                .animation(.easeOut(duration: 0.2), value: isGenerating)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { focused = true }
        }
    }

    private func handleSave() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        focused = false
        isGenerating = true
        Task {
            let title = await AIService.generateTitle(from: trimmed)
            await MainActor.run {
                isGenerating = false
                onSave(title, trimmed)
                dismiss()
            }
        }
    }
}

// MARK: - Link Input Sheet

private struct LinkInputSheet: View {
    var onSave: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var urlText = ""
    @State private var isFetching = false
    @FocusState private var focused: Bool

    private var isValidURL: Bool {
        let t = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        return (t.hasPrefix("http://") || t.hasPrefix("https://")) && t.count > 11
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") { dismiss() }
                    .foregroundColor(Color.white.opacity(0.55))
                Spacer()
                Text("Link source")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Spacer()
                Button {
                    guard !isFetching else { return }
                    saveLink()
                } label: {
                    if isFetching {
                        ProgressView()
                            .scaleEffect(0.75)
                            .tint(Color.white.opacity(0.55))
                            .frame(width: 40)
                    } else {
                        Text("Save")
                            .foregroundColor(isValidURL ? Color.white.opacity(0.88) : Color.white.opacity(0.25))
                    }
                }
                .disabled(!isValidURL || isFetching)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 14)

            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 0.5)

            HStack(spacing: 10) {
                Image(systemName: "link")
                    .font(.app(size: 15))
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("https://", text: $urlText)
                    .font(.app(size: 16))
                    .foregroundColor(Color.white.opacity(0.88))
                    .autocapitalization(.none)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .submitLabel(.done)
                    .onSubmit { if isValidURL { saveLink() } }
                if !urlText.isEmpty {
                    Button { urlText = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 18)

            if isFetching {
                HStack(spacing: 6) {
                    Image(systemName: "globe")
                        .font(.app(size: 12))
                    Text("Fetching page content\u{2026}")
                        .font(.app(size: 13))
                }
                .foregroundColor(Color.white.opacity(0.35))
                .padding(.top, 4)
            }

            Spacer()
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { focused = true }
        }
    }

    private func saveLink() {
        let trimmed = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed) else { return }
        isFetching = true
        Task {
            let (label, content) = await fetchPageContent(from: url)
            await MainActor.run {
                isFetching = false
                onSave(label, content)
                dismiss()
            }
        }
    }

    private func fetchPageContent(from url: URL) async -> (label: String, content: String) {
        guard let (data, _) = try? await URLSession.shared.data(from: url),
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

    private func extractBodyText(from html: String) -> String {
        var text = html
        for tag in ["script", "style", "nav", "header", "footer", "noscript"] {
            let pattern = "<\(tag)[^>]*>[\\s\\S]*?</\(tag)>"
            if let re = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                text = re.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..<text.endIndex, in: text), withTemplate: " ")
            }
        }
        if let re = try? NSRegularExpression(pattern: "<[^>]+>") {
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

private struct VoiceRecordSheet: View {
    var onSave: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceRecorder()
    @State private var seconds = 0
    @State private var pulse = false
    @State private var isGenerating = false

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    private var timeLabel: String {
        String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [amber.opacity(recorder.isRecording ? 0.16 : 0.0), .clear],
                center: .center, startRadius: 0, endRadius: 300
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 0.6), value: recorder.isRecording)

            VStack(spacing: 0) {
                HStack {
                    Button("Cancel") {
                        guard !isGenerating else { return }
                        recorder.stop()
                        dismiss()
                    }
                    .foregroundColor(Color.white.opacity(0.55))
                    .disabled(isGenerating)

                    Spacer()

                    Text("Voice Note")
                        .font(.app(size: 16, weight: .semibold))
                        .foregroundColor(.white)

                    Spacer()
                    Text("Cancel").foregroundColor(.clear)
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)

                Spacer()

                VStack(spacing: 28) {
                    ZStack {
                        if recorder.isRecording {
                            Circle()
                                .fill(amber.opacity(0.10))
                                .frame(width: 150, height: 150)
                                .scaleEffect(pulse ? 1.3 : 1.0)
                                .animation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true), value: pulse)
                            Circle()
                                .fill(amber.opacity(0.20))
                                .frame(width: 108, height: 108)
                        }
                        Button(action: handleMicTap) {
                            Circle()
                                .fill(recorder.isRecording ? amber : Color.white.opacity(0.12))
                                .frame(width: 76, height: 76)
                                .overlay(
                                    Image(systemName: recorder.isRecording ? "stop.fill" : "mic.fill")
                                        .font(.app(size: 28, weight: .medium))
                                        .foregroundColor(.white)
                                )
                        }
                        .buttonStyle(.plain)
                        .disabled(isGenerating)
                    }
                    .animation(.spring(duration: 0.4), value: recorder.isRecording)

                    if isGenerating {
                        Label("Generating title\u{2026}", systemImage: "sparkles")
                            .font(.app(size: 15))
                            .foregroundColor(Color.white.opacity(0.50))
                            .transition(.opacity)
                    } else {
                        Text(recorder.isRecording ? timeLabel : "Tap to record")
                            .font(.app(size: 17, design: recorder.isRecording ? .monospaced : .default))
                            .foregroundColor(Color.white.opacity(recorder.isRecording ? 0.80 : 0.40))
                            .transition(.opacity)
                    }
                }
                .animation(.easeOut(duration: 0.2), value: isGenerating)

                if !recorder.transcript.isEmpty {
                    ScrollView(showsIndicators: false) {
                        Text(recorder.transcript)
                            .font(.app(size: 14))
                            .foregroundColor(Color.white.opacity(0.50))
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                            .padding(.top, 24)
                            .frame(maxWidth: .infinity)
                    }
                    .frame(maxHeight: 120)
                    .transition(.opacity)
                } else {
                    Spacer()
                }

                Spacer()

                if recorder.isRecording && !recorder.transcript.isEmpty {
                    Button {
                        handleDone()
                    } label: {
                        Text("Done")
                            .font(.app(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(amber)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 40)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else if !recorder.isRecording && !recorder.transcript.isEmpty && !isGenerating {
                    Button {
                        handleDone()
                    } label: {
                        Text("Use this")
                            .font(.app(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(amber)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 40)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                } else {
                    Color.clear.frame(height: 92)
                }
            }
        }
        .onReceive(clock) { _ in
            if recorder.isRecording { seconds += 1 }
        }
        .onChange(of: recorder.isRecording) { _, recording in
            if recording {
                seconds = 0
                withAnimation { pulse = true }
            } else {
                pulse = false
            }
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
        recorder.stop()
        let transcript = recorder.transcript
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
    @ViewBuilder let content: Content
    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.04))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

// MARK: - Sources Block

private struct SourcesBlock: View {
    @Binding var sources: [SourceItem]
    var pendingSourceType: Binding<SourceType?> = .constant(nil)

    @State private var showImport = false
    @State private var showTextInput = false
    @State private var showLinkInput = false
    @State private var showVoiceRecord = false
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var photoPickerItem: PhotosPickerItem? = nil

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Text("Sources")
                        .font(.app(size: 15, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.85))
                    Spacer()
                    Button { showImport = true } label: {
                        Image(systemName: "plus")
                            .font(.app(size: 13, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.80))
                            .frame(width: 30, height: 30)
                            .background(Color.white.opacity(0.09))
                            .overlay(Circle().stroke(Color.white.opacity(0.10), lineWidth: 0.5))
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
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)

                        HStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.app(size: 15))
                                .foregroundColor(Color.white.opacity(0.45))
                                .frame(width: 20)
                            Text(item.label)
                                .font(.app(size: 15))
                                .foregroundColor(Color.white.opacity(0.80))
                                .lineLimit(1)
                            Spacer()
                            Button {
                                withAnimation(.spring(duration: 0.25)) {
                                    sources.removeAll { $0.id == item.id }
                                }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.app(size: 11, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.28))
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
        .sheet(isPresented: $showImport) {
            ImportSheetView { type in
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                switch type {
                case .text:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { showTextInput = true }
                case .link:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { showLinkInput = true }
                case .voice:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { showVoiceRecord = true }
                case .file:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.30) { showFilePicker = true }
                case .image:
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.30) { showPhotoPicker = true }
                }
            }
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .sheet(isPresented: $showTextInput) {
            TextInputSheet { label, content in
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(SourceItem(type: .text, label: label, content: content))
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .sheet(isPresented: $showLinkInput) {
            LinkInputSheet { label, url in
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(SourceItem(type: .link, label: label, content: url))
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .sheet(isPresented: $showVoiceRecord) {
            VoiceRecordSheet { label, transcript in
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(SourceItem(type: .voice, label: label, content: transcript))
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.text, .plainText, .pdf],
            allowsMultipleSelection: false
        ) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            let name = url.lastPathComponent
            Task {
                let content = readFileContent(from: url)
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
            Task {
                let content = await extractTextFromPhoto(item: item)
                await MainActor.run {
                    withAnimation(.spring(duration: 0.25)) {
                        sources.append(SourceItem(type: .image, label: "Image", content: content))
                    }
                    photoPickerItem = nil
                }
            }
        }
        .onChange(of: pendingSourceType.wrappedValue) { _, type in
            guard let type else { return }
            pendingSourceType.wrappedValue = nil
            switch type {
            case .text:  DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showTextInput = true }
            case .link:  DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showLinkInput = true }
            case .voice: DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showVoiceRecord = true }
            case .file:  DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showFilePicker = true }
            case .image: DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { showPhotoPicker = true }
            }
        }
    }

    private func readFileContent(from url: URL) -> String {
        guard url.startAccessingSecurityScopedResource() else { return "" }
        defer { url.stopAccessingSecurityScopedResource() }
        if url.pathExtension.lowercased() == "pdf" {
            return String((PDFDocument(url: url)?.string ?? "").prefix(8000))
        }
        if let text = try? String(contentsOf: url, encoding: .utf8) { return String(text.prefix(8000)) }
        if let text = try? String(contentsOf: url, encoding: .isoLatin1) { return String(text.prefix(8000)) }
        return ""
    }

    private func extractTextFromPhoto(item: PhotosPickerItem) async -> String {
        guard let data = try? await item.loadTransferable(type: Data.self),
              let cgImage = UIImage(data: data)?.cgImage else { return "" }
        return await withCheckedContinuation { continuation in
            let request = VNRecognizeTextRequest { req, _ in
                let text = (req.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n") ?? ""
                continuation.resume(returning: text)
            }
            request.recognitionLevel = .accurate
            try? VNImageRequestHandler(cgImage: cgImage).perform([request])
        }
    }
}

// MARK: - Format Picker Sheet

private struct FormatPickerSheet: View {
    @Binding var selectedFormatIDs: Set<String>
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var showAllTemplates = false

    private let green = Color(red: 0.27, green: 0.70, blue: 0.42)

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

    private var doneLabel: String {
        selectedFormatIDs.isEmpty ? "Done" : "Done · \(selectedFormatIDs.count) selected"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Text("Format")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.app(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.60))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 18)
            .padding(.bottom, 14)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.app(size: 14))
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("Search formats and templates", text: $search)
                    .font(.app(size: 15))
                    .foregroundColor(.white)
                    .autocorrectionDisabled()
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.app(size: 15))
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.bottom, 2)

            if filteredTemplates.isEmpty && filteredFormats.isEmpty {
                Spacer()
                Text("No matches.")
                    .font(.app(size: 15))
                    .foregroundColor(Color.white.opacity(0.30))
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 0) {

                        if !filteredTemplates.isEmpty {
                            sectionHeader("Quick picks")

                            ForEach(displayedTemplates) { template in
                                templateRow(template)
                                divider()
                            }

                            if search.isEmpty && !showAllTemplates && allTemplates.count > 5 {
                                Button {
                                    withAnimation(.easeOut(duration: 0.2)) { showAllTemplates = true }
                                } label: {
                                    HStack {
                                        Text("See all templates")
                                            .font(.app(size: 15))
                                            .foregroundColor(Color.white.opacity(0.50))
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .font(.app(size: 12, weight: .medium))
                                            .foregroundColor(Color.white.opacity(0.30))
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                }
                                .buttonStyle(.plain)
                                divider()
                            }
                        }

                        if !filteredFormats.isEmpty {
                            sectionHeader("All formats")
                                .padding(.top, filteredTemplates.isEmpty ? 0 : 8)

                            ForEach(filteredFormats) { format in
                                formatRow(format)
                                if format.id != filteredFormats.last?.id { divider() }
                            }
                        }
                    }
                    .padding(.bottom, 16)
                }
            }

            VStack(spacing: 0) {
                Rectangle()
                    .fill(Color.white.opacity(0.07))
                    .frame(height: 0.5)

                Button { dismiss() } label: {
                    Text(doneLabel)
                        .font(.app(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(selectedFormatIDs.isEmpty ? Color.white.opacity(0.12) : green)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.top, 14)
                .padding(.bottom, 32)
                .animation(.easeOut(duration: 0.15), value: selectedFormatIDs.count)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }

    @ViewBuilder
    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.app(size: 11, weight: .semibold))
            .foregroundColor(Color.white.opacity(0.28))
            .tracking(0.6)
            .padding(.horizontal, 16)
            .padding(.top, 18)
            .padding(.bottom, 8)
    }

    @ViewBuilder
    private func divider() -> some View {
        Rectangle()
            .fill(Color.white.opacity(0.06))
            .frame(height: 0.5)
            .padding(.horizontal, 16)
    }

    @ViewBuilder
    private func templateRow(_ template: ContentTemplate) -> some View {
        let isActive = Set(template.formatIDs).isSubset(of: selectedFormatIDs)
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.easeOut(duration: 0.15)) {
                selectedFormatIDs.formUnion(template.formatIDs)
            }
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(template.name)
                        .font(.app(size: 15, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.88))

                    HStack(spacing: 5) {
                        ForEach(template.formatIDs.prefix(4), id: \.self) { fid in
                            if let fmt = allFormats.first(where: { $0.id == fid }) {
                                Text(fmt.label)
                                    .font(.app(size: 10, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.55))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(Color.white.opacity(isActive ? 0.14 : 0.07))
                                    .clipShape(Capsule())
                            }
                        }
                        if template.formatIDs.count > 4 {
                            Text("+\(template.formatIDs.count - 4)")
                                .font(.app(size: 10, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.35))
                        }
                    }

                    Text(template.description)
                        .font(.app(size: 12))
                        .foregroundColor(Color.white.opacity(0.35))
                }
                Spacer()
                if isActive {
                    Image(systemName: "checkmark")
                        .font(.app(size: 12, weight: .semibold))
                        .foregroundColor(green)
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func formatRow(_ format: ContentFormat) -> some View {
        let selected = selectedFormatIDs.contains(format.id)
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.easeOut(duration: 0.12)) {
                if selected { selectedFormatIDs.remove(format.id) }
                else { selectedFormatIDs.insert(format.id) }
            }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: selected ? "checkmark.square.fill" : "square")
                    .font(.app(size: 18))
                    .foregroundColor(selected ? green : Color.white.opacity(0.22))
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 3) {
                    Text(format.label)
                        .font(.app(size: 15))
                        .foregroundColor(selected ? Color.white.opacity(0.92) : Color.white.opacity(0.70))
                    Text(format.description)
                        .font(.app(size: 12))
                        .foregroundColor(Color.white.opacity(0.30))
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Formats Block

private struct PopularTemplate: Identifiable {
    let id: String
    let label: String
    let formatIDs: [String]
}

private let popularTemplates: [PopularTemplate] = [
    PopularTemplate(id: "social-pack", label: "Social pack",   formatIDs: ["linkedin", "twitter", "instagram"]),
    PopularTemplate(id: "newsletter",  label: "Newsletter",    formatIDs: ["newsletter"]),
    PopularTemplate(id: "blog",        label: "Blog post",     formatIDs: ["blog"]),
    PopularTemplate(id: "video",       label: "Video script",  formatIDs: ["youtube", "video"]),
    PopularTemplate(id: "research",    label: "Research pack", formatIDs: ["newsletter", "blog", "twitter"]),
]

private struct FormatsBlock: View {
    @Binding var selectedFormatIDs: Set<String>
    @State private var showPicker = false

    private let green = Color(red: 0.27, green: 0.70, blue: 0.42)

    private var summaryText: String {
        let labels = allFormats.filter { selectedFormatIDs.contains($0.id) }.map(\.label)
        switch labels.count {
        case 0: return ""
        case 1: return labels[0]
        case 2: return "\(labels[0]), \(labels[1])"
        default: return "\(labels[0]), \(labels[1]) +\(labels.count - 2)"
        }
    }

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showPicker = true
                } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Format")
                                .font(.app(size: 15, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.85))
                            if !selectedFormatIDs.isEmpty {
                                Text(summaryText)
                                    .font(.app(size: 14))
                                    .foregroundColor(Color.white.opacity(0.55))
                                    .lineLimit(1)
                                    .transition(.opacity)
                            }
                        }
                        Spacer()
                        if selectedFormatIDs.isEmpty {
                            Text("None")
                                .font(.app(size: 14))
                                .foregroundColor(Color.white.opacity(0.25))
                        } else {
                            Text("\(selectedFormatIDs.count)")
                                .font(.app(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .frame(minWidth: 24, minHeight: 24)
                                .background(green)
                                .clipShape(Circle())
                                .transition(.scale.combined(with: .opacity))
                        }
                        Image(systemName: "chevron.right")
                            .font(.app(size: 12, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.20))
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 12)
                    .animation(.easeOut(duration: 0.15), value: selectedFormatIDs.count)
                }
                .buttonStyle(.plain)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(popularTemplates) { tpl in
                            let active = Set(tpl.formatIDs) == selectedFormatIDs
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                withAnimation(.easeOut(duration: 0.15)) {
                                    selectedFormatIDs = Set(tpl.formatIDs)
                                }
                            } label: {
                                Text(tpl.label)
                                    .font(.app(size: 13, weight: .medium))
                                    .foregroundColor(active ? .white : Color.white.opacity(0.65))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 7)
                                    .background(active ? Color.white.opacity(0.12) : Color.white.opacity(0.05))
                                    .overlay(
                                        Capsule().stroke(
                                            active ? Color.white.opacity(0.30) : Color.white.opacity(0.10),
                                            lineWidth: 0.5
                                        )
                                    )
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)
                }
            }
        }
        .sheet(isPresented: $showPicker) {
            FormatPickerSheet(selectedFormatIDs: $selectedFormatIDs)
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
                .presentationCornerRadius(22)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
    }
}

// MARK: - Prompt Field

private struct PromptField: View {
    @Binding var prompt: String
    @FocusState private var focused: Bool

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 0) {
                Text("Add details (optional)")
                    .font(.app(size: 13, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.40))
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .padding(.bottom, 6)

                ZStack(alignment: .topLeading) {
                    if prompt.isEmpty {
                        Text("Leave empty to generate from sources and format.")
                            .font(.app(size: 15))
                            .foregroundColor(Color.white.opacity(0.20))
                            .padding(.horizontal, 16)
                            .padding(.top, 2)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $prompt)
                        .font(.app(size: 15))
                        .foregroundColor(Color.white.opacity(0.85))
                        .scrollContentBackground(.hidden)
                        .background(.clear)
                        .frame(minHeight: 70, maxHeight: 130)
                        .padding(.horizontal, 12)
                        .padding(.bottom, 10)
                        .focused($focused)
                }
            }
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
                    .font(.app(size: 18, weight: .medium))
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
                            .font(.app(size: 15, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.70))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.app(size: 11, weight: .semibold))
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

private enum GenerationSheet: String, Identifiable {
    case generating, results
    var id: String { rawValue }
}

struct HomeView: View {
    var scrollToTopSignal: Int = 0
    var pendingSourceType: Binding<SourceType?> = .constant(nil)

    @State private var sources: [SourceItem] = []
    @State private var selectedFormatIDs: Set<String> = []
    @State private var prompt = ""
    @State private var brand = "Default"

    @State private var isGenerating = false
    @State private var activeSheet: GenerationSheet? = nil
    @State private var generationResults: [GeneratedResult] = []
    @State private var generationFailed = false
    @State private var generationFailReason = ""
    @State private var generationTask: Task<Void, Never>? = nil
    @State private var showKeyUpdate = false

    @AppStorage("library_projects") private var projectsData: Data = Data()

    private var canGenerate: Bool {
        !sources.isEmpty && !selectedFormatIDs.isEmpty && !isGenerating
    }

    private var generateLabel: String {
        if isGenerating { return "Generating\u{2026}" }
        return selectedFormatIDs.isEmpty ? "Generate" : "Generate \(selectedFormatIDs.count)"
    }

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
                                .font(.app(size: 28, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            Button { showKeyUpdate = true } label: {
                                Image(systemName: "key.horizontal")
                                    .font(.app(size: 14, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.30))
                                    .frame(width: 36, height: 36)
                                    .background(Color.white.opacity(0.07))
                                    .clipShape(Circle())
                            }
                            .buttonStyle(.plain)
                        }
                        .id("top")
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 16)

                        VStack(spacing: 12) {
                            SourcesBlock(sources: $sources, pendingSourceType: pendingSourceType)
                            FormatsBlock(selectedFormatIDs: $selectedFormatIDs)
                            PromptField(prompt: $prompt)
                            BrandCard(selectedBrand: $brand)
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)

                        AnimatedLightsButton(
                            title: generateLabel,
                            icon: isGenerating ? nil : "sparkles",
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
        .sheet(item: $activeSheet) { sheet in
            Group {
                switch sheet {
                case .generating:
                    GeneratingSheet(
                        formatLabels: selectedFormatIDs.compactMap { id in allFormats.first { $0.id == id }?.label }
                    ) {
                        generationTask?.cancel()
                        generationTask = nil
                        activeSheet = nil
                        isGenerating = false
                    }
                    .interactiveDismissDisabled()
                case .results:
                    GenerationResultSheet(results: generationResults)
                }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .alert("Generation failed", isPresented: $generationFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(generationFailReason.isEmpty
                 ? "Could not reach the API. Check your network connection and try again."
                 : generationFailReason)
        }
        .sheet(isPresented: $showKeyUpdate) {
            APIKeySetupView {
                showKeyUpdate = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.hidden)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
    }

    private func startGeneration() {
        guard canGenerate else { return }

        guard ContentGenerator.isKeyConfigured else {
            generationFailReason = "No API key found. Tap the key icon in the top-right to add your Anthropic API key."
            generationFailed = true
            return
        }

        let effectiveSources = sources.filter { !$0.content.isEmpty }
        guard !effectiveSources.isEmpty else {
            generationFailReason = "Your sources have no content — the fetch or read may have failed. Try adding a text source manually."
            generationFailed = true
            return
        }

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        isGenerating = true
        activeSheet = .generating

        let capturedSources = effectiveSources
        let capturedIDs = Array(selectedFormatIDs)
        let capturedPrompt = prompt
        let capturedBrand = brand

        generationTask = Task {
            var results: [GeneratedResult] = []
            for formatID in capturedIDs {
                guard !Task.isCancelled else { break }
                let label = allFormats.first { $0.id == formatID }?.label ?? formatID
                if let text = await ContentGenerator.generate(
                    sources: capturedSources,
                    formatID: formatID,
                    formatLabel: label,
                    customPrompt: capturedPrompt,
                    brand: capturedBrand
                ) {
                    results.append(GeneratedResult(formatID: formatID, formatLabel: label, content: text))
                }
            }
            await MainActor.run {
                isGenerating = false
                generationTask = nil
                activeSheet = nil
                if results.isEmpty {
                    generationFailed = true
                } else {
                    generationResults = results
                    saveToLibrary(results, sources: capturedSources)
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                        activeSheet = .results
                    }
                }
            }
        }
    }

    private func saveToLibrary(_ results: [GeneratedResult], sources: [SourceItem]) {
        var projects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        let sourceTitle = sources.first?.label ?? "Untitled"
        let formatLabel = results.map(\.formatLabel).joined(separator: ", ")
        let preview = String(results.first?.content.prefix(160) ?? "")
        let allContent = results.count == 1
            ? results[0].content
            : results.map { "## \($0.formatLabel)\n\n\($0.content)" }.joined(separator: "\n\n---\n\n")
        projects.insert(
            GenerationProject(title: sourceTitle, outputType: formatLabel, preview: preview, content: allContent, date: Date()),
            at: 0
        )
        projectsData = (try? JSONEncoder().encode(projects)) ?? Data()
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
