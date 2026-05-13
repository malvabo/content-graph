import Foundation
import Security

struct KeychainService {
    private static let account = "com.up200.app.anthropic_api_key"

    static func save(_ value: String) {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account,
            kSecValueData: data
        ]
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }

    static func load() -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8),
              !value.isEmpty else { return nil }
        return value
    }

    static func delete() {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

struct Note: Identifiable, Codable, Equatable, Hashable {
    var id = UUID()
    // Legacy field. The composer stores everything in `body`; this stays
    // for decoding stored notes written by earlier versions, and is folded
    // into `body` on load.
    var title: String = ""
    var body: String = ""
    var updatedAt: Date = Date()
    var tags: [String] = []

    var isEmpty: Bool {
        body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var displayTitle: String {
        let firstLine = body.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let cleaned = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "Untitled" : cleaned
    }

    var preview: String {
        let lines = body.split(whereSeparator: \.isNewline).map(String.init)
        guard lines.count > 1 else { return "" }
        return lines.dropFirst()
            .first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    /// Folds a legacy stored `title` into the body.
    static func migrated(_ note: Note) -> Note {
        var out = note
        let t = out.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return out }
        if out.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            out.body = t
        } else {
            out.body = t + "\n" + out.body
        }
        out.title = ""
        return out
    }
}

struct GenerationProject: Identifiable, Codable {
    var id = UUID()
    var title: String
    var outputType: String
    var preview: String
    var content: String = ""
    var date: Date
}

struct CustomTemplate: Identifiable, Codable {
    var id = UUID()
    var title: String
    var subtitle: String
    var prompt: String = ""
    var formatIDs: [String] = []
}

final class BannerController: ObservableObject {
    @Published var isVisible = false
    @Published var isReady = false
    @Published var formatLabels: [String] = []
    var onOpen: (() -> Void)?
    var onCancel: (() -> Void)?
}

final class ChromeController: ObservableObject {
    @Published var hideTabBar = false
}
