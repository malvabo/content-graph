import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield of white glowing particles matching the onboarding
/// constellation screen. Audio level gently scales radius and brightness.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

    private let starCount = 160

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = audioLevel()
            let amplified = min(1.0, max(0.0, Double(level) - 0.008) * 18.0)
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy)

                // Gray boundary stroke
                let strokeR = maxR - 1
                ctx.stroke(
                    Path(ellipseIn: CGRect(x: cx - strokeR, y: cy - strokeR,
                                           width: strokeR * 2, height: strokeR * 2)),
                    with: .color(Color(white: 0.38, opacity: 0.55)),
                    lineWidth: 1.5
                )

                for i in 0..<starCount {
                    let rx = prng(i * 3)
                    let ry = prng(i * 3 + 1)
                    let ra = prng(i * 3 + 2)

                    let phase = t * 0.38 + Double(i) * 0.41
                    let dx = sin(phase) * 16.0
                    let dy = cos(phase * 1.27) * 11.0

                    let x = rx * size.width + dx
                    let y = ry * size.height + dy

                    // Clip particles to circle
                    let distX = x - cx, distY = y - cy
                    guard distX * distX + distY * distY <= strokeR * strokeR else { continue }

                    let pulse = 0.65 + 0.35 * sin(t * 1.6 + Double(i) * 0.31)
                    let radius = (1.5 + ra * 2.4) * (1.0 + amplified * 0.45)
                    let alpha = min(1.0, (0.38 + ra * 0.55) * pulse * (1.0 + amplified * 0.35))

                    ctx.fill(
                        Path(ellipseIn: CGRect(x: x - radius, y: y - radius,
                                               width: radius * 2, height: radius * 2)),
                        with: .color(.white.opacity(alpha))
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
