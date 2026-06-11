import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield. Particles drift calmly by default; speech only makes
/// them move a little faster and turn more opaque.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

    private let starCount = 160
    private let goldenAngle = Double.pi * (1 + sqrt(5.0))

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = max(0.0, Double(audioLevel()))
            let rawLevel = max(0.0, level - 0.003)
            let audio = min(1.0, pow(rawLevel * 9.0, 0.72))
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let sphereR = min(cx, cy) - 18
                let rotation = t * (0.018 + audio * 0.010)

                for i in 0..<starCount {
                    let n = Double(i) + 0.5
                    let phi = acos(1 - 2 * n / Double(starCount))
                    let theta = goldenAngle * Double(i) + rotation
                    let jitter = 0.80 + prng(i * 3) * 0.20
                    let breath = 1.0 + sin(t * 0.12 + Double(i) * 0.23) * 0.006
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
                    let alpha = min(0.82, (0.10 + prng(i * 7) * 0.18) * perspective + audioLift * 0.42)
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
