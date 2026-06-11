import SwiftUI

// MARK: - Shared recording waveform

/// Full-circle starfield. Each particle has its own slow glow cycle; audio
/// gives particles permission to ignite during their natural upswing, producing
/// a rolling, organic bloom rather than a simultaneous flash.
struct RecordingWaveformView: View {
    let audioLevel: () -> Float

    private let starCount = 160

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            // Soft audio presence: gentle lift so quiet rooms show nothing,
            // normal speech lands around 0.6–0.8.
            let audio = min(1.0, Double(audioLevel()) * 2.4)
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy)

                for i in 0..<starCount {
                    let angle = prng(i * 3    ) * 2 * .pi
                    let baseR = sqrt(prng(i * 3 + 1)) * (maxR - 18)
                    let ra    = prng(i * 3 + 2)

                    // Very gentle drift — particles barely float in place
                    let speed = 0.14 + audio * 0.03
                    let phase = t * speed + Double(i) * 0.41
                    let x = cx + baseR * cos(angle) + sin(phase)        * 3.5
                    let y = cy + baseR * sin(angle) + cos(phase * 1.27) * 2.5

                    // Per-particle glow cycle — slow (3–8 s period), staggered
                    // so no two particles sync. glow is zero half the time,
                    // creating natural gaps between ignitions.
                    let glowHz    = 0.12 + prng(i * 7 + 3) * 0.18   // 0.12–0.30 Hz
                    let glow      = max(0.0, sin(t * glowHz + Double(i) * 1.73))

                    // Ignition = glow opportunity × audio × particle sensitivity.
                    // All three must be nonzero; sensitivity variance (0.4–2.4)
                    // means some particles respond to a whisper, others need
                    // louder speech — an organic, staggered lighting pattern.
                    let sensitivity = 0.4 + prng(i * 5 + 1) * 2.0
                    let ignition    = min(1.0, glow * audio * sensitivity)

                    // Alpha: dim at rest (distant stars), selected ones bloom
                    let alpha  = min(0.80, (0.12 + ra * 0.16) + ignition * 0.56)

                    // Size: gentle bloom — 20% growth at full ignition
                    let radius = (1.4 + ra * 2.4) * (1.0 + ignition * 0.20)

                    // Color: pure white. Barely-perceptible warmth (< 2%) only
                    // at peak ignition — adds depth without an orange cast.
                    let w = ignition * 0.08
                    ctx.fill(
                        Path(ellipseIn: CGRect(x: x - radius, y: y - radius,
                                               width: radius * 2, height: radius * 2)),
                        with: .color(Color(red: 1.0,
                                          green: 1.0 - w * 0.20,
                                          blue:  1.0 - w * 0.50).opacity(alpha))
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
