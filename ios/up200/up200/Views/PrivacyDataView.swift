import SwiftUI
import UniformTypeIdentifiers

// MARK: - Privacy & Data page (App Store requirement: account deletion + data export)

struct PrivacyDataView: View {
    @Environment(\.dismiss) private var dismiss
    @AppStorage("onboarding_complete") private var onboardingComplete = false

    @State private var showDeleteConfirm = false
    @State private var showShareSheet = false
    @State private var exportURL: URL? = nil
    @State private var isExporting = false
    @State private var exportFailed = false

    private let bg = AppBackground.primary
    private let destructiveRed = Color(red: 0.95, green: 0.40, blue: 0.32)

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    dismiss()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(AppText.primary)
                        .frame(width: 36, height: 36)
                        .background(AppInk.solid(0.08))
                        .clipShape(Circle())
                        .frame(minWidth: 44, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Text("Privacy & Data")
                    .font(.appBodyBold)
                    .foregroundColor(AppText.primary)
                    .lineLimit(1)

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .padding(.bottom, 12)

            List {
                privacyRow(
                    title: isExporting ? "Preparing export…" : "Export my data",
                    trailingIcon: isExporting ? nil : "square.and.arrow.up",
                    titleColor: AppText.primary,
                    trailingColor: AppText.tertiary
                ) {
                    guard !isExporting else { return }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    exportData()
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparatorTint(AppInk.solid(0.06))
                .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }

                privacyRow(
                    title: "Delete all my data",
                    trailingIcon: "trash",
                    titleColor: destructiveRed,
                    trailingColor: destructiveRed
                ) {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showDeleteConfirm = true
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparatorTint(AppInk.solid(0.06))
                .alignmentGuide(.listRowSeparatorLeading) { _ in 20 }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)

            Text("Notes and generated content are stored on this device. Export downloads a copy as JSON. Deleting removes all local data and signs you out.")
                .font(.appSmall)
                .foregroundColor(AppText.muted)
                .multilineTextAlignment(.leading)
                .padding(.horizontal, 20)
                .padding(.top, 4)
                .padding(.bottom, 24)
        }
        .background(bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .toolbarBackground(.hidden, for: .navigationBar)
        .swipeBackGesture { dismiss() }
        .sheet(isPresented: $showShareSheet, onDismiss: cleanupExportFile) {
            if let url = exportURL {
                ExportShareSheet(url: url)
            }
        }
        .alert("Delete all data?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete everything", role: .destructive) {
                deleteAllData()
            }
        } message: {
            Text("This permanently deletes all notes, generated content, and templates from this device and signs you out. This cannot be undone.")
        }
        .alert("Export failed", isPresented: $exportFailed) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Could not prepare your data for export. Please try again.")
        }
    }

    // MARK: Row

    @ViewBuilder
    private func privacyRow(
        title: String,
        trailingIcon: String?,
        titleColor: Color,
        trailingColor: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Text(title)
                    .font(.appRowTitle)
                    .foregroundColor(titleColor)
                Spacer(minLength: 8)
                if let icon = trailingIcon {
                    Image(systemName: icon)
                        .font(.system(size: 16, weight: .regular))
                        .foregroundColor(trailingColor)
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: Export

    private func exportData() {
        isExporting = true
        Task {
            let url = await buildExportFile()
            await MainActor.run {
                isExporting = false
                if let url {
                    exportURL = url
                    showShareSheet = true
                } else {
                    exportFailed = true
                }
            }
        }
    }

    private func buildExportFile() async -> URL? {
        let notes = await NotesStore.loadAsync()
        let generations = MinimalGenStore.load()
        let libraryData = UserDefaults.standard.data(forKey: "library_projects") ?? Data()
        let libraryProjects = (try? JSONDecoder().decode([GenerationProject].self, from: libraryData)) ?? []

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        let notesJSON = (try? encoder.encode(notes)).flatMap {
            try? JSONSerialization.jsonObject(with: $0)
        } ?? []
        let generationsJSON = (try? encoder.encode(generations)).flatMap {
            try? JSONSerialization.jsonObject(with: $0)
        } ?? []
        let libraryJSON = (try? encoder.encode(libraryProjects)).flatMap {
            try? JSONSerialization.jsonObject(with: $0)
        } ?? []

        let payload: [String: Any] = [
            "exported_at": ISO8601DateFormatter().string(from: Date()),
            "notes": notesJSON,
            "generations": generationsJSON,
            "library_projects": libraryJSON
        ]

        guard let data = try? JSONSerialization.data(
            withJSONObject: payload,
            options: [.prettyPrinted, .sortedKeys]
        ) else { return nil }

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("oula-data-\(df.string(from: Date())).json")
        do {
            try data.write(to: url)
            return url
        } catch {
            return nil
        }
    }

    private func cleanupExportFile() {
        if let url = exportURL {
            try? FileManager.default.removeItem(at: url)
            exportURL = nil
        }
    }

    // MARK: Delete

    private func deleteAllData() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: NotesStore.key)
        defaults.removeObject(forKey: MinimalGenStore.key)
        defaults.removeObject(forKey: "library_projects")
        defaults.removeObject(forKey: "custom_templates")
        defaults.removeObject(forKey: "apple_user_id")
        defaults.removeObject(forKey: "apple_auth_email")
        defaults.removeObject(forKey: "apple_auth_full_name")
        KeychainService.delete()
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        onboardingComplete = false
    }
}

// MARK: - UIActivityViewController bridge

private struct ExportShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
