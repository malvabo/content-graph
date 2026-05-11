import SwiftUI

extension Font {
    static func app(size: CGFloat, weight: Weight = .regular) -> Font {
        .custom("ABCDiatypeVariableUnlicensedTrial-Regular", size: size)
            .weight(weight)
    }
}
