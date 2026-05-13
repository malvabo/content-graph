import SwiftUI

// MARK: - App Tab

enum AppTab: String {
    case notes, create, templates
}

// MARK: - Library View

struct LibraryView: View {
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @State private var searchText = ""
    @State private var showSearch = false
    @State private var cachedGroups: [(title: String, items: [GenerationProject])] = []
    @FocusState private var searchFocused: Bool

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var filteredGroups: [(title: String, items: [GenerationProject])] {
        guard !searchText.isEmpty else { return cachedGroups }
        let q = searchText.lowercased()
        return cachedGroups.filter { $0.title.lowercased().contains(q) }
    }

    private func buildGroups() {
        let projects = (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
        var dict: [String: [GenerationProject]] = [:]
        for p in projects { dict[p.title, default: []].append(p) }
        cachedGroups = dict
            .map { (title: $0.key, items: $0.value.sorted { $0.date > $1.date }) }
            .sorted { ($0.items.first?.date ?? .distantPast) > ($1.items.first?.date ?? .distantPast) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                bg.ignoresSafeArea()

                VStack(spacing: 0) {
                    if showSearch {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .font(.appLabel)
                                .foregroundColor(Color.white.opacity(0.35))
                            TextField("Search library", text: $searchText)
                                .font(.appLabel)
                                .foregroundColor(.white)
                                .tint(Color(red: 0.85, green: 0.45, blue: 0.10))
                                .focused($searchFocused)
                            if !searchText.isEmpty {
                                Button { searchText = "" } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .font(.appSubtext)
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
                                        ProjectGroupDetailView(groupTitle: group.title, initialItems: group.items)
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
            .navigationBarTitleDisplayMode(.inline)
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
                            .font(.system(size: 17, weight: .regular))
                            .frame(width: 32, height: 32)
                            .background(Color.white.opacity(showSearch ? 0.12 : 0.0))
                            .clipShape(Circle())
                    }
                }
            }
            .task { buildGroups() }
            .onChange(of: projectsData) { buildGroups() }
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
                    .font(.appMicro)
                    .foregroundColor(Color.white.opacity(0.35))
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
    }
}

struct ProjectGroupDetailView: View {
    let groupTitle: String
    let initialItems: [GenerationProject]
    @AppStorage("library_projects") private var projectsData: Data = Data()
    @Environment(\.dismiss) private var dismiss

    @State private var selectedIndex: Int = 0
    @State private var editText: String = ""
    @State private var copied = false
    @FocusState private var editorFocused: Bool

    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)

    private var allProjects: [GenerationProject] {
        (try? JSONDecoder().decode([GenerationProject].self, from: projectsData)) ?? []
    }

    private var items: [GenerationProject] {
        let ids = Set(initialItems.map { $0.id })
        let live = allProjects.filter { ids.contains($0.id) }
        return live.isEmpty ? initialItems : live.sorted { $0.date > $1.date }
    }

    private func tabLabel(_ item: GenerationProject) -> String {
        allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType
    }

    private func bodyText(for item: GenerationProject) -> String {
        item.content.isEmpty ? item.preview : item.content
    }

    private func persistCurrent() {
        guard items.indices.contains(selectedIndex) else { return }
        let item = items[selectedIndex]
        guard editText != bodyText(for: item) else { return }
        var projects = allProjects
        if let idx = projects.firstIndex(where: { $0.id == item.id }) {
            projects[idx].content = editText
            projects[idx].preview = String(editText.prefix(120))
        }
        if let data = try? JSONEncoder().encode(projects) { projectsData = data }
    }

    private func selectTab(_ index: Int) {
        persistCurrent()
        selectedIndex = index
        if items.indices.contains(index) { editText = bodyText(for: items[index]) }
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Top bar
                HStack(spacing: 10) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        persistCurrent()
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Text(groupTitle)
                        .font(.appBodyBold)
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .truncationMode(.tail)

                    Spacer()

                    ShareLink(item: editText) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 10)

                // Tabs
                if items.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                                Button { selectTab(idx) } label: {
                                    Text(tabLabel(item))
                                        .font(.app(size: 14, weight: selectedIndex == idx ? .semibold : .regular))
                                        .foregroundColor(selectedIndex == idx ? .white : Color.white.opacity(0.45))
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 7)
                                        .background(selectedIndex == idx ? Color.white.opacity(0.12) : Color.clear)
                                        .clipShape(Capsule())
                                        .overlay(Capsule().stroke(selectedIndex == idx ? Color.white.opacity(0.20) : Color.clear, lineWidth: 0.5))
                                }
                                .buttonStyle(.plain)
                                .animation(.easeOut(duration: 0.15), value: selectedIndex)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 10)
                    }

                    Rectangle()
                        .fill(Color.white.opacity(0.06))
                        .frame(height: 0.5)
                }

                // Content
                if items.indices.contains(selectedIndex) {
                    let item = items[selectedIndex]

                    VStack(alignment: .leading, spacing: 0) {
                        HStack {
                            Text(allFormats.first(where: { $0.id == item.outputType })?.label ?? item.outputType)
                                .font(.appTitle)
                                .foregroundColor(.white)
                            Spacer()
                            Text(item.date, style: .date)
                                .font(.appCaption)
                                .foregroundColor(Color.white.opacity(0.35))
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 10)

                        ZStack(alignment: .topLeading) {
                            if editText.isEmpty {
                                Text("No content")
                                    .font(.appBody)
                                    .foregroundColor(Color.white.opacity(0.22))
                                    .padding(.horizontal, 24)
                                    .padding(.top, 8)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $editText)
                                .font(.appBody)
                                .lineSpacing(8)
                                .foregroundColor(Color.white.opacity(0.88))
                                .scrollContentBackground(.hidden)
                                .background(Color.clear)
                                .tint(.white)
                                .padding(.horizontal, 16)
                                .contentMargins(.bottom, 96, for: .scrollContent)
                                .focused($editorFocused)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .task {
            if items.indices.contains(selectedIndex) { editText = bodyText(for: items[selectedIndex]) }
        }
        .onChange(of: selectedIndex) {
            if items.indices.contains(selectedIndex) { editText = bodyText(for: items[selectedIndex]) }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            Button {
                UIPasteboard.general.string = editText
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                withAnimation(.easeOut(duration: 0.15)) { copied = true }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { withAnimation { copied = false } }
            } label: {
                Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                    .font(.appBodyBold)
                    .foregroundColor(copied ? Color.white.opacity(0.70) : .white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(copied ? Color.white.opacity(0.07) : Color.white.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .animation(.easeOut(duration: 0.2), value: copied)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
            .background(alignment: .top) {
                LinearGradient(colors: [bg.opacity(0), bg], startPoint: .top, endPoint: .bottom)
                    .frame(height: 28).offset(y: -28).allowsHitTesting(false)
            }
            .background(bg)
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
            .navigationBarTitleDisplayMode(.inline)
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
    @State private var existingSubtitle: String
    @State private var prompt: String
    @State private var formatIDs: Set<String>

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var chrome: ChromeController
    @FocusState private var focus: Field?

    private enum Field { case title, prompt }
    private let bg = Color(red: 0.10, green: 0.08, blue: 0.07)
    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    init(template: CustomTemplate?, onSave: @escaping (CustomTemplate) -> Void, onDelete: (() -> Void)? = nil) {
        self.originalID = template?.id
        self.onSave = onSave
        self.onDelete = onDelete
        _title = State(initialValue: template?.title ?? "")
        _existingSubtitle = State(initialValue: template?.subtitle ?? "")
        _prompt = State(initialValue: template?.prompt ?? "")
        _formatIDs = State(initialValue: Set(template?.formatIDs ?? []))
    }

    private var isNew: Bool { originalID == nil }

    private func persist() {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        var tpl = CustomTemplate(title: title, subtitle: existingSubtitle)
        if let id = originalID { tpl.id = id }
        tpl.prompt = prompt
        tpl.formatIDs = Array(formatIDs)
        onSave(tpl)
    }

    var body: some View {
        ZStack {
            bg.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // Top bar
                HStack(spacing: 10) {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(Color.white.opacity(0.08))
                            .clipShape(Circle())
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    if !isNew, let del = onDelete {
                        Button {
                            del()
                            dismiss()
                        } label: {
                            Image(systemName: "trash")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(Color.red.opacity(0.75))
                                .frame(width: 36, height: 36)
                                .background(Color.white.opacity(0.08))
                                .clipShape(Circle())
                                .frame(minWidth: 44, minHeight: 44)
                                .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 12)

                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: 20) {
                        // Large title
                        TextField(
                            "",
                            text: $title,
                            prompt: Text("Template name").foregroundColor(Color.white.opacity(0.25)),
                            axis: .vertical
                        )
                        .font(.appTitle)
                        .foregroundColor(.white)
                        .tint(.white)
                        .lineLimit(1...3)
                        .padding(.horizontal, 20)
                        .focused($focus, equals: .title)

                        // Format chips — wrapping flow
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Choose formats of the output")
                                .font(.app(size: 13, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.40))
                                .padding(.horizontal, 20)
                            TemplateTagFlow(items: allFormats, selectedIDs: $formatIDs)
                                .padding(.horizontal, 20)
                        }

                        Rectangle()
                            .fill(Color.white.opacity(0.06))
                            .frame(height: 0.5)
                            .padding(.horizontal, 20)

                        // Prompt text
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Prompt")
                                .font(.app(size: 13, weight: .medium))
                                .foregroundColor(Color.white.opacity(0.40))
                                .padding(.horizontal, 20)
                            ZStack(alignment: .topLeading) {
                                if prompt.isEmpty {
                                    Text("Describe what this template should produce\u{2026}")
                                        .font(.appBody)
                                        .foregroundColor(Color.white.opacity(0.22))
                                        .padding(.horizontal, 24)
                                        .padding(.top, 8)
                                        .allowsHitTesting(false)
                                }
                                TextEditor(text: $prompt)
                                    .font(.appBody)
                                    .foregroundColor(Color.white.opacity(0.92))
                                    .scrollContentBackground(.hidden)
                                    .background(Color.clear)
                                    .tint(.white)
                                    .padding(.horizontal, 16)
                                    .contentMargins(.bottom, 96, for: .scrollContent)
                                    .focused($focus, equals: .prompt)
                                    .frame(minHeight: 200)
                            }
                        }
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 48)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .onAppear { chrome.hideTabBar = true }
        .onDisappear {
            chrome.hideTabBar = false
            persist()
        }
    }
}

private struct TemplateTagFlow: View {
    let items: [ContentFormat]
    @Binding var selectedIDs: Set<String>

    var body: some View {
        ChipFlowLayout(spacing: 8) {
            ForEach(items) { fmt in
                let selected = selectedIDs.contains(fmt.id)
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.easeOut(duration: 0.15)) {
                        if selected { selectedIDs.remove(fmt.id) }
                        else { selectedIDs.insert(fmt.id) }
                    }
                } label: {
                    Text(fmt.label)
                        .font(.app(size: 14, weight: selected ? .semibold : .regular))
                        .foregroundColor(selected ? .white : Color.white.opacity(0.55))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(selected ? Color.white.opacity(0.14) : Color.white.opacity(0.07))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(selected ? Color.white.opacity(0.30) : Color.white.opacity(0.10), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                .animation(.easeOut(duration: 0.15), value: selected)
            }
        }
    }
}

private struct ChipFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 0
        var height: CGFloat = 0
        var x: CGFloat = 0
        var rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 {
                height += rowH + spacing
                x = 0; rowH = 0
            }
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
        return CGSize(width: width, height: height + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowH: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX && x > bounds.minX {
                y += rowH + spacing
                x = bounds.minX; rowH = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowH = max(rowH, size.height)
        }
    }
}

// MARK: - Custom Tab Bar

private struct AppTabBar: View {
    @Binding var selected: AppTab

    private let mainItems: [(AppTab, String, String)] = [
        (.notes,     "house",                "Home"),
        (.create,    "sparkles",             "Creator"),
        (.templates, "square.grid.2x2.fill", "Templates"),
    ]

    var body: some View {
        HStack(spacing: 10) {
            HStack(spacing: 4) {
                ForEach(mainItems, id: \.0.rawValue) { tab, icon, label in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        selected = tab
                    } label: {
                        VStack(spacing: 4) {
                            if tab == .create {
                                SparkRaysShape()
                                    .stroke(style: StrokeStyle(
                                        lineWidth: selected == tab ? 2.2 : 1.8,
                                        lineCap: .round
                                    ))
                                    .frame(width: 24, height: 24)
                            } else {
                                Image(systemName: icon)
                                    .font(.system(size: 22, weight: selected == tab ? .semibold : .regular))
                            }
                            Text(label)
                                .font(.system(size: 13, weight: selected == tab ? .semibold : .regular))
                        }
                        .foregroundColor(selected == tab ? .white : Color.white.opacity(0.45))
                        .frame(maxWidth: .infinity, minHeight: 64)
                        .background(
                            Group {
                                if selected == tab {
                                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                                        .fill(Color.white.opacity(0.16))
                                }
                            }
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 28, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                    )
            )

            Button {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                selected = .create
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 22, weight: .regular))
                    .foregroundColor(Color.white.opacity(0.85))
                    .frame(width: 76, height: 76)
                    .background(
                        Circle()
                            .stroke(Color.white.opacity(0.18), lineWidth: 0.5)
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
    @State private var keyboardVisible = false
    @StateObject private var bannerController = BannerController()
    @StateObject private var chromeController = ChromeController()
    @StateObject private var recordingController = RecordingController()

    init() {
        UITabBar.appearance().isHidden = true
    }

    var body: some View {
        ZStack(alignment: .top) {
            TabView(selection: $selectedTab) {
                NotesView().tag(AppTab.notes)
                HomeView().tag(AppTab.create)
                TemplatesView().tag(AppTab.templates)
            }
            .environmentObject(bannerController)
            .environmentObject(chromeController)
            .environmentObject(recordingController)
            .sheet(isPresented: $recordingController.showingSheet) {
                NoteVoiceSheet()
                    .environmentObject(recordingController)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !keyboardVisible && !chromeController.hideTabBar {
                    AppTabBar(selected: $selectedTab)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                keyboardVisible = true
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                keyboardVisible = false
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

            if (recordingController.isRecording || recordingController.isPaused) && !recordingController.showingSheet {
                VStack {
                    Spacer()
                    RecordingMiniBar(
                        onTap: {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                            selectedTab = .notes
                            recordingController.showingSheet = true
                        },
                        onStop: {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            recordingController.finish()
                        }
                    )
                    .padding(.horizontal, 12)
                    .padding(.bottom, (!keyboardVisible && !chromeController.hideTabBar) ? 96 : 12)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(3)
            }
        }
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: bannerController.isVisible)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: recordingController.isRecording)
        .animation(.spring(response: 0.42, dampingFraction: 0.85), value: recordingController.showingSheet)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) { showSplash = false }
            }
        }
    }
}

// MARK: - Recording Mini Bar

private struct RecordingMiniBar: View {
    @EnvironmentObject private var recording: RecordingController
    let onTap: () -> Void
    let onStop: () -> Void

    private let amber = Color(red: 0.85, green: 0.45, blue: 0.10)

    private var timeLabel: String {
        String(format: "%02d:%02d", recording.seconds / 60, recording.seconds % 60)
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                PulsingDot(active: recording.isRecording)
                    .frame(width: 10, height: 10)
                Text(recording.isPaused ? "Paused" : "Recording")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                Text(timeLabel)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.55))
                Spacer(minLength: 8)
                Button {
                    onStop()
                } label: {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(amber)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.leading, 16)
            .padding(.trailing, 6)
            .frame(height: 52)
            .background(
                RoundedRectangle(cornerRadius: 26, style: .continuous)
                    .fill(Color(red: 0.18, green: 0.14, blue: 0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
                    )
                    .shadow(color: Color.black.opacity(0.45), radius: 18, y: 6)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(recording.isPaused ? "Paused recording" : "Recording in progress")
        .accessibilityHint("Tap to expand, stop button to finish")
    }
}

private struct PulsingDot: View {
    let active: Bool
    @State private var pulse: Bool = false

    var body: some View {
        Circle()
            .fill(Color.red)
            .opacity(active && pulse ? 0.45 : 1.0)
            .scaleEffect(active && pulse ? 1.25 : 1.0)
            .animation(active ? .easeInOut(duration: 0.9).repeatForever(autoreverses: true) : .default, value: pulse)
            .onAppear { pulse = true }
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
