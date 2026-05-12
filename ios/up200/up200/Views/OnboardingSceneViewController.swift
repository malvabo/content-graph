import SceneKit
import SpriteKit
import UIKit

// MARK: - Main Scene View Controller

class OnboardingSceneViewController: UIViewController {

    private var sceneView: SCNView!
    private let scene = SCNScene()

    // Background gradient layers. Held as properties so viewDidLayoutSubviews
    // can keep their frames in sync with the view bounds across rotations.
    private var pageGradientLayer: CAGradientLayer?
    private var glowTLLayer:       CAGradientLayer?
    private var glowBRLayer:       CAGradientLayer?

    // Each label cycles through type → hold → fade. fullSize is captured at
    // setup so the pill stays at a constant footprint while text streams in.
    private var labelAnchors: [(node: SCNNode, label: PaddedLabel, fullText: String, fullSize: CGSize)] = []
    private var labelStartTime: CFTimeInterval = 0
    private let labelTypeDuration:  CFTimeInterval = 0.88
    private let labelHoldDuration:  CFTimeInterval = 1.6
    private let labelFadeDuration:  CFTimeInterval = 0.7
    private var displayLink: CADisplayLink?

    // Read once at setup. Drives whether the dot cluster rotates, the cloud
    // blobs breathe, and labels typewriter or appear instantly. We don't
    // observe live changes — the user toggling reduce-motion mid-onboarding
    // is rare, and they'll see the static version on the next presentation.
    private let reduceMotion = UIAccessibility.isReduceMotionEnabled

    override func viewDidLoad() {
        super.viewDidLoad()
        setupSceneView()
        setupCamera()
        setupDotCloud()
        setupDeepAtmosphere()
        setupClouds()
        setupLabelAnchors()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        sceneView.frame = view.bounds
        // Background gradient layers don't autoresize with the view, so they
        // stay at the original launch-time bounds and clip after rotation
        // unless we re-frame them on every layout pass.
        pageGradientLayer?.frame = view.bounds
        glowTLLayer?.frame       = view.bounds
        glowBRLayer?.frame       = view.bounds
        updateLabelPositions()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        // CADisplayLink retains its target; without this the controller (and
        // the whole scene graph it owns) leaks past dismissal and keeps
        // rendering off-screen.
        displayLink?.invalidate()
        displayLink = nil
        sceneView?.isPlaying = false
    }

    // MARK: - Scene View

    private func setupSceneView() {
        sceneView = SCNView(frame: view.bounds)
        sceneView.scene = scene
        sceneView.autoenablesDefaultLighting = false
        sceneView.backgroundColor = .clear
        sceneView.antialiasingMode = .multisampling4X
        sceneView.isPlaying = true
        view.addSubview(sceneView)

        // Near-black warm page background so the cloud blobs and dot
        // cluster read against deep void rather than a hazy warm wash.
        let gradient = CAGradientLayer()
        gradient.frame = view.bounds
        gradient.colors = [
            UIColor(red: 0.07, green: 0.05, blue: 0.04, alpha: 1).cgColor,
            UIColor(red: 0.05, green: 0.04, blue: 0.03, alpha: 1).cgColor,
            UIColor(red: 0.03, green: 0.025, blue: 0.02, alpha: 1).cgColor,
            UIColor(red: 0.02, green: 0.015, blue: 0.01, alpha: 1).cgColor,
        ]
        gradient.locations = [0, 0.35, 0.65, 1]
        gradient.startPoint = CGPoint(x: 0.2, y: 0)
        gradient.endPoint   = CGPoint(x: 0.8, y: 1)
        view.layer.insertSublayer(gradient, at: 0)
        pageGradientLayer = gradient

        // Subtle amber corner glows — opacities cut roughly in half so they
        // hint at warmth without lifting the page back into a haze.
        let glowTL = CAGradientLayer()
        glowTL.type = .radial
        glowTL.frame = view.bounds
        glowTL.colors = [
            UIColor(red: 0.55, green: 0.30, blue: 0.08, alpha: 0.16).cgColor,
            UIColor(red: 0.55, green: 0.30, blue: 0.08, alpha: 0).cgColor,
        ]
        glowTL.locations = [0, 1]
        glowTL.startPoint = CGPoint(x: 0.05, y: 0.05)
        glowTL.endPoint   = CGPoint(x: 0.45, y: 0.40)
        view.layer.insertSublayer(glowTL, at: 1)
        glowTLLayer = glowTL

        let glowBR = CAGradientLayer()
        glowBR.type = .radial
        glowBR.frame = view.bounds
        glowBR.colors = [
            UIColor(red: 0.30, green: 0.20, blue: 0.08, alpha: 0.10).cgColor,
            UIColor(red: 0.30, green: 0.20, blue: 0.08, alpha: 0).cgColor,
        ]
        glowBR.locations = [0, 1]
        glowBR.startPoint = CGPoint(x: 1.0, y: 0.85)
        glowBR.endPoint   = CGPoint(x: 0.55, y: 0.50)
        view.layer.insertSublayer(glowBR, at: 2)
        glowBRLayer = glowBR
    }

    // MARK: - Camera (fixed POV)

    private func setupCamera() {
        let cameraNode = SCNNode()
        cameraNode.camera = SCNCamera()
        cameraNode.camera?.fieldOfView = 52
        cameraNode.camera?.zNear = 0.1
        cameraNode.camera?.zFar  = 200
        cameraNode.position = SCNVector3(0, 0, 38)
        scene.rootNode.addChildNode(cameraNode)
    }

    // MARK: - Dot cloud (the rotating focal element)

    /// The central cluster of glowing dots, built as an explicit node graph so
    /// the whole cluster can rotate rigidly around its own center. Particles
    /// emitted via SCNParticleSystem live in world space and don't follow a
    /// parent rotation, which is why the previous implementation looked static.
    private func setupDotCloud() {
        // Two nested nodes so the Y spin and X tilt live on different
        // transforms. Both rotateBy actions write to a node's rotation
        // property every frame, so attaching both to the same node makes
        // them fight (last writer per frame wins) and the cluster reads
        // as static. Splitting them — outer = Y spin, inner = X tilt —
        // composes the rotations correctly via the parent/child matrix.
        let spinNode = SCNNode()           // Y rotation
        let tiltNode = SCNNode()           // X rotation
        spinNode.addChildNode(tiltNode)
        spinNode.position = SCNVector3(0, 0, 0)

        let sprite = makeParticleSprite()

        func rng(_ n: Int) -> Float {
            let v = sin(Double(n) * 12.9898 + 78.233) * 43758.5453
            return Float(v - floor(v))
        }

        let target = 200
        var placed = 0
        var attempt = 0
        while placed < target && attempt < target * 6 {
            let nx = (rng(attempt * 3)     - 0.5) * 2
            let ny = (rng(attempt * 3 + 1) - 0.5) * 2
            let nz = (rng(attempt * 3 + 2) - 0.5) * 2
            attempt += 1
            // Reject points outside the unit sphere → softer, rounder cluster.
            if nx * nx + ny * ny + nz * nz > 1 { continue }

            let size = CGFloat(0.18 + rng(1000 + placed * 2) * 0.22)
            let alpha = CGFloat(0.4 + rng(2000 + placed * 2) * 0.55)

            let plane = SCNPlane(width: size, height: size)
            let mat = plane.firstMaterial!
            mat.diffuse.contents     = sprite
            mat.transparent.contents = sprite
            mat.lightingModel        = .constant
            mat.blendMode            = .add
            mat.writesToDepthBuffer  = false
            mat.isDoubleSided        = true

            let dot = SCNNode(geometry: plane)
            // Ellipsoid scale 10 × 14 × 6 — column-like shape that fills more
            // of the portrait viewport's vertical extent than the previous
            // 9×6×5 cluster (which left the top/bottom mostly empty). Dot
            // count bumped to 200 above so the larger volume still reads as
            // a dense cloud rather than scattered specks.
            dot.position = SCNVector3(nx * 10, ny * 14, nz * 6)
            dot.opacity  = alpha
            dot.constraints = [SCNBillboardConstraint()]
            tiltNode.addChildNode(dot)
            placed += 1
        }

        scene.rootNode.addChildNode(spinNode)

        // Perceptible self-rotation: Y full revolution every 22s on the
        // outer node, X tilt every 38s on the inner node. Two separate
        // nodes so the actions don't compete for the same rotation slot.
        // Skipped under reduce-motion — the rotating cluster is the
        // largest spatial motion in the scene.
        if !reduceMotion {
            spinNode.runAction(SCNAction.repeatForever(
                SCNAction.rotateBy(x: 0, y: CGFloat.pi * 2, z: 0, duration: 22)
            ))
            tiltNode.runAction(SCNAction.repeatForever(
                SCNAction.rotateBy(x: CGFloat.pi * 2, y: 0, z: 0, duration: 38)
            ))
        }
    }

    /// Deeper, sparser atmospheric particle layer behind the dot cloud. Stays
    /// as a particle system because it's purely ambient — no rotation needed.
    private func setupDeepAtmosphere() {
        let deep = SCNParticleSystem()
        deep.birthRate            = 20
        deep.particleLifeSpan     = 60
        deep.emitterShape         = SCNBox(width: 80, height: 90, length: 70, chamferRadius: 0)
        deep.spreadingAngle       = 180
        deep.particleVelocity     = 0.04
        deep.particleSize         = 0.12
        deep.particleColor        = UIColor(white: 1, alpha: 0.5)
        deep.blendMode            = .additive
        deep.isLightingEnabled    = false
        deep.particleImage        = makeParticleSprite()
        deep.loops                = true

        let deepNode = SCNNode()
        deepNode.addParticleSystem(deep)
        deepNode.position = SCNVector3(0, 0, -10)
        scene.rootNode.addChildNode(deepNode)
    }

    /// Soft circular sprite for particles
    private func makeParticleSprite() -> UIImage {
        let size: CGFloat = 24
        UIGraphicsBeginImageContextWithOptions(CGSize(width: size, height: size), false, 0)
        let ctx = UIGraphicsGetCurrentContext()!
        let center = CGPoint(x: size / 2, y: size / 2)
        let colors = [UIColor.white.cgColor, UIColor.clear.cgColor] as CFArray
        let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                  colors: colors,
                                  locations: [0, 1])!
        ctx.drawRadialGradient(gradient,
                               startCenter: center, startRadius: 0,
                               endCenter: center,   endRadius: size / 2,
                               options: [])
        let img = UIGraphicsGetImageFromCurrentImageContext()!
        UIGraphicsEndImageContext()
        return img
    }

    // MARK: - Clouds

    private func setupClouds() {
        struct CloudDef {
            var x, y, z: Float
            var w, h: CGFloat
            var opacity: CGFloat
            var breathDuration: Double   // full inhale+exhale cycle, seconds
            var seed: Int
        }

        // Per-blob breath periods deliberately staggered (4.7–7.1s) so the
        // field never pulses in unison. Positions pushed outward and two
        // corner clouds added so the cloud field spreads across the whole
        // viewport rather than clustering near the optical center.
        // Opacities lowered so individual planes blend without piling up
        // into muddy low-contrast zones where many planes overlap.
        let defs: [CloudDef] = [
            CloudDef(x: -10, y:  9,  z: -6,  w: 32, h: 22, opacity: 0.24, breathDuration: 5.2, seed: 1),
            CloudDef(x:  8,  y: -6,  z: -10, w: 28, h: 18, opacity: 0.18, breathDuration: 6.4, seed: 2),
            CloudDef(x: -4,  y: -11, z:  1,  w: 36, h: 24, opacity: 0.18, breathDuration: 4.7, seed: 3),
            CloudDef(x: 14,  y:  4,  z: -14, w: 26, h: 20, opacity: 0.15, breathDuration: 7.1, seed: 4),
            CloudDef(x: -16, y:  0,  z: -18, w: 30, h: 26, opacity: 0.14, breathDuration: 5.8, seed: 5),
            CloudDef(x:  3,  y: 13,  z: -4,  w: 26, h: 16, opacity: 0.17, breathDuration: 6.0, seed: 6),
            CloudDef(x: 13,  y: -12, z: -8,  w: 26, h: 18, opacity: 0.14, breathDuration: 5.5, seed: 7),
            CloudDef(x: -12, y: -7,  z: -12, w: 24, h: 18, opacity: 0.13, breathDuration: 6.7, seed: 8),
        ]

        for def in defs {
            let plane = SCNPlane(width: def.w, height: def.h)
            plane.firstMaterial?.diffuse.contents  = makeCloudTexture(seed: def.seed)
            plane.firstMaterial?.transparent.contents = makeCloudTexture(seed: def.seed)
            plane.firstMaterial?.isDoubleSided     = true
            plane.firstMaterial?.blendMode         = .alpha
            plane.firstMaterial?.writesToDepthBuffer = false
            plane.firstMaterial?.lightingModel     = .constant

            let node = SCNNode(geometry: plane)
            node.position = SCNVector3(def.x, def.y, def.z)
            node.opacity  = def.opacity
            scene.rootNode.addChildNode(node)

            // All cloud animations skipped under reduce-motion. Blobs render
            // statically at their anchor scale and base opacity.
            guard !reduceMotion else { continue }

            // Breathing: gentle scale pulse (0.92 ↔ 1.08) in place. No
            // translation — blobs hold their anchor positions so the dot
            // cloud remains the only large-amplitude motion in the scene.
            let halfBreath = def.breathDuration / 2
            let inhale = SCNAction.scale(to: 1.08, duration: halfBreath)
            let exhale = SCNAction.scale(to: 0.92, duration: halfBreath)
            inhale.timingMode = .easeInEaseOut
            exhale.timingMode = .easeInEaseOut
            // Desync at t=0 by varying the first action per blob — half the
            // field inhales while the other half exhales. Combined with the
            // staggered breathDuration values, no blob is ever static and
            // the scene drifts apart further over time.
            let breathSeq: SCNAction = def.seed.isMultiple(of: 2)
                ? SCNAction.sequence([exhale, inhale])
                : SCNAction.sequence([inhale, exhale])
            let breath = SCNAction.repeatForever(breathSeq)

            // Soft opacity pulse on a slightly different period so scale and
            // opacity slowly drift against each other — feels organic, not mechanical.
            let halfPulse = (def.breathDuration * 0.85) / 2
            let dim  = SCNAction.fadeOpacity(to: max(0, def.opacity - 0.10), duration: halfPulse)
            let glow = SCNAction.fadeOpacity(to: min(1, def.opacity + 0.10), duration: halfPulse)
            dim.timingMode  = .easeInEaseOut
            glow.timingMode = .easeInEaseOut
            // Same desync trick on opacity, but on a different seed bucket
            // so scale-direction and opacity-direction don't correlate.
            let pulseSeq: SCNAction = def.seed.isMultiple(of: 3)
                ? SCNAction.sequence([glow, dim])
                : SCNAction.sequence([dim, glow])
            let pulse = SCNAction.repeatForever(pulseSeq)

            node.runAction(breath)
            node.runAction(pulse)

            // Very slow z-axis wobble — kept from the original; reads as
            // "alive in place" rather than translating.
            let wobble = SCNAction.repeatForever(
                SCNAction.rotateBy(x: 0, y: 0,
                                   z: CGFloat(0.03 * (def.seed % 2 == 0 ? 1 : -1)),
                                   duration: def.breathDuration * 3.0)
            )
            node.runAction(wobble)
        }
    }

    /// Canvas-drawn soft cloud blob texture
    private func makeCloudTexture(seed: Int) -> UIImage {
        let size: CGFloat = 512
        UIGraphicsBeginImageContextWithOptions(CGSize(width: size, height: size), false, 1)
        let ctx = UIGraphicsGetCurrentContext()!

        func rng(_ n: Int) -> CGFloat {
            let v = sin(Double(seed) * 91.3 + Double(n) * 293.1) * 43758.5
            return CGFloat((v - floor(v)))
        }

        // 22 gradient seeds with constrained centers and a mix of small/large
        // radii. Constraining centers to the inner 50% of the canvas keeps the
        // edges naturally transparent (the vignette pass is now safety, not
        // load-bearing) and lets the cloud silhouette follow the random blob
        // distribution instead of a perfect circle. The small/large mix gives
        // sharp highlights + softer halos in the same texture, breaking up
        // the muddy low-contrast wash the old uniform 50–180 radii produced.
        for i in 0..<22 {
            let cx = (rng(i * 3)     * 0.5 + 0.25) * size
            let cy = (rng(i * 3 + 1) * 0.5 + 0.25) * size
            let isSmall = i % 3 == 0
            let r  = isSmall
                ? rng(i * 3 + 2) * 45  + 20   // sharper detail blob (20–65)
                : rng(i * 3 + 2) * 90  + 50   // softer halo blob (50–140)
            // Lower alpha ceiling so the cloud field reads as dim
            // atmosphere rather than a bright haze. Peaks still pop
            // because contrast is preserved; just dimmer overall.
            let a  = rng(i * 3 + 2) * 0.085 + 0.01
            let isAmber = i % 4 == 0

            let colors: [CGColor]
            if isAmber {
                // Warm amber highlight, matches the app's accent palette.
                colors = [UIColor(red: 0.85, green: 0.45, blue: 0.10, alpha: a * 1.2).cgColor,
                          UIColor(red: 0.85, green: 0.45, blue: 0.10, alpha: 0).cgColor]
            } else {
                colors = [UIColor(white: 1, alpha: a * 1.3).cgColor,
                          UIColor(white: 0.92, alpha: a * 0.7).cgColor,
                          UIColor(white: 1, alpha: 0).cgColor]
            }
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                      colors: colors as CFArray,
                                      locations: isAmber ? [0, 1] : [0, 0.5, 1])!
            ctx.drawRadialGradient(gradient,
                                   startCenter: CGPoint(x: cx, y: cy), startRadius: 0,
                                   endCenter:   CGPoint(x: cx, y: cy), endRadius: r,
                                   options: [])
        }

        // Soft circular vignette pass: multiplies existing alpha by a radial
        // gradient that's opaque in the middle and fully transparent at the
        // canvas edges. .drawsAfterEndLocation is critical — without it the
        // gradient only paints inside the endRadius circle, leaving the four
        // canvas corners (diagonal distance > endRadius) at their original
        // blob-painted alpha. Those corners then read as hard-edged rotated
        // rectangles when the plane wobbles.
        let edgeColors = [
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 0).cgColor,
        ]
        let edgeMask = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                  colors: edgeColors as CFArray,
                                  locations: [0, 0.55, 1.0])!
        ctx.setBlendMode(.destinationIn)
        ctx.drawRadialGradient(edgeMask,
                               startCenter: CGPoint(x: size / 2, y: size / 2), startRadius: 0,
                               endCenter:   CGPoint(x: size / 2, y: size / 2), endRadius: size / 2,
                               options: [.drawsAfterEndLocation])

        let img = UIGraphicsGetImageFromCurrentImageContext()!
        UIGraphicsEndImageContext()
        return img
    }

    // MARK: - Floating Labels

    private func setupLabelAnchors() {
        // Anchor positions pulled in from the original far-corner values so
        // a fully-typed pill of the widest label ("FINANCIAL DATA") still
        // fits inside the viewport without the on-screen clamp having to do
        // visible work.
        let defs: [(text: String, pos: SCNVector3, ghost: Bool)] = [
            ("FINANCIAL DATA", SCNVector3(-3.5,  0.5,  3),  true),
            ("PEOPLE",         SCNVector3( 5.0,  5.5,  1),  false),
            ("COMPANIES",      SCNVector3( 5.0, -5.5, -1),  false),
        ]

        for def in defs {
            // Invisible anchor node so we can project 3D → 2D
            let anchor = SCNNode()
            anchor.position = def.pos
            scene.rootNode.addChildNode(anchor)

            let label = PaddedLabel()
            label.textInsets = UIEdgeInsets(top: 5, left: 11, bottom: 5, right: 11)
            label.text = def.text
            label.font = UIFont.monospacedSystemFont(ofSize: 10, weight: .medium)
            label.textColor = UIColor(white: 1, alpha: 0.92)
            // Warm-dark pill: solid for non-ghost, glassy translucent for ghost.
            label.backgroundColor = def.ghost
                ? UIColor(red: 0.10, green: 0.08, blue: 0.07, alpha: 0.55)
                : UIColor(red: 0.06, green: 0.05, blue: 0.04, alpha: 0.82)
            label.layer.cornerRadius = 2
            label.layer.masksToBounds = true
            // Left-aligned so chars stream in from the left edge of the pill
            // (true typewriter feel) instead of expanding from a center caret.
            label.textAlignment = .left
            label.sizeToFit()
            let fullSize = label.frame.size
            label.frame = CGRect(origin: .zero, size: fullSize)
            label.layer.borderWidth = 0.5
            label.layer.borderColor = UIColor(white: 1, alpha: def.ghost ? 0.18 : 0.10).cgColor
            label.text = ""
            label.alpha = 0
            label.isHidden = true
            view.addSubview(label)
            labelAnchors.append((node: anchor, label: label, fullText: def.text, fullSize: fullSize))
        }

        labelStartTime = CACurrentMediaTime()

        // Drives both 3D → 2D projection updates AND the per-cycle typewriter
        // animation. Stored on the controller so viewWillDisappear can
        // invalidate it (CADisplayLink retains its target strongly).
        let link = CADisplayLink(target: self, selector: #selector(updateLabelPositions))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    @objc private func updateLabelPositions() {
        guard sceneView.pointOfView != nil, !labelAnchors.isEmpty else { return }

        let cycle = labelTypeDuration + labelHoldDuration + labelFadeDuration
        let elapsed = CACurrentMediaTime() - labelStartTime
        let activeIndex = Int(elapsed / cycle) % labelAnchors.count
        let phase = elapsed.truncatingRemainder(dividingBy: cycle)

        for (i, entry) in labelAnchors.enumerated() {
            let label = entry.label

            if i != activeIndex {
                label.isHidden = true
                continue
            }

            // Phase: type → hold → fade.
            // Under reduce-motion the type phase shows full text immediately
            // (no per-char streaming); cycle + crossfade still happen because
            // they aren't spatial motion.
            let charCount: Int
            let alpha: CGFloat
            if phase < labelTypeDuration {
                if reduceMotion {
                    charCount = entry.fullText.count
                    alpha = 1
                } else {
                    let progress = phase / labelTypeDuration
                    charCount = Int(ceil(progress * Double(entry.fullText.count)))
                    alpha = charCount > 0 ? 1 : 0
                }
            } else if phase < labelTypeDuration + labelHoldDuration {
                charCount = entry.fullText.count
                alpha = 1
            } else {
                charCount = entry.fullText.count
                let fp = (phase - labelTypeDuration - labelHoldDuration) / labelFadeDuration
                alpha = CGFloat(max(0, 1 - fp))
            }

            let projected = sceneView.projectPoint(entry.node.worldPosition)
            let inFront = projected.z < 1
            if !inFront || alpha <= 0.001 {
                label.isHidden = true
                continue
            }

            let newText = String(entry.fullText.prefix(charCount))
            if label.text != newText { label.text = newText }
            label.alpha = alpha
            label.isHidden = false

            // Keep pill at its fully-typed footprint so it doesn't visibly
            // grow as chars stream in — the user reads a fixed tag whose
            // contents fill from left to right.
            label.bounds = CGRect(origin: .zero, size: entry.fullSize)

            // Tag drifts a tiny amount in the direction the dot cluster is
            // rotating at the tag's world position, as if the tag is pinned
            // to a dot on the surface of the rotating cluster. Skipped under
            // reduce-motion. Drift accumulates linearly through type → hold
            // → fade, then resets when the next anchor takes over.
            var driftDX: CGFloat = 0
            var driftDY: CGFloat = 0
            if !reduceMotion {
                let anchor = entry.node.worldPosition
                // For Y-axis rotation, the tangent vector at (x, y, z) is
                // (-z, 0, x). Project anchor + tangent step and take the
                // screen-space delta as the drift direction.
                let tipPoint = SCNVector3(anchor.x - anchor.z * 0.5,
                                          anchor.y,
                                          anchor.z + anchor.x * 0.5)
                let tipProj = sceneView.projectPoint(tipPoint)
                let dx = CGFloat(tipProj.x - projected.x)
                let dy = CGFloat(tipProj.y - projected.y)
                let mag = sqrt(dx * dx + dy * dy)
                if mag > 0.001 {
                    let driftProgress = CGFloat(min(1.0, phase / cycle))
                    let maxDrift: CGFloat = 18  // points across the visible lifetime
                    driftDX = (dx / mag) * maxDrift * driftProgress
                    driftDY = (dy / mag) * maxDrift * driftProgress
                }
            }

            // Center on projected anchor (+ drift), clamped to screen so a label
            // anchored near the viewport edge never gets sliced.
            let halfW = entry.fullSize.width  / 2
            let halfH = entry.fullSize.height / 2
            let margin: CGFloat = 8
            let cx = min(max(CGFloat(projected.x) + driftDX, halfW + margin),
                         view.bounds.width - halfW - margin)
            let cy = min(max(CGFloat(projected.y) + driftDY, halfH + margin),
                         view.bounds.height - halfH - margin)
            label.center = CGPoint(x: cx, y: cy)
        }
    }
}

// MARK: - PaddedLabel

/// UILabel that draws its text inset from its bounds. Used for the pill-shaped
/// label tags so the visible text has breathing room from the pill edges while
/// the pill itself stays at a fixed footprint during the typewriter animation.
final class PaddedLabel: UILabel {
    var textInsets: UIEdgeInsets = .zero {
        didSet { invalidateIntrinsicContentSize() }
    }

    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.inset(by: textInsets))
    }

    override var intrinsicContentSize: CGSize {
        let s = super.intrinsicContentSize
        return CGSize(width:  s.width  + textInsets.left + textInsets.right,
                      height: s.height + textInsets.top  + textInsets.bottom)
    }

    override func sizeThatFits(_ size: CGSize) -> CGSize {
        let inner = CGSize(width:  max(0, size.width  - textInsets.left - textInsets.right),
                           height: max(0, size.height - textInsets.top  - textInsets.bottom))
        let fit = super.sizeThatFits(inner)
        return CGSize(width:  fit.width  + textInsets.left + textInsets.right,
                      height: fit.height + textInsets.top  + textInsets.bottom)
    }
}
