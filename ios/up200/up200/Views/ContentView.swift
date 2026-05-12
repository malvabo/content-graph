import SwiftUI

// MARK: - App Tab

enum AppTab: String {
    case notes, create, library, templates
}

// MARK: - Library View

struct LibraryView: View {
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var searchText = ""

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
                Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

                if filteredGroups.isEmpty {
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
                } else {
                    List {
                        ForEach(Array(filteredGroups.enumerated()), id: \.element.title) { idx, group in
                            NavigationLink {
                                ProjectGroupView(title: group.title, items: group.items)
                            } label: {
                                LibraryGroupRow(title: group.title, count: group.items.count, date: group.items.first?.date ?? Date())
                            }
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                            .listRowSeparatorTint(Color.white.opacity(0.06))
                            .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Library")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(.hidden, for: .navigationBar)
            .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search library")
        }
    }
}

private struct LibraryGroupRow: View {
    let title: String
    let count: Int
    let date: Date

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.app(size: 19, weight: .medium))
                    .foregroundColor(Color.white.opacity(0.88))
                    .lineLimit(1)
                Text("\(count) output\(count == 1 ? "" : "s") · \(date, style: .relative) ago")
                    .font(.app(size: 12))
                    .foregroundColor(Color.white.opacity(0.35))
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.18))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
}

private struct ProjectGroupView: View {
    let title: String
    let items: [GenerationProject]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 12) {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.55))
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, 6)

                Text(title)
                    .font(.app(size: 28, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)

                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        ForEach(Array(items.enumerated()), id: \.element.id) { idx, project in
                            ProjectRow(project: project)
                            if idx < items.count - 1 {
                                Divider().background(Color.white.opacity(0.06)).padding(.leading, 20)
                            }
                        }
                    }
                    .padding(.bottom, 32)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
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
    @State private var editingTemplate: CustomTemplate? = nil

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            List {
                ForEach(custom) { tpl in
                    TemplateRow(title: tpl.title)
                        .onTapGesture { editingTemplate = tpl }
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
                    Button { showAdd = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .onAppear { custom = (try? JSONDecoder().decode([CustomTemplate].self, from: customData)) ?? [] }
            .sheet(isPresented: $showAdd) {
                TemplateEditSheet(template: nil) { newTpl in
                    custom.insert(newTpl, at: 0)
                    saveCustom()
                }
            }
            .sheet(item: $editingTemplate) { tpl in
                TemplateEditSheet(template: tpl) { updated in
                    if let idx = custom.firstIndex(where: { $0.id == tpl.id }) {
                        custom[idx] = updated
                    }
                    saveCustom()
                } onDelete: {
                    custom.removeAll { $0.id == tpl.id }
                    saveCustom()
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

private struct TemplateEditSheet: View {
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
        VStack(spacing: 0) {
            HStack {
                Button { dismiss() } label: {
                    Text("Cancel")
                        .font(.app(size: 16))
                        .foregroundColor(Color.white.opacity(0.50))
                }
                .buttonStyle(.plain)

                Spacer()

                Text(isNew ? "New Template" : "Edit Template")
                    .font(.app(size: 17, weight: .semibold))
                    .foregroundColor(.white)

                Spacer()

                if !isNew, let del = onDelete {
                    Button {
                        del()
                        dismiss()
                    } label: {
                        Image(systemName: "trash")
                            .font(.system(size: 14))
                            .foregroundColor(Color.red.opacity(0.65))
                    }
                    .buttonStyle(.plain)
                } else {
                    Text("Cancel").font(.app(size: 16)).opacity(0)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 16)

            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 0.5)

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
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(22)
        .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
        .interactiveDismissDisabled(isNew && (!title.isEmpty || !prompt.isEmpty))
        .task { focus = .title }
    }
}

// MARK: - Custom Tab Bar

private struct AppTabBar: View {
    @Binding var selected: AppTab
    let onVoice: () -> Void

    private let items: [(AppTab, String)] = [
        (.notes,     "note.text"),
        (.create,    "sparkles"),
        (.library,   "folder"),
        (.templates, "square.on.square"),
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(items, id: \.0.rawValue) { tab, icon in
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    selected = tab
                } label: {
                    Image(systemName: icon)
                        .font(.system(size: 19, weight: selected == tab ? .semibold : .regular))
                        .foregroundColor(selected == tab ? .white : Color.white.opacity(0.38))
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(
                            Group {
                                if selected == tab {
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(Color.white.opacity(0.11))
                                        .padding(.horizontal, 6)
                                }
                            }
                        )
                }
                .buttonStyle(.plain)
            }

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onVoice()
            } label: {
                Image(systemName: "mic")
                    .font(.system(size: 19, weight: .regular))
                    .foregroundColor(Color.white.opacity(0.38))
                    .frame(maxWidth: .infinity, minHeight: 46)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(red: 0.13, green: 0.11, blue: 0.09))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.white.opacity(0.07), lineWidth: 0.5)
                )
        )
        .environment(\.colorScheme, .dark)
    }
}

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .notes
    @State private var showVoice = false
    @State private var showSplash = true

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack {
            TabView(selection: $selectedTab) {
                NotesView().tag(AppTab.notes)
                HomeView().tag(AppTab.create)
                LibraryView().tag(AppTab.library)
                TemplatesView().tag(AppTab.templates)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                AppTabBar(selected: $selectedTab, onVoice: { showVoice = true })
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }

            if showSplash {
                LaunchView()
                    .transition(.opacity)
                    .zIndex(1)
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) { showSplash = false }
            }
        }
        .fullScreenCover(isPresented: $showVoice) {
            VoiceRecordSheet(onSave: { _, transcript in
                var notes = NotesStore.load()
                var note = Note()
                note.body = transcript
                note.updatedAt = Date()
                notes.append(note)
                NotesStore.save(notes)
            }, autoStart: true)
            .preferredColorScheme(.dark)
            .presentationBackground(Color(red: 0.10, green: 0.08, blue: 0.07))
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
