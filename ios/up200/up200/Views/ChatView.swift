import SwiftUI

// MARK: - Chat Message Model

struct ChatMessage: Identifiable {
    var id = UUID()
    var role: String // "user" or "assistant"
    var content: String
}

// MARK: - Chat Service

private struct ChatService {
    static func send(messages: [ChatMessage], contextItems: [GenerationProject]) async -> String? {
        guard let apiKey = KeychainService.load(), !apiKey.isEmpty,
              let url = URL(string: "https://api.anthropic.com/v1/messages") else { return nil }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.timeoutInterval = 60

        var systemText = "You are a helpful content and writing assistant."
        if !contextItems.isEmpty {
            let ctx = contextItems.map {
                "[\($0.outputType)] \($0.title):\n\($0.content.isEmpty ? $0.preview : $0.content)"
            }.joined(separator: "\n\n---\n\n")
            systemText += "\n\nThe user has provided these content pieces as context:\n\n\(ctx)"
        }

        let apiMessages = messages.map { ["role": $0.role, "content": $0.content] }
        let body: [String: Any] = [
            "model": "claude-sonnet-4-6",
            "max_tokens": 1024,
            "system": systemText,
            "messages": apiMessages
        ]
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else { return nil }
        req.httpBody = httpBody

        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return nil }

        let result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? nil : result
    }
}

// MARK: - Chat View

struct ChatView: View {
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var showResourcePicker = false
    @State private var selectedProjectIDs: Set<UUID> = []
    @FocusState private var inputFocused: Bool

    private var projects: [GenerationProject] {
        (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
    }

    private var selectedProjects: [GenerationProject] {
        projects.filter { selectedProjectIDs.contains($0.id) }
    }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

            VStack(spacing: 0) {
                header

                if messages.isEmpty {
                    emptyState
                } else {
                    messageList
                }

                if !selectedProjectIDs.isEmpty {
                    contextPills
                }

                ChatInputBar(
                    text: $inputText,
                    focused: $inputFocused,
                    isLoading: isLoading,
                    onSend: sendMessage
                )
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
            }
        }
        .sheet(isPresented: $showResourcePicker) {
            ResourcePickerSheet(projects: projects, selectedIDs: $selectedProjectIDs)
        }
    }

    // MARK: Sub-views

    private var header: some View {
        HStack {
            Text("Chat")
                .font(.app(size: 22, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
            Spacer()
            if !projects.isEmpty {
                Button { showResourcePicker = true } label: {
                    Image(systemName: selectedProjectIDs.isEmpty ? "tray" : "tray.fill")
                        .font(.app(size: 16, weight: .medium))
                        .foregroundColor(
                            selectedProjectIDs.isEmpty
                                ? Color.white.opacity(0.45)
                                : Color(red: 0.85, green: 0.45, blue: 0.10)
                        )
                        .frame(width: 36, height: 36)
                        .background(Color.white.opacity(0.07))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 28)
        .padding(.bottom, 12)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.app(size: 36, weight: .regular))
                .foregroundColor(Color.white.opacity(0.20))
            Text("Ask anything")
                .font(.app(size: 16, weight: .regular))
                .foregroundColor(Color.white.opacity(0.30))
            if !projects.isEmpty {
                Text("Tap the tray icon to include library context")
                    .font(.app(size: 13, weight: .regular))
                    .foregroundColor(Color.white.opacity(0.20))
            }
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView(showsIndicators: false) {
                LazyVStack(spacing: 12) {
                    ForEach(messages) { msg in
                        MessageBubble(message: msg)
                            .id(msg.id)
                    }
                    if isLoading {
                        TypingIndicator()
                            .id("typing")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 8)
            }
            .onChange(of: messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo(messages.last?.id, anchor: .bottom)
                }
            }
            .onChange(of: isLoading) { _, loading in
                if loading {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("typing", anchor: .bottom)
                    }
                }
            }
        }
    }

    private var contextPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(selectedProjects) { proj in
                    ContextPill(title: proj.outputType) {
                        withAnimation(.easeOut(duration: 0.15)) {
                            _ = selectedProjectIDs.remove(proj.id)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
    }

    // MARK: Actions

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        messages.append(ChatMessage(role: "user", content: text))
        inputText = ""
        isLoading = true
        let snapshot = messages
        let ctx = selectedProjects
        Task {
            let reply = await ChatService.send(messages: snapshot, contextItems: ctx)
            await MainActor.run {
                messages.append(ChatMessage(
                    role: "assistant",
                    content: reply ?? "Something went wrong. Check your API key and try again."
                ))
                isLoading = false
            }
        }
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: ChatMessage
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)
    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 56) }

            Text(message.content)
                .font(.app(size: 15))
                .foregroundColor(isUser ? .white : Color.white.opacity(0.88))
                .lineSpacing(3)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? amber.opacity(0.18) : Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(isUser ? amber.opacity(0.30) : Color.white.opacity(0.08), lineWidth: 0.5)
                )
                .textSelection(.enabled)

            if !isUser { Spacer(minLength: 56) }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
    }
}

// MARK: - Typing Indicator

private struct TypingIndicator: View {
    @State private var phase = 0
    private let timer = Timer.publish(every: 0.38, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.white.opacity(phase == i ? 0.60 : 0.18))
                    .frame(width: 6, height: 6)
                    .animation(.easeInOut(duration: 0.28), value: phase)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .leading)
        .onReceive(timer) { _ in phase = (phase + 1) % 3 }
    }
}

// MARK: - Chat Input Bar

private struct ChatInputBar: View {
    @Binding var text: String
    var focused: FocusState<Bool>.Binding
    let isLoading: Bool
    let onSend: () -> Void

    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)
    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text("Message…")
                        .font(.app(size: 15))
                        .foregroundColor(Color.white.opacity(0.25))
                        .padding(.horizontal, 14)
                        .padding(.top, 12)
                        .allowsHitTesting(false)
                }
                TextEditor(text: $text)
                    .font(.app(size: 15))
                    .foregroundColor(.white)
                    .scrollContentBackground(.hidden)
                    .background(Color.clear)
                    .tint(.white)
                    .focused(focused)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .frame(minHeight: 44, maxHeight: 120)
            }
            .background(Color.white.opacity(0.07))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
            )

            Button(action: onSend) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(canSend ? .white : Color.white.opacity(0.25))
                    .frame(width: 36, height: 36)
                    .background(canSend ? amber.opacity(0.45) : Color.white.opacity(0.07))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .padding(.bottom, 4)
        }
    }
}

// MARK: - Context Pill

private struct ContextPill: View {
    let title: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(title)
                .font(.app(size: 12, weight: .medium))
                .foregroundColor(Color.white.opacity(0.75))
                .lineLimit(1)
            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color.white.opacity(0.45))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
        )
    }
}

// MARK: - Resource Picker Sheet

private struct ResourcePickerSheet: View {
    let projects: [GenerationProject]
    @Binding var selectedIDs: Set<UUID>
    @Environment(\.dismiss) private var dismiss
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.app(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.60))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
                Spacer(minLength: 0)
                Text("Add context")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Spacer(minLength: 0)
                Color.clear.frame(width: 28, height: 28)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 14)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

            if projects.isEmpty {
                Spacer()
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.app(size: 32, weight: .regular))
                        .foregroundColor(Color.white.opacity(0.20))
                    Text("No library items yet")
                        .font(.app(size: 15))
                        .foregroundColor(Color.white.opacity(0.30))
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(spacing: 8) {
                        ForEach(projects) { proj in
                            let selected = selectedIDs.contains(proj.id)
                            Button {
                                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                withAnimation(.easeOut(duration: 0.15)) {
                                    if selected {
                                        _ = selectedIDs.remove(proj.id)
                                    } else {
                                        _ = selectedIDs.insert(proj.id)
                                    }
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(proj.outputType)
                                            .font(.app(size: 14, weight: .semibold))
                                            .foregroundColor(Color.white.opacity(0.88))
                                            .lineLimit(1)
                                        if !proj.preview.isEmpty {
                                            Text(proj.preview)
                                                .font(.app(size: 12))
                                                .foregroundColor(Color.white.opacity(0.40))
                                                .lineLimit(1)
                                        }
                                    }
                                    Spacer()
                                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 18))
                                        .foregroundColor(selected ? amber : Color.white.opacity(0.25))
                                }
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(selected ? amber.opacity(0.08) : Color.white.opacity(0.04))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(selected ? amber.opacity(0.25) : Color.white.opacity(0.06), lineWidth: 0.5)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 24)
                }
            }

            Button { dismiss() } label: {
                Text(selectedIDs.isEmpty ? "No context" : "Done — \(selectedIDs.count) added")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(Color.white.opacity(0.10))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(22)
        .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
    }
}
