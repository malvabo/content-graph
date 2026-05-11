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
    var onFinish: () -> Void

    @State private var appeared = false

    var body: some View {
        ZStack {
            OnboardingSceneView()
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 12) {
                    Text("up")
                        .font(.system(size: 52, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)

                    Text("Your AI content graph")
                        .font(.system(size: 17, weight: .regular, design: .rounded))
                        .foregroundColor(Color.white.opacity(0.72))
                        .multilineTextAlignment(.center)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 16)
                .animation(.easeOut(duration: 0.6).delay(0.3), value: appeared)

                Spacer().frame(height: 48)

                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    onFinish()
                }) {
                    Text("Get started")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(red: 0.10, green: 0.30, blue: 0.26))
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(Color.white.opacity(0.92))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
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
    OnboardingView(onFinish: {})
}
