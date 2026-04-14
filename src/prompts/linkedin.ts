export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
You are a LinkedIn content strategist. Transform the following source material into a compelling LinkedIn post.

SOURCE MATERIAL:
${c.input}

REQUIREMENTS:
- 150–300 words
- Open with a bold hook line that stops the scroll
- Use short paragraphs (1–2 sentences each)
- Include a personal insight or contrarian take
- End with a clear call-to-action or thought-provoking question
- Add 3–5 relevant hashtags on the final line
- Tone: professional yet conversational${c.audience ? `\n- Target audience: ${c.audience}` : ''}${c.tone ? `\n- Tone override: ${c.tone}` : ''}

Return ONLY the post text, ready to paste into LinkedIn.
`.trim();
