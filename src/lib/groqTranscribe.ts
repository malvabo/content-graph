// Shared Whisper-via-Groq transcription helper. The mobile recording flow
// (VoiceLibrary) and the post-onboarding "Import audio recordings" action both
// run blobs through here so error handling stays in lockstep.

export async function transcribeWithGroq(blob: Blob, apiKey: string): Promise<string> {
  const key = apiKey.trim().replace(/^['"`]+|['"`]+$/g, '');
  console.info('[Groq]', { keyLen: key.length, prefix: key.slice(0, 4), suffix: key.slice(-4), blobBytes: blob.size, blobType: blob.type });
  if (!key) throw new Error('Groq API key missing. Add it in Settings → API Keys → Groq.');
  if (!key.startsWith('gsk_')) {
    throw new Error('That doesn\'t look like a Groq key — it should start with "gsk_". Get one from https://console.groq.com/keys.');
  }
  const form = new FormData();
  form.append('file', blob, blob instanceof File ? blob.name : 'recording.webm');
  form.append('model', 'whisper-large-v3');
  form.append('response_format', 'json');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new Error('Invalid Groq API key. Re-copy it from https://console.groq.com/keys (no quotes, no trailing spaces) and paste into Settings → API Keys → Groq.');
    }
    if (res.status === 429) {
      throw new Error('Groq rate limit hit. Wait a moment and retry.');
    }
    throw new Error(`Groq ${res.status}: ${body || 'transcription failed'}`);
  }
  const data = await res.json();
  return (data.text || '').trim();
}
