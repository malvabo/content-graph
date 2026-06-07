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
  const prompt = PROMPT(script);

  const res = await fetch('/api/claude', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// `body` ends up in dangerouslySetInnerHTML via CardsPanel, so anything from
// the LLM has to be escaped — a prompt-injected script could otherwise hand
// us "<img onerror=...>" inside a keyword or anchor and that would execute.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function parseScriptCards(raw: string) {
  const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim();
  let parsed: { title?: string; anchor?: string; keywords?: string }[];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item, i) => ({
    id: `c${Date.now().toString(36)}-${i}`,
    headline: item.title ?? `Card ${i + 1}`,
    body: [
      item.anchor ? escapeHtml(item.anchor) : '',
      item.keywords ? `<span class="card-tags">${item.keywords.split(/\s*·\s*|\s*•\s*/).filter(Boolean).map((t: string) => `<span class="card-tag">${escapeHtml(t.trim())}</span>`).join('')}</span>` : '',
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
