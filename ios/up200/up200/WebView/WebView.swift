import AVFoundation
import SwiftUI
import WebKit

// WKUserContentController retains its message handler strongly, creating a cycle.
// This proxy holds a weak reference to break it.
private class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: (NSObject & WKScriptMessageHandler)?
    init(_ target: NSObject & WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool
    var scrollToTopSignal: Int = 0
    var workflowBuildPayload: String? = nil
    var onNavigate: ((String) -> Void)?

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        // Keep audio playing through screen lock — the default .soloAmbient
        // category silences playback on lock.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: .mixWithOthers)
        try? session.setActive(true)

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let controller = WKUserContentController()
        controller.add(WeakMessageHandler(context.coordinator), name: "nativeBridge")

        let script = WKUserScript(source: """
            const meta = document.createElement('meta');
            meta.name = 'viewport';
            meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
            document.head.appendChild(meta);

            const style = document.createElement('style');
            style.textContent = `
                body { -webkit-touch-callout: none; overscroll-behavior: none; }
                :root { --safe-top: env(safe-area-inset-top); --safe-bottom: env(safe-area-inset-bottom); }
            `;
            document.head.appendChild(style);
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        controller.addUserScript(script)
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = true
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh(_:)), for: .valueChanged)
        refresh.tintColor = UIColor.white.withAlphaComponent(0.6)
        webView.scrollView.refreshControl = refresh

        context.coordinator.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Scroll to top when the user retaps the current tab.
        if scrollToTopSignal != context.coordinator.lastScrollToTopSignal {
            context.coordinator.lastScrollToTopSignal = scrollToTopSignal
            webView.evaluateJavaScript("window.scrollTo({top: 0, behavior: 'smooth'})") { _, _ in }
        }

        // Forward native workflow build payload into the web app via postMessage.
        if let payload = workflowBuildPayload, payload != context.coordinator.lastWorkflowPayload {
            context.coordinator.lastWorkflowPayload = payload
            webView.evaluateJavaScript("window.postMessage(\(payload), '*')") { _, _ in }
        }
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: WebView
        weak var webView: WKWebView?
        var lastScrollToTopSignal: Int = 0
        var lastWorkflowPayload: String? = nil

        init(_ parent: WebView) { self.parent = parent }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            parent.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            parent.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            parent.isLoading = false
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if let url = navigationAction.request.url,
               navigationAction.navigationType == .linkActivated,
               url.host != "content-graph-five.vercel.app" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }

            switch action {
            case "navigate":
                if let view = body["view"] as? String {
                    parent.onNavigate?(view)
                }
            case "haptic":
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
            default: break
            }
        }

        @objc func handleRefresh(_ sender: UIRefreshControl) {
            webView?.reload()
            // endRefreshing is called from didFinish / didFail
        }
    }
}
