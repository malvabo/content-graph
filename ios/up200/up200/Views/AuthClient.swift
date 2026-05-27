import Foundation

// MARK: - Errors

enum AuthClientError: LocalizedError {
    case noSession
    case refreshFailed(String)
    case http(Int, String)
    case network(String)

    var errorDescription: String? {
        switch self {
        case .noSession:
            return "Not signed in."
        case .refreshFailed(let msg):
            return "Session refresh failed: \(msg)"
        case .http(401, _):
            return "Your session has expired. Please sign in again."
        case .http(let code, let msg):
            return msg.isEmpty ? "Server error (\(code))." : msg
        case .network(let msg):
            return "Network error: \(msg)"
        }
    }
}

// MARK: - AuthClient

/// HTTP client that automatically attaches `Authorization: Bearer` to every
/// request and refreshes the Supabase session when the access token is near
/// expiry. Declared as an `actor` so concurrent callers share a single
/// in-flight refresh rather than each starting their own.
actor AuthClient {
    static let shared = AuthClient()

    private let refreshURL = URL(string: "https://content-graph-five.vercel.app/api/auth/refresh")!
    private var refreshTask: Task<AppSession, Error>?

    private init() {}

    // MARK: - Public API

    /// Performs an authenticated GET. Throws `AuthClientError.noSession` if
    /// there is no stored session.
    func get(_ url: URL) async throws -> Data {
        try await request(url, method: "GET", body: nil)
    }

    /// Performs an authenticated POST with a JSON-encodable body.
    func post<T: Encodable>(_ url: URL, body: T) async throws -> Data {
        let encoded = try JSONEncoder().encode(body)
        return try await request(url, method: "POST", body: encoded)
    }

    /// Performs an authenticated DELETE.
    func delete(_ url: URL) async throws -> Data {
        try await request(url, method: "DELETE", body: nil)
    }

    // MARK: - Core request

    private func request(_ url: URL, method: String, body: Data?) async throws -> Data {
        let session = try await validSession()
        return try await perform(url: url, method: method, body: body, token: session.accessToken)
    }

    // MARK: - Session management

    private func validSession() async throws -> AppSession {
        guard var session = SessionStore.shared.load() else {
            throw AuthClientError.noSession
        }
        guard session.needsRefresh else { return session }

        // If a refresh is already in flight, wait for it instead of starting
        // a second one. Reset the task slot on completion so future calls
        // trigger a fresh refresh when needed.
        if let ongoing = refreshTask {
            session = try await ongoing.value
            return session
        }

        let task = Task<AppSession, Error> { [self] in
            defer { Task { await self.clearRefreshTask() } }
            return try await self.performRefresh(using: SessionStore.shared.load()?.refreshToken ?? "")
        }
        refreshTask = task
        session = try await task.value
        return session
    }

    private func clearRefreshTask() {
        refreshTask = nil
    }

    private func performRefresh(using refreshToken: String) async throws -> AppSession {
        guard !refreshToken.isEmpty else { throw AuthClientError.noSession }

        struct RefreshBody: Encodable { let refresh_token: String }
        struct RefreshResponse: Decodable {
            let access_token: String
            let refresh_token: String
            let expires_at: Int
        }
        struct ErrorResponse: Decodable { let error: String }

        var req = URLRequest(url: refreshURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(RefreshBody(refresh_token: refreshToken))

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw AuthClientError.network("No response from refresh endpoint")
        }
        guard http.statusCode == 200 else {
            let msg = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error ?? "Unknown error"
            throw AuthClientError.refreshFailed(msg)
        }

        let refreshed = try JSONDecoder().decode(RefreshResponse.self, from: data)
        let existing = SessionStore.shared.load()
        let newSession = AppSession(
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            expiresAt: refreshed.expires_at,
            supabaseUserId: existing?.supabaseUserId ?? "",
            email: existing?.email,
            fullName: existing?.fullName
        )
        SessionStore.shared.save(newSession)
        return newSession
    }

    // MARK: - Raw HTTP

    private func perform(url: URL, method: String, body: Data?, token: String) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = body
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw AuthClientError.network(error.localizedDescription)
        }

        guard let http = response as? HTTPURLResponse else {
            throw AuthClientError.network("Invalid response")
        }
        guard (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8).map { String($0.prefix(300)) } ?? ""
            throw AuthClientError.http(http.statusCode, msg)
        }
        return data
    }
}
