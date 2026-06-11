import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield. Particles drift calmly by default; speech only makes
/// them move a little faster and turn more opaque.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

    private let starCount = 160

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = max(0.0, Double(audioLevel()))
            let rawLevel = max(0.0, level - 0.003)
            let audio = min(1.0, pow(rawLevel * 14.0, 0.62))
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy)

                for i in 0..<starCount {
                    let angle = prng(i * 3    ) * 2 * .pi
                    let baseR = sqrt(prng(i * 3 + 1)) * (maxR - 18)
                    let ra    = prng(i * 3 + 2)

                    let speed = 0.07 + audio * 0.08
                    let phase = t * speed + Double(i) * 0.41
                    let drift = 1.6 + audio * 1.15
                    let radialBreath = sin(t * (0.10 + ra * 0.045) + Double(i) * 0.23) * (0.55 + audio * 0.45)
                    let r = baseR + radialBreath
                    let x = cx + r * cos(angle) + sin(phase) * drift
                    let y = cy + r * sin(angle) + cos(phase * 1.19) * drift * 0.78

                    let sensitivity = 0.65 + prng(i * 5 + 1) * 1.05
                    let audioLift = min(1.0, audio * sensitivity)
                    let alpha = min(0.88, (0.12 + ra * 0.14) + audioLift * 0.46)
                    let radius = 1.35 + ra * 2.15

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
