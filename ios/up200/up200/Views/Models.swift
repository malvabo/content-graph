import Foundation

struct VoiceNote: Identifiable {
    var id = UUID()
    var title: String
    var body: String
    var date: Date
}
