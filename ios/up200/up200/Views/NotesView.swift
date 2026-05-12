import SwiftUI
import Speech
import AVFoundation

// MARK: - Voice Dictation

@MainActor
private final class NoteDictation: ObservableObject {
    @Published var transcript: String = ""
    @Published var isRecording: Bool = false
    @Published var permissionDenied: Bool = false

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
                    self.startEngine()
                } else {
                    self.permissionDenied = true
                }
            }
        }
    }

    func stop() {
        audioEngine.stop()
        request?.endAudio()
        if audioEngine.inputNode.numberOfInputs > 0 {
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        isRecording = false
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
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            req.append(buffer)
        }

        audioEngine.prepare()
        if (try? audioEngine.start()) != nil {
            isRecording = true
        }
    }
}

// MARK: - Storage

private struct NotesStore {
    static let key = "notes_v1"

    static func load() -> [Note] {
        guard let data = UserDefaults.standard.data(forKey: key) else { return [] }
        return (try? JSONDecoder().decode([Note].self, from: data)) ?? []
    }

    static func save(_ notes: [Note]) {
        guard let data = try? JSONEncoder().encode(notes) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}

// MARK: - Row

private struct NoteListRow: View {
    let note: Note

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(note.displayTitle)
                .font(.app(size: 16, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .lineLimit(1)

            HStack(spacing: 6) {
                Text(note.updatedAt, style: .date)
                    .font(.app(size: 12))
                    .foregroundColor(Color.white.opacity(0.35))
                if !note.preview.isEmpty {
                    Text("·")
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

// MARK: - Dictation Button

private struct DictationButton: View {
    let isRecording: Bool
    let action: () -> Void

    @State private var pulse: Bool = false
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    var body: some View {
        Button(action: action) {
            ZStack {
                if isRecording {
                    Circle()
                        .fill(amber.opacity(0.35))
                        .scaleEffect(pulse ? 1.45 : 1.0)
                        .opacity(pulse ? 0.0 : 0.7)
                        .animation(
                            .easeOut(duration: 1.1).repeatForever(autoreverses: false),
                            value: pulse
                        )
                }
                Circle()
                    .fill(amber)
                    .shadow(color: amber.opacity(0.45), radius: 12, y: 4)

                Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(.white)
            }
            .frame(width: 56, height: 56)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isRecording ? "Stop dictation" : "Start dictation")
        .onChange(of: isRecording) { _, recording in
            pulse = recording
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
        self.original = note
        self.isNew = isNew
        self.onSave = onSave
        self.onDelete = onDelete
        self._draft = State(initialValue: note)
    }

    private var canSave: Bool { !draft.isEmpty }
    private var isDirty: Bool { draft.title != original.title || draft.body != original.body }

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

                DictationButton(isRecording: dictation.isRecording) {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    if dictation.isRecording {
                        dictation.stop()
                    } else {
                        bodyBeforeDictation = draft.body
                        dictation.start()
                    }
                }
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
                Button("OK", role: .cancel) {}
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

    private var sortedNotes: [Note] {
        notes.sorted { $0.updatedAt > $1.updatedAt }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

                VStack(alignment: .leading, spacing: 0) {
                    HStack {
                        Text("Notes")
                            .font(.app(size: 22, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.88))
                        Spacer()
                        Button {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            sheet = .new
                        } label: {
                            Image(systemName: "square.and.pencil")
                                .font(.app(size: 16, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.65))
                                .frame(width: 36, height: 36)
                                .background(Color.white.opacity(0.07))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 28)
                    .padding(.bottom, 20)

                    if sortedNotes.isEmpty {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: "note.text")
                                .font(.app(size: 36, weight: .regular))
                                .foregroundColor(Color.white.opacity(0.20))
                            Text("No notes yet")
                                .font(.app(size: 16, weight: .regular))
                                .foregroundColor(Color.white.opacity(0.30))
                            Text("Tap the pencil to write your first note")
                                .font(.app(size: 13, weight: .regular))
                                .foregroundColor(Color.white.opacity(0.20))
                        }
                        .frame(maxWidth: .infinity)
                        Spacer()
                    } else {
                        ScrollView(showsIndicators: false) {
                            VStack(spacing: 0) {
                                ForEach(Array(sortedNotes.enumerated()), id: \.element.id) { idx, note in
                                    NoteListRow(note: note)
                                        .onTapGesture {
                                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                            sheet = .edit(note)
                                        }
                                    if idx < sortedNotes.count - 1 {
                                        Divider()
                                            .background(Color.white.opacity(0.06))
                                            .padding(.leading, 20)
                                    }
                                }
                            }
                            .padding(.bottom, 32)
                        }
                    }
                }
            }
            .toolbar(.hidden, for: .navigationBar)
        }
        .onAppear { notes = NotesStore.load() }
        .sheet(item: $sheet) { which in
            switch which {
            case .new:
                NoteComposerSheet(
                    note: Note(),
                    isNew: true,
                    onSave: { saved in
                        notes.append(saved)
                        NotesStore.save(notes)
                    },
                    onDelete: nil
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(22)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))

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
                        notes.removeAll { $0.id == note.id }
                        NotesStore.save(notes)
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
