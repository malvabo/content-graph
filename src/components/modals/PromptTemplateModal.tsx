import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';

type Category = 'All' | 'Positioning' | 'Structure' | 'Objective' | 'Audience';
const FILTERS: Category[] = ['All', 'Positioning', 'Structure', 'Objective', 'Audience'];

export const PROMPT_TEMPLATES: { label: string; description: string; text: string; category: Category }[] = [
  { label: 'Thought leadership', description: 'Position as an industry authority with bold, forward-thinking perspectives.', text: 'Position as an industry authority. Highlight forward-thinking trends and bold perspectives.', category: 'Positioning' },
  { label: 'Bold & opinionated', description: 'Take a strong stance and challenge conventional thinking with confident language.', text: 'Take a strong stance. Use confident, assertive language. Challenge conventional thinking.', category: 'Positioning' },
  { label: 'Storytelling', description: 'Lead with a narrative hook and a personal or relatable story to engage readers.', text: 'Lead with a narrative hook. Use a personal or relatable story to engage readers.', category: 'Structure' },
  { label: 'Problem → Solution', description: 'Frame around a core problem the audience faces, then reveal the solution.', text: 'Frame around a core problem the audience faces, then reveal the solution.', category: 'Structure' },
  { label: 'ROI focused', description: 'Emphasize business value and ROI. Speak to decision-makers with quantified impact.', text: 'Emphasize business value and ROI. Quantify impact where possible. Speak to decision-makers.', category: 'Objective' },
  { label: 'Call to action', description: 'Build to a compelling call to action with urgency and a clear direct benefit.', text: 'Build to a compelling call to action. Create urgency and highlight the direct benefit.', category: 'Objective' },
  { label: 'Beginner friendly', description: 'Write for a general audience — no jargon, clear explanations of key concepts.', text: 'Write for a general audience. Avoid jargon and explain key concepts clearly.', category: 'Audience' },
  { label: 'Data-driven', description: 'Back every claim with data or research. Lead with statistics and hard evidence.', text: 'Back every claim with data or research. Lead with statistics and hard evidence.', category: 'Audience' },
];

interface Props {
  onClose: () => void;
  onPick: (text: string) => void;
  onScratch: () => void;
}

export default function PromptTemplateModal({ onClose, onPick, onScratch }: Props) {
  const [filter, setFilter] = useState<Category>('All');
  const visible = filter === 'All' ? PROMPT_TEMPLATES : PROMPT_TEMPLATES.filter(t => t.category === filter);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent maxWidth={820} style={{ maxHeight: 'calc(100vh - 48px)', fontFamily: 'var(--font-sans)' }}>
        {/* Header */}
        <DialogHeader className="border-b border-[var(--color-border-subtle)]">
          <DialogTitle>Start with a template</DialogTitle>
          <DialogDescription>Pick a tone or angle to seed your prompt — or start blank.</DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Filter sidebar */}
          <aside style={{ width: 160, flexShrink: 0, padding: 'var(--space-4)', borderRight: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ width: '100%', display: 'block', textAlign: 'left', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: filter === f ? 'var(--color-accent)' : 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { if (filter !== f) e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
                onMouseLeave={e => { if (filter !== f) e.currentTarget.style.background = 'transparent'; }}>
                {f}
              </button>
            ))}
          </aside>

          {/* Template grid */}
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 'var(--space-5)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', alignContent: 'start' }}>
              {visible.map(t => (
                <button key={t.label} onClick={() => onPick(t.text)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 'var(--space-4)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 120ms, box-shadow 120ms, background 120ms', whiteSpace: 'normal', width: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.background = 'var(--color-bg-card)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 'var(--leading-snug)', width: '100%', minHeight: 'calc(2em * var(--leading-snug))', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.label}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', lineHeight: 'var(--leading-snug)', display: 'block', width: '100%' }}>{t.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter>
          <button onClick={onScratch}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--color-text-tertiary)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}>
            Or write from scratch →
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
