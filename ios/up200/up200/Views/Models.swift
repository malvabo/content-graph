import Foundation

struct VoiceNote: Identifiable, Codable {
    var id = UUID()
    var title: String
    var body: String
    var date: Date
}

struct GenerationProject: Identifiable, Codable {
    var id = UUID()
    var title: String
    var outputType: String
    var preview: String
    var content: String = ""
    var date: Date
}

struct CustomTemplate: Identifiable, Codable {
    var id = UUID()
    var title: String
    var subtitle: String
}
