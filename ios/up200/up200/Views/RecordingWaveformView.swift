import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield. Speech does not scatter the particles; it only lets
/// them brighten into slow white blooms and drift a little more awake.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

    private let starCount = 160
    private let ringCount = 22

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 24.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let rawLevel = max(0.0, Double(audioLevel()) - 0.025)
            let audio = min(1.0, pow(rawLevel * 3.0, 0.72))
            let idleBreath = (sin(t * 2.2) + 1.0) / 2.0
            let liveliness = max(audio, 0.16 + idleBreath * 0.10)
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy)

                let haloR = maxR * (0.54 + idleBreath * 0.035 + audio * 0.05)
                let haloRect = CGRect(x: cx - haloR, y: cy - haloR, width: haloR * 2, height: haloR * 2)
                ctx.stroke(
                    Path(ellipseIn: haloRect),
                    with: .color(Color.white.opacity(0.08 + liveliness * 0.16)),
                    lineWidth: 1.2 + liveliness * 1.8
                )

                for i in 0..<ringCount {
                    let progress = Double(i) / Double(ringCount)
                    let angle = progress * 2 * .pi + t * (0.42 + audio * 0.22)
                    let wobble = sin(t * 1.6 + Double(i) * 0.71) * (2.5 + audio * 5.5)
                    let r = maxR * (0.42 + 0.16 * prng(i + 400)) + wobble
                    let x = cx + cos(angle) * r
                    let y = cy + sin(angle) * r
                    let pulse = (sin(t * 3.0 + Double(i) * 0.82) + 1.0) / 2.0
                    let dotR = 1.8 + pulse * 2.5 + audio * 3.2
                    let alpha = 0.22 + pulse * 0.24 + audio * 0.35
                    ctx.fill(
                        Path(ellipseIn: CGRect(x: x - dotR, y: y - dotR, width: dotR * 2, height: dotR * 2)),
                        with: .color(Color.white.opacity(alpha))
                    )
                }

                for i in 0..<starCount {
                    let angle = prng(i * 3    ) * 2 * .pi
                    let baseR = sqrt(prng(i * 3 + 1)) * (maxR - 18)
                    let ra    = prng(i * 3 + 2)

                    let speed = 0.55 + liveliness * 0.34
                    let phase = t * speed + Double(i) * 0.41
                    let drift = 2.8 + liveliness * 5.2
                    let radialBreath = sin(t * (0.82 + ra * 0.26) + Double(i) * 0.23) * (1.2 + liveliness * 2.4)
                    let r = baseR + radialBreath
                    let x = cx + r * cos(angle) + sin(phase) * drift
                    let y = cy + r * sin(angle) + cos(phase * 1.19) * drift * 0.78

                    let glowHz = 0.72 + prng(i * 7 + 3) * 0.58
                    let glowWave = (sin(t * glowHz + Double(i) * 1.73) + 1.0) / 2.0
                    let glow = pow(glowWave, 2.3)

                    let sensitivity = 0.65 + prng(i * 5 + 1) * 1.05
                    let ignition = min(1.0, glow * liveliness * sensitivity)

                    let alpha = min(0.96, (0.14 + ra * 0.16) + ignition * 0.68)
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
