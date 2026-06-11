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

        let speed = 0.003 + level * 0.024
        rotation += dt * speed
        return self
    }
}

/// Full-circle starfield. Particles drift calmly by default; speech only makes
/// them move a little faster and turn more opaque.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

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
                let sphereR = min(cx, cy) - 18

                for i in 0..<starCount {
                    let n = Double(i) + 0.5
                    let phi = acos(1 - 2 * n / Double(starCount))
                    let theta = goldenAngle * Double(i) + rotation
                    let fill = pow(prng(i * 13 + 2), 0.58)
                    let jitter = 0.12 + fill * 0.88
                    let breath = 1.0 + sin(t * 0.08 + Double(i) * 0.23) * (0.002 + audio * 0.004)
                    let r = sphereR * jitter * breath
                    let x3 = r * sin(phi) * cos(theta)
                    let z3 = r * sin(phi) * sin(theta)
                    let y3 = r * cos(phi)

                    let depth = (z3 + sphereR) / (2 * sphereR)
                    let perspective = 0.62 + depth * 0.50
                    let x = cx + x3 * (0.86 + 0.14 * perspective)
                    let y = cy + y3 * (0.86 + 0.14 * perspective)

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
