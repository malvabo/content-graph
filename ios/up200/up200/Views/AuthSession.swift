import Foundation
import Security

// MARK: - Session model

struct AppSession: Codable {
    let accessToken: String
    let refreshToken: String
    /// Unix timestamp when the access token expires (matches Supabase `expires_at`).
    let expiresAt: Int
    let supabaseUserId: String
    let email: String?
    let fullName: String?

    /// True when the access token expires within the next 5 minutes.
    var needsRefresh: Bool {
        let secondsUntilExpiry = TimeInterval(expiresAt) - Date().timeIntervalSince1970
        return secondsUntilExpiry < 300
    }
}

// MARK: - Keychain-backed session store

final class SessionStore {
    static let shared = SessionStore()
    private init() {}

    private let service = "com.up200.app"
    private let account = "app_session_v1"

    func save(_ session: AppSession) {
        guard let data = try? JSONEncoder().encode(session) else { return }
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        // Try update first; add if the item doesn't exist yet.
        let updateStatus = SecItemUpdate(query as CFDictionary, [kSecValueData: data] as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData] = data
            let addStatus = SecItemAdd(addQuery as CFDictionary, nil)
            if addStatus != errSecSuccess {
                print("[SessionStore] SecItemAdd failed: \(addStatus)")
            }
        } else if updateStatus != errSecSuccess {
            print("[SessionStore] SecItemUpdate failed: \(updateStatus)")
        }
    }

    func load() -> AppSession? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(AppSession.self, from: data)
    }

    func delete() {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
