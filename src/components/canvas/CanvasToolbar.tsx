import { useGraphStore } from '../../store/graphStore';
import { useGraphLayout } from '../../hooks/useGraphLayout';
import { useNodeExecution } from '../../hooks/useNodeExecution';
import { exportGraph } from '../../utils/templates';

export default function CanvasToolbar({ activeView }: { activeView: string }) {
  const { graphName, setGraphName, clearGraph, nodes, edges } = useGraphStore();
  const { autoLayout } = useGraphLayout();
  const { runAll } = useNodeExecution();

  const handleRunAll = () => {
    runAll(async (input, _config, subtype) => {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
      // Extract first sentence and key phrases from input for contextual output
      const firstSentence = input.split(/[.!?]\s/)[0]?.trim() || input.slice(0, 100);
      const words = input.split(/\s+/).filter(w => w.length > 4).slice(0, 5).join(', ');
      const short = input.slice(0, 150).trim();

      const formatters: Record<string, () => string> = {
        'linkedin-post': () => `${firstSentence}.\n\nThis is what nobody talks about.\n\nAfter diving deep into this topic, here are the 3 things that stood out:\n\n1. ${input.split(/[.!?]\s/)[1]?.trim() || 'The core insight challenges conventional thinking.'}\n\n2. The implications go far beyond what most people realize — especially around ${words}.\n\n3. The practical takeaway: start small, iterate fast, and measure what matters.\n\nThe biggest misconception? That this is complicated. It's not. It just requires a shift in how you think about ${firstSentence.split(' ').slice(0, 4).join(' ')}.\n\nWhat's your take on this? Have you seen similar patterns? 👇`,
        'twitter-thread': () => `1/ ${firstSentence}. A thread on why this matters:\n\n2/ ${input.split(/[.!?]\s/)[1]?.trim() || 'The key insight most people miss.'}\n\n3/ Think about it: ${words} — these aren't just buzzwords. They represent a fundamental shift.\n\n4/ ${input.split(/[.!?]\s/)[2]?.trim() || 'The data backs this up in ways that surprised me.'}\n\n5/ The practical framework: observe → hypothesize → test → iterate.\n\n6/ ${input.split(/[.!?]\s/)[3]?.trim() || 'What makes this different is the compounding effect over time.'}\n\n7/ TL;DR: ${firstSentence}. Save this thread for later.`,
        'twitter-single': () => `${firstSentence.length <= 280 ? firstSentence : firstSentence.slice(0, 277) + '...'}`,
        'blog-article': () => `# ${firstSentence}\n\n## Why This Matters\n\n${input.split(/[.!?]\s/).slice(0, 3).join('. ')}.\n\n## The Key Insight\n\n${input.split(/[.!?]\s/).slice(3, 6).join('. ') || short}.\n\nThis has implications for how we think about ${words}.\n\n## What To Do About It\n\n${input.split(/[.!?]\s/).slice(6, 9).join('. ') || 'Start by examining your current approach and identifying the gaps.'}\n\n## Conclusion\n\n${firstSentence}. The evidence is clear — and the time to act is now.`,
        'newsletter': () => {
          const paras = input.split(/\n\n+/).filter(Boolean);
          const subject = firstSentence.slice(0, 50);
          const hook = paras[0] || firstSentence;
          const body = paras.slice(1, 4).join('\n\n') || input.slice(0, 600);
          const lastPara = paras[paras.length - 1] || '';
          const takeaway = lastPara.length > 20 ? lastPara : `The key takeaway: ${firstSentence}`;
          return `SUBJECT: ${subject}\n\nHey there,\n\n${hook}\n\n${body}\n\nHere's what this means for you:\n\n${takeaway}\n\nOne thing to try this week: take the core idea above and apply it to your current project. See what shifts.\n\nHit reply and let me know what you think — I read every response.\n\nUntil next time.`;
        },
        'ig-carousel': () => {
          const sentences = input.split(/[.!?]\s/).filter(Boolean);
          const slides = sentences.slice(0, 6).map((s, i) => `---\nSLIDE ${i + 1}:\nHeadline: ${s.split(' ').slice(0, 5).join(' ')}\nBody: ${s.trim()}`);
          return slides.join('\n') + `\n---\nSLIDE ${slides.length + 1}:\nHeadline: Key Takeaway\nBody: ${firstSentence}`;
        },
        'infographic': () => `TITLE: ${firstSentence.split(' ').slice(0, 6).join(' ')}\nSUBTITLE: Key insights visualized\n\n${input.split(/[.!?]\s/).filter(Boolean).slice(0, 4).map((s, i) => `SECTION ${i + 1}: ${s.split(' ').slice(0, 4).join(' ')}\nContent: ${s.trim()}\nVisual element: icon ${i + 1}`).join('\n\n')}\n\nDESIGN DIRECTION:\nLayout: vertical flow\nPalette: #0DBF5A, #1A2420, #F6F7F5\nMood: Clean, data-driven`,
        'quote-card': () => {
          const best = input.split(/[.!?]\s/).reduce((a, b) => b.length > a.length ? b : a, '');
          return `QUOTE: "${best.trim()}"\nATTRIBUTION: Source material\nCONTEXT: Selected as the most impactful statement from the input.`;
        },
        'image-prompt': () => `A cinematic wide-angle photograph of ${firstSentence.toLowerCase()}, golden hour lighting, shallow depth of field, rich color palette, editorial style, 8k resolution`,
        'refine': () => input,
        'text-source': () => input,
      };
      return (formatters[subtype] ?? (() => `[${subtype}]\n\n${short}`))();
    });
  };

  return (
    <div className="h-11 shrink-0 flex items-center px-4 gap-3" style={{ background: 'var(--cg-card)', borderBottom: '1px solid var(--cg-border)' }}>
      <span style={{ font: '500 15px/20px var(--font-mono)', color: 'var(--cg-green)', letterSpacing: '-.02em', userSelect: 'none' }}>up200</span>
      <div className="h-4 w-px" style={{ background: 'var(--cg-border)' }} />
      <input
        style={{ font: '500 14px/20px var(--font-sans)', color: 'var(--cg-ink)', letterSpacing: '-.01em' }}
        className="bg-transparent border-none outline-none w-48"
        value={graphName}
        onChange={(e) => setGraphName(e.target.value)}
      />
      <div className="h-4 w-px" style={{ background: 'var(--cg-border)' }} />
      {activeView === 'workflow' && <>
        <button className="btn-ghost btn-sm" onClick={autoLayout}>Auto-layout</button>
        <button className="btn-ghost btn-sm" onClick={clearGraph}>Clear</button>
        <button className="btn-ghost btn-sm" onClick={() => exportGraph(nodes, edges, graphName)}>Export</button>
      </>}
      <div className="flex-1" />
      {activeView === 'workflow' && <button className="btn btn-primary" onClick={handleRunAll}>▶ Run All</button>}
    </div>
  );
}
