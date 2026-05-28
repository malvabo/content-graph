import Foundation

enum AppConfig {
    static let baseURL = URL(string: "https://content-graph-five.vercel.app")!

    enum API {
        static let appleAuth    = AppConfig.baseURL.appendingPathComponent("api/auth/apple")
        static let tokenRefresh = AppConfig.baseURL.appendingPathComponent("api/auth/token-refresh")
        static let authRefresh  = AppConfig.baseURL.appendingPathComponent("api/auth/refresh")
        static let notes        = AppConfig.baseURL.appendingPathComponent("api/notes")
        static let generations  = AppConfig.baseURL.appendingPathComponent("api/generations")
        static let claude       = AppConfig.baseURL.appendingPathComponent("api/claude")
    }
}
