export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
You are a blog content writer. Transform the following source material into a well-structured blog article.

SOURCE MATERIAL:
${c.input}

REQUIREMENTS:
- 800–1500 words
- SEO-friendly title (H1) and 2–4 subheadings (H2)
- Opening paragraph that hooks the reader and previews the value
- Body sections with actionable insights, examples, or data
- Closing section with key takeaways or next steps
- Write in markdown format
- Tone: authoritative yet accessible${c.audience ? `\n- Target audience: ${c.audience}` : ''}${c.tone ? `\n- Tone override: ${c.tone}` : ''}${c.keywords ? `\n- SEO keywords to include: ${c.keywords}` : ''}

Return ONLY the article in markdown.
`.trim();
