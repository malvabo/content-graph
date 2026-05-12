import SwiftUI
import Speech
import AVFoundation
import UIKit

// MARK: - Voice Dictation

@MainActor
private final class NoteDictation: ObservableObject {
    @Published var transcript: String = ""
    @Published var isRecording: Bool = false
    @Published var permissionDenied: Bool = false
    @Published var audioLevel: Float = 0.0  // RMS, ~0...1

    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private let recognizer = SFSpeechRecognizer(locale: Locale.current)
        ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))

    func start() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                if status == .authorized {
                    self.transcript = ""
                    self.audioLevel = 0
                    self.startEngine()
                } else {
                    self.permissionDenied = true
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
        audioEngine.stop()
        request?.endAudio()
        if audioEngine.inputNode.numberOfInputs > 0 {
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isRecording = false
        audioLevel = 0
    }

    private func startEngine() {
        task?.cancel()
        task = nil

        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.record, mode: .measurement, options: .duckOthers)
        try? session.setActive(true, options: .notifyOthersOnDeactivation)

        request = SFSpeechAudioBufferRecognitionRequest()
        guard let req = request, let rec = recognizer else { return }
        req.shouldReportPartialResults = true

        task = rec.recognitionTask(with: req) { [weak self] result, error in
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
            DispatchQueue.main.async { [weak self] in
                self?.audioLevel = rms
            }
        }

        audioEngine.prepare()
        if (try? audioEngine.start()) != nil {
            isRecording = true
        }
    }
}

// MARK: - Storage

struct NotesStore {
    static let key = "notes_v1"

    static func load() -> [Note] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        let raw = (try? JSONDecoder().decode([Note].self, from: data)) ?? []
        return raw.map(Note.migrated)
    }

    static func save(_ notes: [Note]) {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: key)
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
}

// MARK: - Row

private struct NoteListRow: View {
    let note: Note

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(note.displayTitle)
                .font(.app(size: 20, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .lineLimit(1)

            HStack(spacing: 6) {
                Text(RowDate.string(from: note.updatedAt))
                    .font(.app(size: 12))
                    .foregroundColor(Color.white.opacity(0.35))
                if !note.preview.isEmpty {
                    Text("\u{00B7}")
                        .font(.app(size: 12))
                        .foregroundColor(Color.white.opacity(0.22))
                    Text(note.preview)
                        .font(.app(size: 12))
                        .foregroundColor(Color.white.opacity(0.40))
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .contentShape(Rectangle())
    }
}

// MARK: - Waveform

private struct Waveform: View {
    let level: Float

    private let barCount = 14
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(spacing: 3) {
                ForEach(0..<barCount, id: \.self) { i in
                    Capsule()
                        .fill(amber)
                        .frame(width: 3, height: barHeight(index: i, time: t))
                }
            }
        }
        .frame(height: 32)
        .accessibilityHidden(true)
    }

    private func barHeight(index: Int, time: Double) -> CGFloat {
        let phase = time * 5.0 + Double(index) * 0.55
        let wave = (sin(phase) + 1.0) / 2.0
        // Amplify low RMS values so quiet speech still moves the bars.
        let amplified = min(1.6, pow(Double(level), 0.35) * 3.0)
        let scaled = wave * amplified
        return CGFloat(max(4.0, 4.0 + scaled * 22.0))
    }
}

// MARK: - Dictation Controls

private struct DictationControls: View {
    @ObservedObject var dictation: NoteDictation
    let onStart: () -> Void
    let onCancel: () -> Void
    let onConfirm: () -> Void

    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)
    private let stroke = Color.white.opacity(0.15)
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
                .foregroundColor(amber)
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
                    .foregroundColor(Color.white.opacity(0.65))
                    .frame(width: 44, height: 44)
                    .background(glassCircle)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel dictation")

            Waveform(level: dictation.audioLevel)
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

private struct AudioBlobsView: View {
    let level: Float
    let isRecording: Bool
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 20.0)) { ctx in
            HStack(spacing: 14) {
                ForEach(0..<4, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(amber)
                        .frame(width: 62, height: blobHeight(index: i, time: ctx.date.timeIntervalSinceReferenceDate))
                }
            }
        }
        .frame(height: 120)
    }

    private func blobHeight(index: Int, time: Double) -> CGFloat {
        guard isRecording else { return 54 }
        let phases = [0.0, 0.9, 1.8, 2.7]
        let wave = (sin(time * 4.0 + phases[index]) + 1.0) / 2.0
        let amp = min(1.0, Double(level) * 3.5)
        return 48 + CGFloat(wave * 0.35 + amp * 0.65) * 56
    }
}

private struct NoteVoiceSheet: View {
    let onSave: (Note) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var dictation = NoteDictation()
    @State private var selectedDetent: PresentationDetent = .medium
    @State private var seconds = 0
    @State private var accumulatedTranscript = ""
    @State private var isPaused = false

    private let clock = Timer.publish(every: 1, on: .main, in: .common).autoconnect()
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)
    private let sheetBg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var timeLabel: String {
        String(format: "%02d:%02d", seconds / 60, seconds % 60)
    }

    private var fullTranscript: String {
        let cur = dictation.transcript
        guard !accumulatedTranscript.isEmpty else { return cur }
        guard !cur.isEmpty else { return accumulatedTranscript }
        return accumulatedTranscript + " " + cur
    }

    var body: some View {
        ZStack {
            sheetBg.ignoresSafeArea()

            if selectedDetent == .large {
                NoteComposerSheet(
                    note: {
                        var n = Note()
                        n.body = accumulatedTranscript
                        return n
                    }(),
                    isNew: true,
                    onSave: onSave,
                    onDelete: nil
                )
                .transition(.opacity)
            } else {
                voiceUI
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.22), value: selectedDetent == .large)
        .presentationDetents([.medium, .large], selection: $selectedDetent)
        .presentationDragIndicator(.visible)
        .presentationBackground(sheetBg)
        .presentationCornerRadius(22)
        .task { dictation.start() }
        .onReceive(clock) { _ in
            if dictation.isRecording { seconds += 1 }
        }
        .onChange(of: selectedDetent) { _, newDetent in
            if newDetent == .large {
                accumulatedTranscript = fullTranscript
                dictation.stop()
            }
        }
    }

    private var voiceUI: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Text("Swipe up to add notes")
                    .font(.subheadline)
                    .foregroundColor(Color.white.opacity(0.35))
                Spacer()
                Button {
                    dictation.stop()
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.55))
                        .frame(width: 30, height: 30)
                        .background(Color.white.opacity(0.12))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)

            Spacer()

            AudioBlobsView(level: dictation.audioLevel, isRecording: dictation.isRecording)

            Spacer()

            Text(timeLabel)
                .font(.system(size: 44, weight: .bold, design: .monospaced))
                .foregroundColor(.white)

            Spacer()

            HStack(spacing: 12) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    if isPaused {
                        dictation.start()
                        isPaused = false
                    } else {
                        accumulatedTranscript = fullTranscript
                        dictation.stop()
                        isPaused = true
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: isPaused ? "play.fill" : "pause.fill")
                            .font(.system(size: 15, weight: .semibold))
                        Text(isPaused ? "Resume" : "Pause")
                            .font(.system(size: 17, weight: .semibold))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 56)
                    .background(Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    withAnimation { selectedDetent = .large }
                } label: {
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
        }
    }
}

// MARK: - Composer Sheet

private struct NoteComposerSheet: View {
    let original: Note
    let isNew: Bool
    let onSave: (Note) -> Void
    let onDelete: (() -> Void)?

    @State private var draft: Note
    @State private var bodyBeforeDictation: String = ""
    @State private var showDiscardAlert: Bool = false
    @StateObject private var dictation = NoteDictation()
    @Environment(\.dismiss) private var dismiss
    @FocusState private var bodyFocused: Bool

    init(note: Note, isNew: Bool, onSave: @escaping (Note) -> Void, onDelete: (() -> Void)?) {
        let migrated = Note.migrated(note)
        self.original = migrated
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
        self._draft = State(initialValue: migrated)
    }

    private var canSave: Bool { !draft.isEmpty }
    private var isDirty: Bool { draft.body != original.body }

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
                        dismiss()
                    }
                } label: {
                    Text("Cancel")
                        .font(.app(size: 16))
                        .foregroundColor(Color.white.opacity(0.50))
                }
                .buttonStyle(.plain)

                Spacer()

                Text(isNew ? "New Note" : "Edit Note")
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(.white)

                Spacer()

                Button {
                    dictation.stop()
                    var saved = draft
                    saved.updatedAt = Date()
                    onSave(saved)
                    dismiss()
                } label: {
                    Text("Done")
                        .font(.app(size: 16, weight: .semibold))
                        .foregroundColor(canSave ? .white : Color.white.opacity(0.25))
                }
                .buttonStyle(.plain)
                .disabled(!canSave)
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            ZStack(alignment: .bottomTrailing) {
                ZStack(alignment: .topLeading) {
                    if draft.body.isEmpty {
                        Text("Start typing\u{2026}")
                            .font(.app(size: 17))
                            .foregroundColor(Color.white.opacity(0.22))
                            .padding(.horizontal, 24)
                            .padding(.top, 20)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $draft.body)
                        .font(.app(size: 17))
                        .foregroundColor(Color.white.opacity(0.92))
                        .scrollContentBackground(.hidden)
                        .background(Color.clear)
                        .tint(.white)
                        .padding(.horizontal, 16)
                        .padding(.top, 12)
                        .contentMargins(.bottom, 84, for: .scrollContent)
                        .focused($bodyFocused)
                }

                DictationControls(
                    dictation: dictation,
                    onStart: {
                        bodyBeforeDictation = draft.body
                        dictation.start()
                    },
                    onCancel: {
                        dictation.cancel()
                        draft.body = bodyBeforeDictation
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
                    draft.body = trimmed
                } else {
                    let needsSeparator = !bodyBeforeDictation.hasSuffix("\n") && !bodyBeforeDictation.hasSuffix(" ")
                    draft.body = bodyBeforeDictation + (needsSeparator ? " " : "") + trimmed
                }
            }
            .alert("Microphone access denied", isPresented: $dictation.permissionDenied) {
                Button("Open Settings") { openSettings() }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Enable Microphone and Speech Recognition in Settings to dictate notes.")
            }

            if let del = onDelete, !isNew {
                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 0.5)
                Button {
                    dictation.stop()
                    del()
                    dismiss()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "trash")
                            .font(.app(size: 14))
                        Text("Delete Note")
                            .font(.app(size: 15, weight: .medium))
                    }
                    .foregroundColor(Color.red.opacity(0.75))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                }
                .buttonStyle(.plain)
            }
        }
        .alert("Discard changes?", isPresented: $showDiscardAlert) {
            Button("Keep Editing", role: .cancel) {}
            Button("Discard", role: .destructive) {
                dictation.stop()
                dismiss()
            }
        }
        .task {
            if isNew { bodyFocused = true }
        }
        .interactiveDismissDisabled(isDirty)
    }
}

// MARK: - Sheet Routing

private enum NoteSheet: Identifiable {
    case new
    case edit(Note)

    var id: String {
        switch self {
        case .new: return "new"
        case .edit(let n): return "edit-\(n.id.uuidString)"
        }
    }
}

// MARK: - Notes View

struct NotesView: View {
    @State private var notes: [Note] = []
    @State private var sheet: NoteSheet? = nil
    @State private var searchText = ""

    private var sortedNotes: [Note] {
        notes.sorted { $0.updatedAt > $1.updatedAt }
    }

    private var filteredNotes: [Note] {
        guard !searchText.isEmpty else { return sortedNotes }
        let q = searchText.lowercased()
        return sortedNotes.filter {
            $0.displayTitle.lowercased().contains(q) || $0.body.lowercased().contains(q)
        }
    }

    private func delete(_ note: Note) {
        notes.removeAll { $0.id == note.id }
        NotesStore.save(notes)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

                if filteredNotes.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: searchText.isEmpty ? "note.text" : "magnifyingglass")
                            .font(.system(size: 36))
                            .foregroundColor(Color.white.opacity(0.20))
                        Text(searchText.isEmpty ? "No notes yet" : "No results")
                            .foregroundColor(Color.white.opacity(0.30))
                        if searchText.isEmpty {
                            Text("Tap the pencil to write your first note")
                                .font(.footnote)
                                .foregroundColor(Color.white.opacity(0.20))
                        }
                    }
                } else {
                    List {
                        ForEach(filteredNotes) { note in
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                sheet = .edit(note)
                            } label: {
                                NoteListRow(note: note)
                            }
                            .buttonStyle(.plain)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Color.white.opacity(0.06))
                            .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
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
                    .background(Color.clear)
                }
            }
            .navigationTitle("Notes")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .searchable(text: $searchText, prompt: "Search notes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        sheet = .new
                    } label: {
                        Image(systemName: "square.and.pencil")
                    }
                    .accessibilityLabel("New note")
                }
            }
        }
        .onAppear { notes = NotesStore.load() }
        .sheet(item: $sheet) { which in
            switch which {
            case .new:
                NoteVoiceSheet(onSave: { saved in
                    notes.append(saved)
                    NotesStore.save(notes)
                })

            case .edit(let note):
                NoteComposerSheet(
                    note: note,
                    isNew: false,
                    onSave: { saved in
                        if let idx = notes.firstIndex(where: { $0.id == saved.id }) {
                            notes[idx] = saved
                        }
                        NotesStore.save(notes)
                    },
                    onDelete: {
                        delete(note)
                    }
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(22)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
            }
        }
    }
}

#Preview {
    NotesView()
}
