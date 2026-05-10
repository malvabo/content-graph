import SwiftUI

// MARK: - Library Models

struct LibraryBundle: Identifiable {
    let id = UUID()
    var name: String
    var sourceCount: Int
    var formats: [OutputFormat]
    var createdAt: Date
}

struct LibraryTemplate: Identifiable {
    let id = UUID()
    var name: String
    var description: String
    var formats: [OutputFormat]
    var category: TemplateCategory
}

enum TemplateCategory: String, CaseIterable, Identifiable {
    case all       = "All"
    case marketing = "Marketing"
    case social    = "Social"
    case longform  = "Long-form"
    case internalUse = "Internal"
    var id: String { rawValue }
}

private enum LibrarySection: String, CaseIterable, Identifiable {
    case bundles   = "Bundles"
    case templates = "Templates"
    var id: String { rawValue }
}

// MARK: - Glass Card (local)

private struct LibraryGlassCard<Content: View>: View {
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

// MARK: - Search Field

private struct LibrarySearchField: View {
    @Binding var query: String
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color.white.opacity(0.4))
            TextField("", text: $query, prompt: Text("Search bundles and templates")
                .foregroundColor(Color.white.opacity(0.3))
            )
            .font(.system(size: 15))
            .foregroundColor(.white)
            .focused($focused)
            .submitLabel(.search)
            .autocapitalization(.none)
            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 15))
                        .foregroundColor(Color.white.opacity(0.3))
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
        )
    }
}

// MARK: - Segmented Control

private struct LibrarySegmented: View {
    @Binding var section: LibrarySection
    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        HStack(spacing: 0) {
            ForEach(LibrarySection.allCases) { item in
                let isSelected = section == item
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    withAnimation(.easeOut(duration: 0.18)) { section = item }
                } label: {
                    Text(item.rawValue)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(isSelected ? .white : Color.white.opacity(0.5))
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                        .background(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(isSelected ? Color.white.opacity(0.10) : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 0.5)
        )
    }
}

// MARK: - Format Stack

/// Overlapping circular icon stack — used in bundle rows to show contained
/// output formats at a glance.
private struct FormatStack: View {
    let formats: [OutputFormat]
    var max: Int = 4
    var size: CGFloat = 26

    var body: some View {
        let visible = Array(formats.prefix(max))
        let overflow = formats.count - visible.count

        HStack(spacing: -8) {
            ForEach(Array(visible.enumerated()), id: \.offset) { _, format in
                ZStack {
                    Circle()
                        .fill(Color(red: 0.16, green: 0.13, blue: 0.11))
                    Circle()
                        .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                    Image(systemName: format.icon)
                        .font(.system(size: size * 0.45, weight: .medium))
                        .foregroundColor(Color.white.opacity(0.7))
                }
                .frame(width: size, height: size)
            }

            if overflow > 0 {
                ZStack {
                    Circle()
                        .fill(Color(red: 0.16, green: 0.13, blue: 0.11))
                    Circle()
                        .stroke(Color.white.opacity(0.10), lineWidth: 0.5)
                    Text("+\(overflow)")
                        .font(.system(size: size * 0.40, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.6))
                }
                .frame(width: size, height: size)
            }
        }
    }
}

// MARK: - Bundle Row

private struct BundleRow: View {
    let bundle: LibraryBundle
    var onTap: () -> Void

    private var dateLabel: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: bundle.createdAt, relativeTo: Date())
    }

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onTap()
        } label: {
            LibraryGlassCard {
                HStack(spacing: 12) {
                    FormatStack(formats: bundle.formats)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(bundle.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(Color.white.opacity(0.9))
                            .lineLimit(1)
                            .truncationMode(.tail)
                        HStack(spacing: 6) {
                            Text("\(bundle.formats.count) output\(bundle.formats.count == 1 ? "" : "s")")
                            Text("·")
                            Text("\(bundle.sourceCount) source\(bundle.sourceCount == 1 ? "" : "s")")
                            Text("·")
                            Text(dateLabel)
                        }
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.45))
                        .lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.3))
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button { /* duplicate */ } label: {
                Label("Duplicate", systemImage: "doc.on.doc")
            }
            Button { /* rename */ } label: {
                Label("Rename", systemImage: "pencil")
            }
            Divider()
            Button(role: .destructive) { /* delete */ } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

// MARK: - Bundles List

private struct BundlesList: View {
    let bundles: [LibraryBundle]
    var onOpen: (LibraryBundle) -> Void

    private var grouped: [(String, [LibraryBundle])] {
        let cal = Calendar.current
        let now = Date()
        var today: [LibraryBundle] = []
        var thisWeek: [LibraryBundle] = []
        var earlier: [LibraryBundle] = []

        for bundle in bundles.sorted(by: { $0.createdAt > $1.createdAt }) {
            if cal.isDateInToday(bundle.createdAt) || cal.isDateInYesterday(bundle.createdAt) {
                today.append(bundle)
            } else if let days = cal.dateComponents([.day], from: bundle.createdAt, to: now).day, days < 7 {
                thisWeek.append(bundle)
            } else {
                earlier.append(bundle)
            }
        }

        var sections: [(String, [LibraryBundle])] = []
        if !today.isEmpty    { sections.append(("Today", today)) }
        if !thisWeek.isEmpty { sections.append(("This week", thisWeek)) }
        if !earlier.isEmpty  { sections.append(("Earlier", earlier)) }
        return sections
    }

    var body: some View {
        if bundles.isEmpty {
            EmptyState(
                icon: "tray",
                title: "No bundles yet",
                subtitle: "Bundles you generate will appear here."
            )
            .padding(.top, 60)
        } else {
            VStack(spacing: 20) {
                ForEach(grouped, id: \.0) { (title, items) in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(title)
                            .font(.system(size: 12, weight: .semibold))
                            .tracking(0.8)
                            .foregroundColor(Color.white.opacity(0.4))
                            .textCase(.uppercase)
                            .padding(.horizontal, 4)
                        VStack(spacing: 8) {
                            ForEach(items) { bundle in
                                BundleRow(bundle: bundle) { onOpen(bundle) }
                            }
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Template Card

private struct TemplateCard: View {
    let template: LibraryTemplate
    var onUse: () -> Void

    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            onUse()
        } label: {
            LibraryGlassCard {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        FormatStack(formats: template.formats, max: 3, size: 22)
                        Spacer()
                        Text(template.category.rawValue)
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.6)
                            .foregroundColor(Color.white.opacity(0.5))
                            .textCase(.uppercase)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Color.white.opacity(0.06))
                            .clipShape(Capsule())
                    }

                    Text(template.name)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color.white.opacity(0.9))
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Text(template.description)
                        .font(.system(size: 12))
                        .foregroundColor(Color.white.opacity(0.5))
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Spacer(minLength: 0)

                    HStack(spacing: 4) {
                        Text("\(template.formats.count) output\(template.formats.count == 1 ? "" : "s")")
                            .font(.system(size: 11))
                            .foregroundColor(Color.white.opacity(0.4))
                        Spacer()
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(accent.opacity(0.8))
                    }
                }
                .padding(14)
                .frame(height: 180, alignment: .top)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Category Chip Row

private struct CategoryChipRow: View {
    @Binding var selected: TemplateCategory
    private let accent = Color(red: 0.05, green: 0.75, blue: 0.35)

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TemplateCategory.allCases) { category in
                    let isSelected = selected == category
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        withAnimation(.easeOut(duration: 0.15)) { selected = category }
                    } label: {
                        Text(category.rawValue)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(isSelected ? accent : Color.white.opacity(0.6))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(
                                Capsule()
                                    .fill(isSelected ? accent.opacity(0.12) : Color.white.opacity(0.06))
                                    .overlay(
                                        Capsule().stroke(
                                            isSelected ? accent.opacity(0.4) : Color.white.opacity(0.08),
                                            lineWidth: 0.5
                                        )
                                    )
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - Templates Grid

private struct TemplatesGrid: View {
    let templates: [LibraryTemplate]
    @Binding var category: TemplateCategory
    var onUse: (LibraryTemplate) -> Void

    private var filtered: [LibraryTemplate] {
        category == .all ? templates : templates.filter { $0.category == category }
    }

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CategoryChipRow(selected: $category)

            if filtered.isEmpty {
                EmptyState(
                    icon: "rectangle.on.rectangle",
                    title: "No templates",
                    subtitle: "Try a different category."
                )
                .padding(.top, 60)
            } else {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(filtered) { template in
                        TemplateCard(template: template) { onUse(template) }
                    }
                }
            }
        }
    }
}

// MARK: - Empty State

private struct EmptyState: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 28, weight: .light))
                .foregroundColor(Color.white.opacity(0.35))
                .frame(width: 60, height: 60)
                .background(Color.white.opacity(0.05))
                .clipShape(Circle())
            Text(title)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(Color.white.opacity(0.75))
            Text(subtitle)
                .font(.system(size: 13))
                .foregroundColor(Color.white.opacity(0.4))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
    }
}

// MARK: - Library View

struct LibraryView: View {
    @State var bundles: [LibraryBundle]
    @State var templates: [LibraryTemplate]
    var onOpenBundle: ((LibraryBundle) -> Void)? = nil
    var onUseTemplate: ((LibraryTemplate) -> Void)? = nil

    @State private var section: LibrarySection = .bundles
    @State private var category: TemplateCategory = .all
    @State private var query: String = ""

    private var filteredBundles: [LibraryBundle] {
        guard !query.isEmpty else { return bundles }
        return bundles.filter { $0.name.localizedCaseInsensitiveContains(query) }
    }

    private var filteredTemplates: [LibraryTemplate] {
        guard !query.isEmpty else { return templates }
        return templates.filter {
            $0.name.localizedCaseInsensitiveContains(query) ||
            $0.description.localizedCaseInsensitiveContains(query)
        }
    }

    var body: some View {
        ZStack {
            Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.55, green: 0.30, blue: 0.08).opacity(0.30), .clear],
                center: .init(x: 0.05, y: 0.05),
                startRadius: 0, endRadius: 380
            ).ignoresSafeArea()
            RadialGradient(
                colors: [Color(red: 0.05, green: 0.35, blue: 0.15).opacity(0.22), .clear],
                center: .init(x: 1.0, y: 0.85),
                startRadius: 0, endRadius: 320
            ).ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 14) {
                    HStack {
                        Text("Library")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.white)
                        Spacer()
                    }
                    .padding(.top, 8)

                    LibrarySearchField(query: $query)
                    LibrarySegmented(section: $section)

                    Group {
                        switch section {
                        case .bundles:
                            BundlesList(bundles: filteredBundles) { bundle in
                                onOpenBundle?(bundle)
                            }
                        case .templates:
                            TemplatesGrid(
                                templates: filteredTemplates,
                                category: $category
                            ) { template in
                                onUseTemplate?(template)
                            }
                        }
                    }
                    .padding(.top, 4)
                    .padding(.bottom, 40)
                }
                .padding(.horizontal, 16)
            }
            .scrollDismissesKeyboard(.immediately)
        }
        .onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil, from: nil, for: nil
            )
        }
    }
}

// MARK: - Sample Data

private let sampleBundles: [LibraryBundle] = [
    LibraryBundle(
        name: "Q3 launch announcement",
        sourceCount: 3,
        formats: [.linkedinPost, .twitterThread, .newsletter, .blogPost, .email],
        createdAt: Date()
    ),
    LibraryBundle(
        name: "Founder podcast — episode 14",
        sourceCount: 2,
        formats: [.summary, .twitterThread, .quoteCard],
        createdAt: Date().addingTimeInterval(-3600 * 4)
    ),
    LibraryBundle(
        name: "Weekly customer insights",
        sourceCount: 5,
        formats: [.newsletter, .slackMessage],
        createdAt: Date().addingTimeInterval(-3600 * 30)
    ),
    LibraryBundle(
        name: "Conference talk repurpose",
        sourceCount: 1,
        formats: [.linkedinPost, .twitterThread, .blogPost, .youtubeScript, .quoteCard],
        createdAt: Date().addingTimeInterval(-3600 * 24 * 5)
    ),
    LibraryBundle(
        name: "Hiring announcement",
        sourceCount: 1,
        formats: [.linkedinPost, .twitterSingle],
        createdAt: Date().addingTimeInterval(-3600 * 24 * 18)
    ),
]

private let sampleTemplates: [LibraryTemplate] = [
    LibraryTemplate(
        name: "Product launch",
        description: "Long-form announcement, social teasers, and an internal Slack note from a single brief.",
        formats: [.blogPost, .linkedinPost, .twitterThread, .slackMessage, .email],
        category: .marketing
    ),
    LibraryTemplate(
        name: "Podcast repurpose",
        description: "Turn one episode into a thread, a quote card, and a newsletter recap.",
        formats: [.twitterThread, .quoteCard, .newsletter, .summary],
        category: .longform
    ),
    LibraryTemplate(
        name: "Conference talk",
        description: "Repackage a keynote into a blog post, social pulls, and a YouTube script.",
        formats: [.blogPost, .twitterThread, .youtubeScript, .linkedinPost],
        category: .longform
    ),
    LibraryTemplate(
        name: "Weekly newsletter",
        description: "Round up the week's wins, learnings, and links into a sendable draft.",
        formats: [.newsletter, .summary],
        category: .marketing
    ),
    LibraryTemplate(
        name: "Hiring spotlight",
        description: "Announce an open role or new hire across LinkedIn and a single tweet.",
        formats: [.linkedinPost, .twitterSingle],
        category: .social
    ),
    LibraryTemplate(
        name: "All-hands recap",
        description: "Distill a meeting transcript into Slack updates and an internal memo.",
        formats: [.slackMessage, .summary, .email],
        category: .internalUse
    ),
]

// MARK: - Previews

#Preview("Library") {
    LibraryView(bundles: sampleBundles, templates: sampleTemplates)
        .preferredColorScheme(.dark)
}

#Preview("Empty") {
    LibraryView(bundles: [], templates: sampleTemplates)
        .preferredColorScheme(.dark)
}
