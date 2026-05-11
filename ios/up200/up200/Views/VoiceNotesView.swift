import SwiftUI

// MARK: - Note Row

private struct NoteRow: View {
    let note: VoiceNote

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(note.title.isEmpty ? "Untitled" : note.title)
                .font(.app(size: 16, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .lineLimit(1)
            if !note.body.isEmpty {
                Text(note.body)
                    .font(.app(size: 14))
                    .foregroundColor(Color.white.opacity(0.42))
                    .lineLimit(2)
            }
            Text(note.date, style: .date)
                .font(.app(size: 12, weight: .regular))
                .foregroundColor(Color.white.opacity(0.22))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 14)
        .padding(.vertical, 13)
        .background(Color.white.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
        )
    }
}

// MARK: - Editor

struct NoteEditorView: View {
    @Binding var note: VoiceNote
    var onDone: () -> Void
    var onDelete: (() -> Void)? = nil

    @FocusState private var bodyFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Done") { onDone() }
                    .font(.app(size: 16, weight: .medium))
                    .foregroundColor(.white)
                Spacer()
                if let del = onDelete {
                    Button(action: del) {
                        Image(systemName: "trash")
                            .font(.app(size: 17))
                            .foregroundColor(Color.white.opacity(0.40))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 0.5)

            TextField("Title", text: $note.title)
                .font(.app(size: 24, weight: .bold))
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.top, 20)
                .padding(.bottom, 10)

            TextEditor(text: $note.body)
                .font(.app(size: 16))
                .foregroundColor(Color.white.opacity(0.80))
                .scrollContentBackground(.hidden)
                .background(.clear)
                .padding(.horizontal, 12)
                .focused($bodyFocused)

            Spacer(minLength: 0)
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                bodyFocused = true
            }
        }
    }
}

// MARK: - Editor sheet wrapper (edits a copy, saves on done)

private struct NoteEditorSheet: View {
    let original: VoiceNote
    var onSave: (VoiceNote) -> Void
    var onDelete: () -> Void

    @State private var draft: VoiceNote
    @Environment(\.dismiss) private var dismiss

    init(note: VoiceNote, onSave: @escaping (VoiceNote) -> Void, onDelete: @escaping () -> Void) {
        self.original = note
        self.onSave = onSave
        self.onDelete = onDelete
        self._draft = State(initialValue: note)
    }

    var body: some View {
        NoteEditorView(note: $draft) {
            onSave(draft)
            dismiss()
        } onDelete: {
            onDelete()
            dismiss()
        }
    }
}

// MARK: - Voice Notes View

struct VoiceNotesView: View {
    @State private var notes: [VoiceNote] = []
    @State private var editing: VoiceNote? = nil

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.55, green: 0.30, blue: 0.08).opacity(0.30), .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0, endRadius: 350
            ).ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Text("Voice Notes")
                        .font(.app(size: 28, weight: .bold))
                        .foregroundColor(.white)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 16)

                if notes.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "mic.slash")
                            .font(.app(size: 38, weight: .light))
                            .foregroundColor(Color.white.opacity(0.18))
                        Text("No notes yet")
                            .font(.app(size: 16))
                            .foregroundColor(Color.white.opacity(0.28))
                    }
                    Spacer()
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 8) {
                            ForEach(notes) { note in
                                NoteRow(note: note)
                                    .onTapGesture {
                                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                        editing = note
                                    }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 24)
                    }
                }
            }
        }
        .sheet(item: $editing) { note in
            NoteEditorSheet(note: note) { updated in
                if let idx = notes.firstIndex(where: { $0.id == updated.id }) {
                    notes[idx] = updated
                }
            } onDelete: {
                notes.removeAll { $0.id == note.id }
            }
        }
    }
}
