import SwiftUI

// MARK: - UIKit bridge

private struct OnboardingSceneView: UIViewControllerRepresentable {
    var step: Int

    func makeUIViewController(context: Context) -> OnboardingSceneViewController {
        OnboardingSceneViewController()
    }
    func updateUIViewController(_ uiViewController: OnboardingSceneViewController, context: Context) {
        uiViewController.setStep(step)
    }
}

// MARK: - Onboarding screen

private enum OnboardingStep: Int {
    case intro = 0          // wide constellation + brand mark + Get started / Log in
    case transform = 1      // collected bulb + "Transform your ideas…" headline + Continue
    case constellation = 2  // central bulb + 4 satellite bulbs joined by dot arcs + doc + Continue
    case features = 3       // app preview: 4 feature blurbs around one big central + button
}

struct OnboardingView: View {
    var onGetStarted: () -> Void
    var onLogin: () -> Void

    @State private var step: OnboardingStep = .intro
    @State private var appeared = false
    // Per-element appearance flag for step 4. We don't share `appeared`
    // because the staggered children on step 4 need to start hidden and
    // cascade in only when that step is reached, not when the OnboardingView
    // is first put on screen. Under Reduce Motion the flag starts already
    // true so the workspace overlay renders at its final state with no
    // value change for the per-element `.animation(_, value:)` modifiers
    // to animate against — keeping the workspace screen as instant as the
    // SCN fade is in `applyFeatures`'s reduce-motion path.
    @State private var featuresAppeared: Bool = UIAccessibility.isReduceMotionEnabled
    // Gate for the step-4 CTA. The button is laid out from t=0 but only
    // animates in over its own `delay(1.15) + duration(0.5)` window — i.e.
    // it sits at opacity 0 until t≈1.65 while still being hit-testable
    // (`.opacity(0)` doesn't disable taps in SwiftUI). Without this gate a
    // user rage-tapping the bottom of the screen on entry could dismiss
    // onboarding before ever seeing the workspace preview. Same Reduce
    // Motion treatment as `featuresAppeared` so the CTA is tappable
    // immediately when the cascade is being skipped.
    @State private var ctaReady: Bool = UIAccessibility.isReduceMotionEnabled
    // Typewriter state for the brand mark. Mirrors web's TypewriterLogo —
    // mono font, lowercase "up150", char-by-char typing with a blinking
    // caret that persists after the word is fully typed.
    @State private var brandTypedLength: Int = 0
    @State private var caretOn: Bool = true
    private let brandFull = "up150"

    var body: some View {
        ZStack {
            // Shared scene across all steps — same SceneKit view stays mounted
            // so the dots can collapse inward (step 2) and then sprout
            // satellites + connector arcs (step 3) without cross-fading
            // between separate scenes.
            OnboardingSceneView(step: step.rawValue)
                .ignoresSafeArea()

            switch step {
            case .intro:         introOverlay
            case .transform:     transformOverlay
            case .constellation: constellationOverlay
            case .features:      featuresOverlay
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
                    step = .constellation
                }
            }) {
                Text("Continue")
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

    // MARK: Step 3 — content graph

    /// Final onboarding beat: the collected bulb sprouts smaller satellite
    /// bulbs around it, each tethered to the centre by a chain of star dots
    /// that arcs gently between the two. Visually states the app's core
    /// metaphor — one idea blooming into a graph of related content — before
    /// the user lands on the home screen.
    private var constellationOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 24)

            Text("From one idea,\na graph of content")
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
                    step = .features
                }
            }) {
                Text("Continue")
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
        // Insertion (step 2 → step 3): hold the headline + CTA until the
        // satellites + connectors have finished their first beats of motion,
        // then fade them in — scene leads, copy follows.
        // Removal (step 3 → step 4): exit fast and with no delay so this
        // headline doesn't sit over the top of the new "Your new workspace"
        // headline (same top-center position) while the workspace cascade
        // is fading in.
        .transition(
            .asymmetric(
                insertion: .opacity.animation(.easeIn(duration: 0.55).delay(0.35)),
                removal:   .opacity.animation(.easeOut(duration: 0.30))
            )
        )
    }

    // MARK: Step 4 — app preview (features blurbs around a central +)

    /// Final preview screen. The SceneKit scene fades to transparent behind
    /// us — the warm-dark page gradient + corner glow layers stay visible
    /// because they live on `view.layer`, not on `sceneView` — and we render
    /// a small annotated mock of the home UI on top: a big plus button in
    /// the centre with the two fan options it pops (Add a note, Create)
    /// splayed at the same (-DX, -DY) / (+DX, -DY) offsets the real
    /// `CreateMenuOverlay` uses, surrounded by four short feature blurbs —
    /// Notes, Profile, Library, Plus menu — each appearing one at a time so
    /// the user reads them in order rather than being hit with the whole
    /// grid at once. The page ends on the final "Let's get started" CTA
    /// that exits onboarding into the app.
    private var featuresOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 28)

            Text("Your new workspace")
                .font(.system(size: 22, weight: .medium, design: .monospaced))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
                .opacity(featuresAppeared ? 1 : 0)
                .offset(y: featuresAppeared ? 0 : 8)
                .animation(.easeOut(duration: 0.5).delay(0.15), value: featuresAppeared)

            Spacer()

            featuresMockup
                .frame(maxWidth: .infinity)

            Spacer()

            Button(action: {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onGetStarted()
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
            .opacity(featuresAppeared ? 1 : 0)
            .offset(y: featuresAppeared ? 0 : 12)
            .animation(.easeOut(duration: 0.5).delay(1.15), value: featuresAppeared)
            .allowsHitTesting(ctaReady)

            Spacer().frame(height: 52)
        }
        // Toggle the per-element appearance cascade on entry, and arm the
        // CTA gate after the CTA's own animation has finished so the button
        // can only be tapped once it's actually visible. We don't reset
        // either flag on disappear because step 4 is the final beat —
        // onGetStarted() dismisses the whole onboarding view.
        .onAppear {
            featuresAppeared = true
            // CTA animation: easeOut(0.5) with delay(1.15). Arm the gate
            // ~50ms before the animation visually settles so a fast-finger
            // user isn't blocked by an off-by-one frame.
            if !UIAccessibility.isReduceMotionEnabled && !ctaReady {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.60) {
                    ctaReady = true
                }
            }
        }
    }

    /// The mock in the centre: 4 feature cards arranged in two rows around a
    /// big white `+` button, with the two satellite option pills floating
    /// just above the plus (left = Add a note, right = Create). VStack +
    /// HStacks rather than absolute offsets so the layout adapts to phone
    /// width without clipping on narrower devices.
    private var featuresMockup: some View {
        VStack(spacing: 26) {
            // --- Top row: Notes (left) and Profile (right) ---
            HStack(alignment: .top) {
                featureBlurb(icon: "list.bullet",
                             title: "Notes",
                             subtitle: "All your\naudio notes",
                             delay: 0.65)
                Spacer(minLength: 12)
                featureBlurb(icon: "person.crop.circle.fill",
                             title: "Profile",
                             subtitle: "Settings &\naccount",
                             delay: 0.78)
            }
            .padding(.horizontal, 28)

            // --- Centre: big + button with its two option pills above ---
            // ZStack so the pills can fan above the plus without changing the
            // row's measured height. The pills describe what the plus pops in
            // the real app and are positioned at the same offsets the real
            // `CreateMenuOverlay` uses ((-DX, -DY) / (+DX, -DY)) so the
            // arrangement reads as a frozen-in-time copy of the real fan
            // menu, just scaled a touch tighter to fit the onboarding's
            // central row. Each pill spawns from the plus's centre (offset 0,
            // scale 0.18 with `.bottom` anchor) the same way the real fan
            // does, then fans out to its resting offset.
            ZStack {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.96))
                        .frame(width: 86, height: 86)
                        .shadow(color: Color(red: 0.85, green: 0.45, blue: 0.10).opacity(0.32),
                                 radius: 22, x: 0, y: 0)
                        .shadow(color: Color.black.opacity(0.45), radius: 14, x: 0, y: 8)
                    Image(systemName: "plus")
                        .font(.system(size: 36, weight: .light))
                        .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
                }
                .scaleEffect(featuresAppeared ? 1 : 0.5)
                .opacity(featuresAppeared ? 1 : 0)
                .animation(.spring(response: 0.55, dampingFraction: 0.72).delay(0.30),
                           value: featuresAppeared)

                optionPill(icon: "mic.fill", label: "Add a note")
                    .scaleEffect(featuresAppeared ? 1 : 0.18, anchor: .bottom)
                    .opacity(featuresAppeared ? 1 : 0)
                    .offset(x: featuresAppeared ? -90 : 0,
                            y: featuresAppeared ? -78 : 0)
                    .animation(.spring(response: 0.55, dampingFraction: 0.72).delay(0.50),
                               value: featuresAppeared)

                optionPill(icon: "sparkles", label: "Create")
                    .scaleEffect(featuresAppeared ? 1 : 0.18, anchor: .bottom)
                    .opacity(featuresAppeared ? 1 : 0)
                    .offset(x: featuresAppeared ? 90 : 0,
                            y: featuresAppeared ? -78 : 0)
                    .animation(.spring(response: 0.55, dampingFraction: 0.72).delay(0.56),
                               value: featuresAppeared)
            }
            .frame(height: 140)

            // --- Bottom row: Library (left) and + menu (right) ---
            HStack(alignment: .top) {
                featureBlurb(icon: "square.grid.2x2.fill",
                             title: "Library",
                             subtitle: "Saved\ncontent projects",
                             delay: 0.91)
                Spacer(minLength: 12)
                featureBlurb(icon: "plus.circle.fill",
                             title: "+ menu",
                             subtitle: "Add a note\nor create",
                             delay: 1.04)
            }
            .padding(.horizontal, 28)
        }
    }

    /// A small floating option pill next to the central `+`, mimicking the
    /// fan-menu pills in the real app — keeps the icon set (mic + sparkles)
    /// honest about what the user will see when they tap the plus.
    private func optionPill(icon: String, label: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
            Text(label)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(
            Capsule(style: .continuous)
                .fill(Color.white.opacity(0.94))
                .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
        )
    }

    /// One of the four feature blurbs — icon, mono title, two-line subtitle,
    /// inside a glassy translucent card. The `delay` parameter controls when
    /// the card slides + fades in on appearance so the four read as a
    /// sequence (Notes → Profile → Library → + menu) instead of a single
    /// burst.
    private func featureBlurb(icon: String,
                              title: String,
                              subtitle: String,
                              delay: Double) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(BrandColor.amber)
            Text(title)
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(Color.white.opacity(0.95))
            Text(subtitle)
                .font(.system(size: 10.5, weight: .regular, design: .rounded))
                .foregroundColor(Color.white.opacity(0.62))
                .multilineTextAlignment(.center)
                .lineSpacing(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .frame(width: 120)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.06))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.12), lineWidth: 0.5)
                )
        )
        .opacity(featuresAppeared ? 1 : 0)
        .scaleEffect(featuresAppeared ? 1 : 0.88)
        .offset(y: featuresAppeared ? 0 : 10)
        .animation(.spring(response: 0.55, dampingFraction: 0.78).delay(delay),
                   value: featuresAppeared)
    }
}

#Preview {
    OnboardingView(onGetStarted: {}, onLogin: {})
}
