import SwiftUI

// MARK: - App Tab

enum AppTab: String {
    case notes, create, library, templates
}

// MARK: - Library View

struct LibraryView: View {
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var searchText = ""
    @State private var showSearch = false
    @FocusState private var searchFocused: Bool

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var projects: [GenerationProject] {
        (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
    }

    private var groups: [(title: String, items: [GenerationProject])] {
        var dict: [String: [GenerationProject]] = [:]
        for p in projects { dict[p.title, default: []].append(p) }
        return dict
            .map { (title: $0.key, items: $0.value.sorted { $0.date > $1.date }) }
            .sorted { ($0.items.first?.date ?? .distantPast) > ($1.items.first?.date ?? .distantPast) }
    }

    private var filteredGroups: [(title: String, items: [GenerationProject])] {
        guard !searchText.isEmpty else { return groups }
        let q = searchText.lowercased()
        return groups.filter { $0.title.lowercased().contains(q) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                bg.ignoresSafeArea()

                VStack(spacing: 0) {
                    if showSearch {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.app(size: 15))
                                .foregroundColor(Color.white.opacity(0.35))
                            TextField("Search library", text: $searchText)
                                .font(.app(size: 16))
                                .foregroundColor(.white)
                                .tint(Color(red: 0.85, green: 0.45, blue: 0.10))
                                .focused($searchFocused)
                            if !searchText.isEmpty {
                                Button { searchText = "" } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.app(size: 15))
                                        .foregroundColor(Color.white.opacity(0.30))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.07))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal, 16)
                        .padding(.top, 8)
                        .padding(.bottom, 10)
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 0.5)

                    if filteredGroups.isEmpty {
                        Spacer()
                        VStack(spacing: 12) {
                            Image(systemName: searchText.isEmpty ? "tray" : "magnifyingglass")
                                .font(.system(size: 36))
                                .foregroundColor(Color.white.opacity(0.20))
                            Text(searchText.isEmpty ? "No generations yet" : "No results")
                                .foregroundColor(Color.white.opacity(0.30))
                            if searchText.isEmpty {
                                Text("Your content outputs will appear here")
                                    .font(.footnote)
                                    .foregroundColor(Color.white.opacity(0.20))
                            }
                        }
                        Spacer()
                    } else {
                        ScrollView(showsIndicators: false) {
                            LazyVStack(spacing: 0) {
                                ForEach(filteredGroups, id: \.title) { group in
                                    NavigationLink {
                                        ProjectGroupView(title: group.title, items: group.items)
                                    } label: {
                                        LibraryGroupRow(title: group.title, items: group.items)
                                    }
                                    .buttonStyle(.plain)

                                    Rectangle()
                                        .fill(Color.white.opacity(0.06))
                                        .frame(height: 0.5)
                                        .padding(.leading, 20)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Library")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(.easeInOut(duration: 0.22)) {
                            showSearch.toggle()
                            if !showSearch { searchText = "" }
                            else { searchFocused = true }
                        }
                    } label: {
                        Image(systemName: showSearch ? "xmark" : "magnifyingglass")
                            .font(.system(size: 15, weight: .regular))
                            .frame(width: 32, height: 32)
                            .background(Color.white.opacity(showSearch ? 0.12 : 0.0))
                            .clipShape(Circle())
                    }
                }
            }
        }
    }
}

private func libraryRelativeTime(_ date: Date) -> String {
    let interval = Date().timeIntervalSince(date)
    if interval < 60 { return "just now" }
    if interval < 3600 { return "\(Int(interval / 60))m ago" }
    if interval < 86400 { return "\(Int(interval / 3600))h ago" }
    let days = Int(interval / 86400)
    return days == 1 ? "yesterday" : "\(days) days ago"
}

private func outputTypesList(_ items: [GenerationProject]) -> String {
    var seen = Set<String>()
    let labels: [String] = items.compactMap { item in
        guard seen.insert(item.outputType).inserted else { return nil }
        return allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType
    }
    return labels.joined(separator: ", ")
}

private struct LibraryGroupRow: View {
    let title: String
    let items: [GenerationProject]

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.app(size: 19, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.88))
                    .lineLimit(1)
                Text("\(outputTypesList(items)) · \(libraryRelativeTime(items.first?.date ?? Date()))")
                    .font(.app(size: 12))
                    .foregroundColor(Color.white.opacity(0.35))
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
}

private struct ProjectGroupView: View {
    let title: String
    let items: [GenerationProject]

    var body: some View {
        List {
            ForEach(Array(items.enumerated()), id: \.element.id) { idx, project in
                ProjectRow(project: project)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                    .listRowSeparatorTint(Color.white.opacity(0.06))
                    .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
    }
}

private struct ProjectRow: View {
    let project: GenerationProject
    @State private var showDetail = false

    var body: some View {
        Button { showDetail = true } label: {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(project.outputType)
                        .font(.app(size: 19, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.88))
                        .lineLimit(1)
                    if !project.preview.isEmpty {
                        Text(project.preview)
                            .font(.app(size: 13))
                            .foregroundColor(Color.white.opacity(0.40))
                            .lineLimit(1)
                    }
                }
                Spacer()
                Text(project.date, style: .date)
                    .font(.app(size: 12))
                    .foregroundColor(Color.white.opacity(0.28))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
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
                Color.clear.frame(width: 28, height: 28)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
            .padding(.bottom, 14)

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

private enum TemplateDestination: Hashable {
    case new
    case edit(UUID)
}

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
    @State private var path: [TemplateDestination] = []

    var body: some View {
        NavigationStack(path: $path) {
            List {
                ForEach(custom) { tpl in
                    TemplateRow(title: tpl.title)
                        .onTapGesture { path.append(.edit(tpl.id)) }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(Color.white.opacity(0.06))
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                }
                ForEach(builtIn, id: \.title) { tpl in
                    TemplateRow(title: tpl.title)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparatorTint(Color.white.opacity(0.06))
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
            .navigationTitle("Templates")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { path.append(.new) } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .onAppear { custom = (try? JSONDecoder().decode([CustomTemplate].self, from: customData)) ?? [] }
            .navigationDestination(for: TemplateDestination.self) { dest in
                switch dest {
                case .new:
                    TemplateEditPage(template: nil) { newTpl in
                        custom.insert(newTpl, at: 0)
                        saveCustom()
                    }
                case .edit(let id):
                    if let tpl = custom.first(where: { $0.id == id }) {
                        TemplateEditPage(template: tpl) { updated in
                            if let idx = custom.firstIndex(where: { $0.id == id }) {
                                custom[idx] = updated
                            }
                            saveCustom()
                        } onDelete: {
                            custom.removeAll { $0.id == id }
                            saveCustom()
                        }
                    }
                }
            }
        }
    }

    private func saveCustom() {
        customData = (try? JSONEncoder().encode(custom)) ?? Data()
    }
}

private struct TemplateRow: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.app(size: 19, weight: .regular))
            .foregroundColor(Color.white.opacity(0.82))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
    }
}

private struct TemplateEditPage: View {
    let originalID: UUID?
    let onSave: (CustomTemplate) -> Void
    let onDelete: (() -> Void)?

    @State private var title: String
    @State private var subtitle: String
    @State private var prompt: String
    @State private var formatIDs: Set<String>

    @Environment(\.dismiss) private var dismiss
    @FocusState private var focus: Field?

    private enum Field { case title, subtitle, prompt }
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    init(template: CustomTemplate?, onSave: @escaping (CustomTemplate) -> Void, onDelete: (() -> Void)? = nil) {
        self.originalID = template?.id
        self.onSave = onSave
        self.onDelete = onDelete
        _title = State(initialValue: template?.title ?? "")
        _subtitle = State(initialValue: template?.subtitle ?? "")
        _prompt = State(initialValue: template?.prompt ?? "")
        _formatIDs = State(initialValue: Set(template?.formatIDs ?? []))
    }

    private var isNew: Bool { originalID == nil }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

            VStack(spacing: 0) {
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(spacing: 10) {
                        TextField("Template name", text: $title)
                            .font(.app(size: 16))
                            .foregroundColor(.white)
                            .padding(14)
                            .background(Color.white.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .tint(.white)
                            .focused($focus, equals: .title)

                        TextField("Short description (optional)", text: $subtitle)
                            .font(.app(size: 15))
                            .foregroundColor(.white)
                            .padding(14)
                            .background(Color.white.opacity(0.06))
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .tint(.white)
                            .focused($focus, equals: .subtitle)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Prompt")
                            .font(.app(size: 11, weight: .semibold))
                            .tracking(0.6)
                            .foregroundColor(Color.white.opacity(0.30))

                        ZStack(alignment: .topLeading) {
                            if prompt.isEmpty {
                                Text("Describe what this template should produce…")
                                    .font(.app(size: 15))
                                    .foregroundColor(Color.white.opacity(0.22))
                                    .padding(.horizontal, 14)
                                    .padding(.top, 14)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $prompt)
                                .font(.app(size: 15))
                                .foregroundColor(.white)
                                .scrollContentBackground(.hidden)
                                .background(Color.clear)
                                .tint(.white)
                                .focused($focus, equals: .prompt)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                                .frame(minHeight: 100)
                        }
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        Text("Formats")
                            .font(.app(size: 11, weight: .semibold))
                            .tracking(0.6)
                            .foregroundColor(Color.white.opacity(0.30))

                        LazyVGrid(
                            columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                            spacing: 8
                        ) {
                            ForEach(allFormats) { fmt in
                                let selected = formatIDs.contains(fmt.id)
                                Button {
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                    withAnimation(.easeOut(duration: 0.15)) {
                                        if selected { formatIDs.remove(fmt.id) }
                                        else { formatIDs.insert(fmt.id) }
                                    }
                                } label: {
                                    Text(fmt.label)
                                        .font(.app(size: 13, weight: .medium))
                                        .foregroundColor(selected ? .white : Color.white.opacity(0.55))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .background(selected ? amber.opacity(0.22) : Color.white.opacity(0.06))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                                .stroke(selected ? amber.opacity(0.45) : Color.white.opacity(0.10), lineWidth: 0.5)
                                        )
                                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 32)
            }

            Button {
                guard !title.isEmpty else { return }
                var tpl = CustomTemplate(title: title, subtitle: subtitle)
                if let id = originalID { tpl.id = id }
                tpl.prompt = prompt
                tpl.formatIDs = Array(formatIDs)
                onSave(tpl)
                dismiss()
            } label: {
                Text(isNew ? "Add Template" : "Save Changes")
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
            } // VStack
        } // ZStack
        .navigationTitle(isNew ? "New Template" : "Edit Template")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            if !isNew, let del = onDelete {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        del()
                        dismiss()
                    } label: {
                        Image(systemName: "trash")
                            .foregroundColor(Color.red.opacity(0.65))
                    }
                }
            }
        }
        .task { focus = .title }
    }
}

// MARK: - Custom Tab Bar

private struct AppTabBar: View {
    @Binding var selected: AppTab

    private let mainItems: [(AppTab, String, String)] = [
        (.notes,     "note.text",        "Home"),
        (.library,   "folder",           "Explore"),
        (.templates, "square.on.square", "Templates"),
    ]

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 0) {
                ForEach(mainItems, id: \.0.rawValue) { tab, icon, label in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        selected = tab
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: icon)
                                .font(.system(size: 18, weight: selected == tab ? .semibold : .regular))
                            Text(label)
                                .font(.system(size: 10, weight: selected == tab ? .semibold : .regular))
                        }
                        .foregroundColor(selected == tab ? .white : Color.white.opacity(0.38))
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(
                            Group {
                                if selected == tab {
                                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                                        .fill(Color.white.opacity(0.12))
                                        .padding(.horizontal, 4)
                                }
                            }
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 24, style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                    )
            )

            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                selected = .create
            } label: {
                VStack(spacing: 3) {
                    Image(systemName: "square.and.pencil")
                        .font(.system(size: 18, weight: selected == .create ? .semibold : .regular))
                    Text("Creator")
                        .font(.system(size: 10, weight: selected == .create ? .semibold : .regular))
                }
                .foregroundColor(selected == .create ? .white : Color.white.opacity(0.55))
                .frame(width: 62, height: 62)
                .background(
                    RoundedRectangle(cornerRadius: 20, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                        )
                )
            }
            .buttonStyle(.plain)
        }
        .environment(\.colorScheme, .dark)
    }
}

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .notes
    @State private var showSplash = true
    @StateObject private var bannerController = BannerController()

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                NotesView().tag(AppTab.notes)
                HomeView().tag(AppTab.create)
                LibraryView().tag(AppTab.library)
                TemplatesView().tag(AppTab.templates)
            }
            .environmentObject(bannerController)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                AppTabBar(selected: $selectedTab)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }

            if showSplash {
                LaunchView()
                    .transition(.opacity)
                    .zIndex(1)
            }

            if bannerController.isVisible {
                GenerationBanner(
                    formatLabels: bannerController.formatLabels,
                    isReady: bannerController.isReady,
                    onTap: {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        bannerController.onOpen?()
                    },
                    onDismiss: {
                        bannerController.onCancel?()
                    }
                )
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(2)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: bannerController.isVisible)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) { showSplash = false }
            }
        }
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
