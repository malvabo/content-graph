import SwiftUI

@main
struct Up200App: App {
    @State private var needsSetup = KeychainService.load() == nil

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .fullScreenCover(isPresented: $needsSetup) {
                    APIKeySetupView {
                        needsSetup = false
                    }
                }
        }
    }
}
