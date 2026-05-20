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
    case capture = 3        // starfield "blurb" → press-and-hold record → transform / expand
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
    // 6.5s auto-task or the manual Continue button can drive it, but only
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

            if step == .constellation {
                GeneratingCloudScene(generationStartedAt: constellationStartedAt,
                                     frozenAt: diveStartedAt)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    // Insertion (.intro → .constellation): the cloud appears
                    // at 1.7× and contracts to its final size while fading
                    // in, so the eye reads the crossing as the camera
                    // *pulling back* from the wide constellation to reveal
                    // the cloud as a discrete object — not a hard cut. Plain
                    // opacity here was the source of the "abrupt change"
                    // feedback; the spatial motion gives the transition
                    // somewhere to land.
                    //
                    // Removal (.constellation → .capture): the cluster
                    // scales past the camera and fades — the user is
                    // *flying into* the cloud rather than cutting to a new
                    // screen. 3.5× is enough to read as "past the camera"
                    // without the corners shearing.
                    .transition(
                        .asymmetric(
                            insertion: .scale(scale: 1.7).combined(with: .opacity),
                            removal: .scale(scale: 3.5).combined(with: .opacity)
                        )
                    )
            }

            // Step 4: the starfield is the visual continuity between the
            // .prompt → .choose beats. .prompt owns the long-press to start
            // recording; .choose keeps the field as a passive backdrop so
            // the four blob options sit in the same cloud the user just
            // pressed-and-held, rather than a flat black screen. Hit
            // testing is disabled outside .prompt so the blob buttons
            // (rendered above in `captureOverlay`) still receive taps.
            //
            // Held alive throughout the entire .capture step (rather than
            // being inserted/removed on each active sub-phase) so the
            // SwiftUI transition fires exactly once — on the
            // .constellation → .capture crossing — and the 0.85s delay
            // below applies only to that one entry. In-capture phase
            // crossings (.recording → .choose etc.) are driven by the
            // .opacity modifier on `starfieldVisible` with a prompt 0.45s
            // curve, so the field reappears under the blob chooser
            // immediately rather than inheriting the entry delay.
            if step == .capture {
                let starfieldVisible = capturePhase == .prompt || capturePhase == .choose
                StarfieldBlurb(active: starfieldVisible)
                    .ignoresSafeArea()
                    // Held at a permanent dim so the captureOverlay headline
                    // ("Let's capture your first idea") and the press-and-hold
                    // caption read cleanly on top — the blurb is the destination
                    // background, not the focal element.
                    .opacity(starfieldVisible ? 0.65 : 0)
                    .contentShape(Rectangle())
                    // maximumDistance: 80 (was 30) — phones held normally
                    // wobble enough that a 30pt drift silently cancelled
                    // the press with no feedback. 80pt still excludes
                    // intentional swipes but tolerates ordinary hand
                    // jitter during a 0.3s hold.
                    .onLongPressGesture(minimumDuration: 0.3, maximumDistance: 80) {
                        guard capturePhase == .prompt else { return }
                        startCaptureRecording()
                    }
                    // Hit testing only matters during .prompt — the blob
                    // buttons in .choose are rendered above in
                    // `captureOverlay` and would still get tap priority
                    // either way, but turning off the long-press during
                    // .choose keeps the gesture from competing for taps
                    // near the bottom blobs.
                    .allowsHitTesting(capturePhase == .prompt)
                    .animation(.easeInOut(duration: 0.45), value: capturePhase)
                    // Insertion delayed by the cluster's full 0.85s dive
                    // duration so the starfield only begins fading in
                    // *after* the cluster has scaled past the camera and
                    // cleared the frame. Without the delay, the new
                    // full-screen blurb fades up at 0% over a still-
                    // dispersing structured cluster, and the eye reads the
                    // two layers as overlapping starfields instead of one
                    // continuous "fly through the cloud into open space"
                    // beat. Removal stays as a plain fade so leaving
                    // .capture (no path today, but defensive) is calm.
                    .transition(
                        .asymmetric(
                            insertion: .opacity.animation(.easeOut(duration: 0.40).delay(0.85)),
                            removal: .opacity
                        )
                    )
            }

            switch step {
            case .intro:         introOverlay
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
                    .font(.lora(size: 52, weight: .regular))
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
                    // Stamp the constellation clock 1.2s in the future so the
                    // central bulb is visible immediately on screen 3 but the
                    // amber spark firings hold off until the transition has
                    // settled — the orange animation reads as starting after
                    // a beat rather than launching mid-fade.
                    constellationStartedAt = Date().addingTimeInterval(1.2)
                    // easeOut so the zoom-out decelerates into rest — the
                    // cloud reads as a camera pulling back and settling at
                    // its final distance. 0.85s gives the eye time to track
                    // the contraction; the previous 0.45s easeInOut was too
                    // fast for the new spatial motion to register and the
                    // crossing felt like a cut.
                    withAnimation(.easeOut(duration: 0.85)) {
                        step = .constellation
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
        // Removal accelerated to 0.20s so the intro's white pills are
        // gone quickly when the user taps Get started — the next beat
        // is the orange cluster, and lingering CTAs would ghost over
        // the new scene as it fades in.
        .transition(.asymmetric(
            insertion: .opacity,
            removal: .opacity.animation(.easeInOut(duration: 0.20))
        ))
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
            // seen at least two satellites bloom (the gesture reads as
            // intentional rather than mid-animation) and lets impatient
            // users skip the remaining ~4s of the hold.
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
        // dives into it. The constellation clock is stamped 1.2s in
        // the future when entering this step, so the spark schedule
        // is shifted later; the hold tracks that shift to keep the
        // four firings on screen instead of being clipped by the dive.
        .task {
            // Arm the Continue button after 2.5s — by that point the
            // cluster has bloomed two satellites and the headline has
            // fully faded in, so the button reads as part of the same
            // settled scene rather than competing with mid-animation.
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeOut(duration: 0.5)) {
                constellationContinueArmed = true
            }
            // Auto-dive after the remaining 4s if the user hasn't tapped
            // Continue. Total hold ≈ 6.5s — same as before for users who
            // want to watch the whole bloom.
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
        }
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
        // During .prompt the entire overlay is decorative — the only
        // interactive element is the full-screen StarfieldBlurb behind
        // it, which owns the press-and-hold gesture. Without this
        // allowsHitTesting flip, the headline text and the bottom
        // `Color.clear` placeholder would each carve a strip of the
        // screen where the long-press silently fails to fire.
        .allowsHitTesting(capturePhase != .prompt)
        .animation(.easeInOut(duration: 0.45), value: capturePhase)
        // Enter: hold the headline back until the cluster's 0.85s dive
        // has fully resolved, so the copy lands on the same beat as the
        // starfield blurb behind it rather than 0.35s ahead. Previous
        // 0.50 delay had the headline appear mid-dive on top of a still-
        // dispersing cluster; matching the starfield's 0.85 delay keeps
        // the entire new screen — background + copy — arriving as one
        // coherent beat after the cluster is gone.
        // Exit: not actually used today (.capture is terminal in
        // onboarding) but mirror the pattern so it's correct if the flow
        // ever reverses.
        .transition(.asymmetric(
            insertion: .opacity.animation(.easeOut(duration: 0.40).delay(0.85)),
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
        }
        // Drop the user straight onto the per-note detail page the app uses
        // for every note — a "Note" tab plus a tab for the generation just
        // produced. When they dismiss it, fall through to onGetStarted so
        // onboarding exits: they've now seen both the create flow and the
        // notes-and-generations surface they'll live in.
        .fullScreenCover(item: $resultNote, onDismiss: { onGetStarted() }) { note in
            MinimalNoteDetailPage(initialNote: note)
                .preferredColorScheme(.dark)
        }
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
            VStack(spacing: 6) {
                Text("Shaping your first idea\u{2026}")
                    .font(.lora(size: 20, weight: .medium))
                    .kerning(-0.3)
                    .foregroundColor(AppText.primary)
                Text("What do you want to create?")
                    .font(.lora(size: 20, weight: .medium))
                    .kerning(-0.3)
                    .foregroundColor(Color.white.opacity(0.72))
            }
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
                        .fill(isLive ? BrandColor.amber : Color.white.opacity(0.4))
                        .frame(width: 7, height: 7)
                    Text(isLive
                         ? "Recording  \(formatCaptureTime(recordingSeconds))"
                         : "Listening\u{2026}")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor((isLive ? BrandColor.amber : Color.white.opacity(0.6)).opacity(0.92))
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
                        .fill(isLive ? BrandColor.amber : Color.white.opacity(0.4))
                        .frame(width: 7, height: 7)
                    Text(isLive
                         ? "Recording  \(formatCaptureTime(specifySeconds))"
                         : "Listening\u{2026}")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor((isLive ? BrandColor.amber : Color.white.opacity(0.6)).opacity(0.92))
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

    /// The four `.choose` options rendered as plain circles in a 2×2 grid.
    /// Each circle has a thin white stroke — the stroke alone defines the
    /// edge, with only a whisper of a halo for soft depth. The earlier
    /// brighter blurred halo read as "glowing buttons," which fought the
    /// quiet starfield behind them.
    private var chooseCirclesField: some View {
        struct ChooseOption {
            let label: String
            let symbol: String
            let action: () -> Void
        }

        let options: [ChooseOption] = [
            // LinkedIn: briefcase reads as "professional post" and keeps the
            // four icons in the same outline-SF-Symbol vocabulary. The
            // previous typographic "LI" sat as a flat letterform next to
            // three graphical glyphs and visually didn't belong.
            ChooseOption(label: "A LinkedIn post", symbol: "briefcase", action: {
                startGeneration(label: "A LinkedIn post", formatID: "linkedin", customPrompt: "")
            }),
            ChooseOption(label: "A Twitter thread", symbol: "text.bubble", action: {
                startGeneration(label: "A Twitter thread", formatID: "twitter", customPrompt: "")
            }),
            ChooseOption(label: "Something else", symbol: "sparkles", action: {
                startSpecifyRecording()
            }),
            // square.and.arrow.down is the universal iOS save glyph;
            // bookmark read more like "bookmark an item" than "save my
            // note," which is what this action actually does.
            ChooseOption(label: "Just save my note for now", symbol: "square.and.arrow.down", action: {
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
            let circleRadius: CGFloat = min(dim * 0.24, 84)
            // Small gap between circles so the strokes read as four
            // discrete shapes rather than a touching cluster.
            let cellOffset: CGFloat = circleRadius * 1.08
            let cx = geo.size.width / 2
            let cy = geo.size.height / 2
            let positions: [CGPoint] = [
                CGPoint(x: cx - cellOffset, y: cy - cellOffset),
                CGPoint(x: cx + cellOffset, y: cy - cellOffset),
                CGPoint(x: cx - cellOffset, y: cy + cellOffset),
                CGPoint(x: cx + cellOffset, y: cy + cellOffset),
            ]

            ZStack {
                ForEach(Array(options.enumerated()), id: \.offset) { idx, opt in
                    Button(action: opt.action) {
                        VStack(spacing: 10) {
                            Image(systemName: opt.symbol)
                                .font(.system(size: 20, weight: .medium))
                                .foregroundColor(AppText.primary)
                            Text(opt.label)
                                .font(.app(size: 14, weight: .medium))
                                .foregroundColor(AppText.primary)
                                .multilineTextAlignment(.center)
                                .lineLimit(3)
                                .minimumScaleFactor(0.85)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.horizontal, 16)
                        .frame(width: circleRadius * 2, height: circleRadius * 2)
                        .background(
                            // Mostly-opaque dark disc so the circle reads as
                            // a discrete button rather than a transparent
                            // ring with stars drifting through it. A bit of
                            // alpha left so the boundary doesn't read as a
                            // hard coal cutout against the cosmos behind.
                            Circle()
                                .fill(Color.black.opacity(0.72))
                        )
                        .overlay(
                            // Whisper of a halo for a hint of depth against
                            // the starfield — much dimmer than before so it
                            // doesn't read as "glowing." Padding kept tight
                            // so the bleed doesn't extend visibly past the
                            // sharp edge.
                            Circle()
                                .stroke(Color.white.opacity(0.10), lineWidth: 1.0)
                                .blur(radius: 2)
                                .padding(-2)
                        )
                        .overlay(
                            // Sharp thin stroke on top — the only edge the
                            // eye actually reads. Dialed from 0.60 → 0.38
                            // so the ring is present but not bright.
                            Circle()
                                .stroke(Color.white.opacity(0.38), lineWidth: 0.5)
                        )
                        .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .position(positions[idx])
                }
            }
        }
        // Reserve enough vertical room for two rows of circles (each ~168pt
        // diameter at max) plus the inter-row gap. Computed from the same
        // sizing math as the inner GeometryReader so the field never
        // requests more height than its circles need — important on
        // iPhone SE-class screens where a fixed 360pt frame was forcing
        // the inner VStack to clip the bottom row's labels.
        .frame(maxHeight: 360)
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
        captureRecorder.start()
        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .recording
        }
    }

    private func finishCaptureRecording() {
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
        saveTranscriptAsNote(firstIdeaTranscript)
        onGetStarted()
    }

    private func startGeneration(label: String, formatID: String, customPrompt: String) {
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
        // a key from Profile. Note is already saved.
        guard ContentGenerator.isKeyConfigured else {
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
            // Attach the generation to the note just saved so the handoff
            // page renders the standard two-tab note detail — a "Note" tab
            // plus this generation — instead of a standalone library card.
            let generation = MinimalGeneration(
                noteId: note.id,
                sourceNoteIds: [note.id],
                sourceLabels: [note.displayTitle],
                outputType: formatID,
                content: text,
                date: Date()
            )
            MinimalGenStore.insertBatch([generation])
            resultNote = note
        case .failure:
            // Note is already saved — quietly exit into the app rather than
            // stranding the user on the generating pill. A failure banner
            // in the middle of onboarding would be more noise than signal.
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
        // instead of thinking the app discarded their idea.
        let isPlaceholder = trimmed.isEmpty
        let body = isPlaceholder
            ? "Your first voice idea — transcription was empty. Try recording again from the Notes tab."
            : trimmed

        var stored = NotesStore.load()
        var note = Note()
        note.body = body
        note.updatedAt = Date()
        let noteID = note.id
        stored.insert(note, at: 0)
        NotesStore.save(stored)

        // Skip AI-titling for placeholder notes — there's no content to
        // summarise and we'd just send the placeholder text to the model.
        guard !isPlaceholder else { return note }

        // Title in the background so the notes list shows a 3-word summary
        // instead of the first transcript line. This is the only persistence
        // path for onboarding transcripts — there is no editor sweep here to
        // catch it on dismissal.
        Task.detached(priority: .utility) {
            guard let updatedBody = await AIService.prependTitleIfMissing(to: trimmed) else { return }
            var latest = NotesStore.load()
            guard let idx = latest.firstIndex(where: { $0.id == noteID }) else { return }
            // Don't clobber edits the user may have made after onboarding handed off.
            guard latest[idx].body == trimmed else { return }
            latest[idx].body = updatedBody
            latest[idx].updatedAt = Date()
            NotesStore.save(latest)
        }

        return note
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
    // Higher density + larger stars than the "viewed-through-a-window"
    // version this replaced. The user reads themselves as inside the
    // cloud now: more stars per square point, each one noticeably bigger,
    // with a wider drift radius that makes the nearer stars feel like
    // they're orbiting the camera rather than dotting a distant field.
    private let starCount = 160

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
                    // Amplitude and rate are dialled up enough that the
                    // motion is clearly visible behind the .choose circles
                    // (the field used to read as static at conversational
                    // viewing distance).
                    let phase = t * 0.38 + Double(i) * 0.41
                    let dx = sin(phase) * 16.0
                    let dy = cos(phase * 1.27) * 11.0

                    let x = rx * size.width + dx
                    let y = ry * size.height + dy

                    let pulse = 0.65 + 0.35 * sin(t * 1.6 + Double(i) * 0.31)
                    let radius = (1.5 + ra * 2.4) * (active ? 1.0 : 0.85)
                    let alpha = (0.38 + ra * 0.55) * pulse * (active ? 1.0 : 0.5)

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

    private let centralStarCount = 120
    private let amber = Color(red: 1.00, green: 0.68, blue: 0.20)

    private struct Satellite {
        let delay: Double
        let angle: Double
        // Per-satellite distance / size so the four don't sit on a perfect
        // circle. Each value is a multiplier of the central coreRadius —
        // organic asymmetry reads better than a clock-face arrangement.
        let distanceFactor: Double
        let sizeFactor: Double
        let starCount: Int
    }
    // Four anchor points around the central sphere, staggered in time so
    // the sparks read as individual firings rather than a chord, and at
    // varied distances / sizes so the resulting graph feels composed
    // rather than mechanical. Distances are 1.7-2.1x core radius (was a
    // uniform 3.3x), so the satellites cluster near the parent instead
    // of drifting to the edges of the viewport.
    private let satellites: [Satellite] = [
        Satellite(delay: 0.55, angle: -.pi / 2 + 0.18,
                  distanceFactor: 1.80, sizeFactor: 0.55, starCount: 28),
        Satellite(delay: 1.75, angle:  .pi / 5,
                  distanceFactor: 2.10, sizeFactor: 0.42, starCount: 20),
        Satellite(delay: 2.95, angle:  .pi - .pi / 7,
                  distanceFactor: 1.90, sizeFactor: 0.48, starCount: 24),
        Satellite(delay: 4.15, angle: -2 * .pi / 3,
                  distanceFactor: 1.70, sizeFactor: 0.38, starCount: 18),
    ]

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 40.0)) { context in
            let now = frozenAt ?? context.date
            let elapsed = now.timeIntervalSince(generationStartedAt)
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                // Bigger core (0.20 of min, was 0.16) so the central
                // cloud reads as the focal element of the composition
                // rather than a small dot lost in negative space.
                let coreRadius = min(size.width, size.height) * 0.20

                drawSphere(in: ctx,
                           cx: cx, cy: cy,
                           r: coreRadius,
                           t: elapsed,
                           count: centralStarCount,
                           sizeScale: 1.0,
                           rotationSpeed: 0.32)

                for (i, sat) in satellites.enumerated() {
                    let progress = max(0.0, min(1.0, (elapsed - sat.delay) / 1.4))
                    guard progress > 0 else { continue }
                    let eased = 1 - pow(1 - progress, 3)

                    let satDistance = coreRadius * sat.distanceFactor
                    let satX = cx + cos(sat.angle) * satDistance * eased
                    let satY = cy + sin(sat.angle) * satDistance * eased

                    // Connector line fades in once the spark has covered
                    // most of its travel. Start point sits on the central
                    // sphere's surface (rather than its dead centre) and
                    // end point sits just shy of the satellite's surface,
                    // so the line emerges *from* the cluster's edge rather
                    // than slicing through every dot in the core.
                    //
                    // Stroked as a dotted line — zero-length dashes drawn
                    // with a round line cap render as small circular dots
                    // spaced 4pt apart — and shaded by a linear gradient
                    // that brightens through the middle and softens at
                    // both ends, so the connector reads as a gentle "spark
                    // trail" rather than a hard 100% filled-in stroke.
                    if progress > 0.6 {
                        let lineAlpha = (progress - 0.6) / 0.4
                        let startX = cx + cos(sat.angle) * coreRadius * 0.95
                        let startY = cy + sin(sat.angle) * coreRadius * 0.95
                        let satEdge = coreRadius * sat.sizeFactor * 0.9
                        let endX = satX - cos(sat.angle) * satEdge
                        let endY = satY - sin(sat.angle) * satEdge
                        var line = Path()
                        line.move(to: CGPoint(x: startX, y: startY))
                        line.addLine(to: CGPoint(x: endX, y: endY))
                        let lineGradient = Gradient(stops: [
                            .init(color: amber.opacity(0.08 * lineAlpha), location: 0.0),
                            .init(color: amber.opacity(0.30 * lineAlpha), location: 0.5),
                            .init(color: amber.opacity(0.08 * lineAlpha), location: 1.0)
                        ])
                        ctx.stroke(
                            line,
                            with: .linearGradient(
                                lineGradient,
                                startPoint: CGPoint(x: startX, y: startY),
                                endPoint: CGPoint(x: endX, y: endY)
                            ),
                            style: StrokeStyle(
                                lineWidth: 1.4,
                                lineCap: .round,
                                dash: [0.01, 4]
                            )
                        )
                    }

                    // Satellite mini-cluster blooms after the spark
                    // arrives. Its radius scales with bloom progress so
                    // it appears to grow out of the spark; per-satellite
                    // sizeFactor / starCount give the composition organic
                    // variety rather than four identical clones. Drawn
                    // before the spark/glow so the bright amber dot at
                    // the centre stays visible on top of the cluster.
                    if progress > 0.7 {
                        let bloom = (progress - 0.7) / 0.3
                        drawSphere(in: ctx,
                                   cx: satX, cy: satY,
                                   r: coreRadius * sat.sizeFactor * bloom,
                                   t: elapsed + Double(i) * 1.7,
                                   count: sat.starCount,
                                   sizeScale: 0.85,
                                   rotationSpeed: 0.45)
                    }

                    // Travelling spark — bright while in flight, leaves a
                    // short fading tail back toward the origin. Once it
                    // settles, the breathing glow stays on top of the
                    // mini-cluster as the satellite's "seed" marker.
                    if progress < 1 {
                        drawSparkInFlight(in: ctx,
                                          from: CGPoint(x: cx, y: cy),
                                          to: CGPoint(x: satX, y: satY),
                                          eased: eased)
                    } else {
                        drawSettledSparkGlow(in: ctx,
                                             at: CGPoint(x: satX, y: satY),
                                             phase: Double(i),
                                             t: elapsed)
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
                            rotationSpeed: Double) {
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
            let perspective = 0.6 + depth * 0.8

            let sx = cx + x * (0.85 + 0.15 * perspective)
            let sy = cy + y * (0.85 + 0.15 * perspective)

            let dotSize = (1.0 + pseudoRandom(i * 5) * 1.5) * perspective * sizeScale
            let pulse = 0.78 + 0.22 * sin(t * 1.6 + Double(i) * 0.31)
            let alpha = (0.30 + pseudoRandom(i * 7) * 0.55) * perspective * pulse

            ctx.fill(
                Path(ellipseIn: CGRect(x: sx - dotSize, y: sy - dotSize,
                                       width: dotSize * 2, height: dotSize * 2)),
                with: .color(.white.opacity(alpha))
            )
        }
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
