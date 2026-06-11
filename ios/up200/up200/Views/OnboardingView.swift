import AuthenticationServices
import CryptoKit
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
    case constellation = 2  // central bulb + 4 satellite bulbs joined by dot arcs + final CTA
    case capture = 3        // cloud background → press-and-hold record → transform / expand
}

private enum CapturePhase {
    case prompt      // stars drift inside the blurb; "Press and hold to record"
    case recording   // blurb morphs to a live waveform; "Finish recording" CTA below
    case choose      // headline question + content-type / save / "something else" options
    case specify     // user picked "Something else" — second recording for what they want
    case generating  // user picked a content type — pill with orbiting dots, then exit
}

struct OnboardingView: View {
    var onGetStarted: () -> Void
    var onLogin: () -> Void

    @State private var step: OnboardingStep = .intro
    @State private var appeared = false
    @StateObject private var appleSignIn = AppleSignInCoordinator()
    @State private var authError: String? = nil
    @State private var pendingNonce: String?
    // Typewriter state for the brand mark — char-by-char typing of
    // "Oula" in the mono font.
    @State private var brandTypedLength: Int = 0
    private let brandFull = "Oula"

    // Capture-step state: which sub-phase the blurb is in, plus a live mic
    // session driving the waveform during .recording. The recorder is held
    // here (not constructed lazily on press) so audioLevel can be wired into
    // the waveform's TimelineView without resubscribing on every transition.
    @State private var capturePhase: CapturePhase = .prompt
    @StateObject private var captureRecorder = VoiceRecorder()
    @State private var recordingSeconds: Int = 0
    @State private var specifySeconds: Int = 0
    // Wall-clock anchor for each recording so the displayed mm:ss is computed
    // from Date() at render time rather than from a 1-second .task poll, which
    // drifts under main-thread pressure (the .generating Canvas can stretch
    // ticks past their nominal 1.0s interval). The Int seconds counters above
    // are kept as a backing store for the on-screen text so SwiftUI only
    // invalidates that subtree when the second actually rolls over.
    @State private var recordingStartedAt: Date = .distantPast
    @State private var specifyStartedAt: Date = .distantPast
    @State private var showCaptureMicAlert: Bool = false
    @State private var chosenContentLabel: String = ""
    @State private var generatingTask: Task<Void, Never>? = nil
    // The first recording's transcript becomes the source we feed to the
    // generator. We snapshot it the moment the user finishes recording —
    // starting a second recording (the "Something else" specify pass)
    // rewires SFSpeechRecognizer and clobbers `captureRecorder.transcript`
    // with the new text, so reading it lazily would lose the original idea.
    @State private var firstIdeaTranscript: String = ""
    // Deferred task that re-snapshots `firstIdeaTranscript` ~700ms after
    // finishCaptureRecording so the recognizer's final isFinal callback
    // (which carries the last 200-500ms of speech) lands in our captured
    // value. Cancelled when a new recording starts so the second pass
    // can't clobber the first idea.
    @State private var firstIdeaSnapshotTask: Task<Void, Never>? = nil
    @State private var resultNote: Note? = nil

    @State private var generatingStartedAt: Date = .distantPast
    // Step 3 (.constellation) renders the same orange-spark / central-cloud
    // scene used during .capture/.generating, so the "one idea → graph"
    // metaphor is spoken in the same visual vocabulary across onboarding.
    @State private var constellationStartedAt: Date = .distantPast
    // Set at the instant the .constellation → .capture dive begins. The
    // cluster scene freezes at this time for the duration of the scale-out:
    // without it, the cluster's rotation + amber spark firings keep running
    // *while* the view is being scaled 1× → 3.5×, and every pixel of that
    // internal motion gets amplified by the scale-up — the eye reads it as
    // trembling rather than a clean dive. Holding the cluster on a single
    // frame for the dive makes the zoom a pure motion of one still image.
    @State private var diveStartedAt: Date? = nil
    // True once the user can manually advance past the constellation hold
    // (after the cluster has bloomed enough to read as a complete gesture
    // and the "Continue" button has had time to fade in). Lets impatient
    // users skip the remaining ~5s before the auto-dive fires.
    @State private var constellationContinueArmed = false
    // Idempotency latch on the .constellation → .capture dive — either the
    // auto-task or the manual Continue button can drive it, but only
    // one of them should actually flip the step.
    @State private var diveInFlight = false

    var body: some View {
        ZStack {
            // SceneKit wide-constellation backdrop for the intro step only.
            // Rendered conditionally instead of held at opacity 0 on later
            // steps — SCNView paints into its own Metal-backed CAMetalLayer,
            // which can keep compositing pixels through an outer SwiftUI
            // .opacity(0) and leave a ghost dust pattern on top of the
            // starfield after the dive. Tearing down the representable
            // entirely on .constellation / .capture removes the layer, so
            // nothing from the SceneKit cluster can leak onto the next beat.
            if step == .intro {
                OnboardingSceneView(step: step.rawValue)
                    .ignoresSafeArea()
                    // No inner .animation override — inherit the wrapping
                    // withAnimation curve set by the Get-started button
                    // (.easeOut(0.85)). Previously hardcoded easeInOut here
                    // diverged from the cloud's easeOut zoom curve, so the
                    // intro fade and the cloud contraction crossed paths at
                    // different points in the timeline and read as two
                    // unrelated motions.
                    .transition(.opacity)
            }

            if step == .constellation || (step == .capture && captureCloudVisible) {
                let isCaptureBackground = step == .capture
                GeneratingCloudScene(generationStartedAt: constellationStartedAt,
                                     frozenAt: diveStartedAt,
                                     showsContentGraph: !isCaptureBackground)
                    .ignoresSafeArea()
                    .scaleEffect(isCaptureBackground ? 3.5 : 1)
                    .opacity(isCaptureBackground ? captureCloudOpacity : 1)
                    .contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0).onChanged { _ in
                        guard capturePhase == .prompt else { return }
                        startCaptureRecording()
                    })
                    .allowsHitTesting(step == .capture && capturePhase == .prompt)
                    .animation(.easeIn(duration: 0.85), value: step)
                    .animation(.easeInOut(duration: 0.45), value: capturePhase)
                    // Insertion (.intro → .constellation): fade only. Scaling
                    // the dense central dot field down during phone screen
                    // recording causes subpixel aliasing that reads as random
                    // trembling while the cloud settles into place.
                    //
                    // Removal (.constellation → .capture): the cluster
                    // is no longer removed. It enlarges and dims in place,
                    // becoming the capture-step background instead of sitting
                    // over a separate starfield layer.
                    .transition(
                        .asymmetric(
                            insertion: .opacity,
                            removal: .opacity
                        )
                    )
            }

            switch step {
            case .intro:         introOverlay
            case .constellation: constellationOverlay
            case .capture:       captureOverlay
            }

            if let note = resultNote {
                MinimalNoteDetailPage(initialNote: note, initialTabIndex: 1,
                                      onDismiss: {
                    withAnimation(.easeOut(duration: 0.25)) { resultNote = nil }
                    generatingTask?.cancel()
                    generatingTask = nil
                    onGetStarted()
                })
                .environmentObject(ChromeController())
                .environmentObject(RecordingController())
                .preferredColorScheme(.dark)
                .transition(.opacity)
                .zIndex(10)
            }
        }
        .onAppear { appeared = true }
    }

    private var captureCloudVisible: Bool {
        switch capturePhase {
        case .prompt, .recording, .choose, .specify:
            true
        case .generating:
            false
        }
    }

    private var captureCloudOpacity: Double {
        switch capturePhase {
        case .prompt:
            0.65
        case .recording, .specify:
            0.12
        case .choose:
            0.56
        case .generating:
            0
        }
    }

    // MARK: Step 1 — wide constellation

    private var introOverlay: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: 12) {
                Text(String(brandFull.prefix(brandTypedLength)))
                    .font(.lora(size: 52, weight: .regular))
                    .kerning(-0.5)
                    .foregroundColor(AppText.primary)

                Text("Framing your ideas beautifully")
                    .font(.system(size: 18, weight: .regular, design: .rounded))
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
                SignInWithAppleButton(.continue) { request in
                    pendingNonce = appleSignIn.setupRequest(request)
                } onCompletion: { result in
                    startAppleLoginWithResult(result)
                }
                .signInWithAppleButtonStyle(.whiteOutline)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .cornerRadius(Radius.card)

                if let authError {
                    Text(authError)
                        .font(.appSmall)
                        .foregroundColor(Color(red: 0.95, green: 0.42, blue: 0.34))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 4)
                }

                Button {
                    constellationStartedAt = Date().addingTimeInterval(0.45)
                    withAnimation(.easeOut(duration: 0.85)) {
                        step = .constellation
                    }
                } label: {
                    Text("Explore")
                        .font(.app(size: 17, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.78))
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
                        .background(Color.white.opacity(0.10))
                        .clipShape(RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                                .strokeBorder(Color.white.opacity(0.20), lineWidth: 1)
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
        // Removal accelerated to 0.20s so the intro's white pills are
        // gone quickly when the user taps Get started — the next beat
        // is the orange cluster, and lingering CTAs would ghost over
        // the new scene as it fades in.
        .transition(.asymmetric(
            insertion: .opacity,
            removal: .opacity.animation(.easeInOut(duration: 0.20))
        ))
    }

    private func startAppleLoginWithResult(_ result: Result<ASAuthorization, Error>) {
        authError = nil
        let nonce = pendingNonce
        pendingNonce = nil
        switch result {
        case .failure(let error as NSError)
            where error.domain == ASAuthorizationError.errorDomain
            && error.code == ASAuthorizationError.canceled.rawValue:
            return
        case .failure(let error):
            authError = error.localizedDescription
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else {
                authError = "Could not read Apple credentials. Try again."
                return
            }
            appleSignIn.handleCredential(credential, nonce: nonce, onSuccess: {
                constellationStartedAt = Date().addingTimeInterval(0.45)
                withAnimation(.easeOut(duration: 0.85)) {
                    step = .constellation
                }
            }) { error in
                authError = error.localizedDescription
            }
        }
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
        // 'Transform your ideas / into high quality content' carries the
        // post-intro beat: the user reads one message while the central
        // bulb collapses, the satellites bloom, and the camera dives into
        // the cloud. Was previously a `Color.clear` with no copy, which
        // left the satellites floating without context.
        VStack(spacing: 0) {
            Spacer().frame(height: 24)

            Text("Transform your ideas\ninto high quality content")
                .font(.lora(size: 22, weight: .medium))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .padding(.horizontal, 28)
                .padding(.top, 12)
                // Decorative — taps fall through to the SceneKit cluster
                // (which itself disables hit testing). The Continue button
                // below is the only interactive element in this overlay.
                .allowsHitTesting(false)

            Spacer()
                .allowsHitTesting(false)

            // Continue affordance — appears after ~2.5s so the user has
            // seen the first satellite bloom and the second in flight
            // (the gesture reads as intentional rather than mid-animation)
            // and lets impatient users skip the remaining hold.
            Button(action: triggerDiveNow) {
                HStack(spacing: 6) {
                    Text("Continue")
                        .font(.app(size: 15, weight: .medium))
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                }
                .foregroundColor(Color.white.opacity(0.78))
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.08))
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(Color.white.opacity(0.14), lineWidth: 0.5)
                )
            }
            .buttonStyle(.plain)
            .opacity(constellationContinueArmed ? 1 : 0)
            .animation(.easeOut(duration: 0.5), value: constellationContinueArmed)
            .allowsHitTesting(constellationContinueArmed)

            Spacer().frame(height: 36)
        }
        // Delayed easeIn lets the bulb collapse settle before the headline
        // resolves — scene leads, copy follows, same shape the rest of
        // onboarding uses. Fast easeOut removal so it's gone before the
        // capture step's delayed headline starts fading in.
        .transition(.asymmetric(
            insertion: .opacity.animation(.easeIn(duration: 0.55).delay(0.35)),
            removal:   .opacity.animation(.easeOut(duration: 0.22))
        ))
        // Hold long enough for the cluster to bloom out into its
        // satellites and read as a finished gesture before the camera
        // dives into it. The constellation clock is stamped slightly in
        // the future when entering this step, so the first satellite waits
        // for the scene transition to settle without leaving a long empty
        // beat before generation starts.
        .task {
            // Arm the Continue button after 2.5s — by that point the
            // first satellite has bloomed, the second is forming, and the
            // headline has fully faded in, so the button reads as part of
            // the same scene rather than competing with the opening beat.
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.5)) {
                constellationContinueArmed = true
            }
            // Auto-dive after the remaining 4s if the user hasn't tapped
            // Continue. Total hold still leaves the whole bloom visible.
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard !Task.isCancelled else { return }
            triggerDiveNow()
        }
    }

    /// Drives the .constellation → .capture transition. Idempotent — the
    /// auto-task and the Continue button may both call this; only the
    /// first call flips state, the second is a no-op.
    private func triggerDiveNow() {
        guard !diveInFlight, step == .constellation else { return }
        diveInFlight = true
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        // Freeze the cluster first, then flip the step on a later runloop
        // turn — the two changes must land in *separate* transactions.
        // SwiftUI animates a removed `if` branch using the last version of
        // that view it committed while the branch was still on screen. If
        // `diveStartedAt` and `step` change together, the branch is already
        // gone by the time the new `frozenAt` is seen, so the cloud scene
        // that scales to 3.5× is the last *unfrozen* one: its rotation and
        // amber spark firings keep running, and the zoom amplifies that
        // internal motion into the shake. Setting diveStartedAt on its own
        // forces a commit where the on-screen cloud is already frozen; that
        // frozen frame is then the still image the dive carries past the
        // camera.
        diveStartedAt = Date()
        Task { @MainActor in
            // ~3 frames — long enough for SwiftUI to commit the frozen
            // render before the step flip removes the cloud.
            try? await Task.sleep(nanoseconds: 50_000_000)
            // 0.85s, easeIn — the frozen scene scales + fades through the
            // camera. See the constellation task body for the curve rationale.
            withAnimation(.easeIn(duration: 0.85)) {
                self.step = .capture
            }
            // Cloud stays frozen for the entire capture phase so the enlarged
            // background remains pixel-stable during recording — no drift or
            // breathing motion behind the waveform circle.
        }
    }

    // MARK: Step 4 — Capture (cloud background → record → choose)

    /// Closing onboarding beat. The story so far is "one idea → graph of
    /// content"; step 4 asks the user to make that idea real. The same
    /// central cloud becomes the full-screen press-and-hold surface, then
    /// dims behind recording and choose states so the visual thread stays
    /// continuous instead of swapping to a separate background.
    private var captureOverlay: some View {
        VStack(spacing: 0) {
            Spacer().frame(height: 24)

            captureHeadline
                .padding(.vertical, 10)
                .padding(.horizontal, 16)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.black.opacity(0.40))
                        .blur(radius: 20)
                )
                .padding(.horizontal, 28)
                .padding(.top, 12)

            Spacer(minLength: 24)

            captureCenter
                // Reserve the waveform circle height even during .prompt so
                // the layout doesn't reflow (and shift all surrounding
                // elements) when the waveform fades in on recording start.
                .frame(minHeight: UIScreen.main.bounds.width * 2 / 3)
                .padding(.horizontal, 24)

            Spacer(minLength: 24)

            captureBottom
                .padding(.horizontal, 28)

            Spacer().frame(height: 52)
        }
        // During .prompt the entire overlay is decorative — the only
        // interactive element is the full-screen cloud behind
        // it, which owns the press-and-hold gesture. Without this
        // allowsHitTesting flip, the headline text and the bottom
        // `Color.clear` placeholder would each carve a strip of the
        // screen where the long-press silently fails to fire.
        .allowsHitTesting(capturePhase != .prompt)
        .animation(.easeOut(duration: 0.18), value: capturePhase)
        // Enter with the transformed cloud so the prompt and background land
        // as one composed scene after Continue.
        // Exit: not actually used today (.capture is terminal in
        // onboarding) but mirror the pattern so it's correct if the flow
        // ever reverses.
        .transition(.asymmetric(
            insertion: .opacity.animation(.easeOut(duration: 0.30)),
            removal:   .opacity.animation(.easeOut(duration: 0.22))
        ))
        .task {
            // Refresh the displayed mm:ss from the wall-clock anchor each
            // second the recorder is active. Computing from Date() rather
            // than incrementing a counter avoids the drift the old loop hit
            // when Task.sleep ran long under main-thread contention — at the
            // cost of one extra Date() comparison per tick, which is free.
            while !Task.isCancelled {
                do { try await Task.sleep(nanoseconds: 1_000_000_000) }
                catch { break }
                guard captureRecorder.isRecording else { continue }
                switch capturePhase {
                case .recording:
                    recordingSeconds = Int(Date().timeIntervalSince(recordingStartedAt))
                case .specify:
                    specifySeconds = Int(Date().timeIntervalSince(specifyStartedAt))
                default:
                    break
                }
            }
        }
        .onChange(of: captureRecorder.permissionDenied) { _, denied in
            if denied {
                showCaptureMicAlert = true
                withAnimation(.easeInOut(duration: 0.35)) {
                    // If the user already cleared the first recording and only
                    // got blocked on the specify pass, drop them back into the
                    // choose list rather than restarting the whole flow.
                    capturePhase = capturePhase == .specify ? .choose : .prompt
                }
            }
        }
        .alert("Microphone access", isPresented: $showCaptureMicAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Skip", role: .cancel) {
                // Treat Skip differently per phase. From .prompt the user
                // never recorded anything, so exit onboarding entirely.
                // From .choose (denial caught on .specify and bounced
                // back) keep them on the choose list — they still have a
                // valid first idea and can pick a content type or save.
                if capturePhase == .choose {
                    // Already moved back to .choose by the onChange below.
                    // Nothing to do; just dismiss the alert.
                } else {
                    onGetStarted()
                }
            }
        } message: {
            Text("Microphone access is needed to capture your first idea. You can also skip and start exploring.")
        }
        .onDisappear {
            captureRecorder.stop()
            generatingTask?.cancel()
            generatingTask = nil
            firstIdeaSnapshotTask?.cancel()
            firstIdeaSnapshotTask = nil
        }
        // Drop the user straight onto the per-note detail page the app uses
        // for every note — a "Note" tab plus a tab for the generation just
        // produced. When they dismiss it, fall through to onGetStarted so
        // onboarding exits: they've now seen both the create flow and the
        // notes-and-generations surface they'll live in.
    }

    @ViewBuilder private var captureHeadline: some View {
        switch capturePhase {
        case .prompt, .recording:
            Text("Let's capture\nyour first idea")
                .font(.lora(size: 22, weight: .medium))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .transition(.opacity)
        case .choose:
            Text("What do you want to create?")
                .font(.lora(size: 20, weight: .medium))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .transition(.opacity)
        case .generating:
            // The "What do you want to create?" question is past — the user
            // has picked. Keeping just the reassurance line lets the cloud
            // animation below carry the rest of the message.
            Text("Shaping your first idea\u{2026}")
                .font(.lora(size: 20, weight: .medium))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .transition(.opacity)
        case .specify:
            Text("What do you want to\u{2026}?")
                .font(.lora(size: 22, weight: .medium))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
                .transition(.opacity)
        }
    }

    @ViewBuilder private var captureCenter: some View {
        switch capturePhase {
        case .prompt:
            // The cloud itself is rendered as a full-screen background in
            // the parent ZStack and owns the press-and-hold gesture. This
            // slot just hosts the visible caption pinned in the middle of
            // the layout, with hit-testing disabled so taps fall through
            // to the cloud behind it.
            Text("Press and hold to start recording\nyour first idea")
                .font(.system(.subheadline, design: .rounded))
                .foregroundColor(Color.white.opacity(0.62))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .allowsHitTesting(false)
                .transition(.opacity)

        case .recording:
            // captureRecorder.isRecording becomes true only after the
            // async mic auth + audio engine start completes (50-500ms
            // after the long-press fires). The "Listening…" label tells
            // the user the engine is spinning up so they don't start
            // speaking into a deaf microphone during the gap.
            let isLive = captureRecorder.isRecording
            VStack(spacing: 18) {
                let waveSize = UIScreen.main.bounds.width * 2 / 3
                RecordingWaveformView(audioLevel: { captureRecorder.audioLevel })
                    .frame(width: waveSize, height: waveSize)
                    .background(Color.white.opacity(0.05))
                    .clipShape(Circle())

                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.white.opacity(0.5))
                        .frame(width: 7, height: 7)
                    Text(isLive
                         ? "Recording  \(formatCaptureTime(recordingSeconds))"
                         : "Listening\u{2026}")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(Color.white.opacity(0.55))
                        .contentTransition(.opacity)
                        .animation(.easeIn(duration: 0.35), value: isLive)
                }
            }
            .transition(.opacity)

        case .choose:
            chooseCirclesField
                // Pure fade-in. The slide directions (.bottom, then .top)
                // both pulled the eye in a direction; a dissolve is the
                // calmer "appears" the design ask wants.
                .transition(.opacity)

        case .specify:
            let isLive = captureRecorder.isRecording
            VStack(spacing: 18) {
                let waveSize = UIScreen.main.bounds.width * 2 / 3
                RecordingWaveformView(audioLevel: { captureRecorder.audioLevel })
                    .frame(width: waveSize, height: waveSize)
                    .background(Color.white.opacity(0.05))
                    .clipShape(Circle())

                HStack(spacing: 8) {
                    Circle()
                        .fill(Color.white.opacity(0.5))
                        .frame(width: 7, height: 7)
                    Text(isLive
                         ? "Recording  \(formatCaptureTime(specifySeconds))"
                         : "Listening\u{2026}")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(Color.white.opacity(0.55))
                }
            }
            .transition(.opacity)

        case .generating:
            // Immersive cloud scene: a spherical, slowly-rotating cluster of
            // stars that fills the frame so the user reads as standing
            // *inside* the cloud. Periodically a dot on the sphere ignites
            // to amber and connects with a thin line to the previously
            // ignited dot, building a graph of orange nodes around the
            // viewer while the network call is in flight. Nothing fires
            // outside the sphere.
            VStack(spacing: 14) {
                // maxHeight (was fixed 420) lets the sphere shrink on
                // shorter screens; the negative horizontal padding is
                // gone — letting the scene render to its full inscribed
                // size produces a centred sphere even on iPhone SE rather
                // than one whose right edge was being pushed off-screen
                // by the parent's 24pt inset combined with the -24pt
                // counter-inset.
                InsideSphereScene(generationStartedAt: generatingStartedAt)
                    .frame(maxWidth: .infinity)
                    .frame(maxHeight: 420)

                Text("Writing your content\u{2026}")
                    .font(.system(.subheadline, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.62))
            }
            .transition(.opacity)
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
        case .specify:
            Button(action: finishSpecifyRecording) {
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
        case .generating:
            Color.clear.frame(height: 54)
        }
    }

    /// The four `.choose` options rendered as glowing semi-transparent circles
    /// in a 2×2 grid. Each circle has a blurred halo overlay for a soft glow
    /// effect, plus a sharp stroke edge, against the cloud background.
    private var chooseCirclesField: some View {
        struct ChooseOption {
            let label: String
            let action: () -> Void
        }

        let options: [ChooseOption] = [
            ChooseOption(label: "A LinkedIn post", action: {
                startGeneration(label: "A LinkedIn post", formatID: "linkedin", customPrompt: "")
            }),
            ChooseOption(label: "A Twitter thread", action: {
                startGeneration(label: "A Twitter thread", formatID: "twitter", customPrompt: "")
            }),
            ChooseOption(label: "A short message", action: {
                startGeneration(label: "A short message", formatID: "message", customPrompt: "")
            }),
            ChooseOption(label: "Just save my note for now", action: {
                saveIdeaAndExit()
            })
        ]

        // Sized from the *narrower* of width / proposed height so the
        // field shrinks to fit narrow phones (SE-class at 320pt available
        // width) and still has headroom for the icon+label VStack inside
        // each circle to render at AX Dynamic Type. Was hard-coded to
        // 0.24 of width with a fixed 360pt frame — at AX5 the inner VStack
        // pushed past the bottom row's inscribed circle and clipped.
        return GeometryReader { geo in
            let dim = min(geo.size.width, geo.size.height)
            let circleRadius: CGFloat = min(dim * 0.21, 73)
            // Generous gap so the four circles breathe rather than crowd.
            let cellOffset: CGFloat = circleRadius * 1.12
            let cx = geo.size.width / 2
            let cy = geo.size.height / 2
            let positions: [CGPoint] = [
                CGPoint(x: cx - cellOffset, y: cy - cellOffset),
                CGPoint(x: cx + cellOffset, y: cy - cellOffset),
                CGPoint(x: cx - cellOffset, y: cy + cellOffset),
                CGPoint(x: cx + cellOffset, y: cy + cellOffset),
            ]

            TimelineView(.animation(minimumInterval: 1.0 / 20.0)) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                ZStack {
                    ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                        let fi = Double(idx)
                        // Each circle drifts at a slightly different frequency so
                        // they float independently rather than moving in unison.
                        let driftX = sin(t * (0.31 + fi * 0.019) + fi * 1.7) * 4.5
                        let driftY = cos(t * (0.27 + fi * 0.023) + fi * 2.3) * 4.5
                        let pos = CGPoint(x: positions[idx].x + driftX,
                                          y: positions[idx].y + driftY)
                        chooseCircleButton(label: opt.label, seed: idx, radius: circleRadius, action: opt.action)
                            .position(pos)
                    }
                }
            }
        }
        .frame(maxHeight: 310)
    }

    @ViewBuilder
    private func chooseCircleButton(label: String, seed: Int, radius: CGFloat, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            chooseCircleContent(label: label, seed: seed, radius: radius)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func chooseCircleContent(label: String, seed: Int, radius: CGFloat) -> some View {
        let d = radius * 2
        let shape = WobblyCircle(seed: seed)
        let outerGlow = shape.stroke(Color.white.opacity(0.08), lineWidth: 3).blur(radius: 12).padding(-8)
        let midGlow   = shape.stroke(Color.white.opacity(0.12), lineWidth: 1.5).blur(radius: 5).padding(-3)
        let innerRim  = shape.stroke(Color.white.opacity(0.20), lineWidth: 0.8)
        Text(label)
            .font(.lora(size: 16, weight: .medium))
            .foregroundColor(AppText.primary)
            .multilineTextAlignment(.center)
            .lineLimit(3)
            .minimumScaleFactor(0.85)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 13)
            .frame(width: d, height: d)
            .background(shape.fill(Color(white: 0.10).opacity(0.82)))
            .overlay(outerGlow)
            .overlay(midGlow)
            .overlay(innerRim)
            .contentShape(shape)
    }

    private func startCaptureRecording() {
        guard capturePhase == .prompt else { return }
        // .onChange(of: permissionDenied) below only fires on a *transition*
        // to true; if the user previously denied mic access in a past session
        // the flag is already true at view load and no .onChange runs. Catch
        // that case here so the long-press surfaces the alert instead of
        // silently flipping into a recording state with no audio.
        if captureRecorder.permissionDenied {
            showCaptureMicAlert = true
            return
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        recordingSeconds = 0
        recordingStartedAt = Date()
        withAnimation(.easeOut(duration: 0.30)) {
            capturePhase = .recording
        }
        captureRecorder.start()
    }

    private func finishCaptureRecording() {
        guard capturePhase == .recording else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        // Take an immediate snapshot as a floor, then re-snapshot after a
        // short delay so the recognizer's final isFinal callback (which
        // arrives 200-500ms after endAudio()) can land in `transcript`
        // before we capture it. Without the deferred update, the last
        // sentence of a user's idea is silently dropped.
        firstIdeaTranscript = captureRecorder.transcript
        captureRecorder.stop()
        firstIdeaSnapshotTask?.cancel()
        firstIdeaSnapshotTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            // Only overwrite if no second recording has rewired the
            // recognizer in the meantime (.specify clobbers transcript).
            if capturePhase == .choose {
                firstIdeaTranscript = captureRecorder.transcript
            }
        }
        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .choose
        }
    }

    private func startSpecifyRecording() {
        // Same guard as startCaptureRecording — if permission was already
        // denied (perhaps the user revoked between recordings) surface the
        // alert instead of pretending to record.
        if captureRecorder.permissionDenied {
            showCaptureMicAlert = true
            return
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        // Kill the deferred first-idea snapshot — once the recognizer
        // rewires for the specify pass it'll overwrite `transcript` with
        // the new utterance, and we don't want the stale Task firing
        // afterward to copy that into firstIdeaTranscript.
        firstIdeaSnapshotTask?.cancel()
        firstIdeaSnapshotTask = nil
        specifySeconds = 0
        specifyStartedAt = Date()
        captureRecorder.start()
        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .specify
        }
    }

    private func finishSpecifyRecording() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        let specifyText = captureRecorder.transcript
        captureRecorder.stop()
        // The spoken intent steers the generator via customPrompt. "blog"
        // gives the model long-form latitude to honor whatever the user
        // asked for — the format-specific system prompts are too rigid to
        // accommodate "write me a poem" or "draft a quick announcement".
        startGeneration(label: "Your content", formatID: "blog", customPrompt: specifyText)
    }

    private func saveIdeaAndExit() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        captureRecorder.stop()
        let note = saveTranscriptAsNote(firstIdeaTranscript)
        // Title the note in the background so the library shows a 3-word
        // summary rather than the raw first transcript line.
        let transcript = firstIdeaTranscript
        Task.detached(priority: .utility) {
            await Self.applyNoteTitle(noteID: note.id, transcript: transcript)
        }
        onGetStarted()
    }

    private func startGeneration(label: String, formatID: String, customPrompt: String) {
        guard capturePhase == .choose else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        captureRecorder.stop()
        chosenContentLabel = label
        // Stamped so the cloud scene can drive its satellite-firing
        // schedule from t=0 instead of from the TimelineView's first tick,
        // which would otherwise start mid-animation on phase entry.
        generatingStartedAt = Date()

        let transcript = firstIdeaTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        // Persist the raw idea as a Note unconditionally — if the API call
        // fails, the user still has their thought saved when they land in
        // the app instead of losing the recording entirely.
        let note = saveTranscriptAsNote(transcript)

        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .generating
        }

        generatingTask?.cancel()
        generatingTask = Task { @MainActor in
            await runGeneration(label: label,
                                formatID: formatID,
                                customPrompt: customPrompt,
                                transcript: transcript,
                                note: note)
        }
    }

    @MainActor
    private func runGeneration(label: String,
                               formatID: String,
                               customPrompt: String,
                               transcript: String,
                               note: Note) async {
        // No API key configured (e.g. fresh install before the key sheet) —
        // can't generate, so drop the user into the app where they can add
        // a key from Profile. Note is already saved; still title it so the
        // library shows a summary rather than the raw first line.
        guard ContentGenerator.isKeyConfigured else {
            Task.detached(priority: .utility) {
                await Self.applyNoteTitle(noteID: note.id, transcript: transcript)
            }
            capturePhase = .prompt
            onGetStarted()
            return
        }

        let sourceContent = transcript.isEmpty
            ? "Captured idea (no transcription available)."
            : transcript
        let source = SourceItem(type: .voice, label: "First idea", content: sourceContent)
        let formatLabel = allFormats.first { $0.id == formatID }?.label ?? label

        let result = await ContentGenerator.generate(
            sources: [source],
            formatID: formatID,
            formatLabel: formatLabel,
            customPrompt: customPrompt,
            brand: "Default"
        )

        guard !Task.isCancelled else { return }

        switch result {
        case .success(let text):
            // Give the note a title line so the handoff page's "Note" tab
            // renders the captured transcript as body, then attach the
            // generation to it so the page shows the standard two-tab note
            // detail — a "Note" tab plus this generation.
            let displayNote = await Self.applyNoteTitle(noteID: note.id, transcript: transcript) ?? note
            let generation = MinimalGeneration(
                noteId: displayNote.id,
                sourceNoteIds: [displayNote.id],
                sourceLabels: [displayNote.displayTitle],
                outputType: formatID,
                content: text,
                date: Date()
            )
            MinimalGenStore.insertBatch([generation])
            withAnimation(.easeIn(duration: 0.35)) { resultNote = displayNote }
        case .failure:
            // Note is already saved — quietly exit into the app rather than
            // stranding the user on the generating pill. A failure banner
            // in the middle of onboarding would be more noise than signal.
            Task.detached(priority: .utility) {
                await Self.applyNoteTitle(noteID: note.id, transcript: transcript)
            }
            onGetStarted()
        }
    }

    @discardableResult
    private func saveTranscriptAsNote(_ text: String) -> Note {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        // Empty input usually means speech recognition produced nothing — mic
        // worked but the user spoke too quietly, or the recogniser timed out.
        // Previously we returned silently here, so "Just save my note for
        // now" with a failed transcription exited onboarding having persisted
        // nothing. Save a placeholder so the user still finds *a* note in
        // their library and can investigate (mic / permissions / Siri lang)
        // instead of thinking the app discarded their idea. The placeholder
        // already leads with a title line so the note-detail page renders
        // the rest as the body rather than swallowing it into the heading.
        let body = trimmed.isEmpty
            ? "Your first idea\nTranscription was empty — record again from the Notes tab to capture it."
            : trimmed

        var stored = NotesStore.load()
        var note = Note()
        note.body = body
        note.updatedAt = Date()
        stored.insert(note, at: 0)
        NotesStore.save(stored)
        return note
    }

    /// Rewrites a freshly-saved onboarding note so its stored body leads with
    /// a short title line. The note-detail page treats the first line as the
    /// heading and renders everything after it as the body — without a title
    /// line an untitled single-paragraph transcript shows its whole text as
    /// the heading and an empty body. Returns the updated note.
    @discardableResult
    private static func applyNoteTitle(noteID: UUID, transcript: String) async -> Note? {
        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalBody: String
        if trimmed.isEmpty {
            // Placeholder note — already saved with a title line.
            finalBody = "Your first idea\nTranscription was empty — record again from the Notes tab to capture it."
        } else if let titled = await AIService.prependTitleIfMissing(to: trimmed) {
            finalBody = titled
        } else if trimmed.contains("\n") {
            // prependTitleIfMissing only declines a multi-line body when its
            // first line already reads as a title — keep it as-is.
            finalBody = trimmed
        } else {
            // Single paragraph, no AI title available — prepend a generic
            // heading so the transcript still renders below the tabs.
            finalBody = "Your first idea\n" + trimmed
        }

        var latest = NotesStore.load()
        if let idx = latest.firstIndex(where: { $0.id == noteID }) {
            if latest[idx].body != finalBody {
                latest[idx].body = finalBody
                latest[idx].updatedAt = Date()
                NotesStore.save(latest)
            }
            return latest[idx]
        } else {
            var note = Note()
            note.id = noteID
            note.body = finalBody
            note.updatedAt = Date()
            latest.insert(note, at: 0)
            NotesStore.save(latest)
            return note
        }
    }

    private func formatCaptureTime(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
}

private final class AppleSignInCoordinator: NSObject, ObservableObject {
    private let authEndpoint = AppConfig.API.appleAuth

    // Called from SignInWithAppleButton's onRequest closure.
    // Sets the nonce on the request and returns the raw hex nonce to store in view state.
    func setupRequest(_ request: ASAuthorizationAppleIDRequest) -> String {
        let rawBytes = (0..<32).map { _ in UInt8.random(in: 0...255) }
        let rawData = Data(rawBytes)
        let rawHex = rawData.map { String(format: "%02x", $0) }.joined()
        let hash = SHA256.hash(data: rawData)
        request.nonce = hash.map { String(format: "%02x", $0) }.joined()
        request.requestedScopes = [.fullName, .email]
        return rawHex
    }

    // Called from SignInWithAppleButton's onCompletion closure.
    func handleCredential(
        _ credential: ASAuthorizationAppleIDCredential,
        nonce: String?,
        onSuccess: @escaping () -> Void,
        onError: @escaping (Error) -> Void
    ) {
        Task { [weak self] in
            do {
                try await self?.authenticateWithBackend(credential: credential, nonce: nonce)
                await SyncManager.shared.pull()
                await MainActor.run { onSuccess() }
            } catch {
                await MainActor.run { onError(error) }
            }
        }
    }

    private func authenticateWithBackend(
        credential: ASAuthorizationAppleIDCredential,
        nonce: String?
    ) async throws {
        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            throw AppleSignInError.missingIdentityToken
        }

        let authorizationCode = credential.authorizationCode.flatMap {
            String(data: $0, encoding: .utf8)
        }

        let fullName = credential.fullName.map {
            PersonNameComponentsFormatter().string(from: $0)
        }?.trimmingCharacters(in: .whitespacesAndNewlines)

        let body = AppleAuthRequest(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            user: credential.user,
            email: credential.email,
            fullName: fullName?.isEmpty == false ? fullName : nil,
            nonce: nonce
        )

        var request = URLRequest(url: authEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppleSignInError.backend("Could not read the sign-in response.")
        }

        if !(200..<300).contains(httpResponse.statusCode) {
            let apiError = try? JSONDecoder().decode(AppleAuthErrorResponse.self, from: data)
            throw AppleSignInError.backend(apiError?.error ?? "Apple sign-in could not be verified.")
        }

        let authResponse = try JSONDecoder().decode(AppleAuthResponse.self, from: data)

        guard let session = authResponse.session,
              let supabaseId = authResponse.user.supabaseId else {
            throw AppleSignInError.backend("Sign-in succeeded but no session was created. Please try again.")
        }

        SessionStore.shared.save(AppSession(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt,
            supabaseUserId: supabaseId,
            email: authResponse.user.email,
            fullName: authResponse.user.fullName
        ))

        if let token = authResponse.sessionToken {
            SessionTokenService.save(token)
        }
        if let expiresAt = authResponse.sessionTokenExpiresAt {
            UserDefaults.standard.set(expiresAt, forKey: SessionTokenService.expiresAtKey)
        }
    }
}

private enum AppleSignInError: LocalizedError {
    case invalidCredential
    case missingIdentityToken
    case backend(String)

    var errorDescription: String? {
        switch self {
        case .invalidCredential:
            "Could not read Apple credentials. Try again."
        case .missingIdentityToken:
            "Apple did not return a sign-in token. Try again."
        case .backend(let message):
            message
        }
    }
}

private struct AppleAuthRequest: Encodable {
    let identityToken: String
    let authorizationCode: String?
    let user: String
    let email: String?
    let fullName: String?
    let nonce: String?
}

private struct AppleAuthResponse: Decodable {
    let user: AppleAuthUser
    let session: AppleAuthSession?
    let sessionToken: String?
    let sessionTokenExpiresAt: Int?
}

private struct AppleAuthUser: Decodable {
    let id: String
    let supabaseId: String?
    let email: String?
    let fullName: String?
}

private struct AppleAuthSession: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
    }
}

private struct AppleAuthErrorResponse: Decodable {
    let error: String
}

// MARK: - Onboarding recording waveform

// MARK: - Wobbly circle shape

/// A near-circle with subtle low-frequency harmonic perturbations.
/// Each `seed` produces a distinct irregular outline so the four
/// option circles each look slightly different — organic, not mechanical.
private struct WobblyCircle: Shape {
    let seed: Int
    private let wobble: Double = 0.032  // ~3% radius deviation

    func path(in rect: CGRect) -> Path {
        let cx = rect.midX, cy = rect.midY
        let r = min(rect.width, rect.height) / 2
        let s = Double(seed)
        let steps = 72
        var path = Path()
        for i in 0...steps {
            let a = Double(i) / Double(steps) * .pi * 2
            let factor = 1.0 + wobble * (
                sin(a * 3.0 + s * 1.73) * 0.50 +
                sin(a * 5.0 + s * 2.39) * 0.30 +
                sin(a * 7.0 + s * 3.07) * 0.20
            )
            let px = cx + cos(a) * r * factor
            let py = cy + sin(a) * r * factor
            if i == 0 { path.move(to: CGPoint(x: px, y: py)) }
            else       { path.addLine(to: CGPoint(x: px, y: py)) }
        }
        path.closeSubpath()
        return path
    }
}

// MARK: - Generating cloud scene

/// Immersive "your idea is taking shape" animation. Replaces the earlier
/// orbiting-dot loading pill with the scene the user actually sees while
/// the API call is in flight:
///
/// 1. A spherical cluster of stars at the center, slowly rotating around
///    the vertical axis. Stars near the back of the sphere shrink and
///    fade via a fake-perspective z-scale so the sphere reads as
///    volumetric rather than flat.
/// 2. After a beat, an amber spark fires outward toward one of four
///    satellite anchor points around the sphere. The spark eases along
///    a straight line and leaves a brief amber tail.
/// 3. Once the spark settles, a small mini-cluster blooms at the
///    satellite anchor and a thin amber connector line fades in linking
///    the satellite back to the central sphere.
/// 4. Subsequent satellites fire on a staggered schedule. After all four
///    are seated, the whole graph keeps drifting — the "new cloud" the
///    sparks have built sits there breathing until the network call
///    returns and the view is replaced.
private struct GeneratingCloudScene: View {
    let generationStartedAt: Date
    // When non-nil, the scene renders as if `elapsed` were locked at
    // `frozenAt - generationStartedAt` and the TimelineView's ongoing
    // ticks are ignored. Used during the onboarding dive (.constellation
    // → .capture) to hold the cluster on a single frame while the view
    // is scaled past the camera — no rotation + spark amplification at
    // 3.5× scale. Default nil keeps the long-running .generating use of
    // this scene unchanged.
    var frozenAt: Date? = nil
    // The constellation beat shows satellites/connectors forming out of the
    // center. The capture prompt reuses only the central cloud enlarged as
    // the background, so the user doesn't see a second particle layer fade in.
    var showsContentGraph: Bool = true

    private let centralStarCount = 96
    private let amber = Color(red: 1.00, green: 0.68, blue: 0.20)
    private let satelliteTravelDuration: Double = 1.65
    private let connectorStartProgress: Double = 0.70
    private let satelliteBloomStartProgress: Double = 0.70

    private struct Satellite {
        let delay: Double
        let angle: Double
        // Fraction of the screen-edge distance in this direction (0–1).
        // Using edge-fraction rather than a coreRadius multiplier makes
        // each satellite travel to the same relative position regardless
        // of screen aspect ratio — so tall phones fill vertical space too.
        let edgeFraction: Double
        let sizeFactor: Double
        let starCount: Int
    }
    // Four satellites, one per screen quadrant. Angles chosen so they
    // spread toward the four corners rather than clustering on a diagonal.
    // edgeFraction targets 65–72% of the distance to the nearest screen
    // edge in each satellite's direction.
    private let satellites: [Satellite] = [
        Satellite(delay: 0.45, angle: -2.30,   // upper-left
                  edgeFraction: 0.68, sizeFactor: 0.70, starCount: 22),
        Satellite(delay: 1.55, angle: -0.85,   // upper-right
                  edgeFraction: 0.72, sizeFactor: 0.60, starCount: 18),
        Satellite(delay: 2.65, angle:  0.55,   // right-lower
                  edgeFraction: 0.68, sizeFactor: 0.65, starCount: 20),
        Satellite(delay: 3.75, angle:  2.30,   // left-lower
                  edgeFraction: 0.65, sizeFactor: 0.55, starCount: 16),
    ]

    var body: some View {
        ZStack {
            TimelineView(.animation(minimumInterval: showsContentGraph ? 1.0 / 30.0 : 1.0 / 10.0)) { context in
                let now = frozenAt ?? context.date
                let elapsed = max(0, now.timeIntervalSince(generationStartedAt))
                Canvas { ctx, size in
                    let cx = size.width / 2
                    let cy = size.height / 2
                    let coreRadius = min(size.width, size.height) * 0.20

                    // The constellation beat keeps the central cloud visually
                    // stable while satellites form. Capture-background mode
                    // gets a barely-there drift so the enlarged cloud feels
                    // environmental, not like a frozen overlay.
                    let backgroundDrift = showsContentGraph ? 0 : elapsed
                    let backgroundBreath = showsContentGraph
                        ? 1.0
                        : 0.97 + 0.03 * sin(elapsed * 0.55)
                    drawSphere(in: ctx,
                               cx: cx,
                               cy: cy,
                               r: coreRadius * backgroundBreath,
                               t: backgroundDrift,
                               count: centralStarCount,
                               sizeScale: 1.0,
                               rotationSpeed: showsContentGraph ? 0 : 0.025)

                    guard showsContentGraph else { return }

                    for (i, sat) in satellites.enumerated() {
                        let progress = max(0.0, min(1.0, (elapsed - sat.delay) / satelliteTravelDuration))
                        guard progress > 0 else { continue }
                        let eased = smoothstep(progress)

                        // Distance to screen edge in this satellite's direction,
                        // then travel edgeFraction of that — fills all four
                        // screen quadrants regardless of device aspect ratio.
                        let ca = abs(cos(sat.angle)), sa = abs(sin(sat.angle))
                        let distToEdge = ca < 1e-9 ? cy
                                       : sa < 1e-9 ? cx
                                       : min(cx / ca, cy / sa)
                        let satDistance = distToEdge * sat.edgeFraction
                        let satX = cx + cos(sat.angle) * satDistance * eased
                        let satY = cy + sin(sat.angle) * satDistance * eased

                        // Connector links the central cloud to the peripheral
                        // cloud while keeping clear of the central dot mass.
                        if progress > connectorStartProgress {
                            let lineAlpha = smoothstep((progress - connectorStartProgress) / (1 - connectorStartProgress))
                            let startX = cx + cos(sat.angle) * coreRadius * 1.22
                            let startY = cy + sin(sat.angle) * coreRadius * 1.22
                            let satEdge = coreRadius * sat.sizeFactor * 0.9
                            let endX = satX - cos(sat.angle) * satEdge
                            let endY = satY - sin(sat.angle) * satEdge
                            var line = Path()
                            line.move(to: CGPoint(x: startX, y: startY))
                            line.addLine(to: CGPoint(x: endX, y: endY))
                            ctx.stroke(
                                line,
                                with: .color(amber.opacity(0.24 * lineAlpha)),
                                style: StrokeStyle(
                                    lineWidth: 1.35,
                                    lineCap: .round,
                                    dash: [0.01, 4]
                                )
                            )
                        }

                        // Peripheral clouds keep the earlier growing behavior;
                        // central cloud stability is handled by rendering it
                        // as a separate static layer.
                        if progress > satelliteBloomStartProgress {
                            let bloom = smoothstep((progress - satelliteBloomStartProgress) / (1 - satelliteBloomStartProgress))
                            let bloomFade = min(1.0, bloom / 0.25)
                            drawSphere(in: ctx,
                                       cx: satX, cy: satY,
                                       r: coreRadius * sat.sizeFactor * bloom,
                                       t: Double(i) * 1.7,
                                       count: sat.starCount,
                                       sizeScale: 0.85,
                                       rotationSpeed: 0,
                                       alphaScale: bloomFade)
                        }

                        // Settled spark glow — breathing amber bead once the
                        // satellite has arrived. No travelling spark so there's
                        // no isolated dot floating across the screen mid-flight.
                        if progress >= 1 {
                            drawSettledSparkGlow(in: ctx,
                                                 at: CGPoint(x: satX, y: satY),
                                                 phase: Double(i),
                                                 t: elapsed)
                        }
                    }
                }
            }
        }
        .accessibilityLabel("Creating your content")
    }

    /// Volumetric-feeling sphere of stars rendered into a 2D canvas via a
    /// fake perspective scale. Uses a fibonacci-style distribution so the
    /// points cover the sphere evenly rather than clumping at the poles,
    /// then rotates around Y to give the cloud its drift.
    private func drawSphere(in ctx: GraphicsContext,
                            cx: Double, cy: Double,
                            r: Double,
                            t: Double,
                            count: Int,
                            sizeScale: Double,
                            rotationSpeed: Double,
                            alphaScale: Double = 1.0) {
        let rotation = t * rotationSpeed
        let golden = .pi * (1 + sqrt(5.0))
        for i in 0..<count {
            // Fibonacci sphere: points at constant area increments.
            let n = Double(i) + 0.5
            let phi = acos(1 - 2 * n / Double(count))
            let theta = golden * Double(i) + rotation

            let jitter = 0.78 + pseudoRandom(i * 3) * 0.24
            let starR = r * jitter
            let x = starR * sin(phi) * cos(theta)
            let z = starR * sin(phi) * sin(theta)
            let y = starR * cos(phi)

            // Fake perspective: z is depth, range roughly [-r, +r].
            // Map to a 0.6-1.4 scale so back-of-sphere stars shrink/dim.
            let depth = (z + r) / (2 * r)
            let perspective = 0.75 + depth * 0.50

            let sx = cx + x * (0.85 + 0.15 * perspective)
            let sy = cy + y * (0.85 + 0.15 * perspective)

            let dotSize = (1.0 + pseudoRandom(i * 5) * 1.5) * perspective * sizeScale
            let alpha = (0.30 + pseudoRandom(i * 7) * 0.55) * perspective * alphaScale

            ctx.fill(
                Path(ellipseIn: CGRect(x: sx - dotSize, y: sy - dotSize,
                                       width: dotSize * 2, height: dotSize * 2)),
                with: .color(.white.opacity(alpha))
            )
        }
    }

    private func smoothstep(_ value: Double) -> Double {
        let x = max(0.0, min(1.0, value))
        return x * x * (3 - 2 * x)
    }

    /// Bright amber dot somewhere along the (origin → target) line at
    /// `eased`. Adds a soft glow behind it and a short fading trail
    /// pointing back toward origin so the eye reads it as motion.
    private func drawSparkInFlight(in ctx: GraphicsContext,
                                   from origin: CGPoint,
                                   to target: CGPoint,
                                   eased: Double) {
        let sx = origin.x + (target.x - origin.x) * eased
        let sy = origin.y + (target.y - origin.y) * eased

        // Soft glow behind the spark.
        let glow = 7.0
        ctx.fill(
            Path(ellipseIn: CGRect(x: sx - glow, y: sy - glow,
                                   width: glow * 2, height: glow * 2)),
            with: .color(amber.opacity(0.35))
        )
        // Spark itself.
        let core = 2.6
        ctx.fill(
            Path(ellipseIn: CGRect(x: sx - core, y: sy - core,
                                   width: core * 2, height: core * 2)),
            with: .color(amber.opacity(0.95))
        )

        // Trail: three smaller dots stepping back toward origin.
        for k in 1...3 {
            let backEased = max(0.0, eased - Double(k) * 0.06)
            let tx = origin.x + (target.x - origin.x) * backEased
            let ty = origin.y + (target.y - origin.y) * backEased
            let trailSize = 1.8 - Double(k) * 0.4
            let trailAlpha = 0.55 - Double(k) * 0.15
            ctx.fill(
                Path(ellipseIn: CGRect(x: tx - trailSize, y: ty - trailSize,
                                       width: trailSize * 2, height: trailSize * 2)),
                with: .color(amber.opacity(trailAlpha))
            )
        }
    }

    /// After a spark has settled at a satellite anchor, leave a slowly
    /// breathing amber bead at that point so the connector and mini-cluster
    /// have an obvious origin tied to the spark that built them.
    private func drawSettledSparkGlow(in ctx: GraphicsContext,
                                      at point: CGPoint,
                                      phase: Double,
                                      t: Double) {
        let pulse = 0.65 + 0.35 * sin(t * 1.4 + phase * 1.3)
        let glow = 5.0 * pulse
        ctx.fill(
            Path(ellipseIn: CGRect(x: point.x - glow, y: point.y - glow,
                                   width: glow * 2, height: glow * 2)),
            with: .color(amber.opacity(0.32 * pulse))
        )
        let core = 1.8
        ctx.fill(
            Path(ellipseIn: CGRect(x: point.x - core, y: point.y - core,
                                   width: core * 2, height: core * 2)),
            with: .color(amber.opacity(0.85))
        )
    }

    private func pseudoRandom(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

// MARK: - Inside-the-sphere scene

/// "Creating…" beat as a closed sphere the viewer sits inside. A large
/// fibonacci cluster of white stars fills the frame, slowly rotating. Every
/// ~0.85s a dot on the sphere ignites to amber and a thin amber line draws
/// out to the previously ignited dot, so the firings read as a network of
/// orange nodes wiring up *within* the cluster instead of sparks escaping
/// to satellites outside it.
private struct InsideSphereScene: View {
    let generationStartedAt: Date

    private let starCount = 180
    private let amber = Color(red: 1.00, green: 0.68, blue: 0.20)
    private let igniteInterval: Double = 0.85
    private let igniteStartDelay: Double = 0.4
    private let maxIgnitions = 14

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 40.0)) { context in
            let elapsed = max(0, context.date.timeIntervalSince(generationStartedAt))
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                // Sphere fills most of the frame so its edge wraps the
                // viewport — the dots surround the eye rather than sitting
                // in a pocket of negative space.
                let r = min(size.width, size.height) * 0.46

                let rotation = elapsed * 0.22
                let golden = .pi * (1 + sqrt(5.0))

                var positions = [CGPoint](repeating: .zero, count: starCount)
                var depths = [Double](repeating: 0, count: starCount)

                for i in 0..<starCount {
                    let n = Double(i) + 0.5
                    let phi = acos(1 - 2 * n / Double(starCount))
                    let theta = golden * Double(i) + rotation
                    let jitter = 0.80 + pseudoRandom(i * 3) * 0.20
                    let sr = r * jitter
                    let x = sr * sin(phi) * cos(theta)
                    let z = sr * sin(phi) * sin(theta)
                    let y = sr * cos(phi)
                    let depth = (z + r) / (2 * r)
                    let perspective = 0.55 + depth * 0.9
                    let sx = cx + x * (0.85 + 0.15 * perspective)
                    let sy = cy + y * (0.85 + 0.15 * perspective)
                    positions[i] = CGPoint(x: sx, y: sy)
                    depths[i] = depth
                }

                // Firing schedule: coprime stride scatters the ignitions
                // across the sphere rather than walking sequentially.
                let elapsedFiring = elapsed - igniteStartDelay
                let firingCount = min(maxIgnitions,
                                      max(0, Int(elapsedFiring / igniteInterval) + 1))
                let stride = 23
                let startIdx = 11
                var fired: [Int] = []
                var igniteTime: [Int: Double] = [:]
                for k in 0..<firingCount {
                    let idx = (startIdx + k * stride) % starCount
                    fired.append(idx)
                    igniteTime[idx] = igniteStartDelay + Double(k) * igniteInterval
                }

                // Connecting lines drawn first so the bright ignited dots
                // sit on top. Each new ignition pulls a line back to its
                // predecessor over ~0.55s.
                for k in 1..<fired.count {
                    let aIdx = fired[k - 1]
                    let bIdx = fired[k]
                    guard let igniteB = igniteTime[bIdx] else { continue }
                    let progress = max(0, min(1, (elapsed - igniteB - 0.10) / 0.55))
                    if progress <= 0 { continue }
                    let pa = positions[aIdx]
                    let pb = positions[bIdx]
                    let endX = pa.x + (pb.x - pa.x) * progress
                    let endY = pa.y + (pb.y - pa.y) * progress
                    var path = Path()
                    path.move(to: pa)
                    path.addLine(to: CGPoint(x: endX, y: endY))
                    ctx.stroke(path,
                               with: .color(amber.opacity(0.32)),
                               lineWidth: 0.7)
                }

                // Paint stars back-to-front so foreground dots cover the
                // ones behind them — a cheap depth sort that keeps the
                // sphere reading as volumetric rather than flat.
                let order = (0..<starCount).sorted { depths[$0] < depths[$1] }
                for i in order {
                    let p = positions[i]
                    let perspective = 0.55 + depths[i] * 0.9
                    let baseDotSize = (1.0 + pseudoRandom(i * 5) * 1.5) * perspective
                    let pulse = 0.78 + 0.22 * sin(elapsed * 1.6 + Double(i) * 0.31)
                    let baseAlpha = (0.30 + pseudoRandom(i * 7) * 0.55) * perspective * pulse

                    if let it = igniteTime[i] {
                        let ignP = max(0, min(1, (elapsed - it) / 0.45))
                        // White → amber by ramping G and B down toward
                        // the brand amber while leaving R at 1.0.
                        let color = Color(red: 1.0,
                                          green: 1.0 - 0.32 * ignP,
                                          blue: 1.0 - 0.80 * ignP)
                        let amberPulse = 0.85 + 0.15 * sin(elapsed * 1.8 + Double(i) * 0.5)
                        let dot = baseDotSize * (1.0 + 0.8 * ignP * amberPulse)
                        let glow = dot * 2.8
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: p.x - glow, y: p.y - glow,
                                                   width: glow * 2, height: glow * 2)),
                            with: .color(amber.opacity(0.22 * ignP))
                        )
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: p.x - dot, y: p.y - dot,
                                                   width: dot * 2, height: dot * 2)),
                            with: .color(color.opacity(max(baseAlpha, 0.85 * ignP)))
                        )
                    } else {
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: p.x - baseDotSize, y: p.y - baseDotSize,
                                                   width: baseDotSize * 2, height: baseDotSize * 2)),
                            with: .color(.white.opacity(baseAlpha))
                        )
                    }
                }
            }
        }
        .accessibilityLabel("Writing your content")
    }

    private func pseudoRandom(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

#Preview {
    OnboardingView(onGetStarted: {}, onLogin: {})
}
