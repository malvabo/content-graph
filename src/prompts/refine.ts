export const version = 'v1.0';
export const build = (c: Record<string, any>) => `
Apply the following instruction to the source material below.

INSTRUCTION:
${c.directive}

SOURCE MATERIAL:
${c.input}

Process the source material according to the instruction above. Return ONLY the transformed result — no preamble, no explanation.
`.trim();
