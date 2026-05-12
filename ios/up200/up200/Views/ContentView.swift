import SwiftUI

// MARK: - App Tab

enum AppTab: String, CaseIterable {
    case home, library, templates

    var label: String {
        switch self {
        case .home:      return "Home"
        case .library:   return "Library"
        case .templates: return "Templates"
        }
    }

    var icon: String {
        switch self {
        case .home:      return "house"
        case .library:   return "tray.2"
        case .templates: return "rectangle.stack"
        }
    }
}

// MARK: - Library View

struct LibraryView: View {
    @AppStorage("library_projects") private var projectsData: Data = Data()

    private var projects: [GenerationProject] {
        (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
    }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Text("Library")
                    .font(.app(size: 22, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                    .padding(.horizontal, 20)
                    .padding(.top, 28)
                    .padding(.bottom, 20)

                if projects.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.app(size: 36, weight: .regular))
                            .foregroundColor(Color.white.opacity(0.20))
                        Text("No generations yet")
                            .font(.app(size: 16, weight: .regular))
                            .foregroundColor(Color.white.opacity(0.30))
                        Text("Your content outputs will appear here")
                            .font(.app(size: 13, weight: .regular))
                            .foregroundColor(Color.white.opacity(0.20))
                    }
                    .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    ScrollView(showsIndicators: false) {
                        LazyVStack(spacing: 10) {
                            ForEach(projects) { project in
                                ProjectRow(project: project)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 32)
                    }
                }
            }
        }
    }
}

private struct ProjectRow: View {
    let project: GenerationProject
    @State private var showDetail = false

    var body: some View {
        Button { showDetail = true } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(project.outputType)
                    .font(.app(size: 15, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                    .lineLimit(1)
                if !project.preview.isEmpty {
                    Text(project.preview)
                        .font(.app(size: 13))
                        .foregroundColor(Color.white.opacity(0.45))
                        .lineLimit(2)
                }
                HStack(spacing: 8) {
                    Text(project.title)
                        .font(.app(size: 11))
                        .foregroundColor(Color.white.opacity(0.30))
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(project.date, style: .date)
                        .font(.app(size: 11))
                        .foregroundColor(Color.white.opacity(0.30))
                }
                .padding(.top, 2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showDetail) {
            ProjectDetailView(project: project)
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(22)
                .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
    }
}

private struct ProjectDetailView: View {
    let project: GenerationProject
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        VStack(spacing: 0) {
            // Header: close · title · count(=1)
            HStack(spacing: 12) {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.app(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.60))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
                Spacer(minLength: 0)
                Text("Output")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(.white)
                Spacer(minLength: 0)
                // Right slot kept for symmetry with the result sheet's count chip.
                Color.clear.frame(width: 28, height: 28)
            }
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 14)

            // Block
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(project.outputType)
                            .font(.app(size: 15, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.88))
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Button {
                            UIPasteboard.general.string = project.content.isEmpty ? project.preview : project.content
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            withAnimation(.easeOut(duration: 0.15)) { copied = true }
                            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                                withAnimation { copied = false }
                            }
                        } label: {
                            Label(copied ? "Copied" : "Copy",
                                  systemImage: copied ? "checkmark" : "doc.on.doc")
                                .font(.app(size: 12, weight: .medium))
                                .foregroundColor(copied ? .white : Color.white.opacity(0.55))
                        }
                        .buttonStyle(.plain)
                    }

                    if !project.title.isEmpty {
                        Text(project.title)
                            .font(.app(size: 12))
                            .foregroundColor(Color.white.opacity(0.32))
                    }

                    Text(project.content.isEmpty ? project.preview : project.content)
                        .font(.app(size: 14))
                        .foregroundColor(Color.white.opacity(0.82))
                        .lineSpacing(4)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                }
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color.white.opacity(0.04))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
            }
        }
    }
}

// MARK: - Templates View

struct TemplatesView: View {
    private let builtIn: [(title: String, subtitle: String, icon: String)] = [
        ("Landing page",     "Structured hero + sections copy",  "doc.richtext"),
        ("Short note",       "Concise single-topic summary",      "note.text"),
        ("Newsletter",       "300–500 word scannable digest",     "envelope"),
        ("LinkedIn post",    "150–300 word hook post",            "person.crop.rectangle"),
        ("Twitter thread",   "5–10 tweet thread",                 "text.bubble"),
        ("Brand story",      "Rewrite with consistent voice",     "sparkles"),
        ("Marketing pack",   "Social, email and ad copy",         "megaphone"),
        ("Review document",  "Key decisions and action items",    "checkmark.circle"),
    ]

    @AppStorage("custom_templates") private var customData: Data = Data()
    @State private var custom: [CustomTemplate] = []
    @State private var showAdd = false
    @State private var newTitle = ""
    @State private var newDesc = ""

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("Templates")
                        .font(.app(size: 22, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.88))
                    Spacer()
                    Button {
                        newTitle = ""; newDesc = ""; showAdd = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.app(size: 16, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.55))
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.07))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 20)
                .padding(.top, 28)
                .padding(.bottom, 20)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(builtIn, id: \.title) { tpl in
                        TemplateCard(title: tpl.title, subtitle: tpl.subtitle, icon: tpl.icon, isCustom: false) {}
                    }
                    ForEach(custom) { tpl in
                        TemplateCard(title: tpl.title, subtitle: tpl.subtitle, icon: "doc.badge.plus", isCustom: true) {
                            custom.removeAll { $0.id == tpl.id }
                            saveCustom()
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
        .onAppear { custom = (try? JSONDecoder().decode([CustomTemplate].self, from: customData)) ?? [] }
        .sheet(isPresented: $showAdd) {
            AddTemplateSheet(title: $newTitle, desc: $newDesc) {
                guard !newTitle.isEmpty else { return }
                custom.append(CustomTemplate(title: newTitle, subtitle: newDesc))
                saveCustom()
                showAdd = false
            }
        }
    }

    private func saveCustom() {
        customData = (try? JSONEncoder().encode(custom)) ?? Data()
    }
}

private struct TemplateCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let isCustom: Bool
    var onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                Image(systemName: icon)
                    .font(.app(size: 18, weight: .regular))
                    .foregroundColor(Color.white.opacity(0.70))
                Spacer()
                if isCustom {
                    Button(action: onDelete) {
                        Image(systemName: "xmark")
                            .font(.app(size: 11, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.app(size: 14, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.86))
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(.app(size: 12, weight: .regular))
                    .foregroundColor(Color.white.opacity(0.42))
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.04))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 0.5)
        )
    }
}

private struct AddTemplateSheet: View {
    @Binding var title: String
    @Binding var desc: String
    var onAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: Field?

    private enum Field { case title, desc }

    var body: some View {
        VStack(spacing: 0) {
            Text("New template")
                .font(.app(size: 18, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.top, 8)
                .padding(.bottom, 24)

            VStack(spacing: 12) {
                TextField("Title", text: $title)
                    .font(.app(size: 16))
                    .foregroundColor(.white)
                    .padding(14)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .tint(.white)
                    .focused($focus, equals: .title)
                    .submitLabel(.next)
                    .onSubmit { focus = .desc }

                TextField("Description (optional)", text: $desc)
                    .font(.app(size: 16))
                    .foregroundColor(.white)
                    .padding(14)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .tint(.white)
                    .focused($focus, equals: .desc)
                    .submitLabel(.done)
                    .onSubmit { if !title.isEmpty { onAdd() } }
            }
            .padding(.horizontal, 20)

            Spacer()

            Button(action: onAdd) {
                Text("Add template")
                    .font(.app(size: 16, weight: .semibold))
                    .foregroundColor(title.isEmpty ? Color.white.opacity(0.30) : .white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(title.isEmpty ? Color.white.opacity(0.06) : Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(title.isEmpty)
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(22)
        .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        .interactiveDismissDisabled(!title.isEmpty || !desc.isEmpty)
        .task { focus = .title }
    }
}

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .home
    @State private var showSplash = true
    @State private var homeScrollToTop = 0
    @State private var pendingSheet: SourceSheet? = nil

    // Re-tapping the current Home tab scrolls HomeView to the top.
    private var tabSelection: Binding<AppTab> {
        Binding(
            get: { selectedTab },
            set: { newValue in
                if newValue == selectedTab, newValue == .home {
                    homeScrollToTop &+= 1
                }
                selectedTab = newValue
            }
        )
    }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07)
                .ignoresSafeArea()

            if showSplash {
                LaunchView()
                    .transition(.opacity)
            } else {
                TabView(selection: tabSelection) {
                    Tab(AppTab.home.label, systemImage: AppTab.home.icon, value: AppTab.home) {
                        HomeView(scrollToTopSignal: homeScrollToTop, pendingSheet: $pendingSheet)
                            .overlay(alignment: .bottomTrailing) { addFAB }
                    }
                    Tab(AppTab.library.label, systemImage: AppTab.library.icon, value: AppTab.library) {
                        LibraryView()
                            .overlay(alignment: .bottomTrailing) { addFAB }
                    }
                    Tab(AppTab.templates.label, systemImage: AppTab.templates.icon, value: AppTab.templates) {
                        TemplatesView()
                            .overlay(alignment: .bottomTrailing) { addFAB }
                    }
                }
                .tint(.white)
                .toolbarBackground(Color(red: 0.10, green: 0.08, blue: 0.07), for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
                .toolbarColorScheme(.dark, for: .tabBar)
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) { showSplash = false }
            }
        }
    }

    private var addFAB: some View {
        AddFAB {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            selectedTab = .home
            pendingSheet = .picker
        }
        .padding(.trailing, 16)
        .padding(.bottom, 24)
    }
}

// MARK: - Add FAB

struct AddFAB: View {
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(Color.white.opacity(0.09))
                    .overlay(Circle().stroke(Color.white.opacity(0.14), lineWidth: 0.5))
                    .frame(width: 56, height: 56)
                    .shadow(color: .black.opacity(0.25), radius: 12, y: 4)
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add source")
    }
}

// MARK: - Launch View

struct LaunchView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("up")
                .font(.system(size: 32, weight: .semibold, design: .rounded))
                .foregroundColor(.white)
            ProgressView()
                .tint(Color.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.10, green: 0.08, blue: 0.07))
    }
}

#Preview {
    ContentView()
}
