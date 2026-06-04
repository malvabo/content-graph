import { useSettingsStore } from '../store/settingsStore';
import type { SavedBrand } from '../store/brandsStore';

/** Build a one-line description sent to the LLM. Returns '' when there's nothing worth summarizing. */
function describe(brand: SavedBrand): string {
  const parts: string[] = [];
  if (brand.voice?.personality) parts.push(`Personality: ${brand.voice.personality}`);
  if (brand.voice?.audience) parts.push(`Audience: ${brand.voice.audience}`);
  if (brand.imageStyleNote) parts.push(`Visual style: ${brand.imageStyleNote}`);
  return parts.join(' — ');
}

/**
 * Ask the user's LLM for a 1–3 word type label ("Editorial", "Playful", etc.).
 * Resolves to '' if there's not enough input or no API key, or on network error.
 */
export async function summarizeBrandType(brand: SavedBrand): Promise<string> {
  const description = describe(brand);
  if (!description) return '';

  const { groqKey } = useSettingsStore.getState();
  const prompt = `Summarize the following brand description as a single short label of 1-3 words (a noun or adjective phrase, no punctuation, no quotes). Return ONLY the label.\n\n${description}`;

  try {
    if (groqKey) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 12, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) return '';
      const data = await res.json();
      return clean(data.choices?.[0]?.message?.content ?? '');
    }
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 12, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return clean(data.content?.[0]?.text ?? '');
  } catch { /* swallow — empty label is fine */ }
  return '';
}

function clean(s: string): string {
  return s.replace(/["'.]/g, '').split(/\n+/)[0].trim().split(/\s+/).slice(0, 3).join(' ');
}
