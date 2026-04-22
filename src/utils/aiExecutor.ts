import { useSettingsStore } from '../store/settingsStore';
import { getActiveBrand } from '../store/brandsStore';

const SYSTEM_PROMPTS: Record<string, string> = {
  'linkedin-post': 'You are a LinkedIn content writer. Write a compelling 150–300 word LinkedIn post based on the input. Use hooks, line breaks, and end with a question or CTA. Output only the post text.',
  'twitter-thread': 'You are a Twitter thread writer. Write a 5–10 tweet thread based on the input. Number each tweet (1/, 2/, etc). Keep each under 280 chars. Output only the thread.',
  'twitter-single': 'You are a tweet writer. Write the single most quotable, insightful tweet from the input. Max 280 characters. Output only the tweet.',
  'newsletter': 'You are a newsletter writer. Write a 300–500 word newsletter digest with SUBJECT line, greeting, body, takeaway, and sign-off. Output only the newsletter.',
  'infographic': 'Extract the 4-6 most important facts, stats, or claims from this text. Return ONLY a JSON object, no markdown:\n{\n  \"title\": \"string (5 words max)\",\n  \"subtitle\": \"string (10 words max, optional)\",\n  \"points\": [{\"stat\": \"string\", \"label\": \"string\", \"detail\": \"string (optional)\"}]\n}\nstat is a number or short value (e.g. \'73%\', \'$2.4B\', \'10x\'). label is what it means. Keep it scannable.',
  'quote-card': 'You are a quote curator. Extract the single strongest, most shareable quote from the input. Output ONLY the quote text — no attribution labels, no markdown, no asterisks, no formatting. Just the raw quote text.',
  'image-prompt': 'You are an expert AI image prompt engineer for text-to-image models. Based on the input content, write ONE highly specific, visual image generation prompt. Focus on concrete visual elements: specific subjects, setting, lighting, camera angle, color palette, and mood. Avoid abstract concepts — describe what the camera SEES. Output only the prompt text, nothing else.',
  'refine': 'You are an editor. Refine and improve the input text based on any instructions provided. Output only the refined text.',
  'text-source': 'You are a text processor. Process and clean up the input text. If there are preparation instructions, follow them. Output the processed text.',
  'video': 'You are a video script writer. Write a short video script based on the input, with scene descriptions and narration. Output only the script.',
  'brand-voice': 'You are a brand voice analyst and writer. Based on the input content and the brand voice guidelines provided, rewrite the input to perfectly match the brand voice. Preserve the core message and facts but transform the tone, word choice, and style to be unmistakably on-brand. Output only the rewritten text.',
};

function getProvider(model: string): 'anthropic' | 'openai' | 'google' | 'groq' {
  if (model.startsWith('claude')) return 'anthropic';
  if (model.startsWith('gpt') || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4')) return 'openai';
  if (model.startsWith('gemini')) return 'google';
  if (model.startsWith('llama')) return 'groq';
  return 'anthropic';
}

function getApiModel(model: string): string {
  const map: Record<string, string> = {
    'claude-haiku-4': 'claude-haiku-4-20250414',
    'claude-sonnet-4': 'claude-sonnet-4-20250514',
    'claude-opus-4': 'claude-opus-4-20250514',
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-2.5-flash': 'gemini-2.5-flash-preview-04-17',
    'llama-3.3-70b': 'llama-3.3-70b-versatile',
    'llama-4-scout': 'meta-llama/llama-4-scout-17b-16e-instruct',
  };
  return map[model] ?? model;
}

async function callAnthropic(apiKey: string, model: string, system: string, input: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: getApiModel(model), max_tokens: 2048, system, messages: [{ role: 'user', content: input }] }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(apiKey: string, model: string, system: string, input: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: getApiModel(model), max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: input }] }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `OpenAI ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGoogle(apiKey: string, model: string, system: string, input: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getApiModel(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: input }] }], generationConfig: { maxOutputTokens: 2048 } }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Gemini ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGroq(apiKey: string, model: string, system: string, input: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: getApiModel(model), max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: input }] }),
    signal,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Groq ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export interface AiExecuteMeta {
  inputCount?: number;
}

export async function aiExecute(input: string, config: Record<string, unknown>, subtype: string, meta?: AiExecuteMeta, signal?: AbortSignal): Promise<string> {
  const model = (config.model as string) || 'llama-3.3-70b';
  const provider = getProvider(model);
  const { anthropicKey, openaiKey, googleKey, groqKey } = useSettingsStore.getState();

  const keys: Record<string, string> = { anthropic: anthropicKey, openai: openaiKey, google: googleKey, groq: groqKey };
  let apiKey = keys[provider];
  let activeProvider = provider;
  let activeModel = model;

  // Fallback: if selected provider has no key, try any available key
  if (!apiKey) {
    const fallbacks: [string, string, string][] = [
      ['anthropic', anthropicKey, 'claude-sonnet-4'],
      ['groq', groqKey, 'llama-3.3-70b'],
      ['openai', openaiKey, 'gpt-4o-mini'],
      ['google', googleKey, 'gemini-2.0-flash'],
    ];
    for (const [p, k, m] of fallbacks) {
      if (k) { apiKey = k; activeProvider = p as any; activeModel = m; break; }
    }
    if (!apiKey) throw new Error('No API key set. Go to Settings to add one.');
  }

  // Infographic: force claude-sonnet-4 for reliable JSON extraction
  if (subtype === 'infographic') {
    const { anthropicKey, openaiKey, groqKey, googleKey } = useSettingsStore.getState();
    const sys = SYSTEM_PROMPTS['infographic'];
    if (anthropicKey) return callAnthropic(anthropicKey, 'claude-sonnet-4', sys, input, signal);
    if (openaiKey) return callOpenAI(openaiKey, 'gpt-4o-mini', sys, input, signal);
    if (groqKey) return callGroq(groqKey, 'llama-3.3-70b', sys + '\n\nYou MUST return valid JSON only. No markdown, no explanation.', input, signal);
    if (googleKey) return callGoogle(googleKey, 'gemini-2.0-flash', sys, input, signal);
    throw new Error('No API key set. Go to Settings to add one.');
  }

  let system = SYSTEM_PROMPTS[subtype] || `Generate content based on the input. Node type: ${subtype}. Output only the result.`;

  // Multi-input synthesis hint — only when 2+ upstream sources were fanned in.
  const inputCount = meta?.inputCount ?? 0;
  if (inputCount > 1) {
    system = [
      `You are receiving ${inputCount} distinct inputs, each prefixed with "## Input N — <label> (<subtype>)".`,
      'Synthesize them into a single cohesive piece. Do not reproduce the section headers in your output.',
      'Treat all inputs as equally authoritative; if they contradict, prefer the most specific source.',
    ].join(' ') + '\n\n' + system;
  }

  // Inject brand voice context (per-flow override via Brands library > global active > legacy settings).
  const brand = getActiveBrand();
  if (brand?.voice?.personality) {
    const parts = [
      'BRAND VOICE GUIDELINES:',
      brand.name ? `Brand: ${brand.name}` : '',
      `Personality: ${brand.voice.personality}`,
      brand.voice.audience ? `Target audience: ${brand.voice.audience}` : '',
      brand.voice.avoidWords?.length ? `Never use these words/phrases: ${brand.voice.avoidWords.join(', ')}` : '',
      brand.voice.examplePost ? `Reference post that captures the voice:\n"${brand.voice.examplePost}"` : '',
      'Apply this voice consistently. Do not mention these guidelines in your output.',
    ].filter(Boolean).join('\n');
    system = parts + '\n\n' + system;
  }

  // Inject brand visual identity for visual nodes
  if (brand?.colors && ['infographic', 'quote-card', 'image-prompt'].includes(subtype)) {
    system += `\n\nBRAND VISUAL IDENTITY: Primary color ${brand.colors.primary}, secondary ${brand.colors.secondary}, accent ${brand.colors.accent}. Incorporate these into the visual direction.`;
  }

  // Node-level tone override
  const tone = config.tone as string | undefined;
  if (tone && brand?.voice?.personality) {
    system += `\n\nFor this specific piece, adjust the tone to be more ${tone} while staying within the brand voice.`;
  }

  // Enrich brand-voice with strength config
  if (subtype === 'brand-voice') {
    const strength = config.strength as string || 'Full rewrite';
    system += `\n\nRewrite strength: "${strength}". Light touch = preserve most original phrasing, just adjust tone. Moderate = rewrite ~50% of sentences. Full rewrite = completely transform while keeping the message.`;
  }

  // Enrich image-prompt with node config
  if (subtype === 'image-prompt') {
    const purpose = config.purpose as string || 'Blog hero';
    const style = config.style as string || 'Photography';
    const aspect = config.aspect as string || '16:9';
    system += `\n\nContext: Purpose is "${purpose}". Visual style: "${style}". Aspect ratio: ${aspect}. Tailor the prompt to this use case.`;
    // Inject brand reference image style
    if (brand?.imageStyleNote) {
      system += `\n\nBRAND IMAGE STYLE: ${brand.imageStyleNote}. All generated images must match this aesthetic.`;
    }
    if (brand?.referenceImages?.length) {
      system += `\n\nThe brand has ${brand.referenceImages.length} reference image(s) defining the visual style. Ensure the generated prompt produces images consistent with this established visual direction.`;
    }
  }

  if (activeProvider === 'anthropic') return callAnthropic(apiKey, activeModel, system, input, signal);
  if (activeProvider === 'openai') return callOpenAI(apiKey, activeModel, system, input, signal);
  if (activeProvider === 'groq') return callGroq(apiKey, activeModel, system, input, signal);
  return callGoogle(apiKey, activeModel, system, input, signal);
}
