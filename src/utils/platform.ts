// Detect when the web app is running inside the native iOS WKWebView wrapper.
// The wrapper (ios/up200) registers a "nativeBridge" message handler, so its
// presence on window.webkit.messageHandlers is a reliable in-app signal.
export function isIosApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    webkit?: { messageHandlers?: Record<string, unknown> };
  };
  return !!w.webkit?.messageHandlers?.nativeBridge;
}
