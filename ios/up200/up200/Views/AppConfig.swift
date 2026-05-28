import Foundation

enum AppConfig {
    enum API {
        static let authRefresh = URL(string: "https://content-graph-five.vercel.app/api/auth/refresh")!
        static let notes       = URL(string: "https://content-graph-five.vercel.app/api/notes")!
        static let generations = URL(string: "https://content-graph-five.vercel.app/api/generations")!
    }
}
