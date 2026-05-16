import SwiftUI
import Speech
import AVFoundation
import UIKit
import PencilKit

// MARK: - Voice Dictation

@MainActor
final class NoteDictation: ObservableObject {
    @Published var transcript: String = ""
    @Published var isRecording: Bool = false
    @Published var permissionDenied: Bool = false
    @Published var startupError: String? = nil
    var audioLevel: Float = 0.0  // RMS, ~0...1 — plain var, not @Published; waveforms read it via TimelineView

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var teardownTask: Task<Void, Never>? = nil
    private var startupTask: Task<Void, Never>? = nil

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
                        self.transcript = ""
                        self.audioLevel = 0
                        self.startEngine()
                    }
                }
            }
        }
    }

    /// Stop and keep the transcript that's been emitted.
    func stop() {
        teardown()
    }

    /// Stop and suppress the trailing final transcript (so caller can revert
    /// the body without a late `onChange` overwriting the rollback).
    func cancel() {
        task?.cancel()
        task = nil
        transcript = ""
        teardown()
    }

    private func teardown() {
        isRecording = false
        audioLevel = 0
        task?.cancel()
        task = nil
        let engine = audioEngine
        let req = request
        request = nil
        teardownTask = Task.detached(priority: .userInitiated) {
            engine.stop()
            req?.endAudio()
            engine.inputNode.removeTap(onBus: 0)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func startEngine() {
        task?.cancel()
        task = nil
        startupError = nil
        startupTask?.cancel()
        let prev = teardownTask
        teardownTask = nil
        startupTask = Task { @MainActor [weak self] in
            await prev?.value
            guard let self, !Task.isCancelled else { return }
            self.activateAndStart()
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

        request = SFSpeechAudioBufferRecognitionRequest()
        guard let req = request, let rec = recognizer else {
            startupError = "Speech recognition isn't available on this device."
            return
        }
        req.shouldReportPartialResults = true

        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                // Late callbacks after cancel() would otherwise overwrite the
                // intentionally cleared transcript with stale text.
                guard self.isRecording else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                }
                if error != nil || (result?.isFinal ?? false) {
                    self.teardown()
                }
            }
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        var lastLevelDispatch: Double = 0
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            req.append(buffer)
            guard let channels = buffer.floatChannelData else { return }
            let frames = Int(buffer.frameLength)
            guard frames > 0 else { return }
            let samples = channels[0]
            var sum: Float = 0
            for i in 0..<frames {
                let s = samples[i]
                sum += s * s
            }
            let rms = (sum / Float(frames)).squareRoot()
            let now = CFAbsoluteTimeGetCurrent()
            guard now - lastLevelDispatch >= 1.0 / 20.0 else { return }
            lastLevelDispatch = now
            DispatchQueue.main.async { [weak self] in
                self?.audioLevel = rms
            }
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

// MARK: - Storage

extension Notification.Name {
    static let notesStoreDidChange = Notification.Name("NotesStoreDidChange")
}

struct NotesStore {
    static let key = "notes_v1"
    private static let saveQueue = DispatchQueue(label: "com.up200.notes.save", qos: .utility)

    static func load() -> [Note] {
        let data = UserDefaults.standard.data(forKey: key) ?? Data()
        switch loadBlob([Note].self, from: data) {
        case .empty:
            return []
        case .ok(let raw):
            return raw.map(Note.migrated)
        case .corrupt:
            // Bytes exist but can't decode. Return empty so the UI renders,
            // but `save` will refuse to overwrite — preserving the original
            // blob for any future recovery path.
            return []
        }
    }

    static func loadAsync() async -> [Note] {
        await withCheckedContinuation { continuation in
            saveQueue.async {
                continuation.resume(returning: load())
            }
        }
    }

    static func save(_ notes: [Note]) {
        let existing = UserDefaults.standard.data(forKey: key) ?? Data()
        if case .corrupt = loadBlob([Note].self, from: existing) {
            return
        }
        guard let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: key)
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: .notesStoreDidChange, object: nil)
        }
    }

    static func saveInBackground(_ notes: [Note]) {
        let snapshot = notes
        saveQueue.async { save(snapshot) }
    }
}

// MARK: - Relative date

private enum RowDate {
    private static let time: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f
    }()
    private static let weekday: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEEE"
        return f
    }()
    private static let monthDay: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f
    }()
    private static let full: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        return f
    }()

    static func string(from date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return time.string(from: date) }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        let now = Date()
        let days = cal.dateComponents(
            [.day],
            from: cal.startOfDay(for: date),
            to: cal.startOfDay(for: now)
        ).day ?? 0
        if days < 7 { return weekday.string(from: date) }
        if cal.component(.year, from: date) == cal.component(.year, from: now) {
            return monthDay.string(from: date)
        }
        return full.string(from: date)
    }

    static func relative(from date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) { return time.string(from: date) }
        let now = Date()
        if cal.component(.year, from: date) == cal.component(.year, from: now) {
            return monthDay.string(from: date)
        }
        return full.string(from: date)
    }
}

// MARK: - Note Thumbnail

/// Tiny illustrative thumb leading each row in the notes list. Same
/// frame / corner / stroke for every row so adjacent items read as a
/// consistent strip; the inner glyph switches with `Note.kind` — paper
/// lines for text, chart bars for sketched drawings.
private struct NoteThumb: View {
    let note: Note

    var body: some View {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
            .fill(AppInk.solid(0.07))
            .overlay(thumbContent)
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(AppInk.solid(0.09), lineWidth: 0.5)
            )
            .frame(width: 42, height: 52)
    }

    @ViewBuilder
    private var thumbContent: some View {
        switch note.kind {
        case .drawing:
            ChartThumbContent(seed: note.id)
        case .text:
            PaperThumbContent(seed: note.id)
        }
    }
}

/// Stack of five capsule "text lines" with seeded widths — the original
/// notepad thumb, restored for text notes.
private struct PaperThumbContent: View {
    let seed: UUID
    var body: some View {
        let widths = Self.lineWidths(for: seed)
        VStack(alignment: .leading, spacing: 3) {
            ForEach(0..<5, id: \.self) { i in
                Capsule()
                    .fill(AppInk.solid(i == 0 ? 0.55 : 0.20))
                    .frame(width: widths[i], height: i == 0 ? 2.5 : 1.5)
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private static func lineWidths(for id: UUID) -> [CGFloat] {
        let b = id.uuid
        var h = Int(b.0) &<< 24 | Int(b.1) &<< 16 | Int(b.2) &<< 8 | Int(b.3)
        return (0..<5).map { _ in
            h = h &* 1664525 &+ 1013904223
            return 8 + CGFloat(h & 0x17)
        }
    }
}

/// Five bottom-anchored bars with seeded heights — chart-style mark for
/// sketched / drawn notes so they read as visual entries in the list.
private struct ChartThumbContent: View {
    let seed: UUID
    var body: some View {
        let heights = Self.barHeights(for: seed)
        HStack(alignment: .bottom, spacing: 2.5) {
            ForEach(0..<5, id: \.self) { i in
                Capsule()
                    .fill(AppInk.solid(i == heights.tallestIndex ? 0.55 : 0.30))
                    .frame(width: 3.5, height: heights.values[i])
            }
        }
        .padding(8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
    }

    private static func barHeights(for id: UUID) -> (values: [CGFloat], tallestIndex: Int) {
        let b = id.uuid
        var h = Int(b.0) &<< 24 | Int(b.1) &<< 16 | Int(b.2) &<< 8 | Int(b.3)
        let values: [CGFloat] = (0..<5).map { _ in
            h = h &* 1664525 &+ 1013904223
            return 8 + CGFloat(h & 0x1F)        // 8...39 pt tall
        }
        let tallest = values.indices.max(by: { values[$0] < values[$1] }) ?? 0
        return (values, tallest)
    }
}

// MARK: - Row

private struct NoteListRow: View {
    let note: Note
    private let amber = BrandColor.amber

    // Build the title as a single Text so a starred-badge sits inline with
    // the last wrapped line instead of floating at the block's vertical
    // center. An HStack would place the star next to the whole Text block;
    // embedding the symbol via Text(Image:) lets SwiftUI's text layout
    // carry it along with the trailing glyphs.
    private var titleText: Text {
        let base = Text(note.displayTitle)
        guard note.tags.contains("Starred") else { return base }
        return base
            + Text(" ")
            + Text(Image(systemName: "star.fill"))
                .foregroundStyle(BrandColor.glowGradient)
    }

    var body: some View {
        HStack(spacing: 14) {
            NoteThumb(note: note)

            VStack(alignment: .leading, spacing: 5) {
                titleText
                    .font(.appRowTitle)
                    .foregroundColor(AppInk.solid(0.88))
                    .lineLimit(1)
                    .truncationMode(.tail)

                Text(RowDate.relative(from: note.updatedAt))
                    .font(.appSmall)
                    .foregroundColor(AppText.tertiary)

                let otherTags = note.tags.filter { $0 != "Starred" }
                if !otherTags.isEmpty {
                    Text(otherTags.joined(separator: " · "))
                        .font(.appMicro)
                        .foregroundColor(amber.opacity(0.75))
                        .lineLimit(1)
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

// MARK: - Waveform

private struct Waveform: View {
    let dictation: NoteDictation

    private let barCount = 14
    private let amber = BrandColor.amber

    var body: some View {
        // TimelineView drives rendering — we read audioLevel directly here
        // so no @Published binding is needed and no parent re-renders occur.
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = dictation.audioLevel
            HStack(spacing: 3) {
                ForEach(0..<barCount, id: \.self) { i in
                    Capsule()
                        .fill(amber)
                        .frame(width: 3, height: barHeight(level: level, index: i, time: t))
                }
            }
        }
        .frame(height: 32)
        .accessibilityHidden(true)
    }

    private func barHeight(level: Float, index: Int, time: Double) -> CGFloat {
        let phase = time * 5.0 + Double(index) * 0.55
        let wave = (sin(phase) + 1.0) / 2.0
        let amplified = min(1.6, pow(Double(level), 0.35) * 3.0)
        let scaled = wave * amplified
        return CGFloat(max(4.0, 4.0 + scaled * 22.0))
    }
}

// MARK: - Dictation Controls

struct DictationControls: View {
    @ObservedObject var dictation: NoteDictation
    let onStart: () -> Void
    let onCancel: () -> Void
    let onConfirm: () -> Void

    private let amber = BrandColor.amber
    private let stroke = AppInk.solid(0.15)
    private let glassShadow = Color.black.opacity(0.22)

    var body: some View {
        Group {
            if dictation.isRecording {
                recordingRow
            } else {
                idleMic
            }
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: dictation.isRecording)
    }

    private var idleMic: some View {
        Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onStart()
        } label: {
            Image(systemName: "mic.fill")
                .font(.system(size: 19, weight: .semibold))
                .foregroundStyle(BrandColor.glowGradientBright)
                .frame(width: 56, height: 56)
                .background(glassCircle)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Start dictation")
        .transition(.scale(scale: 0.85).combined(with: .opacity))
    }

    private var recordingRow: some View {
        HStack(spacing: 10) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onCancel()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(AppInk.solid(0.65))
                    .frame(width: 44, height: 44)
                    .background(glassCircle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel dictation")

            Waveform(dictation: dictation)
                .padding(.horizontal, 18)
                .frame(height: 44)
                .background(
                    Capsule(style: .continuous)
                        .fill(.regularMaterial)
                        .overlay(Capsule().stroke(stroke, lineWidth: 0.5))
                        .shadow(color: glassShadow, radius: 10, y: 3)
                )

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onConfirm()
            } label: {
                Image(systemName: "checkmark")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 44, height: 44)
                    .background(
                        Circle()
                            .fill(amber)
                            .shadow(color: amber.opacity(0.45), radius: 10, y: 3)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Finish dictation")
        }
        .transition(.scale(scale: 0.92).combined(with: .opacity))
    }

    private var glassCircle: some View {
        Circle()
            .fill(.regularMaterial)
            .overlay(Circle().stroke(stroke, lineWidth: 0.5))
            .shadow(color: glassShadow, radius: 10, y: 3)
    }
}

// MARK: - Voice Start Sheet

struct NoteWaveform: View {
    // Reads audioLevel from RecordingController directly inside TimelineView.
    // No level parameter means no @Published binding — NoteVoiceSheet never
    // re-renders from audio level changes.
    @EnvironmentObject private var recording: RecordingController
    private let barCount = 38

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = recording.audioLevel
            HStack(spacing: 2.5) {
                ForEach(0..<barCount, id: \.self) { i in
                    Capsule()
                        .fill(BrandColor.glowGradient)
                        .frame(width: 3, height: barHeight(level: level, index: i, time: t))
                        .opacity(barOpacity(index: i))
                }
            }
        }
        .frame(height: 75)
        .accessibilityHidden(true)
    }

    private func barHeight(level: Float, index: Int, time: Double) -> CGFloat {
        let pos = Double(index) / Double(barCount - 1)
        let envelope = sin(pos * .pi)
        let phase1 = time * 4.5 + Double(index) * 0.42
        let phase2 = time * 2.8 + Double(index) * 0.65
        let wave = (sin(phase1) * 0.65 + sin(phase2) * 0.35 + 1.0) / 2.0
        let amplified = min(1.0, pow(Double(max(level, 0.005)), 0.28) * 2.8)
        let dynamic = wave * amplified * envelope
        return 3 + CGFloat(dynamic) * 72
    }

    private func barOpacity(index: Int) -> Double {
        let pos = Double(index) / Double(barCount - 1)
        return 0.55 + sin(pos * .pi) * 0.45
    }
}

struct NoteVoiceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var recording: RecordingController
    @State private var selectedDetent: PresentationDetent = .medium
    @State private var showingComposer: Bool = false

    private let sheetBg = AppBackground.primary

    private var timeLabel: String {
        String(format: "%02d:%02d", recording.seconds / 60, recording.seconds % 60)
    }

    var body: some View {
        ZStack {
            sheetBg.ignoresSafeArea()
            if showingComposer {
                NoteComposerSheet(
                    initialBody: recording.fullTranscript,
                    onSave: { body in
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        recording.finishWithText(body)
                        dismiss()
                    },
                    onCancel: {
                        recording.cancel()
                        dismiss()
                    }
                )
            } else {
                voiceUI
            }
        }
        .presentationDetents([.medium, .large], selection: $selectedDetent)
        .presentationDragIndicator(.visible)
        .presentationBackground(sheetBg)
        .presentationCornerRadius(Radius.sheet)
        .onChange(of: selectedDetent) { _, newDetent in
            // Only treat a confirmed snap to .large as "expand to editor".
            // The previous negation (newDetent != .medium) also fired during
            // the downward-dismiss drag when iOS emits transient non-.medium
            // values, which triggered recording.pause() → teardownEngine()
            // on the main thread mid-gesture → hard freeze.
            let large = (newDetent == .large)
            if large && (recording.isRecording || recording.isPaused) {
                recording.pause()
            }
            withAnimation(AppAnimation.standard) {
                showingComposer = large
            }
        }
    }

    private func endRecording() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        recording.finish()
        dismiss()
    }

    private var voiceUI: some View {
        VStack(spacing: 0) {
            ZStack {
                Text("Swipe up to type text")
                    .font(.subheadline)
                    .foregroundColor(AppText.tertiary)
                    .frame(maxWidth: .infinity)
                HStack {
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(AppText.secondary)
                            .frame(width: 28, height: 28)
                            .background(AppInk.solid(0.12))
                            .clipShape(Circle())
                            .appIconHitArea()
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Dismiss")
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            Spacer(minLength: 24)

            NoteWaveform()
                .padding(.horizontal, 28)

            Spacer(minLength: 20)

            Text(timeLabel)
                .font(.system(size: 22, weight: .medium, design: .monospaced))
                .foregroundColor(AppInk.solid(0.70))

            Spacer(minLength: 24)

            HStack(spacing: 12) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    if recording.isPaused {
                        recording.resume()
                    } else {
                        recording.pause()
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: recording.isPaused ? "play.fill" : "pause.fill")
                            .font(.system(size: 15, weight: .semibold))
                        Text(recording.isPaused ? "Resume" : "Pause")
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

                Button { endRecording() } label: {
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
        }
    }
}

// MARK: - Composer Sheet (large-detent text editor with corner mic)

private struct NoteComposerSheet: View {
    let initialBody: String
    let onSave: (String) -> Void
    let onCancel: () -> Void

    @State private var noteBody: String
    @State private var bodyBeforeDictation: String = ""
    @State private var showDiscardAlert: Bool = false
    @StateObject private var dictation = NoteDictation()
    @FocusState private var bodyFocused: Bool

    init(initialBody: String, onSave: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.initialBody = initialBody
        self.onSave = onSave
        self.onCancel = onCancel
        self._noteBody = State(initialValue: initialBody)
    }

    private var canSave: Bool { !noteBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var isDirty: Bool { noteBody != initialBody }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    if isDirty {
                        showDiscardAlert = true
                    } else {
                        dictation.stop()
                        onCancel()
                    }
                } label: {
                    Text("Cancel")
                        .font(.appLabel)
                        .foregroundColor(AppInk.solid(0.50))
                }
                .buttonStyle(.plain)

                Spacer()

                Text("New Note")
                    .font(.appBodyBold)
                    .foregroundColor(AppText.primary)

                Spacer()

                Button {
                    dictation.stop()
                    onSave(noteBody)
                } label: {
                    Text("Done")
                        .font(.appLabelBold)
                        .foregroundColor(canSave ? .white : AppText.disabled)
                }
                .buttonStyle(.plain)
                .disabled(!canSave)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Rectangle()
                .fill(AppInk.solid(0.06))
                .frame(height: 0.5)

            ZStack(alignment: .bottomTrailing) {
                ZStack(alignment: .topLeading) {
                    if noteBody.isEmpty {
                        Text("Start typing\u{2026}")
                            .font(.appBody)
                            .foregroundColor(AppText.muted)
                            .padding(.horizontal, 24)
                            .padding(.top, 20)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $noteBody)
                        .font(.appBody)
                        .lineSpacing(8)
                        .foregroundColor(AppInk.solid(0.92))
                        .scrollContentBackground(.hidden)
                        .background(Color.clear)
                        .tint(AppText.primary)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .contentMargins(.bottom, 84, for: .scrollContent)
                        .focused($bodyFocused)
                }

                DictationControls(
                    dictation: dictation,
                    onStart: {
                        bodyBeforeDictation = noteBody
                        dictation.start()
                    },
                    onCancel: {
                        dictation.cancel()
                        noteBody = bodyBeforeDictation
                    },
                    onConfirm: {
                        dictation.stop()
                    }
                )
                .padding(.trailing, 20)
                .padding(.bottom, 20)
            }
            .onChange(of: dictation.transcript) { _, newValue in
                let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return }
                if bodyBeforeDictation.isEmpty {
                    noteBody = trimmed
                } else {
                    let needsSeparator = !bodyBeforeDictation.hasSuffix("\n") && !bodyBeforeDictation.hasSuffix(" ")
                    noteBody = bodyBeforeDictation + (needsSeparator ? " " : "") + trimmed
                }
            }
            .alert("Microphone access denied", isPresented: $dictation.permissionDenied) {
                Button("Open Settings") { openSettings() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Enable Microphone and Speech Recognition in Settings to dictate notes.")
            }
        }
        .alert("Discard changes?", isPresented: $showDiscardAlert) {
            Button("Keep Editing", role: .cancel) {}
            Button("Discard", role: .destructive) {
                dictation.stop()
                onCancel()
            }
        }
        .task {
            bodyBeforeDictation = noteBody
            // Delay auto-start to let RecordingController's async audio
            // teardown finish (setActive false runs in a detached task,
            // 50-300 ms). Starting dictation immediately races setActive(true)
            // against that setActive(false) on a background thread; if teardown
            // wins last the session is deactivated and dictation silently fails.
            do { try await Task.sleep(nanoseconds: 400_000_000) }
            catch { return }
            dictation.start()
        }
        .onDisappear { dictation.stop() }
    }
}

// MARK: - Editor Page (full-page edit for existing notes)

private struct NoteEditorPage: View {
    let onSave: (Note) -> Void
    let onDelete: () -> Void

    @State private var original: Note
    @State private var title: String
    @State private var noteBody: String
    @State private var bodyBeforeDictation: String = ""
    @State private var didDelete: Bool = false
    @State private var showChat: Bool = false
    @StateObject private var dictation = NoteDictation()
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController
    @FocusState private var focus: Field?

    private enum Field { case title, body }

    init(note: Note, onSave: @escaping (Note) -> Void, onDelete: @escaping () -> Void) {
        let migrated = Note.migrated(note)
        self.onSave = onSave
        self.onDelete = onDelete
        self._original = State(initialValue: migrated)
        let (t, b) = Self.split(migrated.body)
        self._title = State(initialValue: t)
        self._noteBody = State(initialValue: b)
    }

    private static func split(_ body: String) -> (String, String) {
        // A title is only present when the user explicitly entered one — marked
        // by a newline separating it from the body (or trailing it, for a
        // title-only note). Bodies with no newline are treated as body-only
        // so dictated transcripts populate the body, not the title.
        guard let nl = body.firstIndex(of: "\n") else { return ("", body) }
        let firstLine = String(body[..<nl])
        var rest = String(body[body.index(after: nl)...])
        while let c = rest.first, c == "\n" || c == "\r" { rest.removeFirst() }
        return (firstLine, rest)
    }

    private var combined: String {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let bTrim = noteBody.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty && bTrim.isEmpty { return "" }
        // Preserve a title-only note across save/reopen by trailing a newline,
        // which `split` uses to distinguish it from a body-only note.
        if bTrim.isEmpty { return t + "\n" }
        if t.isEmpty { return noteBody }
        return t + "\n" + noteBody
    }

    private var hasContent: Bool {
        !combined.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func persistIfNeeded() {
        guard !didDelete else { return }
        if combined == original.body { return }
        var saved = original
        saved.body = combined
        saved.title = ""
        saved.updatedAt = Date()
        onSave(saved)

        // If the user didn't enter a title, ask the model for a summary title
        // and re-save with it prepended as the first line — `Note.displayTitle`
        // picks that up. Title every non-empty body, however short: a one-line
        // note still needs a name to scan in the list.
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedTitle.isEmpty else { return }
        let trimmedBody = noteBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedBody.isEmpty else { return }

        let snapshotBody = noteBody
        let baseNote = saved
        let save = onSave
        Task {
            let aiTitle = await AIService.generateTitle(from: trimmedBody)
            let cleaned = aiTitle.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !cleaned.isEmpty else { return }
            // Avoid prepending a title that just duplicates what `displayTitle`
            // would already surface (e.g. when the fallback returns a stub
            // similar to the first line).
            let firstLine = snapshotBody.split(whereSeparator: \.isNewline).first
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } ?? ""
            guard cleaned.lowercased() != firstLine.lowercased() else { return }
            var updated = baseNote
            updated.body = cleaned + "\n" + snapshotBody
            updated.updatedAt = Date()
            await MainActor.run { save(updated) }
        }
    }

    private func performDelete() {
        dictation.stop()
        didDelete = true
        onDelete()
        dismiss()
    }

    /// Pulls the latest body from disk after the chat sheet closes so a
    /// rewrite the user accepted in the chat actually shows up in the
    /// editor underneath. The chat sheet covers this view, so `combined`
    /// should still match the pre-chat body — if it doesn't, the user
    /// somehow typed in the editor during the chat, and we keep those
    /// edits while still refreshing `original` so the next save isn't
    /// compared against a stale baseline.
    private func refreshAfterChat() {
        let id = original.id
        Task {
            let fresh = await NotesStore.loadAsync()
            guard let updated = fresh.first(where: { $0.id == id }) else { return }
            let migrated = Note.migrated(updated)
            await MainActor.run {
                if combined == original.body {
                    let (t, b) = Self.split(migrated.body)
                    title = t
                    noteBody = b
                }
                original = migrated
            }
        }
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            AppBackground.primary.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                topBar
                    .padding(.horizontal, 16)
                    .padding(.top, 4)
                    .padding(.bottom, 12)

                TextField(
                    "",
                    text: $title,
                    prompt: Text("Title").foregroundColor(AppInk.solid(0.25)),
                    axis: .vertical
                )
                .font(.appTitle)
                .foregroundColor(AppText.primary)
                .tint(AppText.primary)
                .lineLimit(1...3)
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
                .focused($focus, equals: .title)

                ZStack(alignment: .topLeading) {
                    if noteBody.isEmpty {
                        Text("Start typing\u{2026}")
                            .font(.appBody)
                            .foregroundColor(AppText.muted)
                            .padding(.horizontal, 24)
                            .padding(.top, 8)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $noteBody)
                        .appBodyText()
                        .scrollContentBackground(.hidden)
                        .background(Color.clear)
                        .tint(AppText.primary)
                        .padding(.horizontal, 16)
                        .contentMargins(.bottom, 96, for: .scrollContent)
                        .focused($focus, equals: .body)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            // Idle mic only appears once the user has tapped into a field —
            // the recording row stays for the duration of dictation so the
            // user can always cancel or confirm.
            if dictation.isRecording || focus != nil {
                DictationControls(
                    dictation: dictation,
                    onStart: {
                        bodyBeforeDictation = noteBody
                        dictation.start()
                    },
                    onCancel: {
                        dictation.cancel()
                        noteBody = bodyBeforeDictation
                    },
                    onConfirm: {
                        dictation.stop()
                    }
                )
                .padding(.trailing, 20)
                .padding(.bottom, 20)
                .transition(.scale(scale: 0.85).combined(with: .opacity))
            }

            if !dictation.isRecording {
                chatButton
                    .padding(.leading, 20)
                    .padding(.bottom, 20)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: dictation.isRecording)
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: focus)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: dictation.transcript) { _, newValue in
            let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return }
            if bodyBeforeDictation.isEmpty {
                noteBody = trimmed
            } else {
                let needsSeparator = !bodyBeforeDictation.hasSuffix("\n") && !bodyBeforeDictation.hasSuffix(" ")
                noteBody = bodyBeforeDictation + (needsSeparator ? " " : "") + trimmed
            }
        }
        .alert("Microphone access denied", isPresented: $dictation.permissionDenied) {
            Button("Open Settings") { openSettings() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Enable Microphone and Speech Recognition in Settings to dictate notes.")
        }
        .sheet(isPresented: $showChat, onDismiss: refreshAfterChat) {
            ChatView(initialNoteContextID: original.id)
        }
        .onAppear { chrome.hideTabBar = true }
        .onDisappear {
            chrome.hideTabBar = false
            dictation.stop()
            persistIfNeeded()
        }
    }

    private var chatButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            // Commit any unsaved edits so the chat sees the current body
            // when it loads notes from the store on appear.
            persistIfNeeded()
            showChat = true
        } label: {
            Image(systemName: "message")
                .font(.system(size: 19, weight: .regular))
                .foregroundColor(AppText.primary)
                .frame(width: 56, height: 56)
                .background(
                    Circle()
                        .fill(.regularMaterial)
                        .overlay(Circle().stroke(AppInk.solid(0.15), lineWidth: 0.5))
                        .shadow(color: Color.black.opacity(0.22), radius: 10, y: 3)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Ask AI chat about this note")
    }

    private var topBar: some View {
        HStack(spacing: 10) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dictation.stop()
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
                    if hasContent {
                        ShareLink(item: combined) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                    }
                    Button(role: .destructive) {
                        performDelete()
                    } label: {
                        Label("Delete Note", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .topBarPillLabel()
                }
                .accessibilityLabel("More")
            }
        }
    }
}

// MARK: - Filter Chip

private struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let isDeletable: Bool
    let action: () -> Void
    var onDelete: (() -> Void)? = nil

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.app(size: 14, weight: isSelected ? .semibold : .regular))
                .foregroundColor(isSelected ? .white : AppText.secondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(isSelected ? BrandColor.amber : AppInk.solid(0.06))
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(
                        isSelected ? Color.clear : AppInk.solid(0.08),
                        lineWidth: 0.5
                    )
                )
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.28, dampingFraction: 0.72), value: isSelected)
        .contextMenu {
            if isDeletable, let onDelete {
                Button(role: .destructive, action: onDelete) {
                    Label("Remove tag", systemImage: "trash")
                }
            }
        }
    }
}

// MARK: - Pinned Note Card

// MARK: - Notes View

struct NotesView: View {
    var newNoteTrigger: Int = 0
    var onProfileTap: (() -> Void)? = nil
    /// When true, the view is hosted inside another container (the Simple
    /// home page) that owns the NavigationStack, title, and profile pill —
    /// so this view skips those pieces of chrome.
    var embedded: Bool = false
    /// When the host provides these bindings (Simple mode), search lives
    /// in the host's chrome and both views write through the same state.
    /// When nil, the view uses its own internal storage (Classic mode).
    var externalShowSearch: Binding<Bool>? = nil
    var externalSearchText: Binding<String>? = nil
    @EnvironmentObject private var recording: RecordingController
    @Environment(\.scenePhase) private var scenePhase
    @State private var notes: [Note] = []
    @State private var editingNote: Note? = nil
    @State private var pendingSave: DispatchWorkItem? = nil
    @State private var localSearchText = ""
    @State private var localShowSearch = false
    @State private var selectedFilter: String? = nil
    @State private var customTags: [String] = UserDefaults.standard.stringArray(forKey: "note_custom_tags") ?? []
    @State private var showAddTag = false
    @State private var newTagName = ""
    @State private var reloadTask: Task<Void, Never>? = nil
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

    private func startAudioNote() {
        recording.begin { transcript in
            var note = Note()
            note.body = transcript
            note.updatedAt = Date()
            notes.append(note)
            scheduleSave()
        }
        recording.showingSheet = true
    }

    private let builtinTags = ["Starred", "Work", "Personal"]
    private var allTags: [String] { builtinTags + customTags }

    private var sortedNotes: [Note] {
        notes.sorted { $0.updatedAt > $1.updatedAt }
    }

    private var tagFilteredNotes: [Note] {
        guard let tag = selectedFilter else { return sortedNotes }
        return sortedNotes.filter { $0.tags.contains(tag) }
    }

    private var searchedNotes: [Note] {
        let q = searchText.lowercased()
        guard !q.isEmpty else { return tagFilteredNotes }
        return tagFilteredNotes.filter {
            $0.displayTitle.lowercased().contains(q) || $0.body.lowercased().contains(q)
        }
    }

    private func delete(_ note: Note) {
        notes.removeAll { $0.id == note.id }
        scheduleSave()
    }

    private func toggleTag(_ tag: String, for note: Note) {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        if notes[idx].tags.contains(tag) {
            notes[idx].tags.removeAll { $0 == tag }
        } else {
            notes[idx].tags.append(tag)
        }
        scheduleSave()
    }

    private func togglePin(_ note: Note) {
        guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
        notes[idx].isPinned.toggle()
        scheduleSave()
    }

    private func scheduleSave() {
        pendingSave?.cancel()
        let snapshot = notes
        var work: DispatchWorkItem!
        work = DispatchWorkItem {
            NotesStore.saveInBackground(snapshot)
            // Only clear the marker if we're still the latest scheduled save.
            // A newer scheduleSave() would have replaced pendingSave already.
            if pendingSave === work { pendingSave = nil }
        }
        pendingSave = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35, execute: work)
    }

    private func flushSave() {
        guard let work = pendingSave else { return }
        work.cancel()
        pendingSave = nil
        NotesStore.saveInBackground(notes)
    }

    private func removeTag(_ tag: String) {
        customTags.removeAll { $0 == tag }
        UserDefaults.standard.set(customTags, forKey: "note_custom_tags")
        if selectedFilter == tag { selectedFilter = nil }
    }

    @ViewBuilder
    private func notesList(_ items: [Note], splitPinned: Bool = false, emptyTitle: String, emptySubtitle: String?) -> some View {
        let pinned = splitPinned ? items.filter { $0.isPinned } : []
        let main = splitPinned ? items.filter { !$0.isPinned } : items
        // Only show the create CTA in the true "no notes yet" state — for
        // search/filter empty results the plus would suggest the wrong action.
        let isPristineEmpty = searchText.isEmpty && selectedFilter == nil && !showSearch

        if pinned.isEmpty && main.isEmpty {
            if isPristineEmpty {
                EmptyStateView(
                    illustration: NotesIllustration(),
                    title: emptyTitle,
                    subtitle: emptySubtitle,
                    actionTitle: "New note",
                    action: { startAudioNote() }
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
            List {
                if !pinned.isEmpty {
                    sectionHeader("Pinned")
                    ForEach(pinned) { note in
                        noteRow(note)
                    }
                    if !main.isEmpty {
                        sectionHeader("Other", topPadding: 18)
                    }
                }
                ForEach(main) { note in
                    noteRow(note)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color.clear)
            .animation(AppAnimation.standard, value: pinned.map(\.id))
        }
    }

    @ViewBuilder
    private func sectionHeader(_ title: String, topPadding: CGFloat = 6) -> some View {
        Text(title)
            .font(.app(size: 15, weight: .semibold))
            .foregroundColor(AppText.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, topPadding)
            .padding(.bottom, 4)
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }

    @ViewBuilder
    private func noteRow(_ note: Note) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            editingNote = note
        } label: {
            NoteListRow(note: note)
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
                Label {
                    Text("Delete").font(.appSmall)
                } icon: {
                    Image(systemName: "trash")
                        .font(.system(size: 14, weight: .semibold))
                }
            }
            .tint(
                LinearGradient(
                    colors: [
                        Color(red: 0.48, green: 0.06, blue: 0.06),
                        Color(red: 0.20, green: 0.02, blue: 0.02)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
        }
        .swipeActions(edge: .leading) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                togglePin(note)
            } label: {
                Label {
                    Text(note.isPinned ? "Unpin" : "Pin").font(.appSmall)
                } icon: {
                    Image(systemName: note.isPinned ? "pin.slash.fill" : "pin.fill")
                        .font(.system(size: 14, weight: .semibold))
                }
            }
            .tint(Color(red: 0.62, green: 0.18, blue: 0.04))
        }
        .contextMenu {
            Button {
                togglePin(note)
            } label: {
                Label(
                    note.isPinned ? "Unpin" : "Pin",
                    systemImage: note.isPinned ? "pin.slash" : "pin"
                )
            }
            Divider()
            ForEach(allTags.filter { $0 != "Starred" }, id: \.self) { tag in
                Button {
                    toggleTag(tag, for: note)
                } label: {
                    Label(
                        note.tags.contains(tag) ? "Remove \"\(tag)\"" : "Tag as \"\(tag)\"",
                        systemImage: note.tags.contains(tag) ? "tag.slash" : "tag"
                    )
                }
            }
            Divider()
            Button(role: .destructive) { delete(note) } label: {
                Label("Delete", systemImage: "trash")
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
                // both the search and profile pills, so this view skips its
                // own top bar entirely.
                if !embedded {
                    InlineTopBar(title: "Notes") {
                        TopBarPill {
                            // Classic mode (no profile callback) shows the
                            // pencil for starting an audio note.
                            if onProfileTap == nil {
                                TopBarPillButton(systemImage: "square.and.pencil") {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    startAudioNote()
                                }
                                .accessibilityLabel("New note")

                                TopBarPillDivider()
                            }

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
                            .accessibilityLabel(showSearch ? "Close search" : "Search")
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

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(label: "All", isSelected: selectedFilter == nil, isDeletable: false) {
                                withAnimation { selectedFilter = nil }
                            }
                            ForEach(allTags, id: \.self) { tag in
                                FilterChip(
                                    label: tag,
                                    isSelected: selectedFilter == tag,
                                    isDeletable: customTags.contains(tag),
                                    action: { withAnimation { selectedFilter = selectedFilter == tag ? nil : tag } },
                                    onDelete: customTags.contains(tag) ? { removeTag(tag) } : nil
                                )
                            }
                            Button {
                                newTagName = ""
                                showAddTag = true
                            } label: {
                                Image(systemName: "plus")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundColor(AppText.secondary)
                                    .frame(width: 34, height: 34)
                                    .background(AppInk.solid(0.08))
                                    .clipShape(Circle())
                                    .appIconHitArea()
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Add tag")
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                    }

                    Rectangle()
                        .fill(AppInk.solid(0.06))
                        .frame(height: 0.5)

                    notesList(
                        tagFilteredNotes,
                        splitPinned: true,
                        emptyTitle: selectedFilter == nil ? "No notes yet" : "No results",
                        emptySubtitle: selectedFilter == nil ? "Capture an idea to get started" : nil
                    )
                }
                .allowsHitTesting(!showSearch)
                .animation(AppAnimation.standard, value: showSearch)
                // The notes list never owns the keyboard (only the SearchOverlay
                // does), so don't let the keyboard's safe-area inset reshape the
                // list. Without this, Cancel-ing search makes the keyboard
                // descend and the list's bottom edge animates outward — which
                // reads as content jumping up from below during the overlay fade.
                .ignoresSafeArea(.keyboard)

                if showSearch {
                    SearchOverlay(
                        query: searchTextBinding,
                        placeholder: "Search notes",
                        isFocused: $searchFocused,
                        onCancel: {
                            withAnimation(AppAnimation.standard) {
                                showSearch = false
                                searchText = ""
                            }
                        },
                        omitField: embedded
                    ) {
                        notesList(
                            searchedNotes,
                            emptyTitle: searchText.isEmpty ? "Start typing" : "No results",
                            emptySubtitle: nil
                        )
                    }
                    .transition(.opacity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationDestination(item: $editingNote) { note in
                if note.kind == .drawing {
                    DrawingCanvasView(
                        initialNote: note,
                        onSave: { saved in
                            if let idx = notes.firstIndex(where: { $0.id == saved.id }) {
                                notes[idx] = saved
                            } else {
                                notes.insert(saved, at: 0)
                            }
                            flushSave()
                        },
                        onCancel: {}
                    )
                    .toolbar(.hidden, for: .navigationBar)
                } else {
                    NoteEditorPage(
                        note: note,
                        onSave: { saved in
                            if let idx = notes.firstIndex(where: { $0.id == saved.id }) {
                                notes[idx] = saved
                            }
                            flushSave()
                        },
                        onDelete: { delete(note) }
                    )
                }
            }
            .sheet(isPresented: $showAddTag) {
                NewTagSheet(newTagName: $newTagName) {
                    let t = newTagName.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !t.isEmpty, !allTags.map({ $0.lowercased() }).contains(t.lowercased()) else { return }
                    customTags.append(t)
                    UserDefaults.standard.set(customTags, forKey: "note_custom_tags")
                    showAddTag = false
                }
            }
            .task { notes = await NotesStore.loadAsync() }
        .onReceive(NotificationCenter.default.publisher(for: .notesStoreDidChange)) { _ in
            // Skip if this view has a debounced save in flight; the disk may be
            // stale relative to in-memory edits and reloading would clobber them.
            guard pendingSave == nil else { return }
            reloadTask?.cancel()
            reloadTask = Task {
                let fresh = await NotesStore.loadAsync()
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    if fresh != notes { notes = fresh }
                }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .inactive || phase == .background { flushSave() }
        }
        .onChange(of: newNoteTrigger) { _, _ in
            startAudioNote()
        }
    }
}

private struct NewTagSheet: View {
    @Binding var newTagName: String
    let onAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                TextField("Tag name", text: $newTagName)
                    .font(.appBody)
                    .foregroundColor(AppText.primary)
                    .tint(AppText.primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(AppInk.solid(0.07))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.input, style: .continuous))
                    .padding(.horizontal, 20)
                    .padding(.top, 24)
                    .focused($focused)
                    .onSubmit { if !newTagName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { onAdd() } }
                Spacer()
            }
            .background(AppBackground.primary.ignoresSafeArea())
            .navigationTitle("New Tag")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(AppText.secondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Add") { onAdd() }
                        .fontWeight(.semibold)
                        .disabled(newTagName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .presentationDetents([.height(180)])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(AppBackground.primary)
        .onAppear { focused = true }
    }
}

// MARK: - Drawing canvas (Draw my idea)

/// Sketch surface with a left-aligned title and the canvas filling the
/// rest of the screen. Mirrors the notes editor: chrome row up top
/// (close + undo/redo on the left, save on the right), large title on
/// the next line, content area below. Save writes a `.drawing` Note
/// with the serialized PKDrawing.
struct DrawingCanvasView: View {
    var initialNote: Note? = nil
    var onSave: ((Note) -> Void)? = nil
    var onCancel: (() -> Void)? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var canvasView = PKCanvasView()
    @State private var hasInk: Bool = false
    @State private var canUndo: Bool = false
    @State private var canRedo: Bool = false

    private var canSave: Bool { hasInk }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            topBar
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 12)

            Text("Draw my idea")
                .font(.appTitle)
                .foregroundColor(AppText.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 20)
                .padding(.bottom, 20)

            canvasArea
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(AppBackground.primary.ignoresSafeArea())
    }

    private var topBar: some View {
        HStack(spacing: 8) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onCancel?()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(AppText.primary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(AppBackground.surface))
                    .overlay(Circle().stroke(AppInk.solid(0.10), lineWidth: 0.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel")

            undoRedoCluster

            Spacer()

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                save()
            } label: {
                Text("Save")
                    .font(.appLabelBold)
                    .foregroundColor(canSave ? .white : AppInk.solid(0.32))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(
                        Capsule(style: .continuous)
                            .fill(canSave ? BrandColor.amber : AppInk.solid(0.06))
                    )
                    .overlay(
                        Capsule(style: .continuous)
                            .stroke(canSave ? Color.clear : AppInk.solid(0.10), lineWidth: 0.5)
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSave)
        }
    }

    private var undoRedoCluster: some View {
        HStack(spacing: 4) {
            undoRedoButton(
                systemImage: "arrow.uturn.backward",
                enabled: canUndo,
                accessibilityLabel: "Undo"
            ) {
                canvasView.undoManager?.undo()
                refreshUndoState()
            }
            undoRedoButton(
                systemImage: "arrow.uturn.forward",
                enabled: canRedo,
                accessibilityLabel: "Redo"
            ) {
                canvasView.undoManager?.redo()
                refreshUndoState()
            }
        }
    }

    private func undoRedoButton(
        systemImage: String,
        enabled: Bool,
        accessibilityLabel: String,
        action: @escaping () -> Void
    ) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            Image(systemName: systemImage)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(enabled ? AppText.primary : AppInk.solid(0.22))
                .frame(width: 36, height: 36)
                .background(Circle().fill(AppBackground.surface))
                .overlay(Circle().stroke(AppInk.solid(0.10), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .accessibilityLabel(accessibilityLabel)
    }

    private func refreshUndoState() {
        // Read on the next runloop so PKCanvasView's own undo registration
        // for the just-finished stroke has time to land — reading inline
        // sometimes returned the pre-stroke state.
        DispatchQueue.main.async {
            let mgr = canvasView.undoManager
            canUndo = mgr?.canUndo ?? false
            canRedo = mgr?.canRedo ?? false
        }
    }

    private var canvasArea: some View {
        PencilKitCanvas(canvasView: $canvasView, initialDrawing: initialNote?.drawingData, onChange: { drawing in
            hasInk = !drawing.bounds.isEmpty
            refreshUndoState()
        })
        .background(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .fill(AppBackground.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .stroke(AppInk.solid(0.06), lineWidth: 0.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private func save() {
        let data = canvasView.drawing.dataRepresentation()
        var note = initialNote ?? Note()
        note.kind = .drawing
        note.drawingData = data
        note.updatedAt = Date()

        if let onSave {
            onSave(note)
        } else {
            var all = NotesStore.load()
            if let idx = all.firstIndex(where: { $0.id == note.id }) {
                all[idx] = note
            } else {
                all.insert(note, at: 0)
            }
            NotesStore.save(all)
        }
        dismiss()
    }
}

private struct PencilKitCanvas: UIViewRepresentable {
    @Binding var canvasView: PKCanvasView
    var initialDrawing: Data?
    var onChange: ((PKDrawing) -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(onChange: onChange) }

    func makeUIView(context: Context) -> PKCanvasView {
        canvasView.tool = PKInkingTool(.pen, color: UIColor.label, width: 3)
        canvasView.drawingPolicy = .anyInput
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.delegate = context.coordinator

        if let data = initialDrawing, let drawing = try? PKDrawing(data: data) {
            canvasView.drawing = drawing
        }
        return canvasView
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        context.coordinator.onChange = onChange
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var onChange: ((PKDrawing) -> Void)?
        init(onChange: ((PKDrawing) -> Void)?) { self.onChange = onChange }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            onChange?(canvasView.drawing)
        }
    }
}

/// Read-only render of a stored `PKDrawing` for previewing a sketched
/// note inside the editor.
struct DrawingPreview: UIViewRepresentable {
    let data: Data

    func makeUIView(context: Context) -> PKCanvasView {
        let v = PKCanvasView()
        v.isUserInteractionEnabled = false
        v.backgroundColor = .clear
        v.isOpaque = false
        if let drawing = try? PKDrawing(data: data) {
            v.drawing = drawing
        }
        return v
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {
        if let drawing = try? PKDrawing(data: data) {
            uiView.drawing = drawing
        }
    }
}

#Preview {
    NotesView()
}
