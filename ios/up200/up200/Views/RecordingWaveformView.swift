import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield of white glowing particles. Audio level gently scales
/// radius and brightness; active particles warm toward amber when speaking.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float
    var isPaused: Bool = false

    private let starCount = 160

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = audioLevel()
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy)

                for i in 0..<starCount {
                    // Distribute particles in a circle rather than a square so
                    // no particle drifts across the clip boundary and flickers.
                    // Polar coordinates with sqrt-radius give uniform area density.
                    let angle = prng(i * 3) * 2 * .pi
                    let baseR = sqrt(prng(i * 3 + 1)) * (maxR - 20)
                    let ra = prng(i * 3 + 2)
                    // Per-particle threshold prevents all 160 stars firing
                    // simultaneously — denser stars react first, sparse ones later.
                    let amplified = min(1.0, max(0.0, Double(level) - (0.004 + ra * 0.016)) * 18.0)

                    let phase = t * 0.38 + Double(i) * 0.41
                    let dx = sin(phase) * 13.0
                    let dy = cos(phase * 1.27) * 9.0

                    let x = cx + baseR * cos(angle) + dx
                    let y = cy + baseR * sin(angle) + dy

                    let pulse = 0.75 + 0.25 * sin(t * 1.6 + Double(i) * 0.31)
                    let radius = (2.0 + ra * 3.2) * (1.0 + amplified * 0.45)

                    let pauseDim = isPaused ? 0.4 : 1.0
                    let alpha = min(1.0, (0.55 + ra * 0.45) * pulse * (1.0 + amplified * 0.35) * pauseDim)

                    // Particles warm from white toward soft amber as audio level rises
                    let warmth = amplified * 0.55
                    let particleColor = Color(
                        red: 1.0,
                        green: 1.0 - warmth * 0.28,
                        blue: 1.0 - warmth * 0.60
                    ).opacity(alpha)

                    ctx.fill(
                        Path(ellipseIn: CGRect(x: x - radius, y: y - radius,
                                               width: radius * 2, height: radius * 2)),
                        with: .color(particleColor)
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
