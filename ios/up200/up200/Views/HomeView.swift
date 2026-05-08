import SwiftUI

// MARK: - Data Model

enum NodeCategory: String, CaseIterable {
    case source = "Source"
    case generate = "Generate"
    case output = "Output"
    case transform = "Advanced"

    var badgeBg: Color {
        switch self {
        case .source:    return Color(hex: "282828")
        case .generate:  return Color(hex: "222822")
        case .output:    return Color(hex: "282828")
        case .transform: return Color(hex: "282428")
        }
    }

    var badgeText: Color {
        switch self {
        case .source:    return Color(hex: "c0c0c0")
        case .generate:  return Color(hex: "a8c8a0")
        case .output:    return Color(hex: "c0c0a0")
        case .transform: return Color(hex: "c0a8c0")
        }
    }

    var accentColor: Color {
        switch self {
        case .source:    return Color(hex: "888888")
        case .generate:  return Color(hex: "6a9860")
        case .output:    return Color(hex: "888870")
        case .transform: return Color(hex: "886888")
        }
    }
}

struct NodeType: Identifiable {
    let id = UUID()
    let badge: String
    let label: String
    let description: String
    let category: NodeCategory
    let subtype: String
}

private let allNodeTypes: [NodeType] = [
    // Source
    NodeType(badge: "Tx", label: "Text",        description: "Paste text, transcript, notes",  category: .source,    subtype: "text-source"),
    NodeType(badge: "Fl", label: "File",         description: "Upload .txt .md .docx",          category: .source,    subtype: "file-source"),
    NodeType(badge: "Im", label: "Image",        description: "Product photo, diagram",         category: .source,    subtype: "image-source"),
    NodeType(badge: "Vc", label: "Voice Note",   description: "Select a saved voice note",      category: .source,    subtype: "voice-source"),
    // Generate
    NodeType(badge: "Li", label: "LinkedIn",     description: "150–300 word hook post",         category: .generate,  subtype: "linkedin-post"),
    NodeType(badge: "Tw", label: "X Thread",     description: "5–10 tweet thread",              category: .generate,  subtype: "twitter-thread"),
    NodeType(badge: "Ts", label: "X Single",     description: "Most quotable insight",          category: .generate,  subtype: "twitter-single"),
    NodeType(badge: "Nl", label: "Newsletter",   description: "300–500 word digest",            category: .generate,  subtype: "newsletter"),
    NodeType(badge: "If", label: "Infographic",  description: "Structured visual spec",         category: .generate,  subtype: "infographic"),
    NodeType(badge: "Qc", label: "Quote Card",   description: "Strongest quote",                category: .generate,  subtype: "quote-card"),
    NodeType(badge: "Ip", label: "Img Prompt",   description: "AI image generation prompt",     category: .generate,  subtype: "image-prompt"),
    NodeType(badge: "Vd", label: "Video",        description: "AI video generation",            category: .generate,  subtype: "video"),
    // Output
    NodeType(badge: "Ex", label: "Export",       description: "Platform-ready package",         category: .output,    subtype: "export"),
    NodeType(badge: "Bv", label: "Brand Voice",  description: "Rewrite in your brand voice",    category: .output,    subtype: "brand-voice"),
    // Transform
    NodeType(badge: "Pm", label: "Prompt",       description: "Topic or focus filter",          category: .transform, subtype: "prompt"),
    NodeType(badge: "Rf", label: "Refine",       description: "Directive for extraction",       category: .transform, subtype: "refine"),
]

// MARK: - Color Helper

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8)  & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - Node Card

private struct NodeCard: View {
    let node: NodeType
    @State private var pressed = false

    var body: some View {
        HStack(spacing: 12) {
            // Badge
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(node.category.badgeBg)
                    .frame(width: 34, height: 34)
                Text(node.badge)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(node.category.badgeText)
            }

            // Label + description
            VStack(alignment: .leading, spacing: 2) {
                Text(node.label)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text(node.description)
                    .font(.system(size: 11))
                    .foregroundColor(Color.white.opacity(0.35))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(hex: "1c1c1f"))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.white.opacity(pressed ? 0.15 : 0.07), lineWidth: 0.5)
                )
        )
        .scaleEffect(pressed ? 0.97 : 1.0)
        .animation(.easeOut(duration: 0.12), value: pressed)
        .onLongPressGesture(minimumDuration: 0, pressing: { p in pressed = p }, perform: {})
    }
}

// MARK: - Category Section

private struct CategorySection: View {
    let category: NodeCategory
    let nodes: [NodeType]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Circle()
                    .fill(category.accentColor)
                    .frame(width: 5, height: 5)
                Text(category.rawValue.uppercased())
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.3))
                    .tracking(1.4)
            }

            VStack(spacing: 6) {
                ForEach(nodes) { node in
                    NodeCard(node: node)
                }
            }
        }
    }
}

// MARK: - Flow Preview (mini schematic)

private struct MiniFlowPreview: View {
    private let accent = Color(red: 13/255, green: 191/255, blue: 90/255)

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let h = geo.size.height
            let colW = w / 3

            ZStack {
                // Edges
                edgePath(from: CGPoint(x: colW * 0.5, y: h * 0.5),
                         to:   CGPoint(x: colW * 1.5, y: h * 0.25))
                edgePath(from: CGPoint(x: colW * 0.5, y: h * 0.5),
                         to:   CGPoint(x: colW * 1.5, y: h * 0.75))
                edgePath(from: CGPoint(x: colW * 1.5, y: h * 0.25),
                         to:   CGPoint(x: colW * 2.5, y: h * 0.5))
                edgePath(from: CGPoint(x: colW * 1.5, y: h * 0.75),
                         to:   CGPoint(x: colW * 2.5, y: h * 0.5))

                // Nodes
                miniNode(badge: "Tx", cat: .source,   at: CGPoint(x: colW * 0.5, y: h * 0.5))
                miniNode(badge: "Li", cat: .generate, at: CGPoint(x: colW * 1.5, y: h * 0.25))
                miniNode(badge: "Tw", cat: .generate, at: CGPoint(x: colW * 1.5, y: h * 0.75))
                miniNode(badge: "Ex", cat: .output,   at: CGPoint(x: colW * 2.5, y: h * 0.5))
            }
        }
    }

    private func edgePath(from: CGPoint, to: CGPoint) -> some View {
        let mid = CGPoint(x: (from.x + to.x) / 2, y: (from.y + to.y) / 2)
        return Path { p in
            p.move(to: from)
            p.addCurve(to: to,
                       control1: CGPoint(x: mid.x, y: from.y),
                       control2: CGPoint(x: mid.x, y: to.y))
        }
        .stroke(Color.white.opacity(0.12), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
    }

    private func miniNode(badge: String, cat: NodeCategory, at pt: CGPoint) -> some View {
        ZStack {
            RoundedRectangle(cornerRadius: 5)
                .fill(cat.badgeBg)
                .frame(width: 32, height: 26)
                .overlay(
                    RoundedRectangle(cornerRadius: 5)
                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                )
            Text(badge)
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundColor(cat.badgeText)
        }
        .position(pt)
    }
}

// MARK: - Home View

struct HomeView: View {
    var onNewWorkflow: (() -> Void)?

    private let bg       = Color(red: 17/255, green: 17/255, blue: 20/255)
    private let cardBg   = Color(hex: "1c1c1f")
    private let accent   = Color(red: 13/255, green: 191/255, blue: 90/255)

    private var categorisedNodes: [(NodeCategory, [NodeType])] {
        NodeCategory.allCases.compactMap { cat in
            let nodes = allNodeTypes.filter { $0.category == cat }
            return nodes.isEmpty ? nil : (cat, nodes)
        }
    }

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 28) {

                // Hero card
                VStack(alignment: .leading, spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Content Graph")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(.white)
                            Text("Build workflows with nodes")
                                .font(.system(size: 13))
                                .foregroundColor(Color.white.opacity(0.4))
                        }
                        Spacer()
                        Button(action: { onNewWorkflow?() }) {
                            HStack(spacing: 5) {
                                Image(systemName: "plus")
                                    .font(.system(size: 12, weight: .semibold))
                                Text("New")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundColor(.black)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(accent)
                            .clipShape(Capsule())
                        }
                    }

                    // Mini flow diagram
                    MiniFlowPreview()
                        .frame(height: 90)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color.white.opacity(0.03))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
                                )
                        )
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(cardBg)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14)
                                .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
                        )
                )

                // Node palette
                VStack(alignment: .leading, spacing: 6) {
                    Text("NODES")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.25))
                        .tracking(1.6)
                        .padding(.bottom, 4)

                    ForEach(categorisedNodes, id: \.0) { (category, nodes) in
                        CategorySection(category: category, nodes: nodes)
                            .padding(.bottom, 8)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 40)
        }
        .background(bg.ignoresSafeArea())
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
