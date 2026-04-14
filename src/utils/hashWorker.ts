// Web Worker for SHA-256 hashing
self.onmessage = async (e: MessageEvent<{ id: number; data: string }>) => {
  const buf = new TextEncoder().encode(e.data.data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hex = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  self.postMessage({ id: e.data.id, hash: hex });
};
