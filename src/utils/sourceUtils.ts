import { useSettingsStore } from '../store/settingsStore';

export async function generateSourceTitle(text: string): Promise<string> {
  const { groqKey } = useSettingsStore.getState();
  const prompt = `Give this text a concise 3–6 word title that captures the main topic. Return ONLY the title — no quotes, no punctuation, no explanation.\n\nText: ${text.slice(0, 600)}`;

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey.trim()}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 20, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) { const t = (await res.json()).choices?.[0]?.message?.content?.trim(); if (t) return t; }
    } catch { /* fall through */ }
  }

  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 20, messages: [{ role: 'user', content: prompt }] }),
    });
    if (res.ok) { const t = (await res.json()).content?.[0]?.text?.trim(); if (t) return t; }
  } catch { /* fall through */ }

  return text.trim().split(/\s+/).slice(0, 5).join(' ');
}
