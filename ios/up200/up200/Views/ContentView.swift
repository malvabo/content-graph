import SwiftUI

enum AppTab: String, CaseIterable {
    case library, workflow, voice, script

    var label: String {
        switch self {
        case .library: return "Library"
        case .workflow: return "Workflow"
        case .voice: return "Voice"
        case .script: return "Script"
        }
    }

    var icon: String {
        switch self {
        case .library: return "book.closed"
        case .workflow: return "square.grid.2x2"
        case .voice: return "mic"
        case .script: return "doc.text"
        }
    }

    var hash: String {
        switch self {
        case .library: return "#library"
        case .workflow: return "#workflow"
        case .voice: return "#voice"
        case .script: return "#scriptsense"
        }
    }
}

struct ContentView: View {
    @State private var selectedTab: AppTab = .library
    @State private var isLoading = true
    @State private var showSplash = true

    private let baseURL = URL(string: "https://content-graph-five.vercel.app/")!

    var body: some View {
        ZStack {
            Color(red: 17/255, green: 17/255, blue: 20/255)
                .ignoresSafeArea()

            if showSplash {
                LaunchView()
                    .transition(.opacity)
            } else {
                VStack(spacing: 0) {
                    // Web content
                    WebView(url: baseURL, isLoading: $isLoading) { view in
                        if let tab = AppTab.allCases.first(where: { $0.hash.contains(view) }) {
                            selectedTab = tab
                        }
                    }
                    .ignoresSafeArea(edges: .top)

                    // Loading bar
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(.linear)
                            .tint(Color(red: 13/255, green: 191/255, blue: 90/255))
                    }

                    // Native tab bar
                    NativeTabBar(selected: $selectedTab)
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
    let accent = Color(red: 13/255, green: 191/255, blue: 90/255)

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases, id: \.self) { tab in
                Button {
                    let feedback = UIImpactFeedbackGenerator(style: .light)
                    feedback.impactOccurred()
                    selected = tab
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 20, weight: .medium))
                        Text(tab.label)
                            .font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(selected == tab ? accent : Color.gray.opacity(0.6))
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                }
            }
        }
        .padding(.top, 8)
        .padding(.bottom, 2)
        .background {
            Rectangle()
                .fill(Color(red: 28/255, green: 28/255, blue: 31/255))
                .overlay(alignment: .top) {
                    Rectangle().fill(Color.white.opacity(0.08)).frame(height: 0.5)
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
