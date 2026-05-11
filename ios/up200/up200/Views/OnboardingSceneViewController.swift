import SceneKit
import SpriteKit
import UIKit

// MARK: - Main Scene View Controller

class OnboardingSceneViewController: UIViewController {

    private var sceneView: SCNView!
    private let scene = SCNScene()

    // Label anchors: 3D position → UILabel overlay
    private var labelAnchors: [(node: SCNNode, label: UILabel)] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        setupSceneView()
        setupCamera()
        setupParticles()
        setupClouds()
        setupLabelAnchors()
        setupBackground()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        sceneView.frame = view.bounds
        updateLabelPositions()
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

        // Background gradient
        let gradient = CAGradientLayer()
        gradient.frame = view.bounds
        gradient.colors = [
            UIColor(red: 0.49, green: 0.83, blue: 0.92, alpha: 1).cgColor,
            UIColor(red: 0.66, green: 0.89, blue: 0.81, alpha: 1).cgColor,
            UIColor(red: 0.36, green: 0.77, blue: 0.78, alpha: 1).cgColor,
            UIColor(red: 0.17, green: 0.56, blue: 0.50, alpha: 1).cgColor,
        ]
        gradient.locations = [0, 0.35, 0.65, 1]
        gradient.startPoint = CGPoint(x: 0.2, y: 0)
        gradient.endPoint   = CGPoint(x: 0.8, y: 1)
        view.layer.insertSublayer(gradient, at: 0)
    }

    private func setupBackground() {
        sceneView.backgroundColor = .clear
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

    // MARK: - Particles

    private func setupParticles() {
        // Main particle system
        let particles = SCNParticleSystem()
        particles.birthRate           = 80
        particles.particleLifeSpan    = 45
        particles.particleLifeSpanVariation = 20
        particles.emitterShape        = SCNBox(width: 60, height: 80, length: 40, chamferRadius: 0)
        particles.emittingDirection   = SCNVector3(0, 0.02, 0)
        particles.spreadingAngle      = 180        // omnidirectional
        particles.particleVelocity    = 0.08
        particles.particleVelocityVariation = 0.06
        particles.particleSize        = 0.18
        particles.particleSizeVariation = 0.12
        particles.particleColor       = .white
        particles.particleColorVariation = SCNVector4(0, 0, 0.1, 0.2)
        particles.blendMode           = .additive
        particles.isLightingEnabled   = false
        particles.particleImage       = makeParticleSprite()
        particles.loops               = true

        let particleNode = SCNNode()
        particleNode.addParticleSystem(particles)
        particleNode.position = SCNVector3(0, 0, 0)
        scene.rootNode.addChildNode(particleNode)

        // Slow global rotation of particle container
        let rotate = SCNAction.repeatForever(
            SCNAction.rotateBy(x: 0.04, y: 0.12, z: 0, duration: 60)
        )
        particleNode.runAction(rotate)

        // Deeper, sparser layer
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

        let rotateDeep = SCNAction.repeatForever(
            SCNAction.rotateBy(x: -0.02, y: -0.08, z: 0.01, duration: 70)
        )
        deepNode.runAction(rotateDeep)
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
            var driftRadius: Float
            var driftDuration: Double
            var seed: Int
        }

        let defs: [CloudDef] = [
            CloudDef(x: -7,  y:  6,  z: -6,  w: 30, h: 20, opacity: 0.80, driftRadius: 4.5, driftDuration: 22, seed: 1),
            CloudDef(x:  6,  y: -4,  z: -10, w: 26, h: 16, opacity: 0.65, driftRadius: 3.5, driftDuration: 28, seed: 2),
            CloudDef(x: -3,  y: -9,  z:  1,  w: 34, h: 22, opacity: 0.60, driftRadius: 5.0, driftDuration: 19, seed: 3),
            CloudDef(x: 11,  y:  3,  z: -14, w: 22, h: 18, opacity: 0.50, driftRadius: 3.0, driftDuration: 32, seed: 4),
            CloudDef(x: -13, y:  0,  z: -18, w: 28, h: 24, opacity: 0.45, driftRadius: 4.0, driftDuration: 25, seed: 5),
            CloudDef(x:  2,  y: 10,  z: -4,  w: 24, h: 14, opacity: 0.55, driftRadius: 3.8, driftDuration: 21, seed: 6),
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

            // Elliptical drift using two sequential moves, repeated forever
            let r = def.driftRadius
            let half = def.driftDuration / 2
            let moveA = SCNAction.move(
                by: SCNVector3(r, r * 0.4, r * 0.3),
                duration: half
            )
            let moveB = SCNAction.move(
                by: SCNVector3(-r, -r * 0.4, -r * 0.3),
                duration: half
            )
            moveA.timingMode = .easeInEaseOut
            moveB.timingMode = .easeInEaseOut

            let drift = SCNAction.repeatForever(SCNAction.sequence([moveA, moveB]))
            node.runAction(drift)

            // Subtle slow rotation
            let wobble = SCNAction.repeatForever(
                SCNAction.rotateBy(x: 0, y: 0,
                                   z: CGFloat(0.03 * (def.seed % 2 == 0 ? 1 : -1)),
                                   duration: def.driftDuration * 1.5)
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

        for i in 0..<14 {
            let cx = rng(i * 3)     * size
            let cy = rng(i * 3 + 1) * size
            let r  = rng(i * 3 + 2) * 130 + 50
            let a  = rng(i * 3 + 2) * 0.11 + 0.03
            let isTeal = i % 3 == 0

            let colors: [CGColor]
            if isTeal {
                colors = [UIColor(red: 0.71, green: 0.94, blue: 0.90, alpha: a * 1.4).cgColor,
                          UIColor(red: 0.71, green: 0.94, blue: 0.90, alpha: 0).cgColor]
            } else {
                colors = [UIColor(white: 1, alpha: a * 2).cgColor,
                          UIColor(white: 0.9, alpha: a).cgColor,
                          UIColor(white: 1, alpha: 0).cgColor]
            }
            let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
                                      colors: colors as CFArray,
                                      locations: isTeal ? [0, 1] : [0, 0.5, 1])!
            ctx.drawRadialGradient(gradient,
                                   startCenter: CGPoint(x: cx, y: cy), startRadius: 0,
                                   endCenter:   CGPoint(x: cx, y: cy), endRadius: r,
                                   options: [])
        }

        let img = UIGraphicsGetImageFromCurrentImageContext()!
        UIGraphicsEndImageContext()
        return img
    }

    // MARK: - Floating Labels

    private func setupLabelAnchors() {
        let defs: [(text: String, pos: SCNVector3, ghost: Bool)] = [
            ("PEOPLE",         SCNVector3( 8.5,  5.5,  1),  false),
            ("FINANCIAL DATA", SCNVector3(-6.5,  0.5,  3),  true),
            ("COMPANIES",      SCNVector3( 8.0, -5.5, -1),  false),
        ]

        for def in defs {
            // Invisible anchor node so we can project 3D → 2D
            let anchor = SCNNode()
            anchor.position = def.pos
            scene.rootNode.addChildNode(anchor)

            let label = UILabel()
            label.text = def.text
            label.font = UIFont.monospacedSystemFont(ofSize: 10, weight: .medium)
            label.textColor = .white
            label.backgroundColor = def.ghost
                ? UIColor(red: 0.08, green: 0.20, blue: 0.16, alpha: 0.45)
                : UIColor(red: 0.02, green: 0.06, blue: 0.05, alpha: 0.78)
            label.layer.cornerRadius = 2
            label.layer.masksToBounds = true
            label.textAlignment = .center
            label.sizeToFit()
            label.frame = CGRect(x: 0, y: 0,
                                 width: label.frame.width + 22,
                                 height: label.frame.height + 10)
            if def.ghost {
                label.layer.borderWidth = 0.5
                label.layer.borderColor = UIColor(white: 1, alpha: 0.25).cgColor
            }
            view.addSubview(label)
            labelAnchors.append((node: anchor, label: label))
        }

        // Update label positions every frame via CADisplayLink
        let link = CADisplayLink(target: self, selector: #selector(updateLabelPositions))
        link.add(to: .main, forMode: .common)
    }

    @objc private func updateLabelPositions() {
        guard let _ = sceneView.pointOfView else { return }
        for (node, label) in labelAnchors {
            let projected = sceneView.projectPoint(node.worldPosition)
            // projected.z < 1 means in front of camera
            let inFront = projected.z < 1
            label.isHidden = !inFront
            label.center   = CGPoint(x: CGFloat(projected.x),
                                     y: CGFloat(projected.y))
        }
    }
}
