import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useVoiceStore } from '../../store/voiceStore';
import { useMemo } from 'react';

const SAMPLE_CONTENT = "Movement in Gemini is not merely decorative; it's an essential guiding element. Each animation has a defined start and end point, creating a sense of directional flow that mirrors user actions. This sense of responsiveness helps users intuitively understand that the system is working with them. Inner activity within the motion conveys thinking, analysis, and intelligence, making Gemini's processing feel more transparent. Motion allows users to see information coming together, visualizing Gemini's conversations and listening abilities.";

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
        style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: onExpand ? 'pointer' : 'default' }}
      >
        {selected ? (
          <>
            <div style={{ fontWeight: 'var(--weight-normal)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>
              {selected.transcript || SAMPLE_CONTENT}
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(transparent, var(--color-bg-card))', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 2, cursor: 'pointer' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', letterSpacing: '0.01em' }}>···</span>
            </div>
          </>
        ) : (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-placeholder)', fontStyle: 'italic' }}>Select a note to see transcript</span>
        )}
      </div>
    </div>
  );
}
