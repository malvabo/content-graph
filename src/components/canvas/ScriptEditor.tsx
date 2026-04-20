import { useState, useRef, useEffect, useCallback } from 'react';
import { useScriptStore } from '../../store/scriptStore';

export default function ScriptEditor({ scriptId, onBack }: { scriptId: string; onBack: () => void }) {
  const script = useScriptStore(s => s.scripts.find(sc => sc.id === scriptId));
  const updateScript = useScriptStore(s => s.updateScript);
  const [content, setContent] = useState(script?.content ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-save on change
  const handleChange = useCallback((val: string) => {
    setContent(val);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateScript(scriptId, { content: val }), 400);
  }, [scriptId, updateScript]);

  // Auto-resize
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }
  }, [content]);

  // Focus on mount
  useEffect(() => { ref.current?.focus(); }, []);

  // Cleanup
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  if (!script) return null;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <button onClick={onBack} className="btn btn-ghost" style={{ padding: 'var(--space-1) var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          </button>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>Scripts</span>
        </div>

        {/* Title */}
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-4)' }}>
          {script.title || 'Untitled'}
        </div>

        {/* Editor */}
        <textarea ref={ref} value={content} onChange={e => handleChange(e.target.value)}
          placeholder="Start writing…"
          style={{
            width: '100%', flex: 1, minHeight: 400,
            background: 'transparent', border: 'none', outline: 'none', resize: 'none',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)',
            color: 'var(--color-text-primary)', overflow: 'hidden',
          }} />
      </div>
    </div>
  );
}
