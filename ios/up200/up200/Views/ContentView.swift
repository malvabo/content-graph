import SwiftUI

enum AppTab: String, CaseIterable {
    case library, workflow, voice, script

    var label: String {
        switch self {
        case .library:  return "Library"
        case .workflow: return "Workflow"
        case .voice:    return "Voice"
        case .script:   return "Script"
        }
    }

    var icon: String {
        switch self {
        case .library:  return "square.grid.2x2"
        case .workflow: return "arrow.triangle.branch"
        case .voice:    return "mic"
        case .script:   return "doc.text"
        }
    }

    // URL fragment used both for web→native onNavigate matching and native→web JS navigation.
    // .library is matched by onNavigate but never sent via JS (HomeView is native-only).
    var urlFragment: String {
        switch self {
        case .library:  return "#library"
        case .workflow: return "#workflow"
        case .voice:    return "#voice"
        case .script:   return "#scriptsense"
        }
    }
}

struct ContentView: View {
    @State private var selectedTab: AppTab = .library
    @State private var isLoading = true
    @State private var showSplash = true
    // Incrementing these signals retap scroll-to-top for Library and web tabs respectively.
    @State private var homeScrollToTop = 0
    @State private var webScrollToTop = 0

    private let baseURL = URL(string: "https://content-graph-five.vercel.app/")!

    var body: some View {
        ZStack {
            Color(red: 17/255, green: 17/255, blue: 20/255)
                .ignoresSafeArea()

            if showSplash {
                LaunchView()
                    .transition(.opacity)
            } else {
                ZStack {
                    WebView(
                        url: baseURL,
                        isLoading: $isLoading,
                        selectedTab: selectedTab,
                        scrollToTopSignal: webScrollToTop
                    ) { view in
                        if let tab = AppTab.allCases.first(where: { $0.urlFragment.contains(view) }) {
                            selectedTab = tab
                        }
                    }
                    .ignoresSafeArea(edges: .top)
                    .opacity(selectedTab == .library ? 0 : 1)
                    .allowsHitTesting(selectedTab != .library)

                    if selectedTab == .library {
                        HomeView(
                            onNewWorkflow: { selectedTab = .workflow },
                            scrollToTopSignal: homeScrollToTop
                        )
                        .transition(.opacity)
                    }

                    // Loading bar overlaid at the top edge — no layout shift
                    if isLoading && selectedTab != .library {
                        VStack {
                            ProgressView()
                                .progressViewStyle(.linear)
                                .tint(Color(red: 13/255, green: 191/255, blue: 90/255))
                            Spacer()
                        }
                    }
                }
                // safeAreaInset overlays the tab bar above the content and adjusts the
                // SwiftUI safe area so ScrollViews scroll correctly without manual padding.
                .safeAreaInset(edge: .bottom) {
                    NativeTabBar(selected: $selectedTab) { retappedTab in
                        if retappedTab == .library {
                            homeScrollToTop += 1
                        } else {
                            webScrollToTop += 1
                        }
                    }
                }
            }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation(.easeOut(duration: 0.3)) {
                    showSplash = false
                }
            }
        }
    }
}

struct NativeTabBar: View {
    @Binding var selected: AppTab
    var onSameTabTap: ((AppTab) -> Void)?
    let accent = Color(red: 13/255, green: 191/255, blue: 90/255)

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
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
                            .font(.system(size: 20, weight: .medium))
                        Text(tab.label)
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(selected == tab ? accent : Color.white.opacity(0.45))
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                }
            }
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
                    .fill(Color.white.opacity(0.12))
                    .frame(height: 0.5)
            }
        }
    }
}

struct LaunchView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("up")
                .font(.system(size: 32, weight: .semibold, design: .rounded))
                .foregroundColor(.white)
            ProgressView()
                .tint(Color(red: 13/255, green: 191/255, blue: 90/255))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 17/255, green: 17/255, blue: 20/255))
    }
}

#Preview {
    ContentView()
}
