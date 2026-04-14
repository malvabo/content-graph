export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
You are an AI image prompt engineer. Based on the following source material, generate a detailed image generation prompt.

SOURCE MATERIAL:
${c.input}

REQUIREMENTS:
- Create a vivid, detailed prompt suitable for AI image generators (DALL-E, Midjourney, Stable Diffusion)
- Include: subject, composition, lighting, color palette, mood, style
- Be specific about visual elements — avoid abstract or vague descriptions
- Keep under 200 words
- Do NOT include text-in-image instructions (AI generators handle text poorly)${c.style ? `\n- Art style: ${c.style}` : ''}${c.aspect ? `\n- Aspect ratio: ${c.aspect}` : ''}

Return ONLY the image prompt, ready to paste into a generator.
`.trim();
