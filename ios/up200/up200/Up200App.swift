import SwiftUI
import UIKit

@main
struct Up200App: App {
    @AppStorage("onboarding_complete") private var onboardingComplete = false
    @AppStorage("local_home_enabled") private var localHomeEnabled = false
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
            Group {
                if !onboardingComplete && !localHomeEnabled {
                    OnboardingView {
                        withAnimation(.easeOut(duration: 0.4)) {
                            onboardingComplete = true
                        }
                    } onLogin: {
                        withAnimation(.easeOut(duration: 0.4)) {
                            onboardingComplete = true
                        }
                    }
                } else {
                    ContentView()
                        .fullScreenCover(isPresented: $needsSetup) {
                            APIKeySetupView {
                                needsSetup = false
                            }
                        }
                        .task {
                            let (hasKey, hasSession) = await Task.detached(priority: .userInitiated) {
                                let key = !(KeychainService.load() ?? "").isEmpty
                                    || SessionTokenService.load() != nil
                                let session = SessionStore.shared.hasValidSession
                                return (key, session)
                            }.value

                            guard hasKey || hasSession || localHomeEnabled else {
                                // No usable credential — send back to onboarding.
                                // Covers users whose only access was the now-removed
                                // "Just explore" anonymous path: their UserDefaults flag
                                // is still true but they have no session or API key.
                                withAnimation(.easeOut(duration: 0.4)) {
                                    onboardingComplete = false
                                }
                                return
                            }

                            // An Apple session alone is sufficient; API key is opt-in
                            // from Settings. Only show the setup sheet if neither exists
                            // (edge case: corrupted state that passed the guard above).
                            needsSetup = !hasKey && !hasSession && !localHomeEnabled

                            if hasSession {
                                await SyncManager.shared.pull()
                            }
                        }
                }
            }
            .preferredColorScheme(colorScheme)
            // Mirror the in-app dark-mode toggle to the window's interface style
            // so the system status bar (using UIStatusBarStyleDefault) picks dark
            // content in light mode and light content in dark mode — otherwise it
            // follows the device's system setting, which may not match the app.
            .onAppear {
                applyInterfaceStyle()
                Task { await SyncManager.shared.setup() }
            }
            .onChange(of: darkModeEnabled) { _, _ in applyInterfaceStyle() }
        }
    }

    private func applyInterfaceStyle() {
        let style: UIUserInterfaceStyle = darkModeEnabled ? .dark : .light
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows {
                window.overrideUserInterfaceStyle = style
            }
        }
    }
}
