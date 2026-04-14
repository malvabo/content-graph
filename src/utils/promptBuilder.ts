export function buildPrompt(template: string, vars: Record<string, unknown>): string {
  let result = template;
  // {{#if key}}...{{/if}} conditionals
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) =>
    vars[key] ? body : ''
  );
  // {{variable}} interpolation
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
  // Clean double blank lines
  result = result.replace(/\n{3,}/g, '\n\n');
  return result.trim();
}
