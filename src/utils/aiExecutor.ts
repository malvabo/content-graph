import { useSettingsStore } from '../store/settingsStore';

const SYSTEM_PROMPTS: Record<string, string> = {
  'linkedin-post': 'You are a LinkedIn content writer. Write a compelling 150–300 word LinkedIn post based on the input. Use hooks, line breaks, and end with a question or CTA. Output only the post text.',
  'twitter-thread': 'You are a Twitter thread writer. Write a 5–10 tweet thread based on the input. Number each tweet (1/, 2/, etc). Keep each under 280 chars. Output only the thread.',
  'twitter-single': 'You are a tweet writer. Write the single most quotable, insightful tweet from the input. Max 280 characters. Output only the tweet.',
  'newsletter': 'You are a newsletter writer. Write a 300–500 word newsletter digest with SUBJECT line, greeting, body, takeaway, and sign-off. Output only the newsletter.',
  'infographic': 'You are an infographic content planner. Create a structured infographic spec with TITLE, SUBTITLE, 3-5 SECTIONS (each with heading + content + visual element), and DESIGN DIRECTION. Output only the spec.',
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

async function callAnthropic(apiKey: string, model: string, system: string, input: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: getApiModel(model), max_tokens: 2048, system, messages: [{ role: 'user', content: input }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Anthropic ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

async function callOpenAI(apiKey: string, model: string, system: string, input: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: getApiModel(model), max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: input }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `OpenAI ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callGoogle(apiKey: string, model: string, system: string, input: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getApiModel(model)}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: input }] }], generationConfig: { maxOutputTokens: 2048 } }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Gemini ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callGroq(apiKey: string, model: string, system: string, input: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: getApiModel(model), max_tokens: 2048, messages: [{ role: 'system', content: system }, { role: 'user', content: input }] }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || `Groq ${res.status}`); }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function aiExecute(input: string, config: Record<string, unknown>, subtype: string): Promise<string> {
  const model = (config.model as string) || 'llama-3.3-70b';
  const provider = getProvider(model);
  const { anthropicKey, openaiKey, googleKey, groqKey } = useSettingsStore.getState();

  const keys: Record<string, string> = { anthropic: anthropicKey, openai: openaiKey, google: googleKey, groq: groqKey };
  const apiKey = keys[provider];
  if (!apiKey) throw new Error(`No ${provider} API key set. Go to Settings to add one.`);

  let system = SYSTEM_PROMPTS[subtype] || `Generate content based on the input. Node type: ${subtype}. Output only the result.`;

  // Inject brand voice context
  const brand = useSettingsStore.getState().brand;
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
  }

  if (provider === 'anthropic') return callAnthropic(apiKey, model, system, input);
  if (provider === 'openai') return callOpenAI(apiKey, model, system, input);
  if (provider === 'groq') return callGroq(apiKey, model, system, input);
  return callGoogle(apiKey, model, system, input);
}
