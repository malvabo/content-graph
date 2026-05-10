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
    var isProcessing: Bool = false
    var extractionFailed: Bool = false

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

// MARK: - Source Extractor

private enum SourceExtractor {
    static func extractFile(from url: URL) async -> String {
        await Task.detached(priority: .userInitiated) {
            let didStart = url.startAccessingSecurityScopedResource()
            defer { if didStart { url.stopAccessingSecurityScopedResource() } }

            let ext = url.pathExtension.lowercased()
            if ext == "pdf" {
                guard let pdf = PDFDocument(url: url) else { return "" }
                var pages: [String] = []
                for i in 0..<pdf.pageCount {
                    if let s = pdf.page(at: i)?.string { pages.append(s) }
                }
                return pages.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
            }
            if let utf8 = try? String(contentsOf: url, encoding: .utf8) { return utf8 }
            if let latin = try? String(contentsOf: url, encoding: .isoLatin1) { return latin }
            return ""
        }.value
    }

    static func extractImage(data: Data) async -> String {
        await Task.detached(priority: .userInitiated) {
            guard let cgImage = UIImage(data: data)?.cgImage else { return "" }
            var output = ""
            let request = VNRecognizeTextRequest { req, _ in
                let strings = (req.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string } ?? []
                output = strings.joined(separator: "\n")
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try? handler.perform([request])
            return output
        }.value
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
    ContentFormat(id: "linkedin",       label: "LinkedIn Post",      description: "Professional hook post, 150\u{2013}300 words"),
    ContentFormat(id: "twitter",        label: "Twitter Thread",     description: "5\u{2013}10 tweet thread from your source"),
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

enum GenerationFailure: Error {
    case missingAPIKey
    case network
    case api(String)

    var userMessage: String {
        switch self {
        case .missingAPIKey: return "ANTHROPIC_API_KEY not configured"
        case .network:       return "Network error"
        case .api(let m):    return m
        }
    }
}

private struct AIService {
    private static var apiKey: String {
        Bundle.main.object(forInfoDictionaryKey: "ANTHROPIC_API_KEY") as? String ?? ""
    }

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

    static func generateContent(
        sources: [SourceItem],
        formatLabel: String,
        formatDescription: String,
        prompt: String,
        brand: String
    ) async -> Result<String, GenerationFailure> {
        guard !apiKey.isEmpty else { return .failure(.missingAPIKey) }
        guard let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            return .failure(.network)
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 60

        let sourceBlock = sources.map { item -> String in
            let body = item.content.trimmingCharacters(in: .whitespacesAndNewlines)
            if body.isEmpty {
                return "- [\(item.type.rawValue)] \(item.label)"
            }
            return "- [\(item.type.rawValue)] \(item.label):\n\(body.prefix(4000))"
        }.joined(separator: "\n\n")

        let extras = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let extraLine = extras.isEmpty ? "" : "\nAdditional instructions: \(extras)\n"

        let userPrompt = """
        Generate content in the following format from the supplied sources.

        Format: \(formatLabel) — \(formatDescription)
        Brand voice: \(brand)
        \(extraLine)
        Sources:
        \(sourceBlock)

        Reply with only the finished \(formatLabel). No preamble, no explanation.
        """

        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 1500,
            "messages": [["role": "user", "content": userPrompt]]
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else {
            return .failure(.api("Failed to encode request"))
        }
        req.httpBody = httpBody

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            return .failure(.network)
        }

        if let http = response as? HTTPURLResponse, http.statusCode >= 400 {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let err = json["error"] as? [String: Any],
               let message = err["message"] as? String {
                return .failure(.api(message))
            }
            return .failure(.api("HTTP \(http.statusCode)"))
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return .failure(.api("Unexpected response")) }

        let result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? .failure(.api("Empty response")) : .success(result)
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
                RoundedRectangle(cornerRadius: 14, style: .continuous)
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

                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(isEnabled ? 0.13 : 0.06), lineWidth: 0.5)

                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon)
                            .font(.system(size: 17, weight: .semibold))
                    }
                    Text(title)
                        .font(.system(size: 18, weight: .semibold))
                }
                .foregroundColor(isEnabled ? .white : Color.white.opacity(0.25))
            }
            .frame(height: 54)
            .clipped()
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
                .font(.system(size: 19, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.bottom, 2)

            Button {
                onSelect(.link)
                dismiss()
            } label: {
                VStack(spacing: 12) {
                    Image(systemName: "link")
                        .font(.system(size: 16, weight: .light))
                        .foregroundColor(Color.white.opacity(0.82))
                    Text("Paste a link")
                        .font(.system(size: 14, weight: .regular))
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
                                .font(.system(size: 16, weight: .light))
                                .foregroundColor(Color.white.opacity(0.82))
                            Text(item.label)
                                .font(.system(size: 14, weight: .regular))
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
                    .font(.system(size: 16, weight: .semibold))
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
                        .font(.system(size: 16))
                        .foregroundColor(Color.white.opacity(0.22))
                        .padding(.horizontal, 20)
                        .padding(.top, 18)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(.system(size: 16))
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
                            .font(.system(size: 12))
                            .foregroundColor(Color.white.opacity(0.40))
                    }
                    Spacer()
                    Text("\(wordCount) words")
                        .font(.system(size: 12))
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
                    .font(.system(size: 16, weight: .semibold))
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
                    .font(.system(size: 15))
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("https://", text: $urlText)
                    .font(.system(size: 16))
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
                        .font(.system(size: 12))
                    Text("Fetching page title\u{2026}")
                        .font(.system(size: 13))
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
            let label = await fetchPageTitle(from: url) ?? domainLabel(from: url)
            await MainActor.run {
                isFetching = false
                onSave(label, trimmed)
                dismiss()
            }
        }
    }

    private func fetchPageTitle(from url: URL) async -> String? {
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let html = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1)
        else { return nil }
        if let start = html.range(of: "<title", options: .caseInsensitive),
           let tagEnd = html[start.upperBound...].range(of: ">"),
           let titleEnd = html[tagEnd.upperBound...].range(of: "</title>", options: .caseInsensitive) {
            let title = String(html[tagEnd.upperBound..<titleEnd.lowerBound])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return title.isEmpty ? nil : title
        }
        return nil
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
                        .font(.system(size: 16, weight: .semibold))
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
                                        .font(.system(size: 28, weight: .medium))
                                        .foregroundColor(.white)
                                )
                        }
                        .buttonStyle(.plain)
                        .disabled(isGenerating)
                    }
                    .animation(.spring(duration: 0.4), value: recorder.isRecording)

                    if isGenerating {
                        Label("Generating title\u{2026}", systemImage: "sparkles")
                            .font(.system(size: 15))
                            .foregroundColor(Color.white.opacity(0.50))
                            .transition(.opacity)
                    } else {
                        Text(recorder.isRecording ? timeLabel : "Tap to record")
                            .font(.system(size: 17, design: recorder.isRecording ? .monospaced : .default))
                            .foregroundColor(Color.white.opacity(recorder.isRecording ? 0.80 : 0.40))
                            .transition(.opacity)
                    }
                }
                .animation(.easeOut(duration: 0.2), value: isGenerating)

                if !recorder.transcript.isEmpty {
                    ScrollView(showsIndicators: false) {
                        Text(recorder.transcript)
                            .font(.system(size: 14))
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
                            .font(.system(size: 16, weight: .semibold))
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
                            .font(.system(size: 16, weight: .semibold))
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
                    .fill(Color.white.opacity(0.07))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

// MARK: - Sources Block

private struct SourcesBlock: View {
    @Binding var sources: [SourceItem]

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
                ForEach(sources) { item in
                    VStack(spacing: 0) {
                        HStack(spacing: 12) {
                            if item.isProcessing {
                                ProgressView()
                                    .scaleEffect(0.65)
                                    .tint(Color.white.opacity(0.55))
                                    .frame(width: 20)
                            } else if item.extractionFailed {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 13))
                                    .foregroundColor(Color.orange.opacity(0.70))
                                    .frame(width: 20)
                            } else {
                                Image(systemName: item.icon)
                                    .font(.system(size: 15))
                                    .foregroundColor(Color.white.opacity(0.45))
                                    .frame(width: 20)
                            }
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.label)
                                    .font(.system(size: 15))
                                    .foregroundColor(Color.white.opacity(0.80))
                                    .lineLimit(1)
                                if item.isProcessing {
                                    Text("Extracting\u{2026}")
                                        .font(.system(size: 11))
                                        .foregroundColor(Color.white.opacity(0.35))
                                } else if item.extractionFailed {
                                    Text("No readable text")
                                        .font(.system(size: 11))
                                        .foregroundColor(Color.orange.opacity(0.70))
                                }
                            }
                            Spacer()
                            Button {
                                withAnimation(.spring(duration: 0.25)) {
                                    sources.removeAll { $0.id == item.id }
                                }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 11, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.28))
                                    .frame(width: 32, height: 32)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 13)

                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                    }
                }

                Button { showImport = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.system(size: 13, weight: .medium))
                        Text("Add source")
                            .font(.system(size: 15, weight: .medium))
                    }
                    .foregroundColor(Color.white.opacity(0.38))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.plain)
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
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .fullScreenCover(isPresented: $showTextInput) {
            TextInputSheet { label, content in
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(SourceItem(type: .text, label: label, content: content))
                }
            }
        }
        .fullScreenCover(isPresented: $showLinkInput) {
            LinkInputSheet { label, url in
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(SourceItem(type: .link, label: label, content: url))
                }
            }
        }
        .fullScreenCover(isPresented: $showVoiceRecord) {
            VoiceRecordSheet { label, transcript in
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(SourceItem(type: .voice, label: label, content: transcript))
                }
            }
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.text, .plainText, .pdf],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                let item = SourceItem(
                    type: .file,
                    label: url.lastPathComponent,
                    content: "",
                    isProcessing: true
                )
                let id = item.id
                withAnimation(.spring(duration: 0.25)) {
                    sources.append(item)
                }
                Task {
                    let extracted = await SourceExtractor.extractFile(from: url)
                    await MainActor.run {
                        guard let idx = sources.firstIndex(where: { $0.id == id }) else { return }
                        sources[idx].content = extracted
                        sources[idx].isProcessing = false
                        sources[idx].extractionFailed = extracted.isEmpty
                    }
                }
            }
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $photoPickerItem, matching: .images)
        .onChange(of: photoPickerItem) { _, item in
            guard let item else { return }
            let placeholder = SourceItem(
                type: .image,
                label: "Image",
                content: "",
                isProcessing: true
            )
            let id = placeholder.id
            withAnimation(.spring(duration: 0.25)) {
                sources.append(placeholder)
            }
            photoPickerItem = nil
            Task {
                let data = (try? await item.loadTransferable(type: Data.self)) ?? Data()
                let extracted = data.isEmpty ? "" : await SourceExtractor.extractImage(data: data)
                await MainActor.run {
                    guard let idx = sources.firstIndex(where: { $0.id == id }) else { return }
                    sources[idx].content = extracted
                    sources[idx].isProcessing = false
                    sources[idx].extractionFailed = extracted.isEmpty
                }
            }
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
        selectedFormatIDs.isEmpty ? "Done" : "Done \u{00B7} \(selectedFormatIDs.count) selected"
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Spacer()
                Text("Format")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.60))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 18)
            .padding(.bottom, 14)

            // Search
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundColor(Color.white.opacity(0.35))
                TextField("Search formats and templates", text: $search)
                    .font(.system(size: 15))
                    .foregroundColor(.white)
                    .autocorrectionDisabled()
                if !search.isEmpty {
                    Button { search = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 15))
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

            // Content
            if filteredTemplates.isEmpty && filteredFormats.isEmpty {
                Spacer()
                Text("No matches.")
                    .font(.system(size: 15))
                    .foregroundColor(Color.white.opacity(0.30))
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 0) {

                        // Quick picks section
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
                                            .font(.system(size: 15))
                                            .foregroundColor(Color.white.opacity(0.50))
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .font(.system(size: 12, weight: .medium))
                                            .foregroundColor(Color.white.opacity(0.30))
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 14)
                                }
                                .buttonStyle(.plain)
                                divider()
                            }
                        }

                        // All formats section
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

            // Footer
            VStack(spacing: 0) {
                Rectangle()
                    .fill(Color.white.opacity(0.07))
                    .frame(height: 0.5)

                Button { dismiss() } label: {
                    Text(doneLabel)
                        .font(.system(size: 16, weight: .semibold))
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
            .font(.system(size: 11, weight: .semibold))
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
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.88))

                    HStack(spacing: 5) {
                        ForEach(template.formatIDs.prefix(4), id: \.self) { fid in
                            if let fmt = allFormats.first(where: { $0.id == fid }) {
                                Text(fmt.label)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.55))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 3)
                                    .background(Color.white.opacity(isActive ? 0.14 : 0.07))
                                    .clipShape(Capsule())
                            }
                        }
                        if template.formatIDs.count > 4 {
                            Text("+\(template.formatIDs.count - 4)")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.35))
                        }
                    }

                    Text(template.description)
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.35))
                }
                Spacer()
                if isActive {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .semibold))
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
                    .font(.system(size: 18))
                    .foregroundColor(selected ? green : Color.white.opacity(0.22))
                    .frame(width: 22)
                VStack(alignment: .leading, spacing: 3) {
                    Text(format.label)
                        .font(.system(size: 15))
                        .foregroundColor(selected ? Color.white.opacity(0.92) : Color.white.opacity(0.70))
                    Text(format.description)
                        .font(.system(size: 12))
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
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                showPicker = true
            } label: {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Format")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.85))
                        if !selectedFormatIDs.isEmpty {
                            Text(summaryText)
                                .font(.system(size: 13))
                                .foregroundColor(Color.white.opacity(0.45))
                                .lineLimit(1)
                                .transition(.opacity)
                        }
                    }
                    Spacer()
                    if selectedFormatIDs.isEmpty {
                        Text("None")
                            .font(.system(size: 14))
                            .foregroundColor(Color.white.opacity(0.25))
                    } else {
                        Text("\(selectedFormatIDs.count)")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .frame(minWidth: 24, minHeight: 24)
                            .background(green)
                            .clipShape(Circle())
                            .transition(.scale.combined(with: .opacity))
                    }
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.20))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
                .animation(.easeOut(duration: 0.15), value: selectedFormatIDs.count)
            }
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $showPicker) {
            FormatPickerSheet(selectedFormatIDs: $selectedFormatIDs)
                .presentationDetents([.large])
                .presentationDragIndicator(.hidden)
                .presentationCornerRadius(20)
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
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.40))
                    .padding(.horizontal, 16)
                    .padding(.top, 14)
                    .padding(.bottom, 6)

                ZStack(alignment: .topLeading) {
                    if prompt.isEmpty {
                        Text("Leave empty to generate from sources and format.")
                            .font(.system(size: 15))
                            .foregroundColor(Color.white.opacity(0.20))
                            .padding(.horizontal, 16)
                            .padding(.top, 2)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $prompt)
                        .font(.system(size: 15))
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
                    .font(.system(size: 18, weight: .medium))
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
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.70))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: 11, weight: .semibold))
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

struct HomeView: View {
    var scrollToTopSignal: Int = 0

    @State private var sources: [SourceItem] = []
    @State private var selectedFormatIDs: Set<String> = []
    @State private var prompt = ""
    @State private var brand = "Default"
    @State private var isGenerating = false
    @State private var generationProgress: (current: Int, total: Int)?
    @State private var generatedProjects: [GenerationProject] = []
    @State private var generatedFailures: [(format: String, message: String)] = []
    @State private var showResults = false
    @State private var generationError: String?

    @AppStorage("library_projects") private var projectsData: Data = Data()

    private var sourcesProcessing: Bool {
        sources.contains(where: \.isProcessing)
    }

    private var canGenerate: Bool {
        !sources.isEmpty && !selectedFormatIDs.isEmpty && !isGenerating && !sourcesProcessing
    }

    private var generateLabel: String {
        if let p = generationProgress {
            return "Generating \(p.current)/\(p.total)\u{2026}"
        }
        if isGenerating { return "Generating\u{2026}" }
        if sourcesProcessing { return "Processing sources\u{2026}" }
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
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                        }
                        .id("top")
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 16)

                        VStack(spacing: 12) {
                            SourcesBlock(sources: $sources)
                            FormatsBlock(selectedFormatIDs: $selectedFormatIDs)
                            PromptField(prompt: $prompt)
                            BrandCard(selectedBrand: $brand)
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)

                        AnimatedLightsButton(
                            title: generateLabel,
                            icon: (isGenerating || sourcesProcessing) ? nil : "sparkles",
                            isEnabled: canGenerate
                        ) {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            Task { await runGeneration() }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 40)
                    }
                }
                .scrollDismissesKeyboard(.immediately)
                .onChange(of: scrollToTopSignal) { _ in
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("top", anchor: .top)
                    }
                }
            }
        }
        .fullScreenCover(isPresented: $showResults) {
            GenerationResultsSheet(
                projects: generatedProjects,
                failures: generatedFailures
            )
        }
        .alert("Generation failed", isPresented: Binding(
            get: { generationError != nil },
            set: { if !$0 { generationError = nil } }
        )) {
            Button("OK", role: .cancel) { generationError = nil }
        } message: {
            Text(generationError ?? "")
        }
    }

    private func runGeneration() async {
        let chosen = allFormats.filter { selectedFormatIDs.contains($0.id) }
        guard !chosen.isEmpty, !sources.isEmpty else { return }

        await MainActor.run {
            isGenerating = true
            generationProgress = (0, chosen.count)
        }

        var produced: [GenerationProject] = []
        var failures: [(format: String, message: String)] = []
        var keyMissing = false

        for (idx, fmt) in chosen.enumerated() {
            await MainActor.run { generationProgress = (idx + 1, chosen.count) }

            let outcome = await AIService.generateContent(
                sources: sources,
                formatLabel: fmt.label,
                formatDescription: fmt.description,
                prompt: prompt,
                brand: brand
            )

            switch outcome {
            case .success(let content):
                let title = await AIService.generateTitle(from: content)
                let preview = String(content.prefix(140)).replacingOccurrences(of: "\n", with: " ")
                produced.append(GenerationProject(
                    title: title,
                    outputType: fmt.label,
                    preview: preview,
                    date: Date(),
                    content: content
                ))
            case .failure(let err):
                failures.append((fmt.label, err.userMessage))
                if case .missingAPIKey = err {
                    keyMissing = true
                }
            }

            if keyMissing { break }
        }

        await MainActor.run {
            isGenerating = false
            generationProgress = nil

            if produced.isEmpty {
                let firstMessage = failures.first?.message ?? "Unknown error"
                generationError = keyMissing
                    ? "Add ANTHROPIC_API_KEY to Info.plist to enable generation."
                    : "Generation failed: \(firstMessage)"
                generatedFailures = []
                return
            }

            saveToLibrary(produced)
            generatedProjects = produced
            generatedFailures = failures
            showResults = true
        }
    }

    private func saveToLibrary(_ new: [GenerationProject]) {
        var existing = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        existing.insert(contentsOf: new, at: 0)
        projectsData = (try? JSONEncoder().encode(existing)) ?? projectsData
    }
}

// MARK: - Generation Results Sheet

struct GenerationResultsSheet: View {
    let projects: [GenerationProject]
    var failures: [(format: String, message: String)] = []
    var title: String = "Output"
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Text(title)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.white)
                    Spacer()
                    Button { dismiss() } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.60))
                            .frame(width: 30, height: 30)
                            .background(Color.white.opacity(0.10))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, 12)

                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 14) {
                        if !failures.isEmpty {
                            FailuresBanner(failures: failures)
                        }
                        ForEach(projects) { project in
                            ResultCard(project: project)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 32)
                }
            }
        }
    }
}

private struct FailuresBanner: View {
    let failures: [(format: String, message: String)]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color.orange.opacity(0.85))
                Text("\(failures.count) format\(failures.count == 1 ? "" : "s") failed")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.85))
            }
            ForEach(failures, id: \.format) { f in
                Text("• \(f.format) — \(f.message)")
                    .font(.system(size: 12))
                    .foregroundColor(Color.white.opacity(0.55))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.orange.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.orange.opacity(0.30), lineWidth: 0.5)
        )
    }
}

struct ResultCard: View {
    let project: GenerationProject
    @State private var copied = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(project.outputType)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.55))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.white.opacity(0.07))
                    .clipShape(Capsule())
                Spacer()
                Button {
                    UIPasteboard.general.string = project.content
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { copied = false }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 11, weight: .medium))
                        Text(copied ? "Copied" : "Copy")
                            .font(.system(size: 12, weight: .medium))
                    }
                    .foregroundColor(Color.white.opacity(0.70))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.white.opacity(0.08))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }

            Text(project.title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.90))

            Text(project.content)
                .font(.system(size: 14))
                .foregroundColor(Color.white.opacity(0.78))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
        )
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
