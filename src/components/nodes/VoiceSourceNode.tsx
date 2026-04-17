import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useVoiceStore } from '../../store/voiceStore';

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function VoiceSourceInline({ id }: { id: string }) {
  const notes = useVoiceStore((s) => s.notes.filter((n) => n.status === 'ready'));
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, color: 'var(--color-text-placeholder)', fontSize: 'var(--text-sm)' }}>
        No voice notes — record one in the Voice tab
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, minHeight: 0 }}>
      <select
        className="form-input"
        value={voiceNoteId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}
      >
        <option value="" disabled>Select a voice note…</option>
        {notes.map((n) => (
          <option key={n.id} value={n.id}>{n.title} ({formatDuration(n.durationMs)})</option>
        ))}
      </select>
      {selected && (
        <div className="nowheel" style={{ flex: 1, overflow: 'auto', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', scrollbarWidth: 'thin' }}>
          {selected.transcript}
        </div>
      )}
    </div>
  );
}
