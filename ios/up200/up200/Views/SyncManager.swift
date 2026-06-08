import Foundation
import OSLog

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
    guard let updatedAt = parseISO(s.updatedAt) else { return nil }
    var n = Note()
    n.id = uuid
    n.body = s.body
    n.updatedAt = updatedAt
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
          let noteId = UUID(uuidString: s.noteId),
          let date = parseISO(s.date) else { return nil }
    return MinimalGeneration(
        id: id,
        noteId: noteId,
        sourceNoteIds: s.sourceNoteIds.compactMap(UUID.init),
        sourceLabels: s.sourceLabels,
        outputType: s.outputType,
        content: s.content,
        date: date
    )
}

// MARK: - Deleted generations tombstone store

/// Tracks locally deleted generation IDs so they aren't re-added on the next
/// pull. Capped at 1 000 entries to prevent unbounded growth.
enum DeletedGenTombstones {
    static let key = "com.up200.app.deleted_gen_ids_v1"
    private static let cap = 1_000

    static func load() -> Set<UUID> {
        guard let strings = UserDefaults.standard.stringArray(forKey: key) else { return [] }
        return Set(strings.compactMap(UUID.init))
    }

    static func insert(_ id: UUID) {
        var current = load()
        current.insert(id)
        if current.count > cap {
            // Drop oldest by truncating arbitrarily — exact ordering doesn't matter.
            let trimmed = Array(current).dropFirst(current.count - cap)
            UserDefaults.standard.set(trimmed.map(\.uuidString), forKey: key)
        } else {
            UserDefaults.standard.set(current.map(\.uuidString), forKey: key)
        }
    }

    static func contains(_ id: UUID) -> Bool {
        load().contains(id)
    }
}

// MARK: - Deleted notes tombstone store

/// Tracks locally deleted note IDs so a later pull cannot resurrect notes
/// that still exist remotely because a previous DELETE failed or was offline.
enum DeletedNoteTombstones {
    static let key = "com.up200.app.deleted_note_ids_v1"
    private static let cap = 1_000

    static func load() -> Set<UUID> {
        guard let strings = UserDefaults.standard.stringArray(forKey: key) else { return [] }
        return Set(strings.compactMap(UUID.init))
    }

    static func insert(_ id: UUID) {
        var current = load()
        current.insert(id)
        if current.count > cap {
            let trimmed = Array(current).dropFirst(current.count - cap)
            UserDefaults.standard.set(trimmed.map(\.uuidString), forKey: key)
        } else {
            UserDefaults.standard.set(current.map(\.uuidString), forKey: key)
        }
    }

    static func contains(_ id: UUID) -> Bool {
        load().contains(id)
    }
}

// MARK: - SyncManager

private let logger = Logger(subsystem: "com.up200.app", category: "SyncManager")

/// Bidirectional sync between the local UserDefaults stores and the backend.
/// Sync rules:
///   - Push: uploads all local items; server keeps the version with the
///     newer `updatedAt` (notes) or newer `date` (generations).
///   - Pull: downloads all server items and merges into local, taking the
///     server version when it is at least as new as the local copy and
///     adding any server-only items (unless locally deleted).
///   - Drawing notes (kind == .drawing) are excluded — their binary data is
///     too large for the current text-only schema.
///   - Sync failures are logged; local data is never overwritten on error.
actor SyncManager {
    static let shared = SyncManager()

    /// Exposed so the UI can show a sync-error badge.
    @MainActor private(set) var lastSyncError: String?

    private let notesURL = AppConfig.API.notes
    private let gensURL  = AppConfig.API.generations

    private var pushDebounce: Task<Void, Never>?
    private var observerTokens: [NSObjectProtocol] = []

    private init() {}

    // MARK: - Setup (call once from Up200App)

    /// Registers for store-change notifications and schedules a debounced push
    /// whenever local data is modified.
    func setup() {
        guard observerTokens.isEmpty else { return }
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
        guard SessionStore.shared.hasValidSession else { return }
        await pullNotes()
        await pullGenerations()
    }

    private func pullNotes() async {
        do {
            let data = try await AuthClient.shared.get(notesURL)
            let serverNotes = try JSONDecoder().decode([SyncNote].self, from: data)
            await MainActor.run { mergeServerNotes(serverNotes) }
            await setError(nil)
        } catch {
            logger.error("pullNotes failed: \(error.localizedDescription)")
            await setError("Notes sync failed: \(error.localizedDescription)")
        }
    }

    private func pullGenerations() async {
        do {
            let data = try await AuthClient.shared.get(gensURL)
            let serverGens = try JSONDecoder().decode([SyncGeneration].self, from: data)
            await MainActor.run { mergeServerGens(serverGens) }
        } catch {
            logger.error("pullGenerations failed: \(error.localizedDescription)")
            await setError("Generations sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Push: local → server

    /// Uploads all current local data. Called with a 2-second debounce
    /// after every store change.
    func push() async {
        guard SessionStore.shared.hasValidSession else { return }
        var pushError: String?

        do { try await pushNotes() }
        catch {
            logger.error("pushNotes failed: \(error.localizedDescription)")
            pushError = "Notes sync failed"
        }

        do { try await pushGenerations() }
        catch {
            logger.error("pushGenerations failed: \(error.localizedDescription)")
            pushError = pushError ?? "Generations sync failed"
        }

        await setError(pushError)

        if pushError != nil {
            // Retry once after 10 s on push failure.
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            guard !Task.isCancelled else { return }
            do { try await pushNotes() } catch { logger.error("pushNotes retry failed: \(error.localizedDescription)") }
            do { try await pushGenerations() } catch { logger.error("pushGenerations retry failed: \(error.localizedDescription)") }
        }
    }

    private func pushNotes() async throws {
        let local = await Task { @MainActor in NotesStore.load() }.value
        let syncNotes = local.filter { $0.kind == .text }.map(toSyncNote)
        guard !syncNotes.isEmpty else { return }

        struct Body: Encodable { let notes: [SyncNote] }
        let data = try await AuthClient.shared.post(notesURL, body: Body(notes: syncNotes))
        let response = try JSONDecoder().decode(NotesResponse.self, from: data)
        await MainActor.run { mergeServerNotes(response.notes) }
    }

    private func pushGenerations() async throws {
        let local = await Task { @MainActor in MinimalGenStore.load() }.value
        let syncGens = local.map(toSyncGen)
        guard !syncGens.isEmpty else { return }

        struct Body: Encodable { let generations: [SyncGeneration] }
        let data = try await AuthClient.shared.post(gensURL, body: Body(generations: syncGens))
        let response = try JSONDecoder().decode(GensResponse.self, from: data)
        await MainActor.run { mergeServerGens(response.generations) }
    }

    // MARK: - Delete a generation (local + remote)

    /// Removes a note from local storage, records a tombstone so it is not
    /// re-added on pull, deletes any attached generations, and sends DELETE
    /// to the server when authenticated.
    func deleteNote(id: UUID, removeLocal: Bool = true) async {
        DeletedNoteTombstones.insert(id)

        if removeLocal {
            await MainActor.run {
                var notes = NotesStore.load()
                notes.removeAll { $0.id == id }
                NotesStore.save(notes)
            }
        }

        await deleteAllGenerations(forNoteID: id)

        guard SessionStore.shared.hasValidSession else { return }
        let url = notesURL.appendingPathComponent(id.uuidString)
        do {
            _ = try await AuthClient.shared.delete(url)
        } catch {
            // Non-fatal: tombstone prevents resurrection on pull.
            logger.warning("deleteNote server call failed (non-fatal): \(error.localizedDescription)")
        }
    }

    /// Removes a generation from local storage, records a tombstone so it
    /// won't be re-added on the next pull, and sends DELETE to the server.
    func deleteGeneration(id: UUID) async {
        await MainActor.run {
            MinimalGenStore.delete(id: id)
        }
        DeletedGenTombstones.insert(id)

        guard SessionStore.shared.hasValidSession else { return }
        let url = gensURL.appendingPathComponent(id.uuidString)
        do {
            _ = try await AuthClient.shared.delete(url)
        } catch {
            // Non-fatal: tombstone prevents resurrection on pull.
            logger.warning("deleteGeneration server call failed (non-fatal): \(error.localizedDescription)")
        }
    }

    /// Removes all generations for a note from local storage, records tombstones,
    /// and sends DELETE requests to the server for each one.
    func deleteAllGenerations(forNoteID noteId: UUID) async {
        let gens = await MainActor.run { MinimalGenStore.load().filter { $0.noteId == noteId } }
        await MainActor.run { MinimalGenStore.deleteAll(forNoteID: noteId) }
        let authenticated = SessionStore.shared.hasValidSession
        for gen in gens {
            DeletedGenTombstones.insert(gen.id)
            if authenticated {
                let url = gensURL.appendingPathComponent(gen.id.uuidString)
                do { _ = try await AuthClient.shared.delete(url) }
                catch { logger.warning("deleteAllGenerations server call failed for \(gen.id): \(error.localizedDescription)") }
            }
        }
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
            guard !DeletedNoteTombstones.contains(note.id) else { continue }

            if let idx = localById[note.id] {
                // Use >= so that same-millisecond ties prefer the server version.
                if serverDate >= local[idx].updatedAt {
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
        let localById: [UUID: Int] = Dictionary(
            uniqueKeysWithValues: local.enumerated().compactMap { idx, g in (g.id, idx) }
        )
        var changed = false
        var newGens: [MinimalGeneration] = []

        for sg in serverGens {
            guard let gen = fromSyncGen(sg) else { continue }
            // Skip generations the user deleted locally.
            guard !DeletedGenTombstones.contains(gen.id) else { continue }

            if let idx = localById[gen.id] {
                // Update existing if server version is newer.
                if gen.date >= local[idx].date {
                    local[idx] = gen
                    changed = true
                }
            } else {
                newGens.append(gen)
                changed = true
            }
        }

        if !newGens.isEmpty {
            // Append new items then sort newest-first.
            local.append(contentsOf: newGens)
            local.sort { $0.date > $1.date }
        }

        if changed {
            MinimalGenStore.save(local)
        }
    }

    // MARK: - Helpers

    @MainActor
    private func setError(_ message: String?) {
        lastSyncError = message
    }
}
