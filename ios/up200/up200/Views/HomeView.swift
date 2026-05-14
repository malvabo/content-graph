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
    ) async -> Result<String, APICallError> {
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

// MARK: - Generation Banner

struct GenerationBanner: View {
    let formatLabels: [String]
    let isReady: Bool
    var onTap: () -> Void
    var onDismiss: () -> Void

    @State private var glowPhase = false

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
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 36, height: 36)
                if !isReady {
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
                                    .fill(Color.white.opacity(cfg.opacity * (0.5 + 0.5 * pulse)))
                                    .frame(width: cfg.size * (0.75 + 0.25 * pulse),
                                           height: cfg.size * (0.75 + 0.25 * pulse))
                                    .blur(radius: 0.8)
                                    .offset(x: x, y: y)
                            }
                        }
                    }
                } else {
                    Image(systemName: "checkmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(isReady ? "Content ready" : "Creating your content")
                    .font(.appSubtextBold)
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(formatLabels.joined(separator: " · "))
                    .font(.appMicro)
                    .foregroundColor(Color.white.opacity(0.50))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            if isReady {
                Button(action: onTap) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(Color(red: 0.06, green: 0.07, blue: 0.10))
                        Ellipse()
                            .fill(BrandColor.amber.opacity(0.55))
                            .frame(width: 80, height: 36)
                            .blur(radius: 16)
                            .offset(x: glowPhase ? 10 : -10)
                            .animation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true), value: glowPhase)
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                        Text("Open")
                            .font(.appCaptionMedium)
                            .foregroundColor(.white)
                    }
                    .frame(width: 68, height: 32)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                .buttonStyle(.plain)
            } else {
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.50))
                        .frame(width: 26, height: 26)
                        .background(Color.white.opacity(0.08))
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
                    .fill(Color(red: 0.11, green: 0.09, blue: 0.08))
                Ellipse()
                    .fill(BrandColor.amber.opacity(0.06))
                    .blur(radius: 20)
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.09), lineWidth: 0.5)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: Color.black.opacity(0.40), radius: 16, x: 0, y: 8)
        .contentShape(Rectangle())
        .onTapGesture { if isReady { onTap() } }
        .onAppear {
            glowPhase = true
        }
    }
}

// MARK: - Voice Recorder

@MainActor
final class VoiceRecorder: ObservableObject {
    @Published var transcript = ""
    @Published var isRecording = false
    @Published var permissionDenied = false
    @Published var audioLevel: Float = 0.0

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
        audioLevel = 0
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
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let frames = Int(buffer.frameLength)
            var rms: Float = 0
            for i in 0..<frames { rms += channelData[i] * channelData[i] }
            let level = sqrt(rms / Float(max(frames, 1)))
            DispatchQueue.main.async { self?.audioLevel = level }
        }

        audioEngine.prepare()
        if (try? audioEngine.start()) != nil {
            isRecording = true
        }
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
    @State private var phase = false

    var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(red: 0.06, green: 0.07, blue: 0.10))

                if isEnabled {
                    Ellipse()
                        .fill(BrandColor.amber.opacity(0.60))
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
                    if showSparks {
                        SparkRaysShape()
                            .stroke(
                                isEnabled ? Color.white : Color.white.opacity(0.25),
                                style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round)
                            )
                            .frame(width: 17, height: 17)
                    }
                    Text(title)
                        .font(.app(size: 18, weight: .semibold))
                        .foregroundColor(isEnabled ? .white : Color.white.opacity(0.25))
                }
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
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.top, 8)
                .padding(.bottom, 2)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                ForEach(sourceItems, id: \.type) { item in
                    Button {
                        onSelect(item.type)
                    } label: {
                        VStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.appLabel)
                                .foregroundColor(Color.white.opacity(0.82))
                            Text(item.label)
                                .font(.appSmall)
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
        .padding(.bottom, 16)
    }
}

// MARK: - Text Input Sheet

private struct TextInputSheet: View {
    var onSave: (String, String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var titleText = ""
    @State private var bodyText = ""
    @State private var isGenerating = false
    @FocusState private var focusedField: InputField?

    private enum InputField { case title, body }
    private let sheetBackground = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var canSave: Bool {
        !titleText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            header

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    TextField("Title", text: $titleText)
                        .font(.appTitle)
                        .foregroundColor(.white)
                        .tint(.white)
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
                                .font(.appBody)
                                .foregroundColor(Color.white.opacity(0.28))
                                .padding(.horizontal, 20)
                                .padding(.top, 2)
                                .allowsHitTesting(false)
                        }
                        TextEditor(text: $bodyText)
                            .appBodyText()
                            .tint(.white)
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
        .background(sheetBackground.ignoresSafeArea())
        .interactiveDismissDisabled(canSave || isGenerating)
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
                    .foregroundColor(Color.white.opacity(0.65))
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.08))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")

            Spacer(minLength: 8)

            Text("Text source")
                .font(.appBodyBold)
                .foregroundColor(.white)

            Spacer(minLength: 8)

            Button(action: handleSave) {
                Group {
                    if isGenerating {
                        ProgressView().scaleEffect(0.65).tint(.white)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(canSave ? .white : Color.white.opacity(0.28))
                    }
                }
                .frame(width: 32, height: 32)
                .background(canSave ? Color.white.opacity(0.12) : Color.white.opacity(0.05))
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
            kbButton(icon: "photo") {
                if let clip = UIPasteboard.general.string, !clip.isEmpty {
                    bodyText += clip
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
                .foregroundColor(Color.white.opacity(0.60))
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
                Button("Cancel") { dismiss() }
                    .foregroundColor(Color.white.opacity(0.55))
                Spacer()
                Text(stagedURLs.count > 1 ? "Link sources" : "Link source")
                    .font(.appLabelBold)
                    .foregroundColor(.white)
                Spacer()
                Button {
                    guard !isFetching else { return }
                    saveAll()
                } label: {
                    if isFetching {
                        ProgressView()
                            .scaleEffect(0.75)
                            .tint(Color.white.opacity(0.55))
                            .frame(width: 40)
                    } else {
                        Text("Save")
                            .foregroundColor(canSave ? Color.white.opacity(0.88) : Color.white.opacity(0.25))
                    }
                }
                .disabled(!canSave || isFetching)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 0.5)

            HStack(spacing: 10) {
                Image(systemName: "link")
                    .font(.appSubtext)
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("https://", text: $urlText)
                    .font(.appLabel)
                    .foregroundColor(Color.white.opacity(0.88))
                    .autocapitalization(.none)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .focused($focused)
                    .submitLabel(.next)
                    .onSubmit { stageCurrent() }
                Button { stageCurrent() } label: {
                    Image(systemName: "plus")
                        .font(.app(size: 14, weight: .semibold))
                        .foregroundColor(canStage ? .white : Color.white.opacity(0.25))
                        .frame(width: 30, height: 30)
                        .background(canStage ? Color.white.opacity(0.12) : Color.white.opacity(0.04))
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
                    .fill(Color.white.opacity(0.07))
                    .frame(height: 0.5)
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(stagedURLs.enumerated()), id: \.element) { idx, link in
                            HStack(spacing: 12) {
                                Image(systemName: "link")
                                    .font(.appCaption)
                                    .foregroundColor(Color.white.opacity(0.45))
                                    .frame(width: 20)
                                Text(link)
                                    .font(.appSmall)
                                    .foregroundColor(Color.white.opacity(0.80))
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
                                        .foregroundColor(Color.white.opacity(0.30))
                                        .frame(width: 32, height: 32)
                                        .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)

                            if idx < stagedURLs.count - 1 {
                                Rectangle()
                                    .fill(Color.white.opacity(0.05))
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
                .foregroundColor(Color.white.opacity(0.35))
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

struct VoiceRecordSheet: View {
    var onSave: (String, String) -> Void
    var autoStart: Bool = false
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceRecorder()
    @State private var seconds = 0
    @State private var isGenerating = false

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let amber = BrandColor.amber

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
                // Header
                HStack {
                    Spacer()
                    Text(recorder.isRecording ? "Recording…" : recorder.transcript.isEmpty ? "Voice Note" : "Done recording")
                        .font(.subheadline)
                        .foregroundColor(Color.white.opacity(0.35))
                    Spacer()
                    Button {
                        guard !isGenerating else { return }
                        recorder.stop()
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.55))
                            .frame(width: 44, height: 44)
                            .background(Color.white.opacity(0.12))
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
                    NoteWaveform(level: recorder.audioLevel)
                        .padding(.horizontal, 28)
                        .transition(.opacity.combined(with: .scale(scale: 0.95)))
                } else if !recorder.transcript.isEmpty {
                    NoteWaveform(level: 0)
                        .padding(.horizontal, 28)
                        .opacity(0.3)
                        .transition(.opacity)
                } else {
                    Button(action: handleMicTap) {
                        Circle()
                            .fill(amber.opacity(0.18))
                            .frame(width: 76, height: 76)
                            .overlay(
                                Image(systemName: "mic.fill")
                                    .font(.app(size: 28, weight: .medium))
                                    .foregroundColor(amber)
                            )
                            .overlay(Circle().stroke(amber.opacity(0.35), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .disabled(isGenerating)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))
                }

                Spacer(minLength: 20)

                // Timer
                if recorder.isRecording || !recorder.transcript.isEmpty {
                    Text(timeLabel)
                        .font(.system(size: 22, weight: .medium, design: .monospaced))
                        .foregroundColor(Color.white.opacity(0.70))
                        .transition(.opacity)
                } else {
                    Text("Tap to record")
                        .font(.appBody)
                        .foregroundColor(Color.white.opacity(0.40))
                        .transition(.opacity)
                }

                if !recorder.transcript.isEmpty {
                    ScrollView(showsIndicators: false) {
                        Text(recorder.transcript)
                            .font(.appSmall)
                            .foregroundColor(Color.white.opacity(0.50))
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
                        .foregroundColor(Color.white.opacity(0.50))
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
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(Color.white.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
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
                            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
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
                            .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
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
        .task { if autoStart { recorder.start() } }
        .onDisappear { recorder.stop() }
        .onReceive(clock) { _ in
            if recorder.isRecording { seconds += 1 }
        }
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

// MARK: - Section Disclosure

// Tiny chevron button used at the start of collapsible section headers
// (Sources / Format / Prompt). Pointing right when collapsed, rotated 90°
// when expanded. The rotation animates via the spring on the toggle.
private struct SectionDisclosure: View {
    @Binding var expanded: Bool

    var body: some View {
        Button {
            withAnimation(.spring(response: 0.42, dampingFraction: 0.86)) {
                expanded.toggle()
            }
        } label: {
            Image(systemName: "chevron.right")
                .font(.app(size: 11, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.55))
                .rotationEffect(.degrees(expanded ? 90 : 0))
                .frame(width: 16, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(expanded ? "Collapse section" : "Expand section")
    }
}

// MARK: - Sources Block

private struct SourcesBlock: View {
    @Binding var sources: [SourceItem]
    var pendingSheet: Binding<SourceSheet?> = .constant(nil)

    @State private var activeSheet: SourceSheet? = nil
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var photoPickerItem: PhotosPickerItem? = nil
    @State private var expanded: Bool = true

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                HStack(spacing: 10) {
                    SectionDisclosure(expanded: $expanded)
                    Text("Sources")
                        .font(.appSubtextMedium)
                        .foregroundColor(Color.white.opacity(0.85))
                    if !expanded && !sources.isEmpty {
                        Text("\(sources.count)")
                            .font(.appCaption)
                            .foregroundColor(Color.white.opacity(0.40))
                    }
                    Spacer()
                    Button { activeSheet = .picker } label: {
                        Image(systemName: "plus")
                            .font(.appCaptionMedium)
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

                if expanded {
                    ForEach(sources) { item in
                    VStack(spacing: 0) {
                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)

                        HStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.appSubtext)
                                .foregroundColor(Color.white.opacity(0.45))
                                .frame(width: 20)
                            Text(item.label)
                                .font(.appSubtext)
                                .foregroundColor(Color.white.opacity(0.80))
                                .lineLimit(1)
                            Spacer()
                            Button {
                                withAnimation(.spring(duration: 0.25)) {
                                    sources.removeAll { $0.id == item.id }
                                }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.appBadge)
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
                        case .note:  activeSheet = .note
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
                    NotePickerSheet { note in
                        withAnimation(.spring(duration: 0.25)) {
                            sources.append(SourceItem(type: .note, label: note.displayTitle, content: note.body))
                        }
                    }
                }
            }
            .presentationDetents((sheet == .picker || sheet == .note) ? [.medium, .large] : [.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(sheet == .text ? 10 : 22)
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
        // `.task(id:)` fires on mount AND on id change, so externally
        // triggered opens still work even if HomeView was being created in
        // the same pass (tab switch + signal). `.onChange` would miss that
        // race.
        .task(id: pendingSheet.wrappedValue) {
            guard let s = pendingSheet.wrappedValue else { return }
            pendingSheet.wrappedValue = nil
            activeSheet = s
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

// MARK: - Note Picker Sheet

private struct NotePickerSheet: View {
    var onSelect: (Note) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var notes: [Note] = []
    @FocusState private var searchFocused: Bool

    private let sheetBackground = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var filtered: [Note] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return notes }
        return notes.filter {
            $0.displayTitle.localizedCaseInsensitiveContains(q) ||
            $0.body.localizedCaseInsensitiveContains(q)
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .font(.appLabel)
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("Search notes", text: $query)
                    .font(.appLabel)
                    .foregroundColor(.white)
                    .tint(.white)
                    .focused($searchFocused)
                if !query.isEmpty {
                    Button { query = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.appSubtext)
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 10)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            if filtered.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "note.text")
                        .font(.system(size: 32, weight: .light))
                        .foregroundColor(Color.white.opacity(0.18))
                    Text(notes.isEmpty ? "No notes yet" : "No results")
                        .font(.appSubtext)
                        .foregroundColor(Color.white.opacity(0.30))
                }
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 0) {
                        ForEach(filtered) { note in
                            Button {
                                onSelect(note)
                                dismiss()
                            } label: {
                                HStack(spacing: 14) {
                                    Image(systemName: "note.text")
                                        .font(.appSubtext)
                                        .foregroundColor(Color.white.opacity(0.40))
                                        .frame(width: 22)
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(note.displayTitle)
                                            .font(.app(size: 19, weight: .medium))
                                            .foregroundColor(Color.white.opacity(0.88))
                                            .lineLimit(1)
                                        if !note.preview.isEmpty {
                                            Text(note.preview)
                                                .font(.appMicro)
                                                .foregroundColor(Color.white.opacity(0.38))
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 18)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            Rectangle()
                                .fill(Color.white.opacity(0.05))
                                .frame(height: 0.5)
                                .padding(.leading, 52)
                        }
                    }
                }
            }
        }
        .background(sheetBackground)
        .onAppear {
            notes = NotesStore.load().filter { !$0.isEmpty }
            searchFocused = true
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

    private let sheetBackground = Color(red: 0.10, green: 0.08, blue: 0.07)
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
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("Choose formats")
                    .font(.appBodyBold)
                    .foregroundColor(.white)
                Spacer()
                Button("Cancel") { dismiss() }
                    .font(.appLabel)
                    .foregroundColor(Color.white.opacity(0.55))
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 12)

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.appLabel)
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("Search formats and templates", text: $search)
                    .font(.appSubtext)
                    .foregroundColor(.white)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.appSubtext)
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 10)

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
                                sectionHeader("Quick picks")
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
        Button(action: commit) {
            Text(ctaLabel)
                .font(.appBodyBold)
                .foregroundColor(draft.isEmpty ? Color.white.opacity(0.40) : .white)
                .frame(maxWidth: .infinity)
                .frame(height: 52)
                .background(draft.isEmpty ? Color.white.opacity(0.07) : amber)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(draft.isEmpty)
        .animation(.easeOut(duration: 0.2), value: draft.count)
    }

    private var seeAllToggle: some View {
        Button {
            withAnimation(.easeOut(duration: 0.25)) { showAllTemplates.toggle() }
        } label: {
            HStack(spacing: 6) {
                Text(showAllTemplates ? "Show less" : "See all templates")
                    .font(.app(size: 14, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.65))
                Image(systemName: showAllTemplates ? "chevron.up" : "chevron.down")
                    .font(.appBadge)
                    .foregroundColor(Color.white.opacity(0.40))
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
            .foregroundColor(Color.white.opacity(0.55))
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
                Circle().fill(Color.white.opacity(0.45))
                Image(systemName: "minus")
                    .font(.app(size: 11, weight: .bold))
                    .foregroundColor(sheetBackground)
            case .none:
                Circle().stroke(Color.white.opacity(0.22), lineWidth: 1.5)
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
            withAnimation(.easeInOut(duration: 0.22)) {
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
                        .foregroundColor(.white)
                    Text(template.description)
                        .font(.appCaption)
                        .foregroundColor(Color.white.opacity(0.50))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                selectionIndicator(state)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(fillOpacity))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(strokeOpacity), lineWidth: 0.5)
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
            withAnimation(.easeInOut(duration: 0.22)) {
                if selected { draft.remove(format.id) }
                else { draft.insert(format.id) }
            }
        } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(format.label)
                        .font(.appSubtextBold)
                        .foregroundColor(.white)
                    Text(format.description)
                        .font(.appCaption)
                        .foregroundColor(Color.white.opacity(0.50))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                selectionIndicator(selected ? .all : .none)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(selected ? 0.10 : 0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(selected ? 0.30 : 0.06), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
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
    @State private var expanded: Bool = true
    @State private var suggestions: [ContentFormat] = []

    private var selectedFormats: [ContentFormat] {
        allFormats.filter { selectedFormatIDs.contains($0.id) }
    }

    private var displayText: String {
        selectedFormats.map(\.label).joined(separator: ", ")
    }

    private func refreshSuggestions() {
        let unselected = allFormats.filter { !selectedFormatIDs.contains($0.id) }
        suggestions = Array(unselected.shuffled().prefix(4))
    }

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 0) {
                // Header — same style as PromptField/Details
                HStack(spacing: 10) {
                    SectionDisclosure(expanded: $expanded)
                    Text("Format")
                        .font(.appSubtextMedium)
                        .foregroundColor(Color.white.opacity(0.85))
                    if !expanded && !displayText.isEmpty {
                        Text(displayText)
                            .font(.appCaption)
                            .foregroundColor(Color.white.opacity(0.30))
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

                if expanded {
                    // Display selected formats as text (matches Details text style)
                    Text(displayText.isEmpty ? "Choose output formats below…" : displayText)
                        .font(.appSubtext)
                        .foregroundColor(displayText.isEmpty ? Color.white.opacity(0.22) : Color.white.opacity(0.85))
                        .lineLimit(3)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 14)

                    // Suggestion chip row: refresh · chips · expand
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            // Refresh
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                refreshSuggestions()
                            } label: {
                                Image(systemName: "arrow.clockwise")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.45))
                                    .frame(width: 36, height: 36)
                                    .background(Color.white.opacity(0.06))
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)

                            // Format suggestions
                            ForEach(suggestions) { fmt in
                                Button {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    withAnimation(.easeOut(duration: 0.15)) {
                                        selectedFormatIDs.insert(fmt.id)
                                        refreshSuggestions()
                                    }
                                } label: {
                                    Pill(title: fmt.label, style: .suggestion)
                                }
                                .buttonStyle(.plain)
                                .transition(.scale.combined(with: .opacity))
                            }

                            // Expand — opens full picker
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                showPicker = true
                            } label: {
                                Image(systemName: "arrow.up.left.and.arrow.down.right")
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.45))
                                    .frame(width: 36, height: 36)
                                    .background(Color.white.opacity(0.06))
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                    }
                    .padding(.bottom, 14)
                }
            }
        }
        .onAppear { refreshSuggestions() }
        .onChange(of: selectedFormatIDs) { refreshSuggestions() }
        .sheet(isPresented: $showPicker) {
            FormatPickerSheet(selectedFormatIDs: $selectedFormatIDs)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(22)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
    }
}

// MARK: - Prompt Field

private struct PromptField: View {
    @Binding var prompt: String
    @FocusState private var focused: Bool
    @State private var expanded: Bool = true

    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 10) {
                    SectionDisclosure(expanded: $expanded)
                    Text("Details")
                        .font(.appSubtextMedium)
                        .foregroundColor(Color.white.opacity(0.85))
                    if !expanded && !prompt.isEmpty {
                        Text(prompt)
                            .font(.appCaption)
                            .foregroundColor(Color.white.opacity(0.30))
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)

                if expanded {
                    // Multi-line TextField with axis:.vertical grows with content
                    // and doesn't engage its own scroll, so it plays nicely with
                    // the page-level ScrollView. TextEditor inside a height cap
                    // fights the parent for scroll gestures.
                    TextField(
                        text: $prompt,
                        axis: .vertical
                    ) {
                        Text("Leave empty to generate from sources and format.")
                            .foregroundStyle(Color.white.opacity(0.22))
                    }
                    .font(.appSubtext)
                    .foregroundColor(Color.white.opacity(0.85))
                    .tint(.white)
                    .lineLimit(3...6)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 14)
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
                Text("Brand voice")
                    .font(.appSubtextMedium)
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
                    Pill(
                        title: selectedBrand,
                        style: .neutral,
                        trailingSystemImage: "chevron.up.chevron.down"
                    )
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
    @EnvironmentObject private var bannerController: BannerController

    @State private var sources: [SourceItem] = []
    @State private var selectedFormatIDs: Set<String> = []
    @State private var prompt = ""
    @State private var brand = "Default"

    @State private var isGenerating = false
    @State private var resultBatch: ResultBatch? = nil
    @State private var lastBatchIDs: [UUID] = []
    @State private var generationFailed = false
    @State private var generationFailReason = ""
    @State private var generationTask: Task<Void, Never>? = nil
    @State private var showKeyUpdate = false
    @State private var showOnboarding = false

    @AppStorage("library_projects") private var projectsData: Data = Data()

    private var canGenerate: Bool {
        !sources.isEmpty && !selectedFormatIDs.isEmpty && !isGenerating
    }

    private var generateLabel: String {
        if isGenerating { return "Generating\u{2026}" }
        return selectedFormatIDs.isEmpty ? "Generate" : "Generate \(selectedFormatIDs.count)"
    }

    var body: some View {
        NavigationStack {
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

                VStack(spacing: 0) {
                    InlineTopBar(title: "Create") {
                        TopBarPill {
                            TopBarPillButton(systemImage: "sun.max") {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                showOnboarding = true
                            }
                            .accessibilityLabel("Onboarding")

                            TopBarPillDivider()

                            TopBarPillButton(systemImage: "key.horizontal") {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                showKeyUpdate = true
                            }
                            .accessibilityLabel("API key")
                        }
                    }

                    ScrollViewReader { proxy in
                        ScrollView(showsIndicators: false) {
                            VStack(spacing: 0) {
                                VStack(spacing: 12) {
                                    SourcesBlock(sources: $sources, pendingSheet: pendingSheet)
                                    FormatsBlock(selectedFormatIDs: $selectedFormatIDs)
                                    PromptField(prompt: $prompt)
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
        .sheet(isPresented: $showKeyUpdate) {
            APIKeySetupView {
                showKeyUpdate = false
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(22)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .fullScreenCover(isPresented: $showOnboarding) {
            OnboardingView(onGetStarted: { showOnboarding = false }, onLogin: { showOnboarding = false })
                .preferredColorScheme(.dark)
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
        bannerController.formatLabels = selectedFormatIDs.compactMap { id in allFormats.first { $0.id == id }?.label }
        bannerController.isReady = false
        bannerController.isVisible = true
        bannerController.onOpen = { [self] in
            let projects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
            let batchItems = lastBatchIDs.compactMap { id in projects.first { $0.id == id } }
            let items = batchItems.isEmpty ? (projects.first.map { [$0] } ?? []) : batchItems
            if let first = items.first {
                resultBatch = ResultBatch(title: first.title, items: items)
            }
            bannerController.isVisible = false
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
            await MainActor.run {
                isGenerating = false
                generationTask = nil
                if results.isEmpty {
                    bannerController.isVisible = false
                    generationFailReason = firstError?.userMessage ?? ""
                    generationFailed = true
                } else {
                    saveToLibrary(results, sources: capturedSources)
                    bannerController.isReady = true
                }
            }
        }
    }

    private func saveToLibrary(_ results: [GeneratedResult], sources: [SourceItem]) {
        var projects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
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
        lastBatchIDs = newProjects.map { $0.id }
        projects.insert(contentsOf: newProjects, at: 0)
        projectsData = (try? JSONEncoder().encode(projects)) ?? Data()
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
