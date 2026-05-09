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

// MARK: - Templates View

struct TemplatesView: View {
    private let templates: [(title: String, subtitle: String, icon: String)] = [
        ("Landing page",      "Structured hero + sections copy",   "doc.richtext"),
        ("Short note",        "Concise single-topic summary",       "note.text"),
        ("Newsletter",        "300–500 word scannable digest",      "envelope"),
        ("LinkedIn post",     "150–300 word hook post",             "person.crop.rectangle"),
        ("Twitter thread",    "5–10 tweet thread",                  "text.bubble"),
        ("Brand story",       "Rewrite with consistent voice",      "sparkles"),
        ("Marketing pack",    "Social, email and ad copy",          "megaphone"),
        ("Review document",   "Key decisions and action items",     "checkmark.circle"),
    ]

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 0) {
                Text("Templates")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(Color.white.opacity(0.88))
                    .padding(.horizontal, 20)
                    .padding(.top, 28)
                    .padding(.bottom, 20)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(templates, id: \.title) { tpl in
                        Button {} label: {
                            VStack(alignment: .leading, spacing: 10) {
                                Image(systemName: tpl.icon)
                                    .font(.system(size: 18, weight: .light))
                                    .foregroundColor(Color.white.opacity(0.70))
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(tpl.title)
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundColor(Color.white.opacity(0.86))
                                        .multilineTextAlignment(.leading)
                                    Text(tpl.subtitle)
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
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 32)
            }
        }
        .background(Color(red: 0.10, green: 0.08, blue: 0.07).ignoresSafeArea())
    }
}

// MARK: - Content View

struct ContentView: View {
    @State private var selectedTab: AppTab = .home
    @State private var showSplash = true
    @State private var homeScrollToTop = 0
    @State private var showImport = false

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
                        HomeView(scrollToTopSignal: homeScrollToTop)
                    case .library:
                        VoiceNotesView()
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
            ImportSheetView { _ in }
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

            // Plus button — right side
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
