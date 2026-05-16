import SwiftUI

// MARK: - UIKit bridge

private struct OnboardingSceneView: UIViewControllerRepresentable {
    var collected: Bool
    var graph: Bool

    func makeUIViewController(context: Context) -> OnboardingSceneViewController {
        OnboardingSceneViewController()
    }
    func updateUIViewController(_ uiViewController: OnboardingSceneViewController, context: Context) {
        uiViewController.setCollected(collected)
        uiViewController.setShowGraph(graph)
    }
}

// MARK: - Onboarding screen

private enum OnboardingStep {
    case intro      // wide constellation + brand mark + Get started / Log in
    case transform  // collected bulb + "Transform your ideas…" headline + CTA
    case graph      // bulb + smaller satellite bulbs joined by edges + Finish
}

struct OnboardingView: View {
    var onGetStarted: () -> Void
    var onLogin: () -> Void

    @State private var step: OnboardingStep = .intro
    @State private var appeared = false
    // Typewriter state for the brand mark. Mirrors web's TypewriterLogo —
    // mono font, lowercase "up150", char-by-char typing with a blinking
    // caret that persists after the word is fully typed.
    @State private var brandTypedLength: Int = 0
    @State private var caretOn: Bool = true
    private let brandFull = "up150"

    var body: some View {
        ZStack {
            // Shared scene across all steps — same SceneKit view stays
            // mounted so the dots can fly inward continuously and the
            // satellite graph can layer in on top of the same bulb, instead
            // of cross-fading between separate scenes.
            OnboardingSceneView(
                collected: step != .intro,
                graph:     step == .graph
            )
            .ignoresSafeArea()

            switch step {
            case .intro:     introOverlay
            case .transform: transformOverlay
            case .graph:     graphOverlay
            }
        }
        .onAppear { appeared = true }
    }

    // MARK: Step 1 — wide constellation

    private var introOverlay: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 12) {
                HStack(alignment: .bottom, spacing: 2) {
                    Text(String(brandFull.prefix(brandTypedLength)))
                        .font(.system(size: 52, weight: .regular, design: .monospaced))
                        .kerning(-0.5)
                        .foregroundColor(AppText.primary)
                    Rectangle()
                        .fill(BrandColor.amber)
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
                    do { try await Task.sleep(nanoseconds: 110_000_000) }
                    catch { return }
                    brandTypedLength = i + 1
                }
            }
            .task {
                // step-end caret blink: instant on/off every 0.45s,
                // matches the web TypewriterLogo timing.
                // Uses `try await` so CancellationError exits immediately
                // rather than looping with a swallowed error.
                while true {
                    do { try await Task.sleep(nanoseconds: 450_000_000) }
                    catch { return }
                    caretOn.toggle()
                }
            }

            Spacer().frame(height: 48)

            VStack(spacing: 12) {
                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    withAnimation(.easeInOut(duration: 0.45)) {
                        step = .transform
                    }
                }) {
                    Text("Get started")
                        .font(.app(size: 17, weight: .semibold))
                        .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(Color.white.opacity(0.94))
                        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
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
                        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
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
        .transition(.opacity)
    }

    // MARK: Step 2 — collected bulb

    private var transformOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 24)

            // Mono headline at top — same typographic register as the brand
            // mark on step 1, so the two screens feel like one continuous
            // story instead of a font swap mid-flow.
            Text("Transform your ideas\ninto high quality content")
                .font(.system(size: 22, weight: .medium, design: .monospaced))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 28)
                .padding(.top, 12)

            Spacer()

            Button(action: {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                withAnimation(.easeInOut(duration: 0.45)) {
                    step = .graph
                }
            }) {
                Text("Let's get started")
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(Color.white.opacity(0.94))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 28)

            Spacer().frame(height: 52)
        }
        // Headline + button fade in slightly behind the bulb collapse so the
        // user sees the stars converge first, then the text resolves. Matches
        // the "smoothly and quickly" feel — the scene leads, the copy follows.
        .transition(.opacity.animation(.easeIn(duration: 0.45).delay(0.25)))
    }

    // MARK: Step 3 — bulb with satellites + edges

    private var graphOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 24)

            // Same mono register as step 2 so the two screens read as one
            // continuous story rather than a font swap.
            Text("Every idea connects\ninto one knowledge graph")
                .font(.system(size: 22, weight: .medium, design: .monospaced))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 28)
                .padding(.top, 12)

            Spacer()

            Button(action: {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onGetStarted()
            }) {
                Text("Finish")
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(Color.white.opacity(0.94))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 28)

            Spacer().frame(height: 52)
        }
        // Mirrors step 2's delayed fade so the satellite bulbs draw the eye
        // first, then the copy resolves into place.
        .transition(.opacity.animation(.easeIn(duration: 0.45).delay(0.35)))
    }
}

#Preview {
    OnboardingView(onGetStarted: {}, onLogin: {})
}
