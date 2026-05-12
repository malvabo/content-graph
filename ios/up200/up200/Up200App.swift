import SwiftUI

@main
struct Up200App: App {
    @AppStorage("onboarding_complete") private var onboardingComplete = false
    @State private var needsSetup = KeychainService.load() == nil

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
            }
        }
    }
}
