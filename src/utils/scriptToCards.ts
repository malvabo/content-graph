import { useSettingsStore } from '../store/settingsStore';
import { useCardsStore } from '../store/cardsStore';

const PROMPT = (script: string) => `You are breaking a talk script into memory cards for a speaker.

Each card = one major section of the talk.
If the talk has 5 sections, return 5 cards. No more.

Each card contains only what the speaker needs to glance at to unlock that section.
Not a summary. Not the full content. Just the anchor.

Rules:
- title: 2–4 words. Verbatim sections (hook, close) get a ★ prefix.
- anchor: one sentence only — the core idea that unlocks this section
- keywords: 2–4 load-bearing words, dot-separated

Return ONLY valid JSON array — no markdown fences, no explanation:
[
  { "title": "★ The Hook", "anchor": "one sentence", "keywords": "word · word · word" }
]

Script:
${script}`;

export async function fetchScriptCards(script: string, signal?: AbortSignal): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const prompt = PROMPT(script);

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  throw new Error('No API key configured. Add one in Settings.');
}

export function parseScriptCards(raw: string) {
  const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim();
  const parsed: { title?: string; anchor?: string; keywords?: string }[] = JSON.parse(cleaned);
  return parsed.map((item, i) => ({
    id: `c${Date.now().toString(36)}-${i}`,
    headline: item.title ?? `Card ${i + 1}`,
    body: [
      item.anchor,
      item.keywords ? `<span style="opacity:0.6;font-size:0.9em">${item.keywords}</span>` : '',
    ].filter(Boolean).join('<br>'),
  }));
}

export async function generateAndSaveCards(text: string, name: string, signal?: AbortSignal): Promise<string> {
  const raw = await fetchScriptCards(text, signal);
  const cards = parseScriptCards(raw);
  if (cards.length === 0) return '';
  const id = `cards-${Date.now()}`;
  useCardsStore.getState().add({ id, name, cards, createdAt: new Date().toISOString() });
  return id;
}
