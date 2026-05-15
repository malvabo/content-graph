import SwiftUI

struct APIKeySetupView: View {
    var onSaved: () -> Void
    @State private var keyText = ""
    @FocusState private var focused: Bool

    private let amber = BrandColor.amber

    private var trimmed: String { keyText.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var canSave: Bool { trimmed.hasPrefix("sk-ant-") && trimmed.count > 20 }

    var body: some View {
        ZStack {
            AppBackground.primary.ignoresSafeArea()
            RadialGradient(
                colors: [amber.opacity(0.14), .clear],
                center: .init(x: 0.5, y: 0.35), startRadius: 0, endRadius: 380
            ).ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: 32) {
                    ZStack {
                        Circle()
                            .fill(amber.opacity(0.12))
                            .frame(width: 90, height: 90)
                        Image(systemName: "key.fill")
                            .font(.app(size: 30, weight: .regular))
                            .foregroundColor(amber)
                    }

                    VStack(spacing: 10) {
                        Text("Enter your API key")
                            .font(.app(size: 24, weight: .bold))
                            .foregroundColor(AppText.primary)
                        Text("Get one free at console.anthropic.com\nunder API Keys. It starts with sk-ant-")
                            .font(.app(size: 15))
                            .foregroundColor(Color.white.opacity(0.45))
                            .multilineTextAlignment(.center)
                            .lineSpacing(3)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 10) {
                            Image(systemName: "key")
                                .font(.app(size: 14))
                                .foregroundColor(AppText.tertiary)
                            SecureField("sk-ant-api03-…", text: $keyText)
                                .font(.system(size: 15, design: .monospaced))
                                .foregroundColor(AppText.primary)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                                .focused($focused)
                                .submitLabel(.done)
                                .onSubmit { if canSave { save() } }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 14)
                        .background(Color.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: Radius.input, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radius.input, style: .continuous)
                                .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                        )

                        if !keyText.isEmpty && !canSave {
                            Text("Key should start with sk-ant-")
                                .font(.app(size: 12))
                                .foregroundColor(Color(red: 0.90, green: 0.40, blue: 0.30))
                                .padding(.horizontal, 4)
                        }
                    }
                }
                .padding(.horizontal, 28)

                Spacer()

                Button(action: save) {
                    Text("Save & continue")
                        .font(.app(size: 17, weight: .semibold))
                        .foregroundColor(canSave ? .white : AppText.disabled)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(canSave ? amber : Color.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(!canSave)
                .padding(.horizontal, 28)
                .padding(.bottom, 52)
                .animation(AppAnimation.quick, value: canSave)
            }
        }
        .task { focused = true }
    }

    private func save() {
        KeychainService.save(trimmed)
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        onSaved()
    }
}
