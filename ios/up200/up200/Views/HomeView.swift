import SwiftUI

// MARK: - Data Model

enum NodeCategory: String, CaseIterable {
    case source    = "Source"
    case generate  = "Generate"
    case output    = "Output"
    case transform = "Advanced"

    var badgeBg: Color {
        switch self {
        case .source:    return Color(white: 1, opacity: 0.10)
        case .generate:  return Color(red: 0.13, green: 0.20, blue: 0.13)
        case .output:    return Color(white: 1, opacity: 0.08)
        case .transform: return Color(red: 0.18, green: 0.13, blue: 0.20)
        }
    }

    var badgeText: Color {
        switch self {
        case .source:    return Color(white: 0.78)
        case .generate:  return Color(red: 0.68, green: 0.82, blue: 0.64)
        case .output:    return Color(red: 0.78, green: 0.78, blue: 0.66)
        case .transform: return Color(red: 0.78, green: 0.68, blue: 0.82)
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
    NodeType(badge: "Tx", label: "Text",        description: "Paste text, transcript, notes",  category: .source,    subtype: "text-source"),
    NodeType(badge: "Fl", label: "File",         description: "Upload .txt .md .docx",          category: .source,    subtype: "file-source"),
    NodeType(badge: "Im", label: "Image",        description: "Product photo, diagram",         category: .source,    subtype: "image-source"),
    NodeType(badge: "Vc", label: "Voice Note",   description: "Select a saved voice note",      category: .source,    subtype: "voice-source"),
    NodeType(badge: "Li", label: "LinkedIn",     description: "150–300 word hook post",         category: .generate,  subtype: "linkedin-post"),
    NodeType(badge: "Tw", label: "X Thread",     description: "5–10 tweet thread",              category: .generate,  subtype: "twitter-thread"),
    NodeType(badge: "Ts", label: "X Single",     description: "Most quotable insight",          category: .generate,  subtype: "twitter-single"),
    NodeType(badge: "Nl", label: "Newsletter",   description: "300–500 word digest",            category: .generate,  subtype: "newsletter"),
    NodeType(badge: "If", label: "Infographic",  description: "Structured visual spec",         category: .generate,  subtype: "infographic"),
    NodeType(badge: "Qc", label: "Quote Card",   description: "Strongest quote",                category: .generate,  subtype: "quote-card"),
    NodeType(badge: "Ip", label: "Img Prompt",   description: "AI image generation prompt",     category: .generate,  subtype: "image-prompt"),
    NodeType(badge: "Vd", label: "Video",        description: "AI video generation",            category: .generate,  subtype: "video"),
    NodeType(badge: "Ex", label: "Export",       description: "Platform-ready package",         category: .output,    subtype: "export"),
    NodeType(badge: "Bv", label: "Brand Voice",  description: "Rewrite in your brand voice",    category: .output,    subtype: "brand-voice"),
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

// MARK: - Glass Card

private struct GlassCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.07))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.white.opacity(0.09), lineWidth: 0.5)
                    )
            )
    }
}

// MARK: - Section Card

private struct SectionCard: View {
    let category: NodeCategory
    let nodes: [NodeType]
    @State private var expanded = true
    private let accent = Color(red: 13/255, green: 191/255, blue: 90/255)

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                // Header row
                Button {
                    withAnimation(.easeInOut(duration: 0.22)) { expanded.toggle() }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: expanded ? "chevron.down" : "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.4))
                            .frame(width: 16)

                        Text(category.rawValue)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.85))

                        Spacer()

                        // White circle action button
                        ZStack {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 34, height: 34)
                            Image(systemName: "plus")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.black)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                }
                .buttonStyle(.plain)

                if expanded {
                    Divider()
                        .background(Color.white.opacity(0.08))
                        .padding(.horizontal, 16)

                    VStack(spacing: 0) {
                        ForEach(Array(nodes.enumerated()), id: \.element.id) { idx, node in
                            NodeRow(node: node)

                            if idx < nodes.count - 1 {
                                Divider()
                                    .background(Color.white.opacity(0.06))
                                    .padding(.leading, 58)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }
}

// MARK: - Node Row

private struct NodeRow: View {
    let node: NodeType
    @State private var pressed = false

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(node.category.badgeBg)
                    .frame(width: 36, height: 36)
                Text(node.badge)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundColor(node.category.badgeText)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(node.label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                Text(node.description)
                    .font(.system(size: 12))
                    .foregroundColor(Color.white.opacity(0.38))
            }

            Spacer(minLength: 0)

            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(Color.white.opacity(0.2))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .contentShape(Rectangle())
        .scaleEffect(pressed ? 0.98 : 1.0)
        .animation(.easeOut(duration: 0.1), value: pressed)
        .onLongPressGesture(minimumDuration: 0, pressing: { p in pressed = p }, perform: {})
    }
}

// MARK: - Home View

struct HomeView: View {
    var onNewWorkflow: (() -> Void)?

    private let accent = Color(red: 13/255, green: 191/255, blue: 90/255)

    private var sections: [(NodeCategory, [NodeType])] {
        NodeCategory.allCases.compactMap { cat in
            let nodes = allNodeTypes.filter { $0.category == cat }
            return nodes.isEmpty ? nil : (cat, nodes)
        }
    }

    var body: some View {
        ZStack {
            // Warm dark background
            LinearGradient(
                colors: [
                    Color(red: 0.11, green: 0.09, blue: 0.08),
                    Color(red: 0.07, green: 0.06, blue: 0.06),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {

                    // New Workflow button
                    Button(action: { onNewWorkflow?() }) {
                        HStack(spacing: 8) {
                            Image(systemName: "plus")
                                .font(.system(size: 15, weight: .semibold))
                            Text("New Workflow")
                                .font(.system(size: 16, weight: .medium))
                        }
                        .foregroundColor(Color.white.opacity(0.88))
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Color.white.opacity(0.09))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                                )
                        )
                    }
                    .buttonStyle(.plain)

                    // Section cards
                    ForEach(sections, id: \.0) { (category, nodes) in
                        SectionCard(category: category, nodes: nodes)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)
                .padding(.bottom, 40)
            }
        }
    }
}

#Preview {
    HomeView()
        .preferredColorScheme(.dark)
}
