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

    // Two-step onboarding support. Step 1 = wide constellation (original).
    // Step 2 = collected bulb: every dot flies into a small sphere at the
    // origin, clouds + ambient particles fade out, the focal cluster stays
    // alive with a slow internal swirl. Held as state so the SwiftUI binding
    // can flip back and forth without re-running setup.
    private var dotNodes: [SCNNode] = []
    private var dotHomePositions: [SCNVector3] = []
    private var dotBulbPositions: [SCNVector3] = []
    private var cloudNodes: [SCNNode] = []
    private var deepAtmosphereNode: SCNNode?
    private var spinNode: SCNNode?
    private var tiltNode: SCNNode?
    private var currentStep: Int = 0
    private let collectDuration: TimeInterval = 0.85

    // Step 3 — content-graph satellites. Each satellite is its own mini-bulb
    // (a small parent node containing ~20 billboarded dots), and each one is
    // tethered to the central bulb by a connector: a parent node holding a
    // chain of small dots laid out along a gentle arc from the bulb's surface
    // out to the satellite. Both groups are built up-front at viewDidLoad and
    // held invisible until the controller is advanced to step 2, at which
    // point the satellite dots travel from a spawn point on the bulb's
    // surface out along the arc to their resting position — the satellite
    // "forms" from stars peeled off the central bulb instead of fading in
    // as a separate object. satelliteDotPaths captures each dot's spawn
    // point, final position, and arc geometry so applyExpanded can drive
    // that interpolation without recomputing anything per frame.
    private var satelliteNodes: [SCNNode] = []
    private var connectorNodes: [SCNNode] = []
    private var connectorDotOpacities: [[CGFloat]] = []
    private var satelliteDotPaths: [[SatelliteDotPath]] = []
    private let expandDuration: TimeInterval = 0.95

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
        setupSatellites()
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
        self.spinNode = spinNode
        self.tiltNode = tiltNode

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
            let home = SCNVector3(nx * 10, ny * 14, nz * 6)
            dot.position = home
            dot.opacity  = alpha
            dot.constraints = [SCNBillboardConstraint()]
            tiltNode.addChildNode(dot)
            // Bulb target: same random direction but compressed into a tight
            // sphere at the origin. Reusing the home direction (instead of
            // re-randomising) means the inward motion reads as a uniform
            // implosion — each star falls along its own radius — rather than
            // a chaotic swap that would draw attention to individual paths.
            let bulbRadius: Float = 3.2
            let len = max(0.001, sqrt(home.x * home.x + home.y * home.y + home.z * home.z))
            let jitter = 0.55 + rng(5000 + placed) * 0.45   // 0.55–1.00
            let bulb = SCNVector3(home.x / len * bulbRadius * jitter,
                                  home.y / len * bulbRadius * jitter,
                                  home.z / len * bulbRadius * jitter)
            dotNodes.append(dot)
            dotHomePositions.append(home)
            dotBulbPositions.append(bulb)
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
        deepAtmosphereNode = deepNode
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
            CloudDef(x: -10, y:  9,  z: -6,  w: 32, h: 22, opacity: 0.12, breathDuration: 5.2, seed: 1),
            CloudDef(x:  8,  y: -6,  z: -10, w: 28, h: 18, opacity: 0.09, breathDuration: 6.4, seed: 2),
            CloudDef(x: -4,  y: -11, z:  1,  w: 36, h: 24, opacity: 0.09, breathDuration: 4.7, seed: 3),
            CloudDef(x: 14,  y:  4,  z: -14, w: 26, h: 20, opacity: 0.08, breathDuration: 7.1, seed: 4),
            CloudDef(x: -16, y:  0,  z: -18, w: 30, h: 26, opacity: 0.07, breathDuration: 5.8, seed: 5),
            CloudDef(x:  3,  y: 13,  z: -4,  w: 26, h: 16, opacity: 0.09, breathDuration: 6.0, seed: 6),
            CloudDef(x: 13,  y: -12, z: -8,  w: 26, h: 18, opacity: 0.07, breathDuration: 5.5, seed: 7),
            CloudDef(x: -12, y: -7,  z: -12, w: 24, h: 18, opacity: 0.07, breathDuration: 6.7, seed: 8),
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
            cloudNodes.append(node)

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
            let a  = rng(i * 3 + 2) * 0.0425 + 0.005
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

    // MARK: - Step bridge

    /// SwiftUI advances the onboarding flow by passing an integer step:
    /// 0 = wide constellation, 1 = collected bulb, 2 = content-graph
    /// satellites. We diff the requested step against the current one and
    /// run each crossing's animation independently so a 0 → 2 jump still
    /// collapses the cluster *and* expands the satellites in a single pass.
    func setStep(_ step: Int) {
        guard step != currentStep else { return }
        let previous = currentStep
        currentStep = step

        let wasCollected = previous >= 1
        let nowCollected = step >= 1
        if wasCollected != nowCollected {
            applyCollected(nowCollected)
        }

        let wasExpanded = previous >= 2
        let nowExpanded = step >= 2
        if wasExpanded != nowExpanded {
            applyExpanded(nowExpanded)
        }
    }

    // MARK: - Collected bulb step

    /// Step 1 → step 2 (or back). Dots converge into a tight central bulb,
    /// clouds + ambient particles fade, the cluster keeps a slow internal
    /// swirl so it still feels alive.
    private func applyCollected(_ collected: Bool) {
        let dur = collectDuration
        let dotKey = "dot.collect"

        for (i, dot) in dotNodes.enumerated() {
            dot.removeAction(forKey: dotKey)
            let target = collected ? dotBulbPositions[i] : dotHomePositions[i]
            if reduceMotion {
                dot.position = target
                continue
            }
            let move = SCNAction.move(to: target, duration: dur)
            // easeInEaseOut on the collapse looks like fabric being pulled to
            // the center — soft start, soft settle, no harsh snap when the
            // dots arrive.
            move.timingMode = .easeInEaseOut
            dot.runAction(move, forKey: dotKey)
        }

        // Clouds: fade out fully while collapsing so the bulb stands alone in
        // the void. We don't track each cloud's original opacity individually
        // because every blob's animated opacity loop is already paused — we
        // just need them to disappear cleanly.
        for cloud in cloudNodes {
            cloud.removeAllActions()
            if reduceMotion {
                cloud.opacity = collected ? 0 : 0.09
                continue
            }
            cloud.runAction(SCNAction.fadeOpacity(to: collected ? 0 : 0.09, duration: dur))
        }

        // Ambient deep-atmosphere particles: same fade. Hiding the node also
        // stops the particle system rendering once it reaches 0, which keeps
        // GPU work down on the static bulb screen.
        if let deep = deepAtmosphereNode {
            deep.removeAllActions()
            if reduceMotion {
                deep.opacity = collected ? 0 : 1
            } else {
                deep.runAction(SCNAction.fadeOpacity(to: collected ? 0 : 1, duration: dur))
            }
        }

        // Slow the rotation as we collect — a compact bulb spinning at the
        // original 22s/rev rate would look like a fidget spinner. 70s/rev is
        // calm enough to feel like internal swirl, not orbital motion. The
        // tilt axis is stopped entirely so the bulb reads as a stable orb.
        spinNode?.removeAllActions()
        tiltNode?.removeAllActions()
        if !reduceMotion {
            let spinDuration: TimeInterval = collected ? 70 : 22
            spinNode?.runAction(SCNAction.repeatForever(
                SCNAction.rotateBy(x: 0, y: CGFloat.pi * 2, z: 0, duration: spinDuration)
            ))
            if !collected {
                tiltNode?.runAction(SCNAction.repeatForever(
                    SCNAction.rotateBy(x: CGFloat.pi * 2, y: 0, z: 0, duration: 38)
                ))
            }
        }

        // Floating labels are part of the wide-constellation story; hide them
        // on the bulb step so the user's eye lands on the headline + CTA.
        for entry in labelAnchors {
            entry.label.isHidden = collected
        }
    }

    // MARK: - Satellites + connector arcs (step 3)

    /// Each satellite is a small bulb at a fixed offset from the central
    /// cluster. The four offsets sit roughly on a diamond around the origin,
    /// with a tiny z-jitter so the satellites don't read as living on a
    /// perfectly flat plane in front of the camera.
    private struct SatelliteDef {
        let centre: SCNVector3
        let dotCount: Int
        let radius: Float
        let seed: Int
    }

    private let satelliteDefs: [SatelliteDef] = [
        SatelliteDef(centre: SCNVector3( 3.5,  3.25,  0.6),  dotCount: 22, radius: 0.85, seed: 1011),
        SatelliteDef(centre: SCNVector3( 4.2, -1.5,  -0.5),  dotCount: 20, radius: 0.80, seed: 2027),
        SatelliteDef(centre: SCNVector3(-3.6, -2.75,  0.5),  dotCount: 22, radius: 0.85, seed: 3041),
        SatelliteDef(centre: SCNVector3(-3.9,  2.1,  -0.35), dotCount: 20, radius: 0.80, seed: 4057),
    ]

    /// Per-dot path data captured at setup so applyExpanded can interpolate
    /// each satellite dot from its spawn point on the central bulb's surface
    /// out along the connector arc to its resting position inside the
    /// satellite — without recomputing the geometry every frame.
    private struct SatelliteDotPath {
        let spawnLocal: SCNVector3   // satParent-local: a point on the bulb surface plus per-dot jitter
        let finalLocal: SCNVector3   // satParent-local: random position within the satellite volume
        let perp: SCNVector3         // unit perpendicular for the arc bend
        let curveAmount: Float       // signed magnitude of the sin-bend, matches the connector chain
        let restingOpacity: CGFloat  // opacity once the dot has settled in the satellite
    }

    /// Builds the mini-bulbs and their connector chains up-front. Both
    /// groups stay invisible (satellite dots at opacity 0 sitting on the
    /// bulb's surface, connector dots at opacity 0 along the arc) until the
    /// controller is advanced to step 2, so the transition is purely an
    /// animation — no node creation during the step crossing, which would
    /// risk a frame hitch on lower-end devices.
    private func setupSatellites() {
        let sprite = makeParticleSprite()

        func rng(_ seed: Int, _ n: Int) -> Float {
            let v = sin(Double(seed) * 12.9898 + Double(n) * 78.233) * 43758.5453
            return Float(v - floor(v))
        }

        // Matches the bulbRadius constant in setupDotCloud — the spawn point
        // of each migrating star lands on the surface of the central bulb so
        // the dots appear to peel off the cluster rather than materialising
        // in mid-flight.
        let bulbSurfaceRadius: Float = 3.2

        for def in satelliteDefs {
            // --- Satellite container ---
            // satParent stays at opacity 1 and unit scale at all times.
            // Visibility is driven entirely by the per-dot opacity ramp
            // inside applyExpanded so the satellite "draws itself" out of
            // the central bulb instead of fading in as a separate object.
            let satParent = SCNNode()
            satParent.position = def.centre
            satParent.opacity = 1
            satParent.scale = SCNVector3(1, 1, 1)
            scene.rootNode.addChildNode(satParent)
            satelliteNodes.append(satParent)

            // --- Shared arc geometry (bulb surface ↔ satellite centre) ---
            // Both the satellite dots' migration paths and the connector
            // chain use this geometry, so it's computed once per satellite.
            let dirLen = max(0.001, sqrt(def.centre.x * def.centre.x +
                                         def.centre.y * def.centre.y +
                                         def.centre.z * def.centre.z))
            let unit = SCNVector3(def.centre.x / dirLen, def.centre.y / dirLen, def.centre.z / dirLen)
            let bulbSurfaceWorld = SCNVector3(unit.x * bulbSurfaceRadius,
                                              unit.y * bulbSurfaceRadius,
                                              unit.z * bulbSurfaceRadius)
            // satParent sits at def.centre with no rotation, so world → local
            // is a straight translation by -def.centre.
            let bulbSurfaceLocal = SCNVector3(bulbSurfaceWorld.x - def.centre.x,
                                              bulbSurfaceWorld.y - def.centre.y,
                                              bulbSurfaceWorld.z - def.centre.z)

            // Perpendicular = unit × worldUp, falling back to worldRight if
            // the satellite happens to sit on the Y axis (cross with up would
            // be zero). Both clusters of satellite positions are in the XY
            // plane in practice so the fallback never fires here, but the
            // guard makes the geometry robust to future repositioning.
            let up = SCNVector3(0, 1, 0)
            var perp = SCNVector3(
                unit.y * up.z - unit.z * up.y,
                unit.z * up.x - unit.x * up.z,
                unit.x * up.y - unit.y * up.x
            )
            var perpLen = sqrt(perp.x * perp.x + perp.y * perp.y + perp.z * perp.z)
            if perpLen < 0.001 {
                perp = SCNVector3(1, 0, 0)
                perpLen = 1
            }
            perp = SCNVector3(perp.x / perpLen, perp.y / perpLen, perp.z / perpLen)
            // Mirror the arc bend for satellites on one side of the screen so
            // the four arcs splay outward instead of curving in the same
            // direction — gives the final scene a balanced, blossom-like
            // composition rather than four parallel curves. The magnitude is
            // scaled to roughly 1/3 of the bulb→satellite distance so the
            // visual curvature stays consistent as the satellites move closer
            // or farther from the central bulb.
            let bendSign: Float = def.centre.x >= 0 ? 1 : -1
            let chainSpan: Float = max(0.001, dirLen - bulbSurfaceRadius)
            let curveAmount: Float = chainSpan * 0.18 * bendSign

            // --- Satellite dots ---
            var paths: [SatelliteDotPath] = []
            paths.reserveCapacity(def.dotCount)

            var placed = 0
            var attempt = 0
            while placed < def.dotCount && attempt < def.dotCount * 6 {
                let nx = (rng(def.seed, attempt * 3)     - 0.5) * 2
                let ny = (rng(def.seed, attempt * 3 + 1) - 0.5) * 2
                let nz = (rng(def.seed, attempt * 3 + 2) - 0.5) * 2
                attempt += 1
                if nx * nx + ny * ny + nz * nz > 1 { continue }

                let size  = CGFloat(0.14 + rng(def.seed, 1000 + placed) * 0.10)
                let alpha = CGFloat(0.55 + rng(def.seed, 2000 + placed) * 0.40)

                let plane = SCNPlane(width: size, height: size)
                let mat = plane.firstMaterial!
                mat.diffuse.contents     = sprite
                mat.transparent.contents = sprite
                mat.lightingModel        = .constant
                mat.blendMode            = .add
                mat.writesToDepthBuffer  = false
                mat.isDoubleSided        = true

                // Per-dot jitter on the spawn point so 20+ dots don't all
                // peel off the bulb from a single pixel — gives the outbound
                // stream visible thickness as it leaves the cluster surface.
                let jx = (rng(def.seed, 3000 + placed * 3)     - 0.5) * 0.55
                let jy = (rng(def.seed, 3000 + placed * 3 + 1) - 0.5) * 0.55
                let jz = (rng(def.seed, 3000 + placed * 3 + 2) - 0.5) * 0.55
                let spawnLocal = SCNVector3(bulbSurfaceLocal.x + jx,
                                            bulbSurfaceLocal.y + jy,
                                            bulbSurfaceLocal.z + jz)
                let finalLocal = SCNVector3(nx * def.radius, ny * def.radius, nz * def.radius)

                let dot = SCNNode(geometry: plane)
                // Pre-expansion the dot sits on the bulb surface at opacity 0
                // — invisible but pre-positioned so the customAction in
                // applyExpanded can interpolate straight from spawnLocal.
                dot.position = spawnLocal
                dot.opacity  = 0
                dot.constraints = [SCNBillboardConstraint()]
                satParent.addChildNode(dot)

                paths.append(SatelliteDotPath(
                    spawnLocal: spawnLocal,
                    finalLocal: finalLocal,
                    perp: perp,
                    curveAmount: curveAmount,
                    restingOpacity: alpha
                ))
                placed += 1
            }
            satelliteDotPaths.append(paths)

            // --- Connector arc ---
            // Stationary chain of dots along the bulb→satellite arc. The
            // migrating satellite dots stream past this chain on their way
            // out, and the chain fades in just behind them so a visible
            // "trail" stays drawn between the bulb and the satellite after
            // the stream of stars has settled.
            let connectorParent = SCNNode()
            connectorParent.opacity = 1   // parent always visible; per-dot opacity drives the cascade
            scene.rootNode.addChildNode(connectorParent)

            let start = bulbSurfaceWorld
            let end   = def.centre

            // Chain density scales with the bulb→satellite distance so the
            // dots stay readably spaced (~0.42u apart) instead of piling on
            // top of each other when the satellites sit close to the bulb.
            // Clamped to a small minimum so the chain is never just one or
            // two dots.
            let chainCount = max(5, Int((chainSpan / 0.42).rounded()))
            var perDotOpacities: [CGFloat] = []
            perDotOpacities.reserveCapacity(chainCount)
            for k in 1...chainCount {
                let t = Float(k) / Float(chainCount + 1)
                let bend = sin(t * Float.pi) * curveAmount
                let pos = SCNVector3(
                    start.x + (end.x - start.x) * t + perp.x * bend,
                    start.y + (end.y - start.y) * t + perp.y * bend,
                    start.z + (end.z - start.z) * t + perp.z * bend
                )

                // Dots taper slightly inward → outward and brighten toward
                // the satellite end, so the eye reads the chain as light
                // travelling away from the central bulb.
                let progress = Float(k) / Float(chainCount)
                let size  = CGFloat(0.09 + progress * 0.07)
                let alpha = CGFloat(0.45 + progress * 0.40)

                let plane = SCNPlane(width: size, height: size)
                let mat = plane.firstMaterial!
                mat.diffuse.contents     = sprite
                mat.transparent.contents = sprite
                mat.lightingModel        = .constant
                mat.blendMode            = .add
                mat.writesToDepthBuffer  = false
                mat.isDoubleSided        = true

                let dot = SCNNode(geometry: plane)
                dot.position = pos
                dot.opacity  = 0   // every chain dot starts hidden; expansion fades to perDotOpacities[k-1]
                dot.constraints = [SCNBillboardConstraint()]
                connectorParent.addChildNode(dot)
                perDotOpacities.append(alpha)
            }
            connectorNodes.append(connectorParent)
            connectorDotOpacities.append(perDotOpacities)
        }
    }

    /// Step 2 → step 3 (or back). Each satellite is formed by streaming a
    /// flock of stars from a single point on the central bulb's surface
    /// outward along the connector arc. The dots fade in as they leave the
    /// bulb, follow the same sin-curved arc the connector chain occupies,
    /// and settle into their resting positions inside the satellite volume.
    /// The connector chain itself lights up dot-by-dot just behind the
    /// outbound stream, leaving a visible trail between the bulb and the
    /// satellite once the migration has finished. Reversing the step plays
    /// the same animation in reverse: stars retract along the arc and the
    /// trail fades away.
    private func applyExpanded(_ expanded: Bool) {
        let travelDuration: TimeInterval = expandDuration
        // Stagger within a satellite so its 20+ stars peel off the bulb in
        // quick succession rather than as a single block — reads as a flock.
        let perDotStagger:  TimeInterval = 0.035
        // Stagger between satellites so all four streams don't launch in
        // lockstep; the screen reads as four streams blooming in turn.
        let perSatStagger:  TimeInterval = 0.10

        for (i, sat) in satelliteNodes.enumerated() {
            sat.removeAllActions()
            // satParent is no longer fade/scale-animated — the dots inside
            // it carry the visibility transition. Make sure it's back at
            // identity in case anything ever toggled these properties.
            sat.opacity = 1
            sat.scale = SCNVector3(1, 1, 1)

            let paths = satelliteDotPaths[i]
            let dots = sat.childNodes
            let satDelay = Double(i) * perSatStagger

            for (j, dot) in dots.enumerated() {
                dot.removeAllActions()
                guard j < paths.count else { continue }
                let path = paths[j]

                let startPos = expanded ? path.spawnLocal : path.finalLocal
                let endPos   = expanded ? path.finalLocal : path.spawnLocal
                let startOp: CGFloat = expanded ? 0 : path.restingOpacity
                let endOp:   CGFloat = expanded ? path.restingOpacity : 0
                // Mirror the bend when collapsing so the dots retrace the
                // same arc back to the bulb instead of curving the wrong way.
                let bendAmount: Float = expanded ? path.curveAmount : -path.curveAmount

                if reduceMotion {
                    dot.position = endPos
                    dot.opacity  = endOp
                    continue
                }

                let delay = satDelay + Double(j) * perDotStagger
                let wait = SCNAction.wait(duration: delay)

                let perp = path.perp
                let travel = SCNAction.customAction(duration: travelDuration) { node, t in
                    let progress = Float(min(1.0, t / travelDuration))
                    let bend = sin(progress * Float.pi) * bendAmount
                    node.position = SCNVector3(
                        startPos.x + (endPos.x - startPos.x) * progress + perp.x * bend,
                        startPos.y + (endPos.y - startPos.y) * progress + perp.y * bend,
                        startPos.z + (endPos.z - startPos.z) * progress + perp.z * bend
                    )
                    // Opacity ramps over the bulb-adjacent end of the path:
                    // expanding fades in over the first ~30% of travel
                    // (the moment the dot leaves the bulb surface), while
                    // collapsing fades out over the last ~30% (as the dot
                    // returns to the bulb). The far end of the path stays
                    // at full restingOpacity so settled stars don't shimmer.
                    let fadeWindow: Float = 0.30
                    let fadeProgress: CGFloat
                    if expanded {
                        fadeProgress = CGFloat(min(1.0, progress / fadeWindow))
                    } else {
                        fadeProgress = CGFloat(min(1.0, (1.0 - progress) / fadeWindow))
                    }
                    node.opacity = startOp + (endOp - startOp) * fadeProgress
                }

                dot.runAction(SCNAction.sequence([wait, travel]))
            }
        }

        for (i, conn) in connectorNodes.enumerated() {
            let dots = conn.childNodes
            let targets = connectorDotOpacities[i]
            // Connector chain follows just behind the outbound stream: it
            // starts ~50ms after each satellite's first stars leave the
            // bulb, so the trail visibly fills in behind the migrating dots
            // rather than racing ahead of them.
            let baseDelay = Double(i) * perSatStagger + 0.05
            for (j, dot) in dots.enumerated() {
                dot.removeAllActions()
                let target = expanded ? targets[j] : 0
                if reduceMotion {
                    dot.opacity = target
                    continue
                }
                // Per-dot stagger of 0.05s makes light "travel" along the
                // arc from the bulb out to the satellite over ~0.7s per chain.
                let dotDelay = baseDelay + Double(j) * 0.05
                let wait = SCNAction.wait(duration: dotDelay)
                let fade = SCNAction.fadeOpacity(to: target, duration: 0.4)
                fade.timingMode = .easeOut
                dot.runAction(SCNAction.sequence([wait, fade]))
            }
        }
    }

    // MARK: - Floating Labels

    private func setupLabelAnchors() {
        // Anchor positions pulled in from the original far-corner values so
        // a fully-typed pill of the widest label ("TEAM SYNC NOTES") still
        // fits inside the viewport without the on-screen clamp having to do
        // visible work.
        let defs: [(text: String, pos: SCNVector3, ghost: Bool)] = [
            ("PRODUCT IDEA",    SCNVector3(-3.5,  0.5,  3),  true),
            ("FEEDBACK",        SCNVector3( 5.0,  5.5,  1),  false),
            ("TEAM SYNC NOTES", SCNVector3( 5.0, -5.5, -1),  false),
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

        // Suppress the floating-label cycle on the collected bulb step —
        // the labels belong to the wide constellation, not the bulb. The
        // same suppression covers step 3, where the cluster blooms into
        // satellites and the old floating tags would clash with the
        // connector arcs.
        if currentStep >= 1 {
            for entry in labelAnchors { entry.label.isHidden = true }
            return
        }

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
