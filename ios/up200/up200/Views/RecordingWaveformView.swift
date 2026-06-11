import SwiftUI

// MARK: - Shared recording waveform

private final class RecordingWaveformEnvelope: ObservableObject {
    private(set) var level: Double = 0
    private(set) var rotation: Double = 0
    private var lastDate: Date?

    func sample(_ target: Double, at date: Date) -> RecordingWaveformEnvelope {
        let previous = lastDate ?? date
        let dt = max(0, min(0.12, date.timeIntervalSince(previous)))
        lastDate = date

        let timeConstant = target > level ? 0.18 : 1.35
        let blend = timeConstant <= 0 ? 1 : 1 - exp(-dt / timeConstant)
        level += (target - level) * blend

        let speed = 0.003 + level * 0.040
        rotation += dt * speed
        return self
    }
}

/// Full-circle starfield. Particles drift calmly by default; speech only makes
/// them move a little faster and turn more opaque.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float
    var individualParticleMotion = false

    @StateObject private var envelope = RecordingWaveformEnvelope()
    @State private var startedAt = Date()

    private let starCount = 190
    private let goldenAngle = Double.pi * (1 + sqrt(5.0))

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = max(0, context.date.timeIntervalSince(startedAt))
            let level = max(0.0, Double(audioLevel()))
            let rawLevel = max(0.0, level - 0.003)
            let targetAudio = min(1.0, pow(rawLevel * 9.0, 0.72))
            let audio = envelope.sample(targetAudio, at: context.date).level
            let rotation = envelope.rotation
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let sphereR = min(cx, cy) - 3

                let driftTime = t * (1.0 + audio * 0.45)

                for i in 0..<starCount {
                    let n = Double(i) + 0.5
                    let basePhi = acos(1 - 2 * n / Double(starCount))
                    let baseTheta = goldenAngle * Double(i) + rotation
                    let fill = pow(prng(i * 13 + 2), 0.58)
                    let seedA = prng(i * 17 + 3) * Double.pi * 2
                    let seedB = prng(i * 19 + 7) * Double.pi * 2
                    let seedC = prng(i * 23 + 11) * Double.pi * 2

                    let individualLift = 1.0 + audio * 0.50
                    let thetaDrift = individualParticleMotion
                        ? sin(driftTime * (0.34 + prng(i * 29) * 0.16) * individualLift + seedA) * 0.18
                        : 0
                    let phiDrift = individualParticleMotion
                        ? sin(driftTime * (0.26 + prng(i * 31) * 0.13) * individualLift + seedB) * 0.11
                        : 0
                    let radialDrift = individualParticleMotion
                        ? sin(driftTime * (0.20 + prng(i * 37) * 0.10) * individualLift + seedC) * 0.055
                        : sin(t * 0.08 + Double(i) * 0.23) * (0.002 + audio * 0.004)

                    let phi = max(0.04, min(Double.pi - 0.04, basePhi + phiDrift))
                    let theta = baseTheta + thetaDrift
                    let jitter = 0.12 + fill * 0.88
                    let r = sphereR * jitter * (1.0 + radialDrift)
                    let x3 = r * sin(phi) * cos(theta)
                    let z3 = r * sin(phi) * sin(theta)
                    let y3 = r * cos(phi)

                    let depth = (z3 + sphereR) / (2 * sphereR)
                    let perspective = 0.62 + depth * 0.50
                    var x = cx + x3 * (0.86 + 0.14 * perspective)
                    var y = cy + y3 * (0.86 + 0.14 * perspective)

                    if individualParticleMotion {
                        let orbit = (1.8 + prng(i * 41 + 5) * 4.8) * (0.75 + audio * 0.55)
                        let localT = driftTime * (0.55 + prng(i * 43 + 9) * 0.35)
                        x += cos(localT + seedA) * orbit
                        y += sin(localT * (0.82 + prng(i * 47 + 13) * 0.18) + seedB) * orbit
                    }

                    let sensitivity = 0.75 + prng(i * 5 + 1) * 0.75
                    let audioLift = min(1.0, audio * sensitivity)
                    let alpha = min(0.92, (0.14 + prng(i * 7) * 0.20) * perspective + audioLift * 0.62)
                    let radius = (1.20 + prng(i * 11) * 2.20) * perspective

                    ctx.fill(
                        Path(ellipseIn: CGRect(x: x - radius, y: y - radius,
                                               width: radius * 2, height: radius * 2)),
                        with: .color(Color.white.opacity(alpha))
                    )
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }

    private func prng(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

struct RecordingCloudView: View {
    let audioLevel: () -> Float
    let timeLabel: String
    var isDimmed = false

    var body: some View {
        VStack(spacing: 20) {
            let orbitSize = UIScreen.main.bounds.width * 2 / 3
            RecordingWaveformView(audioLevel: audioLevel, individualParticleMotion: true)
                .frame(width: orbitSize, height: orbitSize)
                .background(Color.white.opacity(0.09))
                .clipShape(Circle())
                .overlay(Circle().stroke(Color(white: 0.38, opacity: 0.55), lineWidth: 1.5))
                .opacity(isDimmed ? 0.3 : 1)

            Text(timeLabel)
                .font(.system(.title2, design: .monospaced))
                .fontWeight(.medium)
                .foregroundColor(AppInk.solid(0.70))
        }
    }
}

struct ActiveRecordingPageView<Title: View, Bottom: View>: View {
    let audioLevel: () -> Float
    let timeLabel: String
    let showsAmberGlow: Bool
    let title: () -> Title
    let close: (() -> Void)?
    let bottom: () -> Bottom

    init(audioLevel: @escaping () -> Float,
         timeLabel: String,
         showsAmberGlow: Bool = true,
         @ViewBuilder title: @escaping () -> Title,
         close: (() -> Void)? = nil,
         @ViewBuilder bottom: @escaping () -> Bottom) {
        self.audioLevel = audioLevel
        self.timeLabel = timeLabel
        self.showsAmberGlow = showsAmberGlow
        self.title = title
        self.close = close
        self.bottom = bottom
    }

    var body: some View {
        ZStack {
            AppBackground.primary.ignoresSafeArea()
            RadialGradient(
                colors: [BrandColor.amber.opacity(showsAmberGlow ? 0.16 : 0.0), .clear],
                center: .center, startRadius: 0, endRadius: 300
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    title()
                    Spacer()
                    if let close {
                        Button(action: close) {
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(AppText.secondary)
                                .frame(width: 44, height: 44)
                                .background(AppInk.solid(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)

                Spacer(minLength: 24)

                RecordingCloudView(audioLevel: audioLevel, timeLabel: timeLabel)
                    .transition(.opacity.combined(with: .scale(scale: 0.95)))

                Spacer(minLength: 24)
                Spacer(minLength: 24)

                bottom()
                    .padding(.horizontal, 20)
                    .padding(.bottom, 16)
            }
        }
    }
}
