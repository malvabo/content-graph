import SwiftUI

enum AppTab: String, CaseIterable {
    case library, voice, script

    var label: String {
        switch self {
        case .library: return "Library"
        case .voice:   return "Voice"
        case .script:  return "Script"
        }
    }

    var icon: String {
        switch self {
        case .library: return "square.grid.2x2"
        case .voice:   return "mic"
        case .script:  return "doc.text"
        }
    }

    var urlFragment: String {
        switch self {
        case .library: return "#library"
        case .voice:   return "#voice"
        case .script:  return "#scriptsense"
        }
    }
}

struct ContentView: View {
    @State private var selectedTab: AppTab = .library
    @State private var isLoading = true
    @State private var showSplash = true
    @State private var homeScrollToTop = 0
    @State private var webScrollToTop = 0
    @State private var voiceNotes: [VoiceNote] = []
    @State private var showNewNote = false
    @State private var draftNote = VoiceNote(title: "", body: "", date: Date())

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
                    .opacity(selectedTab == .script ? 1 : 0)
                    .allowsHitTesting(selectedTab == .script)

                    if selectedTab == .library {
                        HomeView(scrollToTopSignal: homeScrollToTop)
                            .transition(.opacity)
                    }

                    if selectedTab == .voice {
                        VoiceNotesView(notes: $voiceNotes)
                            .transition(.opacity)
                    }

                    if isLoading && selectedTab == .script {
                        VStack {
                            ProgressView()
                                .progressViewStyle(.linear)
                                .tint(Color.white.opacity(0.6))
                            Spacer()
                        }
                    }
                }
                .safeAreaInset(edge: .bottom) {
                    NativeTabBar(selected: $selectedTab, onSameTabTap: { tab in
                        if tab == .library {
                            homeScrollToTop += 1
                        } else {
                            webScrollToTop += 1
                        }
                    }, onAdd: {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        draftNote = VoiceNote(title: "", body: "", date: Date())
                        showNewNote = true
                    })
                }
            }
        }
        .sheet(isPresented: $showNewNote) {
            NoteEditorView(note: $draftNote) {
                if !draftNote.title.isEmpty || !draftNote.body.isEmpty {
                    voiceNotes.insert(draftNote, at: 0)
                    selectedTab = .voice
                }
                showNewNote = false
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
    var onAdd: () -> Void
    let accent = Color.white

    var body: some View {
        HStack(spacing: 0) {
            tabItem(.library)

            Button(action: onAdd) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.10))
                        .overlay(Circle().stroke(Color.white.opacity(0.16), lineWidth: 0.5))
                        .frame(width: 46, height: 46)
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundColor(.white)
                }
            }
            .buttonStyle(.plain)
            .frame(maxWidth: .infinity)
            .frame(height: 50)

            tabItem(.voice)
            tabItem(.script)
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
