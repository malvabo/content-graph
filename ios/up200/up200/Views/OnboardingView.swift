import SwiftUI

// MARK: - UIKit bridge

private struct OnboardingSceneView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> OnboardingSceneViewController {
        OnboardingSceneViewController()
    }
    func updateUIViewController(_ uiViewController: OnboardingSceneViewController, context: Context) {}
}

// MARK: - Onboarding screen

struct OnboardingView: View {
    var onGetStarted: () -> Void
    var onLogin: () -> Void

    @State private var appeared = false
    // Typewriter state for the brand mark. Mirrors web's TypewriterLogo —
    // mono font, lowercase "up150", char-by-char typing with a blinking
    // caret that persists after the word is fully typed.
    @State private var brandTypedLength: Int = 0
    @State private var caretOn: Bool = true
    private let brandFull = "up150"

    var body: some View {
        ZStack {
            OnboardingSceneView()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 12) {
                    HStack(alignment: .bottom, spacing: 2) {
                        Text(String(brandFull.prefix(brandTypedLength)))
                            .font(.system(size: 52, weight: .regular, design: .monospaced))
                            .kerning(-0.5)
                            .foregroundColor(.white)
                        Rectangle()
                            .fill(Color(red: 0.85, green: 0.45, blue: 0.10))
                            .frame(width: 2, height: 44)
                            .cornerRadius(1)
                            .opacity(caretOn ? 1 : 0)
                            .padding(.bottom, 6)
                    }

                    Text("Your AI content graph")
                        .font(.system(size: 17, weight: .regular, design: .rounded))
                        .foregroundColor(Color.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 16)
                .animation(.easeOut(duration: 0.6).delay(0.3), value: appeared)
                .task {
                    // Under reduce-motion, show the full brand immediately;
                    // skip per-char streaming.
                    if UIAccessibility.isReduceMotionEnabled {
                        brandTypedLength = brandFull.count
                        return
                    }
                    for i in 0..<brandFull.count {
                        try? await Task.sleep(nanoseconds: 110_000_000)
                        if Task.isCancelled { return }
                        brandTypedLength = i + 1
                    }
                }
                .task {
                    // step-end caret blink: instant on/off every 0.45s,
                    // matches the web TypewriterLogo timing.
                    while !Task.isCancelled {
                        try? await Task.sleep(nanoseconds: 450_000_000)
                        if Task.isCancelled { return }
                        caretOn.toggle()
                    }
                }

                Spacer().frame(height: 48)

                VStack(spacing: 12) {
                    Button(action: {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        onGetStarted()
                    }) {
                        Text("Get started")
                            .font(.app(size: 17, weight: .semibold))
                            .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(Color.white.opacity(0.94))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    Button(action: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        onLogin()
                    }) {
                        Text("Log in")
                            .font(.app(size: 17, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.70))
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(Color.white.opacity(0.07))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                            )
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 28)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)
                .animation(.easeOut(duration: 0.6).delay(0.55), value: appeared)

                Spacer().frame(height: 52)
            }
        }
        .onAppear { appeared = true }
    }
}

#Preview {
    OnboardingView(onGetStarted: {}, onLogin: {})
}
