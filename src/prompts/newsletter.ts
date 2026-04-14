export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
You are a newsletter editor. Transform the following source material into a concise, engaging newsletter issue.

SOURCE MATERIAL:
${c.input}

REQUIREMENTS:
- 300–500 words total
- Subject line: compelling, under 50 characters
- Opening: 1–2 sentences of personal context or a hook
- Body: 2–3 key insights or takeaways, each as a short paragraph
- Closing: one clear CTA (reply, click, share)
- Tone: like a smart friend sharing what they learned${c.audience ? `\n- Target audience: ${c.audience}` : ''}${c.tone ? `\n- Tone override: ${c.tone}` : ''}

Format as:
SUBJECT: [subject line]

[newsletter body]

Return ONLY the formatted newsletter.
`.trim();
