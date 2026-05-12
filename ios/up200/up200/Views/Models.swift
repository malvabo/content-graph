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

struct VoiceNote: Identifiable, Codable {
    var id = UUID()
    var title: String
    var body: String
    var date: Date
}

struct Note: Identifiable, Codable, Equatable {
    var id = UUID()
    var title: String = ""
    var body: String = ""
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    var isEmpty: Bool {
        title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        let firstLine = body.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let cleaned = firstLine.trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "New Note" : cleaned
    }

    var preview: String {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let lines = body.split(whereSeparator: \.isNewline).map(String.init)
        if !trimmedTitle.isEmpty {
            return lines.first?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        }
        guard lines.count > 1 else { return "" }
        return lines.dropFirst().first(where: { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
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
