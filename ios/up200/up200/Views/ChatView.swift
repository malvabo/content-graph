import SwiftUI

// MARK: - Chat Message Model

struct ChatMessage: Identifiable {
    var id = UUID()
    var role: String // "user" or "assistant"
    var content: String
}

// MARK: - Chat Service

private struct ChatService {
    static func send(messages: [ChatMessage], contextItems: [GenerationProject]) async -> Result<String, APICallError> {
        guard let apiKey = KeychainService.load(), !apiKey.isEmpty,
              let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            return .failure(.http(401, "Missing API key"))
        }

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
        guard let httpBody = try? JSONSerialization.data(withJSONObject: body) else {
            return .failure(.decode)
        }
        req.httpBody = httpBody

        let data: Data
        let resp: URLResponse
        do {
            (data, resp) = try await URLSession.shared.data(for: req)
        } catch {
            return .failure(.network(error.localizedDescription))
        }

        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard status == 200 else {
            return .failure(.http(status, anthropicErrorMessage(from: data)))
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let content = (json["content"] as? [[String: Any]])?.first,
              let text = content["text"] as? String
        else { return .failure(.decode) }

        let result = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? .failure(.empty) : .success(result)
    }
}

// MARK: - Chat View

struct ChatView: View {
    var initialContextIDs: Set<UUID> = []

    @Environment(\.dismiss) private var dismiss
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var messages: [ChatMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var showResourcePicker = false
    @State private var selectedProjectIDs: Set<UUID> = []
    @State private var seededProjectID: UUID? = nil
    @State private var didSeedContext = false
    @State private var sendTask: Task<Void, Never>? = nil
    @State private var cachedProjects: [GenerationProject] = []
    @State private var lastDecodedSignature: Data = Data()
    @State private var chatFailed: Bool = false
    @State private var chatFailReason: String = ""
    @FocusState private var inputFocused: Bool

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var projects: [GenerationProject] { cachedProjects }

    private var selectedProjects: [GenerationProject] {
        cachedProjects.filter { selectedProjectIDs.contains($0.id) }
    }

    /// Projects sent as API context — selected pills plus the seeded doc
    /// referenced via the prefilled `@`-mention.
    private var contextProjects: [GenerationProject] {
        var ids = selectedProjectIDs
        if let s = seededProjectID { ids.insert(s) }
        return cachedProjects.filter { ids.contains($0.id) }
    }

    private func rebuildProjects() {
        guard lastDecodedSignature != projectsData else { return }
        cachedProjects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        lastDecodedSignature = projectsData
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 0.5)

                if messages.isEmpty {
                    welcomeState
                } else {
                    messageList
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { inputFocused = false }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                inputArea
            }
        }
        .sheet(isPresented: $showResourcePicker) {
            ResourcePickerSheet(projects: projects, selectedIDs: $selectedProjectIDs)
        }
        .alert("Message failed", isPresented: $chatFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(chatFailReason.isEmpty
                 ? "Could not reach the API. Check your network connection and try again."
                 : chatFailReason)
        }
        .presentationBackground(bg)
        .onDisappear { sendTask?.cancel() }
        .onAppear {
            rebuildProjects()
            if !didSeedContext {
                didSeedContext = true
                if let id = initialContextIDs.first,
                   let proj = cachedProjects.first(where: { $0.id == id }) {
                    seededProjectID = id
                    inputText = "@\(proj.outputType) "
                }
            }
            // Auto-open the keyboard when the chat screen appears. A short
            // delay is needed because @FocusState inside a sheet doesn't
            // reliably take effect until the sheet's presentation transition
            // has settled.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                inputFocused = true
            }
        }
        .onChange(of: projectsData) { rebuildProjects() }
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 0) {
            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.65))
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.08))
                    .clipShape(Circle())
                    .appIconHitArea()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")

            Spacer(minLength: 8)

            Text("New chat")
                .font(.app(size: 17, weight: .semibold))
                .foregroundColor(AppText.primary)

            Spacer(minLength: 8)

            Button {
                if !projects.isEmpty { showResourcePicker = true }
            } label: {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(
                        selectedProjectIDs.isEmpty
                            ? Color.white.opacity(projects.isEmpty ? 0.18 : 0.55)
                            : .white
                    )
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.07))
                    .clipShape(Circle())
                    .appIconHitArea()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Library context")
        }
        .padding(.horizontal, 16)
        .frame(height: 56)
        .padding(.top, 8)
    }

    // MARK: Welcome state

    private var welcomeState: some View {
        VStack(spacing: 0) {
            Spacer()
            VStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.system(size: 28, weight: .light))
                    .foregroundColor(AppText.tertiary)
                Text("Welcome to Chat")
                    .font(.app(size: 20, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                Text("Ask anything or tell me what you need")
                    .font(.app(size: 15))
                    .foregroundColor(Color.white.opacity(0.42))
                    .multilineTextAlignment(.center)
            }
            Spacer()
            Color.clear.frame(height: 96)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: Message list

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
                .padding(.top, 12)
                .padding(.bottom, 16)
            }
            .scrollDismissesKeyboard(.interactively)
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

    // MARK: Input area

    private var inputArea: some View {
        VStack(spacing: 0) {
            if !selectedProjectIDs.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(selectedProjects) { proj in
                            ContextPill(title: proj.outputType) {
                                withAnimation(AppAnimation.quick) {
                                    _ = selectedProjectIDs.remove(proj.id)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                }
            }

            VStack(spacing: 0) {
                ZStack(alignment: .topLeading) {
                    if inputText.isEmpty {
                        Text("Ask anything\u{2026}")
                            .font(.app(size: 16))
                            .foregroundColor(Color.white.opacity(0.28))
                            .padding(.horizontal, 16)
                            .padding(.top, 14)
                            .allowsHitTesting(false)
                    }
                    TextEditor(text: $inputText)
                        .font(.app(size: 16))
                        .foregroundColor(AppText.primary)
                        .scrollContentBackground(.hidden)
                        .background(.clear)
                        .tint(.white)
                        .focused($inputFocused)
                        .padding(.horizontal, 12)
                        .padding(.top, 8)
                        .frame(minHeight: 36, maxHeight: 100)
                }

                HStack(spacing: 4) {
                    Button {
                        if let clip = UIPasteboard.general.string, !clip.isEmpty {
                            inputText += String(clip.prefix(50_000))
                        }
                    } label: {
                        Image(systemName: "paperclip")
                            .font(.system(size: 17))
                            .foregroundColor(Color.white.opacity(0.45))
                            .frame(width: 40, height: 36)
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Button {
                        inputText += "@"
                        inputFocused = true
                    } label: {
                        Image(systemName: "at")
                            .font(.system(size: 17))
                            .foregroundColor(Color.white.opacity(0.45))
                            .frame(width: 40, height: 36)
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Button(action: sendMessage) {
                        let ready = canSend
                        Image(systemName: "arrow.up")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(ready ? .white : Color.white.opacity(0.28))
                            .frame(width: 32, height: 32)
                            .background(ready ? Color.white.opacity(0.18) : Color.white.opacity(0.06))
                            .clipShape(Circle())
                            .overlay(
                                Circle().stroke(
                                    ready ? Color.white.opacity(0.22) : Color.white.opacity(0.08),
                                    lineWidth: 0.5
                                )
                            )
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(!canSend)
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 10)
            }
            .background(Color.white.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                    .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
            )
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 12)
        }
        .background(bg)
    }

    // MARK: Actions

    private var canSend: Bool {
        !inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        messages.append(ChatMessage(role: "user", content: text))
        inputText = ""
        isLoading = true
        let snapshot = messages
        let ctx = contextProjects
        sendTask = Task {
            let outcome = await ChatService.send(messages: snapshot, contextItems: ctx)
            await MainActor.run {
                isLoading = false
                guard !Task.isCancelled else { return }
                switch outcome {
                case .success(let reply):
                    messages.append(ChatMessage(role: "assistant", content: reply))
                case .failure(let err):
                    // Surface as an alert so the error doesn't masquerade as
                    // a model response in the chat history.
                    chatFailReason = err.userMessage
                    chatFailed = true
                }
            }
        }
    }
}

// MARK: - Message Bubble

private struct MessageBubble: View {
    let message: ChatMessage
    private var isUser: Bool { message.role == "user" }

    var body: some View {
        HStack(alignment: .bottom, spacing: 0) {
            if isUser { Spacer(minLength: 56) }

            Text(message.content)
                .font(.appBody)
                .foregroundColor(isUser ? .white : Color.white.opacity(0.88))
                .lineSpacing(3)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? Color.white.opacity(0.12) : Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous)
                        .stroke(Color.white.opacity(isUser ? 0.14 : 0.08), lineWidth: 0.5)
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
        .clipShape(RoundedRectangle(cornerRadius: Radius.bubble, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            while true {
                do { try await Task.sleep(nanoseconds: 380_000_000) }
                catch { break }
                phase = (phase + 1) % 3
            }
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
                    .frame(minWidth: 28, minHeight: 28)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Remove context")
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
                        .appIconHitArea()
                }
                .accessibilityLabel("Close")
                Spacer(minLength: 0)
                Text("Add context")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(AppText.primary)
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
                                withAnimation(AppAnimation.quick) {
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
                                        .foregroundColor(selected ? .white : AppText.disabled)
                                }
                                .padding(14)
                                .background(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(selected ? SelectionStyle.fill : Color.white.opacity(0.04))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .stroke(selected ? SelectionStyle.stroke : Color.white.opacity(0.06), lineWidth: 0.5)
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
                    .foregroundColor(AppText.primary)
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
        .presentationCornerRadius(Radius.sheet)
        .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
    }
}
