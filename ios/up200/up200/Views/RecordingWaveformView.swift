import SwiftUI

// MARK: - Particle orbit store

/// Persistent per-particle orbital state. Angles are accumulated via dt
/// each frame so changing orbital speed (which tracks audio level) never
/// causes a positional jump.
final class ParticleOrbitStore: ObservableObject {
    struct Particle {
        var angle: Double
        let baseSpeed: Double
        let dir: Double
        let normR: Double
        let pr2: Double
        let pr3: Double
        let fi: Double
    }

    private(set) var particles: [Particle] = []
    var lastT: Double = -1

    init(count: Int) {
        for i in 0..<count {
            let pr0 = Self.prng(i)
            let pr1 = Self.prng(i + 1000)
            let pr2 = Self.prng(i + 2000)
            let pr3 = Self.prng(i + 3000)
            particles.append(Particle(
                angle: pr2 * .pi * 2,
                baseSpeed: 0.10 + (1.0 - pr0) * 0.20,
                dir: pr1 < 0.5 ? 1.0 : -1.0,
                normR: 0.08 + pow(pr0, 0.7) * 0.88,
                pr2: pr2, pr3: pr3,
                fi: Double(i)
            ))
        }
    }

    func step(t: Double, amplified: Double) {
        guard lastT > 0 else { lastT = t; return }
        let dt = min(t - lastT, 0.067)
        lastT = t
        let speedMult = 1.8 + amplified * 6.0
        for i in particles.indices {
            particles[i].angle += particles[i].baseSpeed * speedMult * particles[i].dir * dt
        }
    }

    private static func prng(_ n: Int) -> Double {
        let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
        return v - floor(v)
    }
}

// MARK: - Shared recording waveform

/// Full-circle orbital particle field driven by a live audio level.
/// Pass `audioLevel` as a closure so the same view works with both
/// `VoiceRecorder` and `RecordingController` without protocol overhead.
struct RecordingWaveformView: View {
    /// Called each frame to read the current audio level (0–1 raw RMS).
    let audioLevel: () -> Float

    @StateObject private var store = ParticleOrbitStore(count: 200)
    private let amber = Color(red: 0.92, green: 0.54, blue: 0.08)

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            let level = audioLevel()
            let amplified = min(1.0, max(0.0, Double(level) - 0.008) * 18.0)
            Canvas { ctx, size in
                let cx = size.width / 2
                let cy = size.height / 2
                let maxR = min(cx, cy) * 0.88
                for p in store.particles {
                    let radialBreath = 1.0 + sin(t * 0.45 + p.fi * 0.19) * 0.018
                    let r = p.normR * maxR * radialBreath
                    let px = cx + cos(p.angle) * r
                    let py = cy + sin(p.angle) * r
                    let pulse = 0.88 + 0.12 * sin(t * 0.35 + p.fi * 0.4)
                    let dotR = (1.0 + p.pr2 * 1.4) * pulse + amplified * 0.8
                    let alphaPulse = 0.80 + 0.20 * sin(t * 0.28 + p.fi * 0.3)
                    let alpha = (0.50 + p.pr3 * 0.35) * alphaPulse * (0.65 + amplified * 0.35)
                    let glowWave = max(0.0, sin(t * 1.4 + p.fi * 1.1 + p.pr2 * Double.pi * 2.0))
                    let glow = pow(glowWave, 5.0) * (0.5 + amplified * 0.5)
                    if glow > 0.02 {
                        let glowR = dotR * (3.0 + p.pr2 * 2.0)
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: px - glowR, y: py - glowR,
                                                   width: glowR * 2, height: glowR * 2)),
                            with: .color(amber.opacity(0.18 * glow))
                        )
                    }
                    ctx.fill(
                        Path(ellipseIn: CGRect(x: px - dotR, y: py - dotR,
                                               width: dotR * 2, height: dotR * 2)),
                        with: .color(amber.opacity(alpha))
                    )
                }
            }
            .onChange(of: context.date) { _, _ in
                store.step(t: t, amplified: amplified)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityHidden(true)
    }
}
