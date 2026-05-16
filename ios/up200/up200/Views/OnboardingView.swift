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

    @AppStorage("library_projects") private var projectsData: Data = Data()

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
            ProjectGroupDetailView(groupTitle: batch.title, initialItems: batch.items)
                .preferredColorScheme(.dark)
        }
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
        case .choose, .generating:
            VStack(spacing: 6) {
                Text("Your idea is safe here.")
                    .font(.system(size: 20, weight: .medium, design: .monospaced))
                    .kerning(-0.3)
                    .foregroundColor(AppText.primary)
                Text("What do you want to create?")
                    .font(.system(size: 20, weight: .medium, design: .monospaced))
                    .kerning(-0.3)
                    .foregroundColor(Color.white.opacity(0.72))
            }
            .multilineTextAlignment(.center)
            .transition(.opacity)
        case .specify:
            Text("What do you want to?..")
                .font(.system(size: 22, weight: .medium, design: .monospaced))
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
            // The cloud has no edges. The blurb's intrinsic frame is taller
            // than the captureCenter slot, and the negative h-padding /
            // b-padding lets it bleed past the surrounding paddings — the
            // sides clear the captureCenter's horizontal inset, the bottom
            // slips beneath the CTA layout box and past the screen edge.
            // The press-and-hold caption is overlaid at the top of the
            // visible portion of the cloud rather than placed below the
            // blurb, since the blurb's "below" extends off-screen and a
            // text element placed there would never be seen.
            StarfieldBlurb(active: true)
                .frame(height: 660)
                // contentShape goes here, *before* the negative paddings,
                // so the press-and-hold hit area is the full rendered
                // cloud rectangle. Were it applied after, the negative
                // padding would shrink the hit target down to the
                // collapsed layout box and the user could tap on a star
                // without anything firing.
                .contentShape(Rectangle())
                // Long-press initiates recording. minimumDuration is short
                // enough that the gesture feels like a confirm-tap, not a
                // hold — once .recording starts, the user can let go and
                // tap "Finish recording" below.
                .onLongPressGesture(minimumDuration: 0.3, maximumDistance: 30) {
                    startCaptureRecording()
                }
                .padding(.horizontal, -24)
                .padding(.bottom, -320)
                .overlay(alignment: .top) {
                    Text("Press and hold to start recording\nyour first idea")
                        .font(.system(size: 14, weight: .regular, design: .rounded))
                        .foregroundColor(Color.white.opacity(0.58))
                        .multilineTextAlignment(.center)
                        .padding(.top, 18)
                        .allowsHitTesting(false)
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
                captureTagRow(label: "A LinkedIn post", icon: "person.2.fill") {
                    startGeneration(label: "A LinkedIn post", formatID: "linkedin", customPrompt: "")
                }
                captureTagRow(label: "A Twitter thread", icon: "text.bubble") {
                    startGeneration(label: "A Twitter thread", formatID: "twitter", customPrompt: "")
                }
                captureTagRow(label: "Something else", icon: "sparkles") {
                    startSpecifyRecording()
                }
                captureTagRow(label: "Just save my note for now", icon: "tray.and.arrow.down") {
                    saveIdeaAndExit()
                }
            }
            .transition(.opacity.combined(with: .move(edge: .bottom)))

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
            OnboardingGenerationPill(label: chosenContentLabel)
                .transition(.opacity.combined(with: .scale(scale: 0.96)))
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

    private func captureTagRow(label: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(BrandColor.amber.opacity(0.92))
                    .frame(width: 22)
                Text(label)
                    .font(.app(size: 16, weight: .medium))
                    .foregroundColor(AppText.primary)
                Spacer()
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
        var notes = NotesStore.load()
        notes.insert(Note(body: trimmed, updatedAt: Date()), at: 0)
        NotesStore.save(notes)
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

// MARK: - Onboarding generation pill

/// Compact pill shown while the user "waits" for their first piece of
/// content. Mirrors the in-app GenerationBanner — orbiting dots on the
/// left, "Creating your <content>" copy — so the moment the user lands
/// in the app and sees the real banner, it reads as the same instrument
/// they just saw at the end of onboarding.
private struct OnboardingGenerationPill: View {
    let label: String

    /// "A LinkedIn post" → "a LinkedIn post" — lowercases only the first
    /// character so brand names ("LinkedIn", "Twitter") keep their casing
    /// when the label is interpolated into "Creating <label>…".
    private var phrasedLabel: String {
        guard let first = label.first else { return label }
        return first.lowercased() + label.dropFirst()
    }

    private struct DotConfig {
        let radius: Double
        let size: Double
        let speed: Double
        let phase: Double
        let opacity: Double
    }
    private let dotConfigs: [DotConfig] = [
        DotConfig(radius: 9,  size: 3.5, speed: 1.1,  phase: 0.0,  opacity: 0.95),
        DotConfig(radius: 7,  size: 2.5, speed: 1.7,  phase: 0.4,  opacity: 0.70),
        DotConfig(radius: 11, size: 2.0, speed: 0.85, phase: 0.9,  opacity: 0.55),
        DotConfig(radius: 6,  size: 3.0, speed: 2.2,  phase: 1.4,  opacity: 0.80),
        DotConfig(radius: 10, size: 2.0, speed: 1.45, phase: 1.9,  opacity: 0.60),
        DotConfig(radius: 8,  size: 2.5, speed: 0.95, phase: 2.5,  opacity: 0.75),
    ]

    var body: some View {
        HStack(spacing: 12) {
            Spacer(minLength: 0)
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 36, height: 36)
                TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { tl in
                    let t = tl.date.timeIntervalSinceReferenceDate
                    ZStack {
                        ForEach(dotConfigs.indices, id: \.self) { i in
                            let cfg = dotConfigs[i]
                            let angle = t * cfg.speed + cfg.phase
                            let x = cfg.radius * cos(angle)
                            let y = cfg.radius * sin(angle)
                            let pulse = (sin(t * cfg.speed * 2.3 + cfg.phase) + 1) / 2
                            Circle()
                                .fill(Color.white.opacity(cfg.opacity * (0.5 + 0.5 * pulse)))
                                .frame(width: cfg.size * (0.75 + 0.25 * pulse),
                                       height: cfg.size * (0.75 + 0.25 * pulse))
                                .blur(radius: 0.8)
                                .offset(x: x, y: y)
                        }
                    }
                }
            }
            .frame(width: 36, height: 36)
            .clipShape(Circle())

            Text("Creating \(phrasedLabel)\u{2026}")
                .font(.app(size: 15, weight: .semibold))
                .foregroundColor(AppText.primary)
                .lineLimit(1)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(Color.white.opacity(0.05))
                Ellipse()
                    .fill(BrandColor.amber.opacity(0.10))
                    .blur(radius: 22)
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: Color.black.opacity(0.40), radius: 16, x: 0, y: 8)
        .accessibilityLabel("Creating \(phrasedLabel)")
    }
}

#Preview {
    OnboardingView(onGetStarted: {}, onLogin: {})
}
