export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
You are an infographic content architect. Transform the following source material into a structured infographic specification.

SOURCE MATERIAL:
${c.input}

REQUIREMENTS:
- Title: bold, under 10 words
- Subtitle: one-line context setter
- 4–6 sections, each with:
  - Section heading (short)
  - Key stat or data point (if available)
  - 1–2 sentence explanation
  - Suggested icon or visual element
- Footer: source attribution or CTA
- Format as a structured spec a designer can follow${c.style ? `\n- Visual style: ${c.style}` : ''}${c.palette ? `\n- Color palette: ${c.palette}` : ''}

Return ONLY the infographic spec in a clear, labeled format.
`.trim();
