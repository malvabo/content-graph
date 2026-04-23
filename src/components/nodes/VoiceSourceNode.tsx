import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useVoiceStore } from '../../store/voiceStore';
import { useMemo } from 'react';

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VoiceSourceInline({ id, onExpand }: { id: string; onExpand?: () => void }) {
  const allNotes = useVoiceStore((s) => s.notes);
  const notes = useMemo(() => (allNotes ?? []).filter((n) => n.status === 'ready'), [allNotes]);
  const voiceNoteId = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config?.voiceNoteId as string | undefined);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const selected = notes.find((n) => n.id === voiceNoteId);

  const onChange = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    if (!note) return;
    updateConfig(id, { voiceNoteId: noteId });
    useOutputStore.getState().setOutput(id, { text: note.transcript });
  };

  if (notes.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, color: 'var(--color-text-placeholder)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', textAlign: 'center', padding: '0 var(--space-2)' }}>
        No voice notes yet — record one in the Voice tab
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, minHeight: 0 }}>
      {/* Note selector */}
      <select
        className="form-input"
        value={voiceNoteId ?? ''}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
        aria-label="Select voice note"
      >
        <option value="" disabled>Select a voice note…</option>
        {notes.map((n) => (
          <option key={n.id} value={n.id}>{n.title} ({formatDuration(n.durationMs)})</option>
        ))}
      </select>

      {/* Transcript preview — click to open editable modal */}
      <div
        className="nowheel"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
        style={{
          flex: 1,
          overflow: 'hidden',
          fontSize: 'var(--text-sm)',
          lineHeight: 'var(--leading-relaxed)',
          color: selected ? 'var(--color-text-secondary)' : 'var(--color-text-placeholder)',
          background: 'var(--color-bg-surface)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-2)',
          cursor: onExpand ? 'pointer' : 'default',
          position: 'relative',
          transition: 'background 150ms',
        }}
        onMouseEnter={e => { if (onExpand) e.currentTarget.style.background = 'var(--color-bg-hover, var(--color-bg-surface))'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg-surface)'; }}
      >
        {selected ? (
          <>
            <span style={{ fontFamily: 'var(--font-sans)', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {selected.transcript}
            </span>
            {/* Fade + click hint at bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, background: 'linear-gradient(to bottom, transparent, var(--color-bg-surface))', borderRadius: '0 0 var(--radius-md) var(--radius-md)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
              {onExpand && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-placeholder)', fontFamily: 'var(--font-sans)' }}>click to edit</span>}
            </div>
          </>
        ) : (
          <span style={{ fontFamily: 'var(--font-sans)', fontStyle: 'italic' }}>Select a note to see transcript</span>
        )}
      </div>
    </div>
  );
}
