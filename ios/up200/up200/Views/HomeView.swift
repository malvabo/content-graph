import SwiftUI

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
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

// MARK: - Section Header

private struct SectionHeader: View {
    let title: String
    @Binding var expanded: Bool

    var body: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { expanded.toggle() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: expanded ? "chevron.down" : "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.35))
                Text(title)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.85))
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Source Card

private struct SourceCard: View {
    @Binding var text: String
    @State private var expanded = true
    var onBuild: () -> Void

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                SectionHeader(title: "Source", expanded: $expanded)

                if expanded {
                    Divider()
                        .background(Color.white.opacity(0.07))

                    ZStack(alignment: .topLeading) {
                        if text.isEmpty {
                            Text("Paste your text, transcript or notes…")
                                .font(.system(size: 14))
                                .foregroundColor(Color.white.opacity(0.25))
                                .padding(.horizontal, 16)
                                .padding(.top, 14)
                                .allowsHitTesting(false)
                        }
                        TextEditor(text: $text)
                            .font(.system(size: 14))
                            .foregroundColor(Color.white.opacity(0.85))
                            .scrollContentBackground(.hidden)
                            .background(.clear)
                            .frame(minHeight: 110, maxHeight: 200)
                            .padding(.horizontal, 12)
                            .padding(.top, 8)
                    }

                    HStack(spacing: 8) {
                        ForEach(["photo", "mic", "doc.text"], id: \.self) { icon in
                            Button {
                            } label: {
                                Image(systemName: icon)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(Color.white.opacity(0.45))
                                    .frame(width: 34, height: 34)
                                    .background(Color.white.opacity(0.07))
                                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                            }
                            .buttonStyle(.plain)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)

                    Button(action: onBuild) {
                        Text("Build Workflow")
                            .font(.system(size: 15, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.85))
                            .frame(maxWidth: .infinity)
                            .frame(height: 48)
                            .background(Color.white.opacity(0.09))
                            .overlay(
                                Rectangle()
                                    .fill(Color.white.opacity(0.07))
                                    .frame(height: 0.5),
                                alignment: .top
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Generate Card

private struct GenerateCard: View {
    @Binding var prompt: String
    @State private var expanded = true

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                SectionHeader(title: "Generate", expanded: $expanded)

                if expanded {
                    Divider()
                        .background(Color.white.opacity(0.07))

                    ZStack(alignment: .topLeading) {
                        if prompt.isEmpty {
                            Text("Describe what you want to create…")
                                .font(.system(size: 14))
                                .foregroundColor(Color.white.opacity(0.25))
                                .padding(.horizontal, 16)
                                .padding(.top, 14)
                                .allowsHitTesting(false)
                        }
                        TextEditor(text: $prompt)
                            .font(.system(size: 14))
                            .foregroundColor(Color.white.opacity(0.85))
                            .scrollContentBackground(.hidden)
                            .background(.clear)
                            .frame(minHeight: 80, maxHeight: 140)
                            .padding(.horizontal, 12)
                            .padding(.top, 8)
                            .padding(.bottom, 12)
                    }
                }
            }
        }
    }
}

// MARK: - Brand Card

private struct BrandCard: View {
    @Binding var selectedBrand: String
    @State private var expanded = true
    let brands = ["None", "Personal", "Company", "Startup", "Agency"]

    var body: some View {
        GlassCard {
            VStack(spacing: 0) {
                SectionHeader(title: "Brand Voice", expanded: $expanded)

                if expanded {
                    Divider()
                        .background(Color.white.opacity(0.07))

                    VStack(spacing: 0) {
                        ForEach(Array(brands.enumerated()), id: \.element) { idx, brand in
                            Button {
                                withAnimation(.easeOut(duration: 0.15)) {
                                    selectedBrand = brand
                                }
                            } label: {
                                HStack {
                                    Text(brand)
                                        .font(.system(size: 14, weight: selectedBrand == brand ? .medium : .regular))
                                        .foregroundColor(
                                            selectedBrand == brand
                                            ? Color(red: 13/255, green: 191/255, blue: 90/255)
                                            : Color.white.opacity(0.75)
                                        )
                                    Spacer()
                                    if selectedBrand == brand {
                                        Image(systemName: "checkmark")
                                            .font(.system(size: 12, weight: .semibold))
                                            .foregroundColor(Color(red: 13/255, green: 191/255, blue: 90/255))
                                    }
                                }
                                .padding(.horizontal, 16)
                                .padding(.vertical, 13)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)

                            if idx < brands.count - 1 {
                                Divider()
                                    .background(Color.white.opacity(0.06))
                                    .padding(.leading, 16)
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }
}

// MARK: - Home View

struct HomeView: View {
    var onNewWorkflow: (() -> Void)?

    @State private var sourceText  = ""
    @State private var genPrompt   = ""
    @State private var brand       = "None"

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07)
                .ignoresSafeArea()

            RadialGradient(
                colors: [Color(red: 0.55, green: 0.30, blue: 0.08).opacity(0.35), .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0,
                endRadius: 380
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [Color(red: 0.05, green: 0.35, blue: 0.15).opacity(0.28), .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0,
                endRadius: 320
            )
            .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    SourceCard(text: $sourceText, onBuild: { onNewWorkflow?() })
                    GenerateCard(prompt: $genPrompt)
                    BrandCard(selectedBrand: $brand)
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
