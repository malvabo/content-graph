import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useVoiceStore } from '../../store/voiceStore';
import { useGraphStore, type ContentNode } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import ContentModal from '../modals/ContentModal';

/* Icons */
const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2" width="6" height="11" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /><path d="M8 21h8" />
  </svg>
);
const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
);

const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const statusBadge = (status: string) => {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ready: { bg: 'var(--color-success-bg, #e6f9e6)', color: 'var(--color-success-text, #1a7f1a)', label: 'Ready' },
    recording: { bg: 'var(--color-danger-bg, #fde8e8)', color: 'var(--color-danger-text, #c53030)', label: 'Recording' },
    transcribing: { bg: 'var(--color-warning-bg, #fef3cd)', color: 'var(--color-warning-text, #856404)', label: 'Transcribing' },
  };
  const s = map[status] || map.ready;
  return (
    <span style={{ fontSize: 11, fontWeight: 500, fontFamily: 'var(--font-sans)', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: s.bg, color: s.color, lineHeight: '16px' }}>
      {s.label}
    </span>
  );
};

function RecordingOverlay({ onStop, startTime }: { onStop: () => void; startTime: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Date.now() - startTime), 200);
    return () => clearInterval(iv);
  }, [startTime]);

  const mm = String(Math.floor(elapsed / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, '0');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg-card').trim() || '#fff';
    let t = 0, raf: number;
    const resize = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * devicePixelRatio; canvas.height = r.height * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
    resize(); window.addEventListener('resize', resize);
    const draw = () => {
      const r = canvas.getBoundingClientRect(); const w = r.width, h = r.height, cx = w / 2, cy = h / 2;
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const angle = t * 0.8 + i * 1.3;
        const spread = 80 + Math.sin(t * 0.5 + i) * 40;
        const x = cx + Math.cos(angle) * spread * 0.7;
        const y = cy + Math.sin(angle) * spread * 0.5;
        const sz = 120 + Math.sin(t + i) * 30;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, sz);
        const hue = 145 + i * 5;
        grad.addColorStop(0, `hsla(${hue},60%,55%,0.22)`);
        grad.addColorStop(0.6, `hsla(${hue},50%,50%,0.06)`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      }
      t += 0.012; raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center" style={{ background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)', opacity: visible ? 1 : 0, transition: 'opacity 150ms' }}>
      <div className="flex flex-col w-full overflow-hidden rounded-t-[16px] md:rounded-[16px]"
        style={{ maxWidth: 480, maxHeight: '80vh', background: 'var(--color-bg-card)', boxShadow: '0 16px 48px rgba(0,0,0,0.18)', transform: visible ? 'translateY(0)' : 'translateY(16px)', transition: 'transform 150ms ease, opacity 150ms ease', position: 'relative' }}>
        {/* Cloud canvas background */}
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: 'inherit' }} />
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 40px', gap: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 300, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', letterSpacing: '0.05em', fontVariantNumeric: 'tabular-nums' }}>{mm}:{ss}</div>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>Recording</div>
          <button onClick={onStop} style={{ width: 64, height: 64, borderRadius: '50%', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow)', marginTop: 16 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
          </button>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>Tap to stop</div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function VoiceLibrary({ onUseInWorkflow, onSendToScript }: { onUseInWorkflow?: () => void; onSendToScript?: (text: string) => void }) {
  const { notes, addNote, updateNote, removeNote } = useVoiceStore();
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const mediaRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const noteIdRef = useRef('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const h = (e: Event) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [menuId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.onresult = (e: any) => {
          let final = '', interim = '';
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
            else interim += e.results[i][0].transcript;
          }
          setFinalText(final.trim());
          setInterimText(interim);
        };
        recog.start();
        recognitionRef.current = recog;
      }

      const id = `vn-${Date.now()}`;
      noteIdRef.current = id;
      startTimeRef.current = Date.now();
      setFinalText('');
      setInterimText('');
      setRecording(true);

      addNote({ id, title: 'Recording…', durationMs: 0, transcript: '', status: 'recording', createdAt: new Date().toISOString() });
    } catch (err) {
      console.error('Mic access denied', err);
      setMicError(true);
      setTimeout(() => setMicError(false), 3000);
    }
  }, [addNote]);

  const stopRecording = useCallback(() => {
    mediaRef.current?.getTracks().forEach(t => t.stop());
    recognitionRef.current?.stop();
    clearInterval(timerRef.current);

    const duration = Date.now() - startTimeRef.current;
    const transcript = [finalText, interimText].filter(Boolean).join(' ').trim();
    const title = transcript ? transcript.split(/\s+/).slice(0, 5).join(' ') : 'Untitled note';

    updateNote(noteIdRef.current, { title, durationMs: duration, transcript, status: 'ready' });
    setRecording(false);
  }, [finalText, interimText, updateNote]);

  const handleRename = () => {
    if (!renameId || !renameName.trim()) return;
    updateNote(renameId, { title: renameName.trim() });
    setRenameId(null);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    removeNote(deleteId);
    setDeleteId(null);
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-bg)', minWidth: 0, maxWidth: '100%' }}>
      {/* Hero banner */}
      <div style={{ height: '30vh', minHeight: 180, background: 'var(--color-bg-surface)', display: 'flex', alignItems: 'flex-end', padding: 'var(--space-8)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 28, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0, letterSpacing: '-0.02em' }}>Voice Notes</h1>
          {notes.length > 0 && <p style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', margin: 'var(--space-1) 0 0' }}>{notes.length} note{notes.length !== 1 ? 's' : ''}</p>}
        </div>
        {!recording && notes.length > 0 && (
          <div style={{ position: 'absolute', top: 'var(--space-6)', right: 'var(--space-8)', zIndex: 1 }}>
            <button className="btn btn-primary" onClick={startRecording}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/></svg>
              New recording
            </button>
          </div>
        )}
      </div>

      <div className="p-4 md:px-8 md:py-6" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

        {/* Recording overlay — floating blobs */}
        {recording && <RecordingOverlay onStop={stopRecording} startTime={startTimeRef.current} />}

        {/* Empty state */}
        {notes.length === 0 && !recording ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 'var(--space-8)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 'var(--radius-xl, 16px)',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)',
            }}>
              <MicIcon />
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md, 16px)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
              No voice notes yet
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 300, lineHeight: 1.5, marginBottom: 'var(--space-6)' }}>
              Capture ideas, feedback, or narration with a quick voice recording.
            </div>
            <button className="btn btn-primary" onClick={startRecording} style={{ padding: '10px 24px', fontSize: 'var(--text-sm)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/></svg>
              Record your first note
            </button>
            {micError && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', marginTop: 'var(--space-2)' }}>Microphone access denied. Check browser permissions.</div>}
          </div>
        ) : (
          /* Card grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-3)' }}>
            {[...notes].filter(n => n.status !== 'recording').reverse().map(note => (
              <div key={note.id}
                style={{
                  textAlign: 'left', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)',
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                  transition: 'border-color .15s, box-shadow .15s',
                  display: 'flex', flexDirection: 'column', gap: 'var(--space-1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                onClick={() => setViewId(note.id)}>

                {/* Row 1: title + menu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  {renameId === note.id ? (
                    <input autoFocus value={renameName} onChange={e => setRenameName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') setRenameId(null); }}
                      onBlur={handleRename} onClick={e => e.stopPropagation()}
                      style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', padding: '2px 6px', outline: 'none' }} />
                  ) : (
                    <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {note.title}
                    </div>
                  )}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div role="button" tabIndex={0} aria-label="More options"
                      style={{ width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', background: 'var(--color-overlay-light)', cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                      onClick={e => { e.stopPropagation(); setMenuId(menuId === note.id ? null : note.id); }}>
                      <DotsIcon />
                    </div>
                    {menuId === note.id && (
                      <div ref={menuRef} onClick={e => e.stopPropagation()}
                        style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 'var(--space-2)', minWidth: 150 }}>
                        {[
                          { label: 'Rename', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>, action: () => { setRenameName(note.title); setRenameId(note.id); setMenuId(null); } },
                          { label: 'Use in workflow', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>, action: () => {
                            const node: ContentNode = {
                              id: `text-source-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                              type: 'contentNode',
                              position: { x: 200, y: 150 },
                              deletable: true,
                              data: { subtype: 'text-source', label: 'Voice: ' + note.title.slice(0, 30), badge: '📝', category: 'source', description: 'From voice note', config: { text: note.transcript } },
                            };
                            useGraphStore.getState().addNode(node);
                            useOutputStore.getState().setOutput(node.id, { text: note.transcript });
                            setMenuId(null);
                            onUseInWorkflow?.();
                          } },
                          { label: 'Analyze in ScriptSense', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>, action: () => { if (note.transcript) onSendToScript?.(note.transcript); setMenuId(null); } },
                          { label: 'Delete', danger: true, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>, action: () => { setDeleteId(note.id); setMenuId(null); } },
                        ].map(opt => (
                          <button key={opt.label} onClick={opt.action}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', background: 'none', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-primary)', textAlign: 'left', transition: 'background 100ms' }}
                            onMouseEnter={e => { e.currentTarget.style.background = (opt as any).danger ? 'var(--color-danger-bg)' : 'var(--color-bg-surface)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}>
                            <span style={{ color: (opt as any).danger ? 'var(--color-danger-text)' : 'var(--color-text-tertiary)', display: 'flex' }}>{opt.icon}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: duration, date, status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {fmtDuration(note.durationMs)} · {fmtDate(note.createdAt)}
                  </div>
                  {note.status === 'transcribing' && statusBadge(note.status)}
                </div>

                {/* Transcript preview */}
                {note.transcript && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-disabled)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.transcript.slice(0, 120)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Voice note modal */}
      {viewId && (() => {
        const note = notes.find(n => n.id === viewId);
        if (!note || !note.transcript) return null;
        return (
          <ContentModal
            subtype="voice-source"
            title={note.title}
            text={note.transcript}
            onClose={() => setViewId(null)}
            onSave={(t: string) => updateNote(note.id, { transcript: t })}
            extraActions={[
              { label: 'Send to Script Writing', onClick: (t: string) => { onSendToScript?.(t); } },
              { label: 'Push to Workflow', onClick: (t: string) => {
                const node = {
                  id: `text-source-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
                  type: 'contentNode' as const,
                  position: { x: 200, y: 150 },
                  deletable: true,
                  data: { subtype: 'text-source', label: 'Voice: ' + note.title.slice(0, 30), badge: '📝', category: 'source' as const, description: 'From voice note', config: { text: t } },
                };
                useGraphStore.getState().addNode(node);
                useOutputStore.getState().setOutput(node.id, { text: t });
                onUseInWorkflow?.();
              }},
            ]}
          />
        );
      })()}

      {/* Delete confirmation */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)',
          animation: 'fadeIn 150ms ease',
        }} onClick={() => setDeleteId(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--color-bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)',
            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border-default)',
            maxWidth: 340, width: '100%', fontFamily: 'var(--font-sans)',
            animation: 'scaleIn 150ms ease',
          }}>
            <div style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Delete voice note?</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
              This will permanently remove "{notes.find(n => n.id === deleteId)?.title}" from your library.
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-destructive" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.4; } 100% { transform: scale(1.4); opacity: 0; } }
      `}</style>
    </div>
  );
}
