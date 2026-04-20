export function mockExecute(input: string, subtype: string): string {
  const firstSentence = input.split(/[.!?]\s/)[0]?.trim() || input.slice(0, 100);
  const short = input.slice(0, 150).trim();
  const paras = input.split(/\n\n+/).filter(Boolean);
  const sentences = input.split(/[.!?]\s/).filter(Boolean);
  const words = input.split(/\s+/).filter(w => w.length > 4).slice(0, 5).join(', ');

  const formatters: Record<string, () => string> = {
    'text-source': () => input,
    'file-source': () => input,
    'refine': () => input,
    'twitter-single': () => firstSentence.length <= 280 ? firstSentence : firstSentence.slice(0, 277) + '...',
    'quote-card': () => {
      const best = sentences.reduce((a, b) => b.length > a.length ? b : a, '');
      return `QUOTE: "${best.trim()}"\nATTRIBUTION: Source material\nCONTEXT: Selected as the most impactful statement from the input.`;
    },
    'linkedin-post': () => `${firstSentence}.\n\nThis is what nobody talks about.\n\nAfter diving deep into this topic, here are the 3 things that stood out:\n\n1. ${sentences[1]?.trim() || 'The core insight challenges conventional thinking.'}\n\n2. The implications go far beyond what most people realize — especially around ${words}.\n\n3. The practical takeaway: start small, iterate fast, and measure what matters.\n\nThe biggest misconception? That this is complicated. It's not. It just requires a shift in how you think about ${firstSentence.split(' ').slice(0, 4).join(' ')}.\n\nWhat's your take on this? Have you seen similar patterns? 👇`,
    'twitter-thread': () => `1/ ${firstSentence}. A thread on why this matters:\n\n2/ ${sentences[1]?.trim() || 'The key insight most people miss.'}\n\n3/ Think about it: ${words} — these aren't just buzzwords. They represent a fundamental shift.\n\n4/ ${sentences[2]?.trim() || 'The data backs this up in ways that surprised me.'}\n\n5/ The practical framework: observe → hypothesize → test → iterate.\n\n6/ ${sentences[3]?.trim() || 'What makes this different is the compounding effect over time.'}\n\n7/ TL;DR: ${firstSentence}. Save this thread for later.`,
    'newsletter': () => {
      const subject = firstSentence.slice(0, 50);
      const hook = paras[0] || firstSentence;
      const body = paras.slice(1, 4).join('\n\n') || input.slice(0, 600);
      const lastPara = paras[paras.length - 1] || '';
      const takeaway = lastPara.length > 20 ? lastPara : `The key takeaway: ${firstSentence}`;
      return `SUBJECT: ${subject}\n\nHey there,\n\n${hook}\n\n${body}\n\nHere's what this means for you:\n\n${takeaway}\n\nOne thing to try this week: take the core idea above and apply it to your current project. See what shifts.\n\nHit reply and let me know what you think — I read every response.\n\nUntil next time.`;
    },
    'infographic': () => JSON.stringify({ title: firstSentence.split(' ').slice(0, 5).join(' '), subtitle: 'Key insights visualized', points: sentences.slice(0, 4).map((s, i) => ({ stat: `${(i + 1) * 23}%`, label: s.split(' ').slice(0, 5).join(' '), detail: s.trim().slice(0, 50) })) }),
    'image-prompt': () => {
      const orientation = input.includes('9:16') || input.includes('portrait') ? 'vertical portrait' : input.includes('1:1') || input.includes('square') ? 'square' : 'wide landscape';
      return `A cinematic ${orientation} photograph of ${firstSentence.toLowerCase()}, golden hour lighting, shallow depth of field, rich color palette, editorial style, 8k resolution`;
    },
  };

  return (formatters[subtype] ?? (() => `[${subtype}]\n\n${short}`))();
}
