import SwiftUI

@main
struct Up200App: App {
    @AppStorage("onboarding_complete") private var onboardingComplete = false
    // Start false so the window opens instantly; the .task modifier checks the
    // Keychain on a background thread after the first frame renders, preventing
    // SecItemCopyMatching from blocking the UI thread on cold launch.
    @State private var needsSetup = false

    var body: some Scene {
        WindowGroup {
            if !onboardingComplete {
                OnboardingView {
                    withAnimation(.easeOut(duration: 0.4)) {
                        onboardingComplete = true
                    }
                } onLogin: {
                    withAnimation(.easeOut(duration: 0.4)) {
                        onboardingComplete = true
                    }
                }
                .preferredColorScheme(.dark)
            } else {
                ContentView()
                    .preferredColorScheme(.dark)
                    .fullScreenCover(isPresented: $needsSetup) {
                        APIKeySetupView {
                            needsSetup = false
                        }
                    }
                    .task {
                        let hasKey = await Task.detached(priority: .userInitiated) {
                            KeychainService.load() != nil
                        }.value
                        needsSetup = !hasKey
                    }
            }
        }
    }
}
