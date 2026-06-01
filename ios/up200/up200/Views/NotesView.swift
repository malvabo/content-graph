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
    private let sharedRequest = LockedRequest()
    private var task: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var teardownTask: Task<Void, Never>? = nil
    private var startupTask: Task<Void, Never>? = nil
    private var activationTask: Task<Void, Never>? = nil
    // Incremented by start() and teardown() so that auth callbacks queued
    // before a stop() call are silently dropped when they eventually fire.
    private var startToken: Int = 0
    private var srRestartCount = 0
    // Accumulates text from completed SR sessions so transcript is always
    // the full cumulative text across the ~60-second restart boundaries.
    private var sessionBase = ""
    private var configChangeObserver: NSObjectProtocol?

    func start() {
        startToken += 1
        let token = startToken
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self, self.startToken == token else { return }
                guard status == .authorized else {
                    self.permissionDenied = true
                    return
                }
                AVAudioApplication.requestRecordPermission { [weak self] granted in
                    DispatchQueue.main.async {
                        guard let self, self.startToken == token else { return }
                        guard granted else {
                            self.permissionDenied = true
                            return
                        }
                        self.transcript = ""
                        self.sessionBase = ""
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

    /// Stop and suppress the transcript (so caller can revert the body
    /// without a late onChange overwriting the rollback).
    func cancel() {
        task?.cancel()
        task = nil
        transcript = ""
        sessionBase = ""
        teardown()
    }

    private func teardown() {
        startToken += 1   // drop any in-flight start() auth callbacks
        startupTask?.cancel()
        activationTask?.cancel()
        activationTask = nil
        teardownNotifications()
        isRecording = false
        audioLevel = 0
        task?.cancel()
        task = nil
        let engine = audioEngine
        let req = sharedRequest.value
        sharedRequest.value = nil
        teardownTask = Task.detached(priority: .userInitiated) {
            req?.endAudio()  // signal SR before stopping the engine feed
            engine.stop()
            engine.inputNode.removeTap(onBus: 0)
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    func awaitTeardown() async {
        await teardownTask?.value
    }

    private func startEngine() {
        task?.cancel()
        task = nil
        startupError = nil
        srRestartCount = 0
        startupTask?.cancel()
        activationTask?.cancel()
        activationTask = nil
        teardownNotifications()
        setupNotifications()
        let prev = teardownTask
        teardownTask = nil
        startupTask = Task { @MainActor [weak self] in
            await prev?.value
            guard let self, !Task.isCancelled else { return }
            self.activateAndStart()
        }
    }

    private func activateAndStart() {
        activationTask = Task.detached(priority: .userInitiated) { [weak self] in
            let session = AVAudioSession.sharedInstance()
            do {
                try session.setCategory(.playAndRecord, mode: .measurement,
                                       options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
            } catch {
                await MainActor.run {
                    self?.startupError = "Couldn't set up the audio session: \(error.localizedDescription)"
                }
                return
            }
            await MainActor.run { self?.continueStartingEngine() }
        }
    }

    private func continueStartingEngine() {
        guard !Task.isCancelled else { return }
        guard recognizer != nil else {
            startupError = "Speech recognition isn't available on this device."
            return
        }

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        var lastLevelDispatch: Double = 0
        // Dynamic request reference: restartSpeechRecognition() swaps sharedRequest
        // without reinstalling the tap, so all sessions share the same tap lifetime.
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.sharedRequest.value?.append(buffer)
            guard let channels = buffer.floatChannelData else { return }
            let frames = Int(buffer.frameLength)
            guard frames > 0 else { return }
            let samples = channels[0]
            var sum: Float = 0
            for i in 0..<frames { let s = samples[i]; sum += s * s }
            let rms = (sum / Float(frames)).squareRoot()
            let now = CFAbsoluteTimeGetCurrent()
            guard now - lastLevelDispatch >= 1.0 / 20.0 else { return }
            lastLevelDispatch = now
            DispatchQueue.main.async { [weak self] in self?.audioLevel = rms }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
            isRecording = true
            restartSpeechRecognition()
        } catch {
            startupError = "Couldn't start the microphone: \(error.localizedDescription)"
            inputNode.removeTap(onBus: 0)
        }
    }

    private func restartSpeechRecognition() {
        task?.cancel()
        task = nil
        guard isRecording, let rec = recognizer else { return }
        guard srRestartCount < 20 else {
            startupError = "Speech recognition became unavailable. Tap the mic to retry."
            return
        }
        srRestartCount += 1
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        sharedRequest.value = req
        task = rec.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, self.isRecording else { return }
                if let result {
                    let current = result.bestTranscription.formattedString
                    self.transcript = self.sessionBase.isEmpty
                        ? current
                        : self.sessionBase + " " + current
                }
                if result?.isFinal == true {
                    // Accumulate completed session, restart SR on the same engine.
                    self.sessionBase = self.transcript
                    self.restartSpeechRecognition()
                } else if error != nil, self.isRecording {
                    self.restartSpeechRecognition()
                }
            }
        }
    }

    private func setupNotifications() {
        configChangeObserver = NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange,
            object: audioEngine, queue: .main
        ) { [weak self] _ in self?.handleConfigurationChange() }
    }

    private func teardownNotifications() {
        if let obs = configChangeObserver {
            NotificationCenter.default.removeObserver(obs)
            configChangeObserver = nil
        }
    }

    private func handleConfigurationChange() {
        guard isRecording else { return }
        teardown()
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 300_000_000)
            self?.startEngine()
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
/// lines for text, chart bars for sketched drawings. Text notes that
/// carry more than one generation swap to the two-doc stack so the row's
/// leading graphic flags multi-output notes without growing the canvas.
private struct NoteThumb: View {
    let note: Note
    var hasMultipleGenerations: Bool = false

    var body: some View {
        switch note.kind {
        case .drawing:
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(AppInk.solid(0.07))
                .overlay(ChartThumbContent(seed: note.id))
                .overlay(
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(AppInk.solid(0.09), lineWidth: 0.5)
                )
                .frame(width: 42, height: 52)
        case .text:
            if hasMultipleGenerations {
                DocStackThumb()
            } else {
                DocCardThumb()
            }
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
    var hasMultipleGenerations: Bool = false
    private let amber = BrandColor.amber

    private var titleText: Text {
        Text(note.displayTitle)
    }

    var body: some View {
        HStack(spacing: 14) {
            NoteThumb(note: note, hasMultipleGenerations: hasMultipleGenerations)

            VStack(alignment: .leading, spacing: 5) {
                titleText
                    .font(.appRowTitle)
                    .foregroundColor(AppInk.solid(0.88))
                    .lineLimit(1)
                    .truncationMode(.tail)

                Text(RowDate.relative(from: note.updatedAt))
                    .font(.appSmall)
                    .foregroundColor(AppText.tertiary)


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
    private let particleCount = 25

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = dictation.audioLevel
            Canvas { ctx, size in
                let cy = size.height / 2
                let amplified = min(1.0, pow(Double(max(level, 0.005)), 0.28) * 2.8)
                let amplitude = amplified * cy * 0.75
                for i in 0..<particleCount {
                    let fi = Double(i)
                    let progress = fi / Double(particleCount - 1)
                    let baseX = progress * size.width
                    let phase1 = t * 3.5 + progress * .pi * 3.0
                    let phase2 = t * 2.1 + progress * .pi * 6.0
                    let targetY = cy + sin(phase1) * amplitude * 0.65 + sin(phase2) * amplitude * 0.35
                    let seed1 = fi * 13.7; let seed2 = fi * 29.1
                    let scatterY = 1.5 + amplified * 4.0
                    let jitterX = sin(t * 0.7 + seed1) * 1.5
                    let jitterY = sin(t * 0.9 + seed2) * scatterY + cos(t * 1.3 + seed1 * 0.5) * scatterY * 0.4
                    let px = baseX + jitterX; let py = targetY + jitterY
                    let pr = pseudoRandom(i * 3)
                    let waveMag = (sin(phase1) + 1.0) / 2.0
                    let radius = 0.8 + pr * 1.2 + waveMag * 1.5 * amplified
                    let normJitter = abs(jitterY) / max(scatterY * 1.5, 1.0)
                    let proximityAlpha = max(0.0, 1.0 - normJitter)
                    let pulse = 0.65 + 0.35 * sin(t * 1.8 + fi * 0.35)
                    let alpha = proximityAlpha * pulse * (0.40 + amplified * 0.55)
                    ctx.fill(Path(ellipseIn: CGRect(x: px - radius, y: py - radius,
                                                    width: radius * 2, height: radius * 2)),
                             with: .color(BrandColor.amber.opacity(alpha)))
                }
            }
        }
        .frame(height: 32)
        .accessibilityHidden(true)
    }

    private func pseudoRandom(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

// MARK: - Dictation Controls

struct DictationControls: View {
    @ObservedObject var dictation: NoteDictation
    let onStart: () -> Void
    let onCancel: () -> Void
    let onConfirm: () -> Void
    /// Outer size of the idle mic button. Minimal mode passes 52 to
    /// align with its "Ask AI" pill height; other surfaces keep the
    /// default 56pt glass circle.
    var idleDiameter: CGFloat = 56

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
            Image(systemName: "mic.badge.plus")
                .font(.system(size: 19, weight: .regular))
                .foregroundColor(AppText.primary)
                .frame(width: idleDiameter, height: idleDiameter)
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
    @EnvironmentObject private var recording: RecordingController
    private let particleCount = 55

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = recording.audioLevel
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
                    // 3× bigger dots
                    let radius = (1.0 + pr * 1.8 + waveMag * 2.0 * amplified) * 3.0
                    let normJitter = abs(jitterY) / max(scatterY * 1.5, 1.0)
                    let proximityAlpha = max(0.0, 1.0 - normJitter) * envelope
                    let pulse = 0.65 + 0.35 * sin(t * 1.8 + fi * 0.35)
                    // High contrast: nearly invisible when silent, vivid when speaking
                    let alpha = proximityAlpha * pulse * (0.10 + amplified * 0.90)
                    ctx.fill(Path(ellipseIn: CGRect(x: px - radius, y: py - radius,
                                                    width: radius * 2, height: radius * 2)),
                             with: .color(BrandColor.amber.opacity(alpha)))
                }
            }
        }
        .frame(height: 90)
        .accessibilityHidden(true)
    }

    private func pseudoRandom(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

struct NoteVoiceSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var recording: RecordingController
    @State private var selectedDetent: PresentationDetent = .medium
    @State private var showingComposer: Bool = false
    // true only when this sheet triggered the pause (not a manual user pause),
    // so we know to auto-resume on swipe back to medium.
    @State private var pausedByDetent: Bool = false
    // stored so it can be cancelled if the user swipes back to large mid-wait
    @State private var resumeTask: Task<Void, Never>? = nil
    // Owned here so NoteVoiceSheet can await its teardown before resuming
    // RecordingController — prevents the setActive(false)/setActive(true) race.
    @StateObject private var composerDictation = NoteDictation()

    private static let miniDetent: PresentationDetent = .height(88)
    private let sheetBg = AppBackground.primary
    private var isMini: Bool { selectedDetent == Self.miniDetent }

    private var timeLabel: String {
        String(format: "%02d:%02d", recording.seconds / 60, recording.seconds % 60)
    }

    var body: some View {
        ZStack {
            sheetBg.ignoresSafeArea()
            if showingComposer {
                NoteComposerSheet(
                    initialBody: recording.fullTranscript,
                    dictation: composerDictation,
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
            } else if isMini {
                miniBar
            } else {
                voiceUI
            }
        }
        .presentationDetents([Self.miniDetent, .medium, .large], selection: $selectedDetent)
        .presentationDragIndicator(.visible)
        .presentationBackground(sheetBg)
        .presentationCornerRadius(Radius.sheet)
        .presentationBackgroundInteraction(.enabled(upThrough: Self.miniDetent))
        .onChange(of: selectedDetent) { _, newDetent in
            // Only treat a confirmed snap to .large as "expand to editor".
            // The previous negation (newDetent != .medium) also fired during
            // the downward-dismiss drag when iOS emits transient non-.medium
            // values, which triggered recording.pause() → teardownEngine()
            // on the main thread mid-gesture → hard freeze.
            let large = (newDetent == .large)
            if large {
                // Cancel any pending resume — user is back in large detent.
                resumeTask?.cancel()
                resumeTask = nil
                // Only auto-pause if we're the ones pausing (not already paused
                // by the user); only then will we auto-resume on the way back.
                if recording.isRecording && !recording.isPaused {
                    recording.pause()
                    pausedByDetent = true
                }
            } else if !large && pausedByDetent {
                // Wait for NoteComposerSheet.onDisappear to fire (animation ~300ms),
                // then await the dictation teardown so setActive(false) completes
                // before RecordingController calls setActive(true).
                let d = composerDictation
                resumeTask = Task {
                    do { try await Task.sleep(nanoseconds: 500_000_000) }
                    catch { return }
                    await d.awaitTeardown()
                    await MainActor.run {
                        guard recording.isPaused, pausedByDetent else { return }
                        pausedByDetent = false
                        recording.resume()
                    }
                }
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

    private var miniBar: some View {
        HStack(spacing: 14) {
            Circle()
                .fill(BrandColor.amber)
                .frame(width: 8, height: 8)
                .shadow(color: BrandColor.amber.opacity(0.6), radius: 4)
            Text(timeLabel)
                .font(.system(size: 17, weight: .medium, design: .monospaced))
                .foregroundColor(AppText.primary)
            Text(recording.isPaused ? "Paused" : "Recording")
                .font(.appSmall)
                .foregroundColor(AppText.tertiary)
            Spacer()
            Button { endRecording() } label: {
                HStack(spacing: 6) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 12, weight: .semibold))
                    Text("End")
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundColor(.black)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Capsule(style: .continuous).fill(Color.white))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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

            Spacer(minLength: 16)

            if let err = recording.startupError {
                Text(err)
                    .font(.appSmall)
                    .foregroundColor(.red.opacity(0.75))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Spacer(minLength: 16)
            } else if !recording.fullTranscript.isEmpty {
                ScrollView {
                    Text(recording.fullTranscript)
                        .font(.appBody)
                        .foregroundColor(AppText.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 8)
                }
                .frame(maxHeight: 72)
                Spacer(minLength: 16)
            } else {
                Spacer(minLength: 8)
            }

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

    @ObservedObject var dictation: NoteDictation
    @State private var noteBody: String
    @State private var bodyBeforeDictation: String = ""
    @State private var showDiscardAlert: Bool = false
    @State private var dictationCancelled: Bool = false
    @FocusState private var bodyFocused: Bool

    init(initialBody: String, dictation: NoteDictation, onSave: @escaping (String) -> Void, onCancel: @escaping () -> Void) {
        self.initialBody = initialBody
        self.dictation = dictation
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
                            .font(.appReadingBody)
                            .foregroundColor(AppText.muted)
                            .padding(.horizontal, 24)
                            .padding(.top, 20)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $noteBody)
                        .font(.appReadingBody)
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
                        dictationCancelled = false
                        bodyBeforeDictation = noteBody
                        dictation.start()
                    },
                    onCancel: {
                        dictationCancelled = true
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
                guard !dictationCancelled else { return }
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
    /// Page-scoped restore cache for the chat sheet — keeps an
    /// in-progress conversation alive across close/reopen while the
    /// user stays on this note, and is dropped when the page is left.
    @StateObject private var chatDraft = ChatDraftSession()
    @State private var showCreate: Bool = false
    /// Snapshot of the selection captured at the moment a custom menu
    /// action fires — held on its own so the chat sheet's seed survives
    /// the selection clearing when the keyboard collapses on present.
    @State private var pendingSelectionText: String? = nil
    @State private var pendingSelectionRange: NSRange? = nil
    /// Drives the inline rewrite sheet for the magic-pen action.
    @State private var rewriteRequest: RewriteRequest? = nil
    @StateObject private var dictation = NoteDictation()
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController
    @EnvironmentObject private var recording: RecordingController
    @FocusState private var focus: Field?
    @State private var pausedRecordingForDictation = false

    private enum Field { case title, body }

    struct RewriteRequest: Identifiable {
        let id = UUID()
        let originalText: String
        let range: NSRange
    }

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
        // Use bTrim (not raw noteBody) so trailing whitespace from voice
        // dictation doesn't make combined != original.body on every open/close.
        if t.isEmpty { return bTrim }
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
        let bodyChanged = (combined != original.body)
        var saved = original
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedBody = noteBody.trimmingCharacters(in: .whitespacesAndNewlines)
        if bodyChanged {
            saved.body = combined
            saved.title = ""
            saved.updatedAt = Date()
            if trimmedTitle.isEmpty && !trimmedBody.isEmpty {
                let snapshotBody = noteBody
                let fallbackBody = combined
                let baseNote = saved
                let save = onSave
                let bodyRef = $noteBody
                Task {
                    var updated = baseNote
                    updated.body = await AIService.prependTitleIfMissing(to: snapshotBody) ?? fallbackBody
                    await MainActor.run {
                        guard bodyRef.wrappedValue == snapshotBody else { return }
                        save(updated)
                    }
                }
                return
            }
            onSave(saved)
        }

        // Title every non-empty body without a user-supplied title, even when
        // the editor didn't change anything — this keeps older raw transcript
        // notes from staying titleless after the user opens and closes them.
        guard trimmedTitle.isEmpty else { return }
        guard !trimmedBody.isEmpty else { return }

        let snapshotBody = noteBody
        let bodyRef = $noteBody          // binding reads live @State storage
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
            guard !AIService.titleDuplicatesFirstLine(cleaned, firstLine: firstLine) else { return }
            var updated = baseNote
            updated.body = cleaned + "\n" + snapshotBody
            updated.updatedAt = Date()
            await MainActor.run {
                // Guard against the user editing the note while generateTitle
                // was in-flight — mirrors retroTitleUntitledNotes line 1568.
                guard bodyRef.wrappedValue == snapshotBody else { return }
                save(updated)
            }
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
        // Snapshot combined NOW (before the disk read) so the TOCTOU window
        // between loadAsync() completing and the comparison firing doesn't let
        // a user edit during the read slip through the guard undetected.
        let preChatBody = combined
        Task {
            let fresh = await NotesStore.loadAsync()
            guard let updated = fresh.first(where: { $0.id == id }) else { return }
            let migrated = Note.migrated(updated)
            await MainActor.run {
                if preChatBody == original.body {
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
                .allowsTightening(true)
                .padding(.horizontal, 20)
                .padding(.bottom, 20)
                .focused($focus, equals: .title)
                // Submit on Return moves focus down to the body field
                // rather than inserting a newline. Without this the
                // title field was a focus trap: axis: .vertical lets
                // Return insert newlines (up to lineLimit), and there's
                // no visible "Next" affordance to escape into the body.
                .submitLabel(.next)
                .onSubmit { focus = .body }

                ZStack(alignment: .topLeading) {
                    if noteBody.isEmpty {
                        Text("Start typing\u{2026}")
                            .font(.appReadingBody)
                            .foregroundColor(AppText.muted)
                            .padding(.horizontal, 24)
                            .padding(.top, 8)
                            .allowsHitTesting(false)
                    }
                    SelectableNoteEditor(
                        text: $noteBody,
                        isFocused: Binding(
                            get: { focus == .body },
                            set: { newValue in focus = newValue ? .body : nil }
                        ),
                        bottomInset: 96,
                        onMagicSelection: { snippet, range in
                            triggerSelectionRewrite(snippet: snippet, range: range)
                        },
                        onChatSelection: { snippet, range in
                            triggerSelectionChat(snippet: snippet, range: range)
                        }
                    )
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            // Bottom-trailing: chat sits on top, dictation stacks below
            // it once the user focuses a field. The dictation row stays
            // for the duration of recording so the user can always
            // cancel or confirm; chat hides while dictating so the
            // recording row owns the bottom edge.
            VStack(spacing: 12) {
                if !dictation.isRecording && focus == nil {
                    chatButton
                        .transition(.scale(scale: 0.85).combined(with: .opacity))
                }
                DictationControls(
                    dictation: dictation,
                    onStart: {
                        bodyBeforeDictation = noteBody
                        // Pause the floating recorder so both don't compete
                        // for the same AVAudioSession input simultaneously.
                        if recording.isRecording, !recording.isPaused {
                            recording.pauseForSystem()
                            pausedRecordingForDictation = true
                            // Wait for RecordingController's async setActive(false)
                            // to complete before activating NoteDictation's session.
                            Task {
                                try? await Task.sleep(nanoseconds: 400_000_000)
                                await MainActor.run { dictation.start() }
                            }
                        } else {
                            dictation.start()
                        }
                    },
                    onCancel: {
                        dictation.cancel()
                        noteBody = bodyBeforeDictation
                        if pausedRecordingForDictation {
                            pausedRecordingForDictation = false
                            Task {
                                try? await Task.sleep(nanoseconds: 400_000_000)
                                await MainActor.run { recording.resumeIfSystemPaused() }
                            }
                        }
                    },
                    onConfirm: {
                        dictation.stop()
                        if pausedRecordingForDictation {
                            pausedRecordingForDictation = false
                            Task {
                                try? await Task.sleep(nanoseconds: 400_000_000)
                                await MainActor.run { recording.resumeIfSystemPaused() }
                            }
                        }
                    }
                )
                .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
            .padding(.trailing, 20)
            .padding(.bottom, 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)

            if !dictation.isRecording && focus == nil {
                magicButton
                    .padding(.leading, 20)
                    .padding(.bottom, 8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
                    .transition(.scale(scale: 0.85).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: dictation.isRecording)
        .animation(.spring(response: 0.36, dampingFraction: 0.82), value: focus)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .swipeBackGesture {
            dictation.stop()
            dismiss()
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
        .sheet(isPresented: $showChat, onDismiss: {
            pendingSelectionText = nil
            pendingSelectionRange = nil
            refreshAfterChat()
        }) {
            let selectionTitle: String? = {
                let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
                let parent = t.isEmpty ? original.displayTitle : t
                return parent.isEmpty ? "Selected text" : "Selection in \(parent)"
            }()
            ChatView(
                initialNoteContextID: original.id,
                initialSelection: pendingSelectionText,
                initialSelectionTitle: pendingSelectionText == nil ? nil : selectionTitle,
                initialSelectionRange: pendingSelectionRange,
                draftSession: chatDraft
            )
        }
        .sheet(item: $rewriteRequest, onDismiss: refreshAfterChat) { request in
            SelectionRewriteSheet(
                originalText: request.originalText,
                onApply: { rewritten in
                    applyRewrite(rewritten, at: request.range, original: request.originalText)
                }
            )
        }
        .fullScreenCover(isPresented: $showCreate) {
            HomeView(isModal: true, initialSources: [noteAsSource])
        }
        .onAppear { chrome.hideTabBar = true }
        .onDisappear {
            chrome.hideTabBar = false
            dictation.stop()
            persistIfNeeded()
            if pausedRecordingForDictation {
                pausedRecordingForDictation = false
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run { recording.resumeIfSystemPaused() }
                }
            }
        }
    }

    private var chatButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            // Commit any unsaved edits so the chat sees the current body
            // when it loads notes from the store on appear.
            persistIfNeeded()
            pendingSelectionText = nil
            pendingSelectionRange = nil
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

    private var magicButton: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            showCreate = true
        } label: {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 19, weight: .semibold))
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
        .accessibilityLabel("Create from this note")
    }

    /// Opens the rewrite sheet seeded with the snippet UIKit handed back
    /// from the edit-menu callback. The `RewriteRequest` carries its own
    /// snapshot so the rewrite still lands at the right span even if the
    /// user keeps editing.
    private func triggerSelectionRewrite(snippet: String, range: NSRange) {
        let trimmed = snippet.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        persistIfNeeded()
        rewriteRequest = RewriteRequest(originalText: snippet, range: range)
    }

    private func triggerSelectionChat(snippet: String, range: NSRange) {
        let trimmed = snippet.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        pendingSelectionText = snippet
        pendingSelectionRange = range
        persistIfNeeded()
        showChat = true
    }

    /// Replaces the originally-selected span in the note body with the
    /// rewritten text. Falls back to a contains match if the span has
    /// drifted (e.g. the user kept editing while the sheet was open).
    private func applyRewrite(_ rewritten: String, at range: NSRange, original: String) {
        let ns = noteBody as NSString
        if NSMaxRange(range) <= ns.length, ns.substring(with: range) == original {
            noteBody = ns.replacingCharacters(in: range, with: rewritten)
            return
        }
        if let r = noteBody.range(of: original) {
            noteBody.replaceSubrange(r, with: rewritten)
        }
    }

    private var noteAsSource: SourceItem {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let label = trimmed.isEmpty ? original.displayTitle : trimmed
        return SourceItem(type: .note, label: label, content: combined)
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
    let namespace: Namespace.ID
    let action: () -> Void
    var onDelete: (() -> Void)? = nil
    // Selected-pill chrome diverges by scheme so light mode reads as an
    // iOS-native floating capsule (white fill on cream, hairline stroke,
    // subtle drop shadow) rather than a translucent dark blob. Dark mode
    // keeps the existing translucent ink overlay.
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.app(size: 14, weight: isSelected ? .semibold : .regular))
                .foregroundColor(isSelected ? AppText.primary : AppText.secondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    ZStack {
                        if isSelected {
                            Capsule(style: .continuous)
                                .fill(colorScheme == .dark
                                      ? AnyShapeStyle(AppInk.solid(0.14))
                                      : AnyShapeStyle(AppBackground.surface))
                                .overlay(
                                    Capsule(style: .continuous)
                                        .stroke(AppInk.solid(colorScheme == .dark ? 0.22 : 0.05), lineWidth: 0.5)
                                )
                                .shadow(
                                    color: AppInk.solid(colorScheme == .dark ? 0 : 0.08),
                                    radius: 6, x: 0, y: 2
                                )
                                .shadow(
                                    color: AppInk.solid(colorScheme == .dark ? 0 : 0.04),
                                    radius: 1, x: 0, y: 0.5
                                )
                                .matchedGeometryEffect(id: "filterChipPill", in: namespace)
                        }
                    }
                )
                .contentShape(Capsule(style: .continuous))
        }
        .buttonStyle(.plain)
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
    /// Custom navigation destination for a tapped note. When set, takes
    /// precedence over the default NoteEditorPage / DrawingCanvasView
    /// branch. Minimal 1's home page uses this to push its own per-note
    /// detail (with generation tabs) while keeping the row list,
    /// pinned section, swipe actions, filter chips, and search overlay
    /// behaviour intact.
    var detailFor: ((Note) -> AnyView)? = nil
    @EnvironmentObject private var recording: RecordingController
    @EnvironmentObject private var chrome: ChromeController
    @Environment(\.scenePhase) private var scenePhase
    @State private var notes: [Note] = []
    @State private var editingNote: Note? = nil
    @State private var saveGeneration: Int = 0
    @State private var hasPendingSave: Bool = false
    @State private var localSearchText = ""
    @State private var localShowSearch = false
    @State private var selectedFilter: String? = nil
    /// Note IDs that carry more than one generation in MinimalGenStore.
    /// Drives the leading thumbnail swap to `DocStackThumb` so the row
    /// graphic communicates "multiple docs attached" at a glance. Stays
    /// empty for users who have never created a Minimal-mode generation.
    @State private var multiGenNoteIds: Set<UUID> = []
    @State private var customTags: [String] = {
        let defaults = UserDefaults.standard
        var tags = defaults.stringArray(forKey: "note_custom_tags") ?? []
        // One-shot scrub of legacy user tags that were retired from the
        // default set; gated by a versioned flag so the user can re-create
        // a tag with the same name later without it being eaten again.
        let migrationKey = "note_removed_deprecated_tags_v1"
        if !defaults.bool(forKey: migrationKey) {
            let removed: Set<String> = ["Love", "New"]
            tags.removeAll { removed.contains($0) }
            defaults.set(tags, forKey: "note_custom_tags")
            defaults.set(true, forKey: migrationKey)
        }
        return tags
    }()
    @State private var showAddTag = false
    @State private var newTagName = ""
    @State private var reloadTask: Task<Void, Never>? = nil
    @State private var titlingTask: Task<Void, Never>? = nil
    @FocusState private var searchFocused: Bool
    @Namespace private var filterChipNS

    private static let filterChipSpring = Animation.spring(response: 0.34, dampingFraction: 0.86)

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
            saveRecordedTranscript(transcript)
        }
        recording.showingSheet = true
    }

    private func saveRecordedTranscript(_ transcript: String) {
        let capturedAt = Date()
        // Persist immediately so a background/kill during title generation
        // doesn't lose the transcript. Title is patched in afterwards.
        var note = Note()
        note.body = transcript
        note.updatedAt = capturedAt
        notes.append(note)
        NotesStore.saveInBackground(notes)
        let noteID = note.id
        Task {
            guard let body = await AIService.prependTitleIfMissing(to: transcript) else { return }
            await MainActor.run {
                guard let idx = notes.firstIndex(where: { $0.id == noteID }) else { return }
                notes[idx].body = body
                NotesStore.saveInBackground(notes)
            }
        }
    }

    private let builtinTags = ["Talk Copenhagen", "Talk London", "Article"]
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
        // No withAnimation: the swipeActions destructive button already owns
        // the row-out animation. Driving a second animation from the data
        // side made the red tint linger as the row collapsed.
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
        // No withAnimation: the system swipe-close already animates. A second
        // data-side animation just delayed the visible result of the tap.
        notes[idx].isPinned.toggle()
        scheduleSave()
    }

    /// One-shot pass that retroactively titles older notes whose body is a
    /// single line (or a long opening sentence) so the list shows a 3-word
    /// summary instead of the first transcript line. New notes can land
    /// here from onboarding or from a pre-fix install; the editor's
    /// `persistIfNeeded` will not run until the user opens them, so this is
    /// the only way to clean up the existing list without manual taps.
    private func retroTitleUntitledNotes() {
        titlingTask?.cancel()
        // Most-recent first so the top of the list (what the user is looking
        // at) lights up before the long tail.
        let snapshot = notes.sorted { $0.updatedAt > $1.updatedAt }
        titlingTask = Task {
            for note in snapshot where Self.needsTitle(note) {
                if Task.isCancelled { return }
                let originalBody = note.body
                guard let updatedBody = await AIService.prependTitleIfMissing(to: originalBody) else { continue }
                if Task.isCancelled { return }
                await MainActor.run {
                    guard let idx = notes.firstIndex(where: { $0.id == note.id }) else { return }
                    // Skip if the body changed since we sampled it (user edit
                    // landed) or the note is currently being edited — the
                    // editor owns the body until it dismisses.
                    if notes[idx].body != originalBody { return }
                    if editingNote?.id == note.id { return }
                    notes[idx].body = updatedBody
                    notes[idx].updatedAt = note.updatedAt
                    scheduleSave()
                }
            }
        }
    }

    /// Heuristic for "this note has no title yet": text notes whose first
    /// line spans more than four words look like prose, not a title. Counts
    /// words instead of characters so existing 3-word titles ("Plant care
    /// onboarding") are recognised regardless of length, while voice
    /// transcripts ("Hey so that's what I wanted to talk about") still
    /// qualify even when they happen to be short enough to fit one row.
    private static func needsTitle(_ note: Note) -> Bool {
        guard note.kind == .text else { return false }
        let body = note.body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return false }
        let firstLine = body.split(whereSeparator: \.isNewline).first.map(String.init) ?? body
        let wordCount = firstLine.split(whereSeparator: \.isWhitespace).count
        return wordCount > 6
    }

    private func scheduleSave() {
        saveGeneration &+= 1
        let gen = saveGeneration
        let snapshot = notes
        hasPendingSave = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [self] in
            guard saveGeneration == gen else { return }
            NotesStore.saveInBackground(snapshot)
            hasPendingSave = false
        }
    }

    private func flushSave() {
        saveGeneration &+= 1  // invalidate any pending debounced save
        hasPendingSave = false
        NotesStore.saveInBackground(notes)
    }

    /// Recomputes the set of note IDs that have more than one attached
    /// generation. Called from `.task` on first appear and from the
    /// MinimalGenStore change notification so the thumbnail flips the
    /// moment a second generation is added or the last one is removed.
    private func reloadMultiGenIds() {
        let counts = MinimalGenStore.load().reduce(into: [UUID: Int]()) { acc, gen in
            acc[gen.noteId, default: 0] += 1
        }
        let next = Set(counts.compactMap { $0.value > 1 ? $0.key : nil })
        if next != multiGenNoteIds { multiGenNoteIds = next }
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
                    subtitle: emptySubtitle
                )
            } else if !emptyTitle.isEmpty {
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
            // UITableView adjusts contentInset for the keyboard at the UIKit
            // level, bypassing SwiftUI's .transaction { $0.animation = nil }.
            // Without this, the list content visibly slides during the keyboard
            // dismiss animation — visible through the fading SearchOverlay.
            .ignoresSafeArea(.keyboard)
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
            NoteListRow(note: note, hasMultipleGenerations: multiGenNoteIds.contains(note.id))
        }
        .buttonStyle(.plain)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
        .listRowSeparator(.visible)
        .listRowSeparatorTint(AppInk.solid(0.06))
        .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
        .alignmentGuide(.listRowSeparatorTrailing) { d in d[.trailing] - 20 }
        // allowsFullSwipe: false — a full-swipe-to-delete on iOS is a single
        // gesture with no second confirmation, so a brushed-against thumb
        // permanently destroys a note. Requiring an explicit tap on the
        // revealed Delete button after the swipe gives the user a moment
        // to see what they're about to delete.
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
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
            // Plain Color — UIKit's swipeActions background expects a UIColor.
            // A LinearGradient gets bridged as an overlay layer that lingers
            // across the row as the destructive cell expands, reading as a
            // long red strip during the wipe.
            .tint(Color(red: 0.34, green: 0.04, blue: 0.04))
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
            ForEach(allTags, id: \.self) { tag in
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
        ZStack(alignment: .top) {
            AmbientBackground()

            VStack(spacing: 0) {
                // In Simple mode (embedded) the SimpleHomePage header owns
                // both the search and profile pills, so this view skips its
                // own top bar entirely.
                if !embedded {
                    InlineTopBar(title: "Notes") {
                        TopBarPill {
                            if onProfileTap == nil {
                                // Classic mode: pencil + search in one pill
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
                                withAnimation(AppAnimation.standard) {
                                    showSearch.toggle()
                                    if !showSearch { searchText = "" }
                                }
                            }
                            .accessibilityLabel(showSearch ? "Close search" : "Search")

                            // Simple mode: search and profile merged into one pill
                            if let onProfileTap {
                                TopBarPillDivider()
                                TopBarPillButton(systemImage: "person.crop.circle") {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    onProfileTap()
                                }
                                .accessibilityLabel("Profile")
                            }
                        }
                    }
                }

                // Filter chips bar stays in the layout at all times so the
                // notes list position never shifts — only opacity toggles to
                // hide it behind the search overlay. VoiceOver is silenced
                // while search is active via accessibilityHidden.
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(
                                label: "All",
                                isSelected: selectedFilter == nil,
                                isDeletable: false,
                                namespace: filterChipNS
                            ) {
                                withAnimation(Self.filterChipSpring) { selectedFilter = nil }
                            }
                            ForEach(allTags, id: \.self) { tag in
                                FilterChip(
                                    label: tag,
                                    isSelected: selectedFilter == tag,
                                    isDeletable: customTags.contains(tag),
                                    namespace: filterChipNS,
                                    action: {
                                        withAnimation(Self.filterChipSpring) {
                                            selectedFilter = selectedFilter == tag ? nil : tag
                                        }
                                    },
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
                    .opacity(showSearch ? 0 : 1)
                    .accessibilityHidden(showSearch)
                    .animation(AppAnimation.standard, value: showSearch)

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
                .ignoresSafeArea(.keyboard)
                .transaction { $0.animation = nil }

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
                            // No "Start typing" prompt — the search field's
                            // own placeholder already invites the user to
                            // type. When there's no query the list just
                            // mirrors the regular notes view; only show
                            // an empty hint once a query is actively
                            // returning zero matches.
                            emptyTitle: searchText.isEmpty ? "" : "No results",
                            emptySubtitle: nil
                        )
                    }
                    .transition(.opacity)
                }
            }
            // Prevent the ZStack from resizing when the keyboard appears/
            // disappears. Without this the container re-centres its children
            // as it gains height, which animates the notes list up from below
            // during the search-close fade — the bug that survived all prior
            // attempts because they only fixed the inner VStack, not the ZStack.
            .ignoresSafeArea(.keyboard)
            .toolbar(.hidden, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationDestination(item: $editingNote) { note in
                if let detailFor {
                    // Host-provided destination — Minimal 1 surfaces its
                    // own per-note detail page with generation tabs.
                    detailFor(note)
                } else if note.kind == .drawing {
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
                            } else {
                                notes.insert(saved, at: 0)
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
            .task {
                notes = await NotesStore.loadAsync()
                reloadMultiGenIds()
                retroTitleUntitledNotes()
            }
        .onReceive(NotificationCenter.default.publisher(for: .minimalGenStoreDidChange)) { _ in
            reloadMultiGenIds()
        }
        .onReceive(NotificationCenter.default.publisher(for: .notesStoreDidChange)) { _ in
            // Skip if this view has a debounced save in flight; the disk may be
            // stale relative to in-memory edits and reloading would clobber them.
            guard !hasPendingSave else { return }
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
        .onChange(of: editingNote) { _, note in
            // Guarantee the floating mic button reappears whenever the user
            // navigates back from a note — onDisappear on the destination can
            // race with SwiftUI transitions and leave hideTabBar stuck as true.
            if note == nil { chrome.hideTabBar = false }
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
            .toolbarBackground(AppBackground.primary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(AppText.secondary)
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

// MARK: - Selectable Note Editor

/// UITextView-backed body editor that injects Magic + Chat as the first
/// items in the iOS selection edit menu — the Canva-style floating
/// bubble we tried first collided with the system Cut/Copy/Paste
/// callout for the same screen space and was never reliably visible.
/// Routing through `editMenuForTextIn` lands the actions in the menu
/// the user already opens to operate on a selection, which is exactly
/// what "first options on selection" means in iOS terms.
private struct SelectableNoteEditor: UIViewRepresentable {
    @Binding var text: String
    @Binding var isFocused: Bool
    let bottomInset: CGFloat
    let onMagicSelection: (String, NSRange) -> Void
    let onChatSelection: (String, NSRange) -> Void

    private static let font = UIFont.systemFont(ofSize: 18)
    private static let lineSpacing: CGFloat = 8
    // 18pt = 8 lineSpacing + 10 extra, so the gap between paragraphs
    // reads as a clear 10pt break beyond the within-paragraph line
    // gap. UITextView honours `paragraphSpacing` reliably (SwiftUI's
    // Text does not, which is why the body readers use VStack instead).
    private static let paragraphSpacing: CGFloat = 18

    private static func attributes() -> [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineSpacing = Self.lineSpacing
        paragraph.paragraphSpacing = Self.paragraphSpacing
        return [
            .font: Self.font,
            .foregroundColor: UIColor(AppText.primary),
            .paragraphStyle: paragraph
        ]
    }

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.delegate = context.coordinator
        tv.backgroundColor = .clear
        tv.font = Self.font
        tv.textColor = UIColor(AppText.primary)
        tv.tintColor = UIColor(AppText.primary)
        tv.isScrollEnabled = true
        tv.alwaysBounceVertical = true
        tv.textContainer.lineFragmentPadding = 0
        // Matches the original TextEditor's combined outer padding (16) +
        // TextEditor's internal left inset (~8), so the body text lines up
        // with the "Start typing…" placeholder rendered alongside this view.
        tv.textContainerInset = UIEdgeInsets(top: 8, left: 24, bottom: bottomInset, right: 24)
        tv.typingAttributes = Self.attributes()
        tv.attributedText = NSAttributedString(string: text, attributes: Self.attributes())
        return tv
    }

    func updateUIView(_ tv: UITextView, context: Context) {
        // Keep the coordinator's snapshot of the callbacks fresh — the
        // SwiftUI view is rebuilt on every parent state change and the
        // closures capture `self` (i.e. the NoteEditorPage) by value, so
        // an old coordinator-held closure would point at a stale `self`
        // and the trigger funcs would mutate a copy that goes nowhere.
        context.coordinator.parent = self

        if tv.text != text {
            let sel = tv.selectedRange
            context.coordinator.suppressEcho = true
            tv.attributedText = NSAttributedString(string: text, attributes: Self.attributes())
            tv.typingAttributes = Self.attributes()
            let len = (tv.text as NSString).length
            tv.selectedRange = NSRange(
                location: min(sel.location, len),
                length: min(sel.length, max(0, len - sel.location))
            )
            context.coordinator.suppressEcho = false
        }
        if tv.textContainerInset.bottom != bottomInset {
            tv.textContainerInset.bottom = bottomInset
        }
        // Only queue a focus-change block when isFocused actually transitions.
        // Each block is stamped with a generation; if a newer updateUIView call has
        // already superseded it, the block is a no-op. This prevents two failure modes:
        // (1) a stale block queued from an earlier unfocused render firing after the user
        //     taps, calling resignFirstResponder() and then a later block calling
        //     becomeFirstResponder() — resetting the cursor to position 0.
        // (2) animation-frame renders (from .animation(value: focus)) queuing one block
        //     per frame where coordinator.parent may not yet reflect the latest focus.
        let currentFocused = isFocused
        if currentFocused != context.coordinator.lastReportedFocused {
            context.coordinator.lastReportedFocused = currentFocused
            context.coordinator.focusGeneration += 1
            let gen = context.coordinator.focusGeneration
            let coordinator = context.coordinator
            DispatchQueue.main.async {
                guard coordinator.focusGeneration == gen else { return }
                if currentFocused && !tv.isFirstResponder {
                    tv.becomeFirstResponder()
                } else if !currentFocused && tv.isFirstResponder {
                    tv.resignFirstResponder()
                }
            }
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: SelectableNoteEditor
        var suppressEcho = false
        var lastReportedFocused: Bool = false
        var focusGeneration: Int = 0
        init(_ parent: SelectableNoteEditor) { self.parent = parent }

        func textViewDidChange(_ tv: UITextView) {
            guard !suppressEcho else { return }
            let new = tv.text ?? ""
            if parent.text != new { parent.text = new }
        }

        func textViewDidBeginEditing(_ tv: UITextView) {
            if !parent.isFocused { parent.isFocused = true }
        }

        func textViewDidEndEditing(_ tv: UITextView) {
            if parent.isFocused { parent.isFocused = false }
        }

        /// Prepends Magic + Chat to the iOS edit menu whenever the user
        /// has a non-empty selection so those two actions sit in front
        /// of Cut/Copy/Paste/AutoFill — the literal "first options" the
        /// brief asked for. Returning the suggested actions unchanged
        /// for a zero-length range keeps the caret menu (Paste / Select
        /// All / etc.) intact.
        func textView(
            _ textView: UITextView,
            editMenuForTextIn range: NSRange,
            suggestedActions: [UIMenuElement]
        ) -> UIMenu? {
            guard range.length > 0 else { return UIMenu(children: suggestedActions) }
            let ns = (textView.text ?? "") as NSString
            guard range.location >= 0, NSMaxRange(range) <= ns.length else {
                return UIMenu(children: suggestedActions)
            }
            let snippet = ns.substring(with: range)
            let trimmed = snippet.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return UIMenu(children: suggestedActions) }

            let magic = UIAction(
                title: "Magic",
                image: UIImage(systemName: "wand.and.stars")
            ) { [weak self] _ in
                self?.parent.onMagicSelection(snippet, range)
            }
            let chat = UIAction(
                title: "Chat",
                image: UIImage(systemName: "message")
            ) { [weak self] _ in
                self?.parent.onChatSelection(snippet, range)
            }

            // `.displayInline` keeps the two custom actions on the same
            // pill as Cut/Copy/Paste rather than nesting them behind a
            // disclosure arrow.
            let customGroup = UIMenu(title: "", options: .displayInline, children: [magic, chat])
            return UIMenu(children: [customGroup] + suggestedActions)
        }
    }
}

// MARK: - Selection Rewrite Sheet

/// Sheet that fires when the user taps the magic-pen on a highlighted
/// span. Shows the original, lets the user pick a preset or type a
/// custom instruction, calls `AITransformService.transform`, then
/// surfaces the rewrite with Accept/Discard so a botched generation
/// doesn't overwrite the note silently.
private struct SelectionRewriteSheet: View {
    let originalText: String
    let onApply: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var instruction: String = ""
    @State private var rewritten: String? = nil
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    private let presets: [(label: String, instruction: String)] = [
        ("Improve", "Improve the writing — make it clearer and more polished without changing the meaning."),
        ("Shorter", "Tighten this — cut filler and keep the key idea in fewer words."),
        ("Punchier", "Rewrite this with more energy and a stronger opening."),
        ("Fix grammar", "Fix grammar, spelling, and punctuation. Keep the wording and tone otherwise unchanged.")
    ]

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground.primary.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        sectionLabel("Selected text")
                        Text(originalText)
                            .font(.appReadingBody)
                            .foregroundColor(AppText.primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                    .fill(AppBackground.surface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                    .stroke(AppInk.solid(0.08), lineWidth: 0.5)
                            )

                        if rewritten == nil {
                            sectionLabel("Rewrite as…")
                            FlowLayout(spacing: 8) {
                                ForEach(presets, id: \.label) { preset in
                                    presetChip(label: preset.label) {
                                        run(instruction: preset.instruction)
                                    }
                                }
                            }

                            sectionLabel("Or describe the change")
                            TextField(
                                "",
                                text: $instruction,
                                prompt: Text("e.g. make it sound more curious").foregroundColor(AppInk.solid(0.30)),
                                axis: .vertical
                            )
                            .lineLimit(2...5)
                            .font(.appBody)
                            .foregroundColor(AppText.primary)
                            .tint(AppText.primary)
                            .padding(14)
                            .background(
                                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                    .fill(AppBackground.surface)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                    .stroke(AppInk.solid(0.08), lineWidth: 0.5)
                            )

                            Button {
                                let trimmed = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
                                guard !trimmed.isEmpty else { return }
                                run(instruction: trimmed)
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "wand.and.stars")
                                    Text(isLoading ? "Rewriting…" : "Rewrite")
                                }
                                .font(.app(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(canSubmit ? BrandColor.ctaPrimary : AppBackground.ctaDisabled)
                                )
                            }
                            .buttonStyle(.plain)
                            .disabled(!canSubmit || isLoading)
                        } else if let result = rewritten {
                            sectionLabel("Rewrite")
                            Text(result)
                                .font(.appReadingBody)
                                .foregroundColor(AppText.primary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                        .fill(AppBackground.surface)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                        .stroke(AppInk.solid(0.18), lineWidth: 0.5)
                                )

                            HStack(spacing: 10) {
                                Button {
                                    rewritten = nil
                                    instruction = ""
                                } label: {
                                    Text("Try again")
                                        .font(.app(size: 15, weight: .medium))
                                        .foregroundColor(AppText.primary)
                                        .frame(maxWidth: .infinity, minHeight: 44)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .fill(AppBackground.surface)
                                        )
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(AppInk.solid(0.10), lineWidth: 0.5)
                                        )
                                }
                                .buttonStyle(.plain)

                                Button {
                                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                                    onApply(result)
                                    dismiss()
                                } label: {
                                    Text("Replace selection")
                                        .font(.app(size: 15, weight: .semibold))
                                        .foregroundColor(.white)
                                        .frame(maxWidth: .infinity, minHeight: 44)
                                        .background(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .fill(BrandColor.ctaPrimary)
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .font(.app(size: 13))
                                .foregroundColor(Color.red.opacity(0.85))
                                .padding(.top, 4)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Rewrite")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(AppText.primary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(AppBackground.primary)
    }

    private var canSubmit: Bool {
        !instruction.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.app(size: 12, weight: .semibold))
            .foregroundColor(AppText.tertiary)
            .tracking(0.4)
    }

    private func presetChip(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.app(size: 14, weight: .medium))
                .foregroundColor(AppText.primary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(
                    Capsule(style: .continuous)
                        .fill(AppBackground.surface)
                )
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(AppInk.solid(0.10), lineWidth: 0.5)
                )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    private func run(instruction value: String) {
        isLoading = true
        errorMessage = nil
        Task {
            let outcome = await AITransformService.transform(text: originalText, instruction: value)
            await MainActor.run {
                isLoading = false
                switch outcome {
                case .success(let text):
                    rewritten = text
                case .failure(let err):
                    errorMessage = Self.message(for: err)
                }
            }
        }
    }

    private static func message(for error: APICallError) -> String {
        switch error {
        case .http(401, _):
            return AITransformService.isKeyConfigured
                ? "Your API key was rejected. Update it in Settings and try again."
                : "Add your Claude API key in Settings to use rewrite."
        case .http(_, let body) where !body.isEmpty:
            return body
        case .http:
            return "The rewrite request failed. Try again."
        case .network(let detail):
            return detail.isEmpty ? "Network error. Try again." : detail
        case .decode:
            return "Couldn't read the rewrite response."
        case .empty:
            return "The rewrite came back empty. Try again."
        case .signupRequired:
            return "Sign in with Apple to use rewrite."
        }
    }
}

/// Minimal flow layout for wrapping the preset chips — SwiftUI's
/// built-in HStack doesn't wrap, and pulling in a third-party layout
/// for one row of chips is overkill.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var lineWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if lineWidth + size.width > maxWidth && lineWidth > 0 {
                totalHeight += lineHeight + spacing
                lineWidth = 0
                lineHeight = 0
            }
            lineWidth += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        totalHeight += lineHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : lineWidth, height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var lineHeight: CGFloat = 0
        let maxX = bounds.maxX
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxX && x > bounds.minX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), anchor: .topLeading, proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

#Preview {
    NotesView()
}
