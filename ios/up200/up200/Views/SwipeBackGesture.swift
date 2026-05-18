import SwiftUI
import UIKit

/// Re-implements iOS's "swipe from the left edge to go back" interactive
/// pop gesture for screens that hide the native nav-bar back button.
///
/// `navigationBarBackButtonHidden(true)` (and a fully-hidden toolbar)
/// suppresses the system gesture along with the chevron. Several screens
/// here ship a custom chevron in place of the native bar; this modifier
/// restores the muscle-memory edge swipe on those screens.
///
/// The gesture only fires when the drag starts within the leftmost
/// `edgeWidth` of the window, then travels a mostly-horizontal distance
/// to the right past `triggerDistance`.
private struct SwipeBackGestureModifier: ViewModifier {
    let action: () -> Void

    private let edgeWidth: CGFloat = 24
    private let triggerDistance: CGFloat = 60

    @State private var startedAtLeftEdge: Bool? = nil

    func body(content: Content) -> some View {
        content
            .simultaneousGesture(
                DragGesture(minimumDistance: 12, coordinateSpace: .global)
                    .onChanged { value in
                        if startedAtLeftEdge == nil {
                            startedAtLeftEdge = value.startLocation.x <= edgeWidth
                        }
                    }
                    .onEnded { value in
                        let fromEdge = startedAtLeftEdge ?? false
                        startedAtLeftEdge = nil
                        guard fromEdge else { return }
                        let dx = value.translation.width
                        let dy = abs(value.translation.height)
                        guard dx > triggerDistance, dx > dy * 1.5 else { return }
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        action()
                    }
            )
    }
}

extension View {
    /// Adds an iOS-style left-edge swipe-to-go-back gesture that fires
    /// `action` (typically `dismiss()`) when the user drags right from the
    /// left edge. Pair with the custom chevron back button on screens that
    /// hide the system nav-bar back button.
    func swipeBackGesture(_ action: @escaping () -> Void) -> some View {
        modifier(SwipeBackGestureModifier(action: action))
    }
}
