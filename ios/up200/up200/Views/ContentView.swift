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
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                    .padding(.horizontal, 20)
                    .padding(.top, 28)
                    .padding(.bottom, 20)

                if projects.isEmpty {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: "tray")
                            .font(.system(size: 36, weight: .light))
                            .foregroundColor(Color.white.opacity(0.20))
                        Text("No generations yet")
                            .font(.system(size: 16, weight: .regular))
                            .foregroundColor(Color.white.opacity(0.30))
                        Text("Your content outputs will appear here")
                            .font(.system(size: 13, weight: .regular))
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
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(project.outputType)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.45))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.07))
                        .clipShape(Capsule())
                    Spacer()
                    Text(project.date, style: .date)
                        .font(.system(size: 11))
                        .foregroundColor(Color.white.opacity(0.30))
                }
                Text(project.title)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.85))
                    .lineLimit(1)
                if !project.preview.isEmpty {
                    Text(project.preview)
                        .font(.system(size: 13))
                        .foregroundColor(Color.white.opacity(0.40))
                        .lineLimit(2)
                }
            }
            .padding(14)
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
            )
        }
        .buttonStyle(.plain)
        .fullScreenCover(isPresented: $showDetail) {
            ProjectDetailView(project: project)
        }
    }
}

private struct ProjectDetailView: View {
    let project: GenerationProject
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    private let green = Color(red: 0.27, green: 0.70, blue: 0.42)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.60))
                        .frame(width: 28, height: 28)
                        .background(Color.white.opacity(0.10))
                        .clipShape(Circle())
                }
                Spacer()
                Text(project.outputType)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Spacer()
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
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(copied ? green : Color.white.opacity(0.60))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.top, 18)
            .padding(.bottom, 14)

            Rectangle()
                .fill(Color.white.opacity(0.07))
                .frame(height: 0.5)

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(project.title)
                        .font(.system(size: 13))
                        .foregroundColor(Color.white.opacity(0.32))
                    Text(project.content.isEmpty ? project.preview : project.content)
                        .font(.system(size: 15))
                        .foregroundColor(Color.white.opacity(0.85))
                        .lineSpacing(5)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 20)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
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
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.88))
                    Spacer()
                    Button {
                        newTitle = ""; newDesc = ""; showAdd = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 16, weight: .medium))
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
                    .font(.system(size: 18, weight: .light))
                    .foregroundColor(Color.white.opacity(0.70))
                Spacer()
                if isCustom {
                    Button(action: onDelete) {
                        Image(systemName: "xmark")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundColor(Color.white.opacity(0.30))
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.86))
                    .multilineTextAlignment(.leading)
                Text(subtitle)
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(Color.white.opacity(0.42))
                    .multilineTextAlignment(.leading)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
        )
    }
}

private struct AddTemplateSheet: View {
    @Binding var title: String
    @Binding var desc: String
    var onAdd: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(Color.white.opacity(0.12))
                .frame(width: 32, height: 4)
                .padding(.top, 12)
                .padding(.bottom, 20)

            Text("New template")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.88))
                .padding(.bottom, 24)

            VStack(spacing: 12) {
                TextField("Title", text: $title)
                    .font(.system(size: 16))
                    .foregroundColor(.white)
                    .padding(14)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .tint(.white)

                TextField("Description (optional)", text: $desc)
                    .font(.system(size: 16))
                    .foregroundColor(.white)
                    .padding(14)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .tint(.white)
            }
            .padding(.horizontal, 20)

            Spacer()

            Button(action: onAdd) {
                Text("Add template")
                    .font(.system(size: 16, weight: .semibold))
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
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
        .presentationDetents([.medium])
        .presentationDragIndicator(.hidden)
    }
}

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .home
    @State private var showSplash = true
    @State private var homeScrollToTop = 0
    @State private var showImport = false
    @State private var pendingSourceType: SourceType? = nil

    var body: some View {
        ZStack {
            Color(red: 17/255, green: 17/255, blue: 20/255)
                .ignoresSafeArea()

            if showSplash {
                LaunchView()
                    .transition(.opacity)
            } else {
                ZStack {
                    switch selectedTab {
                    case .home:
                        HomeView(scrollToTopSignal: homeScrollToTop, pendingSourceType: $pendingSourceType)
                    case .library:
                        LibraryView()
                    case .templates:
                        TemplatesView()
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    NativeTabBar(
                        selected: $selectedTab,
                        onSameTabTap: { tab in
                            if tab == .home { homeScrollToTop += 1 }
                        },
                        onAdd: {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            showImport = true
                        }
                    )
                }
            }
        }
        .sheet(isPresented: $showImport) {
            ImportSheetView { type in
                selectedTab = .home
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    pendingSourceType = type
                }
            }
            .presentationDetents([.medium])
            .presentationDragIndicator(.hidden)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) { showSplash = false }
            }
        }
    }
}

// MARK: - Native Tab Bar

struct NativeTabBar: View {
    @Binding var selected: AppTab
    var onSameTabTap: ((AppTab) -> Void)?
    var onAdd: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                tabItem(tab)
            }

            Button(action: onAdd) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.09))
                        .overlay(Circle().stroke(Color.white.opacity(0.14), lineWidth: 0.5))
                        .frame(width: 38, height: 38)
                    Image(systemName: "plus")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.80))
                }
            }
            .buttonStyle(.plain)
            .padding(.trailing, 20)
            .padding(.leading, 4)
        }
        .padding(.top, 8)
        .padding(.bottom, 2)
        .background {
            ZStack(alignment: .top) {
                Rectangle()
                    .fill(.ultraThinMaterial)
                    .overlay(Color(red: 0.10, green: 0.08, blue: 0.07).opacity(0.55))
                    .ignoresSafeArea(edges: .bottom)
                Rectangle()
                    .fill(Color.white.opacity(0.10))
                    .frame(height: 0.5)
            }
        }
    }

    @ViewBuilder
    private func tabItem(_ tab: AppTab) -> some View {
        Button {
            if tab == selected {
                onSameTabTap?(tab)
            } else {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                selected = tab
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: tab.icon)
                    .font(.system(size: 18, weight: selected == tab ? .medium : .regular))
                Text(tab.label)
                    .font(.system(size: 10, weight: .medium))
            }
            .foregroundColor(selected == tab ? .white : Color.white.opacity(0.38))
            .frame(maxWidth: .infinity)
            .frame(height: 50)
        }
        .buttonStyle(.plain)
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
        .background(Color(red: 17/255, green: 17/255, blue: 20/255))
    }
}

#Preview {
    ContentView()
}
