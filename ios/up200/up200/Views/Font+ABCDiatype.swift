import SwiftUI

extension Font {
    static func app(size: CGFloat, weight: Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }
}
