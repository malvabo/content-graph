import Foundation

// MARK: - Wire types matching the backend JSON

private struct SyncNote: Codable {
    var id: String
    var body: String
    var updatedAt: String
    var isPinned: Bool
    var tags: [String]
    var kind: String
}

private struct SyncGeneration: Codable {
    var id: String
    var noteId: String
    var sourceNoteIds: [String]
    var sourceLabels: [String]
    var outputType: String
    var content: String
    var date: String
}

private struct NotesResponse: Decodable { var notes: [SyncNote] }
private struct GensResponse: Decodable  { var generations: [SyncGeneration] }

// MARK: - Date helpers

private let iso8601: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

private let iso8601Basic: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

private func parseISO(_ s: String) -> Date? {
    iso8601.date(from: s) ?? iso8601Basic.date(from: s)
}

private func formatISO(_ d: Date) -> String {
    iso8601.string(from: d)
}

// MARK: - Converters

private func toSyncNote(_ note: Note) -> SyncNote {
    SyncNote(
        id: note.id.uuidString,
        body: note.body,
        updatedAt: formatISO(note.updatedAt),
        isPinned: note.isPinned,
        tags: note.tags,
        kind: note.kind.rawValue
    )
}

private func fromSyncNote(_ s: SyncNote) -> Note? {
    guard let uuid = UUID(uuidString: s.id) else { return nil }
    var n = Note()
    n.id = uuid
    n.body = s.body
    n.updatedAt = parseISO(s.updatedAt) ?? Date()
    n.isPinned = s.isPinned
    n.tags = s.tags
    n.kind = NoteKind(rawValue: s.kind) ?? .text
    return n
}

private func toSyncGen(_ g: MinimalGeneration) -> SyncGeneration {
    SyncGeneration(
        id: g.id.uuidString,
        noteId: g.noteId.uuidString,
        sourceNoteIds: g.sourceNoteIds.map(\.uuidString),
        sourceLabels: g.sourceLabels,
        outputType: g.outputType,
        content: g.content,
        date: formatISO(g.date)
    )
}

private func fromSyncGen(_ s: SyncGeneration) -> MinimalGeneration? {
    guard let id = UUID(uuidString: s.id),
          let noteId = UUID(uuidString: s.noteId) else { return nil }
    return MinimalGeneration(
        id: id,
        noteId: noteId,
        sourceNoteIds: s.sourceNoteIds.compactMap(UUID.init),
        sourceLabels: s.sourceLabels,
        outputType: s.outputType,
        content: s.content,
        date: parseISO(s.date) ?? Date()
    )
}

// MARK: - SyncManager

/// Bidirectional sync between the local UserDefaults stores and the backend.
/// Sync rules:
///   - Push: uploads all local items; server keeps the version with the
///     newer `updatedAt` (notes) or any new `date` (generations).
///   - Pull: downloads all server items and merges into local, taking the
///     newer version for each ID and adding any server-only items.
///   - Drawing notes (kind == .drawing) are excluded — their binary data is
///     too large for the current text-only schema.
///   - Sync failures are silent; local data is never overwritten on error.
actor SyncManager {
    static let shared = SyncManager()

    private let notesURL = URL(string: "https://content-graph-five.vercel.app/api/notes")!
    private let gensURL  = URL(string: "https://content-graph-five.vercel.app/api/generations")!

    private var pushDebounce: Task<Void, Never>?
    private var observerTokens: [NSObjectProtocol] = []

    private init() {}

    // MARK: - Setup (call once from Up200App)

    /// Registers for store-change notifications and schedules a debounced push
    /// whenever local data is modified.
    func setup() {
        let nc = NotificationCenter.default
        let names: [Notification.Name] = [.notesStoreDidChange, .minimalGenStoreDidChange]
        for name in names {
            let token = nc.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { await self?.schedulePush() }
            }
            observerTokens.append(token)
        }
    }

    // MARK: - Pull: server → local

    /// Downloads all server data and merges it into local stores.
    /// Call after sign-in and on app foreground when authenticated.
    func pull() async {
        guard SessionStore.shared.load() != nil else { return }
        await pullNotes()
        await pullGenerations()
    }

    private func pullNotes() async {
        do {
            let data = try await AuthClient.shared.get(notesURL)
            let serverNotes = try JSONDecoder().decode([SyncNote].self, from: data)
            await MainActor.run { mergeServerNotes(serverNotes) }
        } catch {
            // Sync errors must not surface to the user.
        }
    }

    private func pullGenerations() async {
        do {
            let data = try await AuthClient.shared.get(gensURL)
            let serverGens = try JSONDecoder().decode([SyncGeneration].self, from: data)
            await MainActor.run { mergeServerGens(serverGens) }
        } catch {}
    }

    // MARK: - Push: local → server

    /// Uploads all current local data. Called with a 2-second debounce
    /// after every store change.
    func push() async {
        guard SessionStore.shared.load() != nil else { return }
        await pushNotes()
        await pushGenerations()
    }

    private func pushNotes() async {
        let local = await Task { @MainActor in NotesStore.load() }.value
        let syncNotes = local.filter { $0.kind == .text }.map(toSyncNote)
        guard !syncNotes.isEmpty else { return }

        struct Body: Encodable { let notes: [SyncNote] }
        do {
            let data = try await AuthClient.shared.post(notesURL, body: Body(notes: syncNotes))
            let response = try JSONDecoder().decode(NotesResponse.self, from: data)
            await MainActor.run { mergeServerNotes(response.notes) }
        } catch {}
    }

    private func pushGenerations() async {
        let local = await Task { @MainActor in MinimalGenStore.load() }.value
        let syncGens = local.map(toSyncGen)
        guard !syncGens.isEmpty else { return }

        struct Body: Encodable { let generations: [SyncGeneration] }
        do {
            let data = try await AuthClient.shared.post(gensURL, body: Body(generations: syncGens))
            let response = try JSONDecoder().decode(GensResponse.self, from: data)
            await MainActor.run { mergeServerGens(response.generations) }
        } catch {}
    }

    // MARK: - Debounce

    private func schedulePush() {
        pushDebounce?.cancel()
        pushDebounce = Task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            await push()
        }
    }

    // MARK: - Merge helpers (must run on MainActor)

    @MainActor
    private func mergeServerNotes(_ serverNotes: [SyncNote]) {
        var local = NotesStore.load()
        var localById: [UUID: Int] = Dictionary(
            uniqueKeysWithValues: local.enumerated().compactMap { idx, n in (n.id, idx) }
        )
        var changed = false

        for sn in serverNotes {
            guard sn.kind != "drawing",
                  let note = fromSyncNote(sn),
                  let serverDate = parseISO(sn.updatedAt) else { continue }

            if let idx = localById[note.id] {
                if serverDate > local[idx].updatedAt {
                    local[idx] = note
                    changed = true
                }
            } else {
                local.append(note)
                localById[note.id] = local.count - 1
                changed = true
            }
        }

        if changed {
            NotesStore.save(local)
        }
    }

    @MainActor
    private func mergeServerGens(_ serverGens: [SyncGeneration]) {
        var local = MinimalGenStore.load()
        let localIds = Set(local.map(\.id))
        var changed = false

        for sg in serverGens {
            guard let gen = fromSyncGen(sg) else { continue }
            if !localIds.contains(gen.id) {
                local.insert(gen, at: 0)
                changed = true
            }
        }

        if changed {
            MinimalGenStore.save(local)
        }
    }
}
