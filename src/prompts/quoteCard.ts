export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
You are a quote curator. Extract the single strongest, most shareable quote from the source material and format it for a visual quote card.

SOURCE MATERIAL:
${c.input}

REQUIREMENTS:
- Select the most impactful quote (or paraphrase into one if no direct quote exists)
- Max 25 words for the quote itself
- Include attribution (speaker/author name)
- Suggest a background mood (e.g., "dark minimal", "warm gradient", "bold typography")
- Provide a short context line (1 sentence, what the quote is about)${c.style ? `\n- Visual style preference: ${c.style}` : ''}

Format as:
QUOTE: "[quote text]"
ATTRIBUTION: [name/source]
CONTEXT: [one-line context]
BACKGROUND: [mood suggestion]

Return ONLY the formatted quote card spec.
`.trim();
