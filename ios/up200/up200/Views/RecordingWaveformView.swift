import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield. Speech does not scatter the particles; it only lets
/// them brighten into slow white blooms and drift a little more awake.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

    private let starCount = 160

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let rawLevel = max(0.0, Double(audioLevel()) - 0.025)
            let audio = min(1.0, pow(rawLevel * 3.0, 0.72))
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy)

                for i in 0..<starCount {
                    let angle = prng(i * 3    ) * 2 * .pi
                    let baseR = sqrt(prng(i * 3 + 1)) * (maxR - 18)
                    let ra    = prng(i * 3 + 2)

                    let speed = 0.055 + audio * 0.045
                    let phase = t * speed + Double(i) * 0.41
                    let drift = 1.8 + audio * 1.4
                    let radialBreath = sin(t * (0.075 + ra * 0.035) + Double(i) * 0.23) * (0.7 + audio * 1.1)
                    let r = baseR + radialBreath
                    let x = cx + r * cos(angle) + sin(phase) * drift
                    let y = cy + r * sin(angle) + cos(phase * 1.19) * drift * 0.78

                    let glowHz = 0.055 + prng(i * 7 + 3) * 0.085
                    let glowWave = (sin(t * glowHz + Double(i) * 1.73) + 1.0) / 2.0
                    let glow = pow(glowWave, 3.2)

                    let sensitivity = 0.65 + prng(i * 5 + 1) * 1.05
                    let ignition = min(1.0, glow * audio * sensitivity)

                    let alpha = min(0.96, (0.11 + ra * 0.13) + ignition * 0.74)
                    let glowAlpha = ignition * (0.16 + ra * 0.10)

                    let radius = (1.35 + ra * 2.15) * (1.0 + ignition * 0.16)

                    if glowAlpha > 0.01 {
                        let glowRadius = radius * (2.4 + ignition * 1.7)
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: x - glowRadius, y: y - glowRadius,
                                                   width: glowRadius * 2, height: glowRadius * 2)),
                            with: .color(Color.white.opacity(glowAlpha))
                        )
                    }

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
