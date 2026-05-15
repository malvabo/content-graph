import SwiftUI

@main
struct Up200App: App {
    @AppStorage("onboarding_complete") private var onboardingComplete = false
    @AppStorage("appearance_dark_mode") private var darkModeEnabled = true
    // Start false so the window opens instantly; the .task modifier checks the
    // Keychain on a background thread after the first frame renders, preventing
    // SecItemCopyMatching from blocking the UI thread on cold launch.
    @State private var needsSetup = false

    private var colorScheme: ColorScheme {
        darkModeEnabled ? .dark : .light
    }

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
                .preferredColorScheme(colorScheme)
            } else {
                ContentView()
                    .preferredColorScheme(colorScheme)
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
