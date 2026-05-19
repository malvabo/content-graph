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
    @State private var showCaptureMicAlert: Bool = false
    @State private var chosenContentLabel: String = ""
    @State private var generatingTask: Task<Void, Never>? = nil
    // The first recording's transcript becomes the source we feed to the
    // generator. We snapshot it the moment the user finishes recording —
    // starting a second recording (the "Something else" specify pass)
    // rewires SFSpeechRecognizer and clobbers `captureRecorder.transcript`
    // with the new text, so reading it lazily would lose the original idea.
    @State private var firstIdeaTranscript: String = ""
    @State private var resultBatch: OnboardingResultBatch? = nil
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

    @AppStorage("library_projects") private var projectsData: Data = Data()

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
                    .transition(.opacity.animation(.easeInOut(duration: 0.85)))
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
                    .onLongPressGesture(minimumDuration: 0.3, maximumDistance: 30) {
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

            Spacer()
        }
        .allowsHitTesting(false)
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
            try? await Task.sleep(nanoseconds: 6_500_000_000)
            guard !Task.isCancelled else { return }
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            // Freeze the cluster on a single frame for the duration of the
            // dive (see comment on `diveStartedAt`). Has to be set on the
            // same runloop tick as the step change so the scene picks up
            // the frozen time before its removal transition starts
            // animating — otherwise we get one or two frames of live
            // rotation that read as a jolt right at the start of the dive.
            diveStartedAt = Date()
            // 0.85s, easeIn — with the cluster frozen on a single frame,
            // the dive is just a still image scaling + fading. easeIn
            // (gentle start, accelerating into the end) reads as a real
            // camera pushing forward: the cluster sits a beat, the camera
            // starts moving, then plunges through. easeInOut had a slow
            // ending that lingered on the magnified, mostly-faded frame,
            // and easeOut started with a jolt before there was anything
            // to dive through. The shorter window (0.85s vs 0.95s) cuts
            // the late, near-zero-opacity tail where the scaled-up cluster
            // would otherwise still be detectable.
            withAnimation(.easeIn(duration: 0.85)) {
                step = .capture
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
            // Tick the on-screen mm:ss only while the recorder is active.
            // Loop exits when the view is torn down (SwiftUI cancels .task).
            // Two counters because the user may record twice — once for the
            // idea and again to specify "what do you want to" — and each
            // phase shows its own elapsed time.
            while !Task.isCancelled {
                do { try await Task.sleep(nanoseconds: 1_000_000_000) }
                catch { break }
                guard captureRecorder.isRecording else { continue }
                switch capturePhase {
                case .recording: recordingSeconds += 1
                case .specify:   specifySeconds += 1
                default:         break
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
            Button("Skip", role: .cancel) { onGetStarted() }
        } message: {
            Text("Microphone access is needed to capture your first idea. You can also skip and start exploring.")
        }
        .onDisappear {
            captureRecorder.stop()
            generatingTask?.cancel()
            generatingTask = nil
        }
        // Drop the user straight into the same detail surface the app uses
        // for every other generation result. When they dismiss it, fall
        // through to onGetStarted so onboarding exits — they've now seen
        // both the create flow and the result page, so showing the main
        // tab bar is the right next beat.
        .fullScreenCover(item: $resultBatch, onDismiss: { onGetStarted() }) { batch in
            ProjectGroupDetailView(groupTitle: batch.title,
                                   initialItems: batch.items,
                                   showsFreshBanner: true)
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
                Text("Your idea is safe here.")
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
            Text("Your idea is safe here.")
                .font(.lora(size: 20, weight: .medium))
                .kerning(-0.3)
                .foregroundColor(AppText.primary)
                .multilineTextAlignment(.center)
                .transition(.opacity)
        case .specify:
            Text("What do you want to?..")
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
                .font(.system(size: 14, weight: .regular, design: .rounded))
                .foregroundColor(Color.white.opacity(0.62))
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .allowsHitTesting(false)
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
            chooseCirclesField
                // Pure fade-in. The slide directions (.bottom, then .top)
                // both pulled the eye in a direction; a dissolve is the
                // calmer "appears" the design ask wants.
                .transition(.opacity)

        case .specify:
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
                    Text("Recording  \(formatCaptureTime(specifySeconds))")
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(BrandColor.amber.opacity(0.92))
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
                InsideSphereScene(generationStartedAt: generatingStartedAt)
                    .frame(maxWidth: .infinity)
                    .frame(height: 420)
                    .padding(.horizontal, -24)

                Text("Writing your content\u{2026}")
                    .font(.system(size: 14, weight: .medium, design: .monospaced))
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
    /// Each circle has a thin white stroke with a soft outer glow — the
    /// sharp stroke gives the edge, a blurred copy underneath gives the
    /// halo. Static, no morphing; circles don't touch or fuse.
    private var chooseCirclesField: some View {
        let options: [(label: String, icon: String, action: () -> Void)] = [
            ("A LinkedIn post", "person.2.fill", {
                startGeneration(label: "A LinkedIn post", formatID: "linkedin", customPrompt: "")
            }),
            ("A Twitter thread", "text.bubble", {
                startGeneration(label: "A Twitter thread", formatID: "twitter", customPrompt: "")
            }),
            ("Something else", "sparkles", {
                startSpecifyRecording()
            }),
            ("Just save my note for now", "tray.and.arrow.down", {
                saveIdeaAndExit()
            })
        ]

        return GeometryReader { geo in
            let circleRadius: CGFloat = min(geo.size.width * 0.24, 84)
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
                            Image(systemName: opt.icon)
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
                            Circle()
                                .fill(Color.white.opacity(0.03))
                        )
                        .overlay(
                            // Blurred outer stroke = soft glow halo.
                            Circle()
                                .stroke(Color.white.opacity(0.35), lineWidth: 1.4)
                                .blur(radius: 3)
                        )
                        .overlay(
                            // Sharp thin stroke on top defines the edge.
                            Circle()
                                .stroke(Color.white.opacity(0.55), lineWidth: 0.5)
                        )
                        .contentShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .position(positions[idx])
                }
            }
        }
        // Reserve enough vertical room for two rows of circles (each ~168pt
        // diameter at max) plus the inter-row gap. The captureCenter
        // surrounds this in Spacers, so any leftover space is absorbed there.
        .frame(height: 360)
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
        // Snapshot the transcript *before* stopping — the recognition task
        // may emit one last partial result after stop(), but the value held
        // here is what we'll feed the generator no matter which path the
        // user picks next.
        firstIdeaTranscript = captureRecorder.transcript
        captureRecorder.stop()
        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .choose
        }
    }

    private func startSpecifyRecording() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        specifySeconds = 0
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
        saveTranscriptAsNote(transcript)

        withAnimation(.easeInOut(duration: 0.45)) {
            capturePhase = .generating
        }

        generatingTask?.cancel()
        generatingTask = Task { @MainActor in
            await runGeneration(label: label,
                                formatID: formatID,
                                customPrompt: customPrompt,
                                transcript: transcript)
        }
    }

    @MainActor
    private func runGeneration(label: String,
                               formatID: String,
                               customPrompt: String,
                               transcript: String) async {
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
            let project = GenerationProject(
                title: deriveTitle(from: transcript, fallback: label),
                outputType: formatID,
                preview: String(text.prefix(160)),
                content: text,
                date: Date()
            )
            saveProjectToLibrary(project)
            resultBatch = OnboardingResultBatch(title: project.title, items: [project])
        case .failure:
            // Note is already saved — quietly exit into the app rather than
            // stranding the user on the generating pill. A failure banner
            // in the middle of onboarding would be more noise than signal.
            onGetStarted()
        }
    }

    private func saveTranscriptAsNote(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        var stored = NotesStore.load()
        var note = Note()
        note.body = trimmed
        note.updatedAt = Date()
        let noteID = note.id
        stored.insert(note, at: 0)
        NotesStore.save(stored)

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
    }

    private func saveProjectToLibrary(_ project: GenerationProject) {
        var projects: [GenerationProject]
        switch loadBlob([GenerationProject].self, from: projectsData) {
        case .empty: projects = []
        case .ok(let existing): projects = existing
        case .corrupt: return
        }
        projects.insert(project, at: 0)
        if let encoded = try? JSONEncoder().encode(projects) {
            projectsData = encoded
        }
    }

    private func deriveTitle(from transcript: String, fallback: String) -> String {
        let first = transcript.split(whereSeparator: \.isNewline).first.map(String.init) ?? ""
        let trimmed = first.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return fallback }
        return String(trimmed.prefix(60))
    }

    private func formatCaptureTime(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }
}

private struct OnboardingResultBatch: Identifiable {
    let id = UUID()
    let title: String
    let items: [GenerationProject]
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
                    let phase = t * 0.22 + Double(i) * 0.41
                    let dx = sin(phase) * 9.0
                    let dy = cos(phase * 1.27) * 6.5

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
