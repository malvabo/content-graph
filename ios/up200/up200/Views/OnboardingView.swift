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
    case constellation = 2  // central bulb + 4 satellite bulbs joined by dot arcs + final CTA
    case capture = 3        // starfield "blurb" → press-and-hold record → transform / expand
}

private enum CapturePhase {
    case prompt      // stars drift inside the blurb; "Press and hold to record"
    case recording   // blurb morphs to a live waveform; "Finish recording" CTA below
    case choose      // headline question + 3 transform/expand tag options
}

struct OnboardingView: View {
    var onGetStarted: () -> Void
    var onLogin: () -> Void

    @State private var step: OnboardingStep = .intro
    @State private var appeared = false
    // Typewriter state for the brand mark — char-by-char typing of
    // lowercase "up150" in the mono font.
    @State private var brandTypedLength: Int = 0
    private let brandFull = "up150"

    // Capture-step state: which sub-phase the blurb is in, plus a live mic
    // session driving the waveform during .recording. The recorder is held
    // here (not constructed lazily on press) so audioLevel can be wired into
    // the waveform's TimelineView without resubscribing on every transition.
    @State private var capturePhase: CapturePhase = .prompt
    @StateObject private var captureRecorder = VoiceRecorder()
    @State private var recordingSeconds: Int = 0
    @State private var showCaptureMicAlert: Bool = false

    var body: some View {
        ZStack {
            // Shared scene across all steps — same SceneKit view stays mounted
            // so the dots can collapse inward (step 2) and then sprout
            // satellites + connector arcs (step 3) without cross-fading
            // between separate scenes. On the capture step (4) the whole
            // scene fades to a quiet backdrop and zooms toward the
            // top-right cloud so the starfield blurb reads as the focal
            // element while the surrounding atmosphere fills the view.
            OnboardingSceneView(step: step.rawValue)
                .opacity(step == .capture ? 0.18 : 1)
                .scaleEffect(step == .capture ? 1.8 : 1.0, anchor: .topTrailing)
                .animation(.easeInOut(duration: 0.65), value: step)
                .ignoresSafeArea()

            switch step {
            case .intro:         introOverlay
            case .transform:     transformOverlay
            case .constellation: constellationOverlay
            case .capture:       captureOverlay
            }
        }
        .onAppear { appeared = true }
    }

    // MARK: Step 1 — wide constellation

    private var introOverlay: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 12) {
                Text(String(brandFull.prefix(brandTypedLength)))
                    .font(.system(size: 52, weight: .regular, design: .monospaced))
                    .kerning(-0.5)
                    .foregroundColor(AppText.primary)

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

    /// Final onboarding beat: the collected bulb blooms outward into four
    /// smaller satellite bulbs, each formed by a flock of stars streaming
    /// out of the central cluster along a brief arc and settling into a
    /// dense shell. No persistent trail is drawn between the centre and
    /// the satellites — the four content clusters stay visually separate
    /// once formed. Visually states the app's core metaphor — one idea
    /// blooming into a graph of related content — before the user lands
    /// on the home screen.
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
                withAnimation(.easeInOut(duration: 0.55)) {
                    step = .capture
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
        // Same easeIn delay as step 2 so the satellites + connectors finish
        // their first beats of motion before the headline and CTA resolve —
        // scene leads, copy follows, just as the previous step does.
        .transition(.opacity.animation(.easeIn(duration: 0.55).delay(0.35)))
    }

    // MARK: Step 4 — Capture (starfield blurb → record → choose)

    /// Closing onboarding beat. The story so far is "one idea → graph of
    /// content"; step 4 asks the user to make that idea real. A rectangular
    /// blurb hosts the same starfield language as the SceneKit cluster, the
    /// user presses-and-holds it to start a real mic recording, the blurb
    /// morphs into a live waveform, and finishing reveals three transform
    /// options (LinkedIn / article / Twitter) that exit onboarding.
    private var captureOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 24)

            captureHeadline
                .padding(.horizontal, 28)
                .padding(.top, 12)

            Spacer(minLength: 24)

            captureCenter
                .padding(.horizontal, 24)

            Spacer(minLength: 24)

            captureBottom
                .padding(.horizontal, 28)

            Spacer().frame(height: 52)
        }
        .animation(.easeInOut(duration: 0.45), value: capturePhase)
        .transition(.opacity.animation(.easeIn(duration: 0.55).delay(0.25)))
        .task {
            // Tick the on-screen mm:ss only while the recorder is active.
            // Loop exits when the view is torn down (SwiftUI cancels .task).
            while !Task.isCancelled {
                do { try await Task.sleep(nanoseconds: 1_000_000_000) }
                catch { break }
                if captureRecorder.isRecording { recordingSeconds += 1 }
            }
        }
        .onChange(of: captureRecorder.permissionDenied) { _, denied in
            if denied {
                showCaptureMicAlert = true
                withAnimation(.easeInOut(duration: 0.35)) {
                    capturePhase = .prompt
                }
            }
        }
        .alert("Microphone access", isPresented: $showCaptureMicAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Skip", role: .cancel) { onGetStarted() }
        } message: {
            Text("Microphone access is needed to capture your first idea. You can also skip and start exploring.")
        }
        .onDisappear { captureRecorder.stop() }
    }

    @ViewBuilder private var captureHeadline: some View {
        switch capturePhase {
        case .prompt, .recording:
            Text("Let's capture\nyour first idea")
                .font(.system(size: 22, weight: .medium, design: .monospaced))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .transition(.opacity)
        case .choose:
            VStack(spacing: 6) {
                Text("Your idea is safe here.")
                    .font(.system(size: 20, weight: .medium, design: .monospaced))
                    .kerning(-0.3)
                    .foregroundColor(AppText.primary)
                Text("Transform or expand it?")
                    .font(.system(size: 20, weight: .medium, design: .monospaced))
                    .kerning(-0.3)
                    .foregroundColor(Color.white.opacity(0.72))
            }
            .multilineTextAlignment(.center)
            .transition(.opacity)
        }
    }

    @ViewBuilder private var captureCenter: some View {
        switch capturePhase {
        case .prompt:
            VStack(spacing: 18) {
                StarfieldBlurb(active: true)
                    .frame(height: 180)
                    .background(Color.white.opacity(0.04))
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                    )
                    // Long-press initiates recording. minimumDuration is short
                    // enough that the gesture feels like a confirm-tap, not a
                    // hold — once .recording starts, the user can let go and
                    // tap "Finish recording" below.
                    .onLongPressGesture(minimumDuration: 0.3, maximumDistance: 30) {
                        startCaptureRecording()
                    }

                Text("Press and hold to start recording\nyour first idea")
                    .font(.system(size: 14, weight: .regular, design: .rounded))
                    .foregroundColor(Color.white.opacity(0.58))
                    .multilineTextAlignment(.center)
            }
            .transition(.opacity)

        case .recording:
            VStack(spacing: 18) {
                OnboardingRecordingWaveform(recorder: captureRecorder)
                    .frame(height: 180)
                    .frame(maxWidth: .infinity)
                    .background(BrandColor.amber.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 22, style: .continuous)
                            .stroke(BrandColor.amber.opacity(0.20), lineWidth: 0.5)
                    )

                HStack(spacing: 8) {
                    Circle()
                        .fill(BrandColor.amber)
                        .frame(width: 7, height: 7)
                    Text("Recording  \(formatCaptureTime(recordingSeconds))")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(BrandColor.amber.opacity(0.92))
                }
            }
            .transition(.opacity)

        case .choose:
            VStack(spacing: 12) {
                captureTagRow(label: "A LinkedIn post", icon: "person.2.fill")
                captureTagRow(label: "A short article", icon: "doc.text")
                captureTagRow(label: "A Twitter thread", icon: "text.bubble")
            }
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        }
    }

    @ViewBuilder private var captureBottom: some View {
        switch capturePhase {
        case .prompt:
            // Reserve the CTA slot so the layout doesn't reflow when the
            // "Finish recording" button appears.
            Color.clear.frame(height: 54)
        case .recording:
            Button(action: finishCaptureRecording) {
                Text("Finish recording")
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(Color(red: 0.10, green: 0.08, blue: 0.07))
                    .frame(maxWidth: .infinity)
                    .frame(height: 54)
                    .background(Color.white.opacity(0.94))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
            .buttonStyle(.plain)
            .transition(.opacity.combined(with: .move(edge: .bottom)))
        case .choose:
            Color.clear.frame(height: 54)
        }
    }

    private func captureTagRow(label: String, icon: String) -> some View {
        Button(action: {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onGetStarted()
        }) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(BrandColor.amber.opacity(0.92))
                    .frame(width: 22)
                Text(label)
                    .font(.app(size: 16, weight: .medium))
                    .foregroundColor(AppText.primary)
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.45))
            }
            .padding(.horizontal, 18)
            .frame(height: 56)
            .background(Color.white.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
    }

    private func startCaptureRecording() {
        guard capturePhase == .prompt else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        recordingSeconds = 0
        captureRecorder.start()
        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .recording
        }
    }

    private func finishCaptureRecording() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        captureRecorder.stop()
        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .choose
        }
    }

    private func formatCaptureTime(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
}

// MARK: - Starfield blurb

/// Self-contained animated starfield rendered with SwiftUI Canvas. Uses the
/// same particle vocabulary as the SceneKit cluster (soft white dots, gentle
/// drift, slow brightness pulse) so the blurb reads as a continuation of the
/// constellation story rather than a separate UI surface. Stays at a fixed
/// star count and seeded layout so the field looks stable across redraws.
private struct StarfieldBlurb: View {
    let active: Bool
    private let starCount = 64

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                for i in 0..<starCount {
                    let rx = pseudoRandom(i * 3)
                    let ry = pseudoRandom(i * 3 + 1)
                    let ra = pseudoRandom(i * 3 + 2)

                    // Each star drifts on its own lazy ellipse — phases are
                    // index-offset so the field never moves in unison.
                    let phase = t * 0.22 + Double(i) * 0.41
                    let dx = sin(phase) * 5.5
                    let dy = cos(phase * 1.27) * 4.0

                    let x = rx * size.width + dx
                    let y = ry * size.height + dy

                    let pulse = 0.65 + 0.35 * sin(t * 1.6 + Double(i) * 0.31)
                    let radius = (0.75 + ra * 1.45) * (active ? 1.0 : 0.85)
                    let alpha = (0.32 + ra * 0.52) * pulse * (active ? 1.0 : 0.5)

                    let rect = CGRect(x: x - radius, y: y - radius,
                                      width: radius * 2, height: radius * 2)
                    ctx.fill(Path(ellipseIn: rect), with: .color(.white.opacity(alpha)))
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func pseudoRandom(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

// MARK: - Onboarding recording waveform

/// Amber bar waveform driven by the live mic level. Mirrors the look of the
/// in-app `VoiceRecorderWaveform` (taller bars + same envelope curve) so the
/// onboarding recorder feels like the same instrument the user will see
/// later inside the app.
private struct OnboardingRecordingWaveform: View {
    let recorder: VoiceRecorder
    private let barCount = 38

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = recorder.audioLevel
            HStack(spacing: 3) {
                ForEach(0..<barCount, id: \.self) { i in
                    Capsule()
                        .fill(BrandColor.amber.opacity(barOpacity(index: i)))
                        .frame(width: 3, height: barHeight(level: level, index: i, time: t))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(.horizontal, 18)
        .accessibilityHidden(true)
    }

    private func barHeight(level: Float, index: Int, time: Double) -> CGFloat {
        let pos = Double(index) / Double(barCount - 1)
        let envelope = sin(pos * .pi)
        let phase1 = time * 4.5 + Double(index) * 0.42
        let phase2 = time * 2.8 + Double(index) * 0.65
        let wave = (sin(phase1) * 0.65 + sin(phase2) * 0.35 + 1.0) / 2.0
        let amplified = min(1.0, pow(Double(max(level, 0.005)), 0.28) * 2.8)
        let dynamic = wave * amplified * envelope
        return 6 + CGFloat(dynamic) * 140
    }

    private func barOpacity(index: Int) -> Double {
        let pos = Double(index) / Double(barCount - 1)
        return 0.55 + sin(pos * .pi) * 0.45
    }
}

#Preview {
    OnboardingView(onGetStarted: {}, onLogin: {})
}
