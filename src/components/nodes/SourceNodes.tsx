import { useCallback, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { generateSourceTitle } from '../../utils/sourceUtils';

// ─── Shared popover shell (portal, closes on Escape or backdrop click) ───────

function SourcePopoverShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>,
    document.body
  );
}

// ─── AI text editing popover (triggered on textarea selection) ────────────

function AiEditPopover({ selectedText, position, onApply, onClose }: {
  selectedText: string; position: { x: number; y: number }; onApply: (newText: string, preview?: boolean) => void; onClose: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { if (preview) { onApply(selectedText); } onClose(); } };
    const tid = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(tid); document.removeEventListener('mousedown', handler); };
  }, [onClose, preview, onApply, selectedText]);

  const quickAction = (action: string) => {
    setLoading(true);
    setTimeout(() => {
      let result = selectedText;
      if (action === 'engaging') {
        result = selectedText.replace(/\bIt is\b/g, "It's").replace(/\bit is\b/g, "it's").replace(/\bdo not\b/g, "don't").replace(/\bDo not\b/g, "Don't").replace(/\bcannot\b/g, "can't").replace(/\bwill not\b/g, "won't");
        if (/^[A-Z][a-z]/.test(result) && !result.startsWith('Here') && !result.startsWith('This')) {
          result = 'Here\'s the thing — ' + result.charAt(0).toLowerCase() + result.slice(1);
        }
      } else if (action === 'expand') {
        const sentences = selectedText.match(/[^.!?]+[.!?]+\s*/g) || [selectedText];
        const elaboration = sentences.length > 1
          ? ' This is particularly worth noting because it shapes how we think about the broader context.'
          : ' In other words, this carries more weight than it might first appear — and the implications extend further than expected.';
        result = sentences[0].trim() + elaboration + ' ' + sentences.slice(1).join('').trim();
      } else if (action === 'condense') {
        const sentences = selectedText.match(/[^.!?]+[.!?]+\s*/g);
        if (!sentences || sentences.length <= 1) {
          result = selectedText.replace(/\b(very|really|just|quite|rather|somewhat|actually|basically|literally|definitely)\s+/gi, '').replace(/\s{2,}/g, ' ').trim();
        } else {
          const keep = Math.max(1, Math.ceil(sentences.length * 0.6));
          result = sentences.slice(0, keep).join('').trim();
        }
      } else if (action === 'custom' && prompt) {
        result = `[${prompt}]: ${selectedText}`;
      }
      setPreview(result);
      onApply(result, true);
      setLoading(false);
    }, 500);
  };

  const accept = () => { if (preview) { onApply(preview, false); onClose(); } };
  const revert = () => { onApply(selectedText, false); setPreview(null); setShowPrompt(true); };

  if (preview) {
    return (
      <div ref={ref} className="absolute z-50" style={{ left: position.x, top: position.y, transform: 'translate(-50%, -100%)' }}>
        <div className="w-[240px] rounded-xl p-3 flex flex-col gap-2" style={{ background: 'var(--color-bg-popover)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="text-field-label">AI edited text</div>
          <div className="nowheel text-sm leading-relaxed max-h-[80px] overflow-y-auto rounded-lg p-2" style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', scrollbarWidth: 'thin' }}>{preview}</div>
          <div className="flex gap-1.5">
            <button className="btn-xs btn-outline flex-1" onClick={revert}>↩ Revert</button>
            <button className="btn-xs btn-primary flex-1" onClick={accept}>✓ Accept</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute z-50" style={{ left: position.x, top: position.y, transform: 'translate(-50%, -100%)' }}>
      {!showPrompt ? (
        <div className="flex items-center gap-0.5 rounded-xl px-1 py-1" style={{ background: 'var(--color-bg-popover)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--color-border-subtle)' }}>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--color-bg-surface)] transition" title="AI Edit"
            onClick={() => setShowPrompt(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
          </button>
        </div>
      ) : (
        <div className="w-[240px] rounded-xl p-3 flex flex-col gap-2.5" style={{ background: 'var(--color-bg-popover)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="text-field-label">Edit this text</div>
          <div className="flex gap-1.5">
            <input className="form-input flex-1"
              placeholder="How to edit this text?"
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') quickAction('custom'); }}
              autoFocus />
            <button className="w-8 h-8 rounded-lg flex items-center justify-center border" disabled={loading}
              style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-primary)', borderColor: 'var(--color-border-default)' }}
              onClick={() => quickAction('custom')}>→</button>
          </div>
          <div className="text-field-label">Writing</div>
          <div className="flex flex-wrap gap-1.5">
            <button className="btn-xs btn-outline" disabled={loading} onClick={() => quickAction('engaging')}>✨ More engaging</button>
            <button className="btn-xs btn-outline" disabled={loading} onClick={() => quickAction('expand')}>↕ Expand</button>
            <button className="btn-xs btn-outline" disabled={loading} onClick={() => quickAction('condense')}>⇕ Condense</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Text source popover (full-screen overlay with textarea) ──────────────

function TextSourcePopover({ initialText, onSave, onClose }: {
  initialText: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [aiPopover, setAiPopover] = useState<{ x: number; y: number; start: number; end: number; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = text.length;
  const charColor = charCount > 50000 ? 'var(--color-danger)' : charCount > 40000 ? 'var(--p-amber-600)' : 'var(--color-text-placeholder)';

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) { setAiPopover(null); return; }
    const selected = text.slice(start, end);
    if (selected.trim().length < 3) { setAiPopover(null); return; }
    const mirror = document.createElement('div');
    const cs = getComputedStyle(ta);
    mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:${ta.clientWidth}px;font-size:${cs.fontSize};font-family:${cs.fontFamily};line-height:${cs.lineHeight};padding:${cs.padding};border:${cs.border};letter-spacing:${cs.letterSpacing};`;
    mirror.textContent = ta.value.slice(0, start);
    document.body.appendChild(mirror);
    const h = mirror.scrollHeight;
    document.body.removeChild(mirror);
    const y = ta.offsetTop + h - ta.scrollTop;
    setAiPopover({ x: ta.offsetWidth / 2, y, start, end, text: selected });
  }, [text]);

  const handleApply = useCallback((newText: string, preview?: boolean) => {
    if (!aiPopover) return;
    const updated = text.slice(0, aiPopover.start) + newText + text.slice(aiPopover.end);
    setText(updated);
    if (!preview) setAiPopover(null);
    else setAiPopover({ ...aiPopover, end: aiPopover.start + newText.length, text: newText });
  }, [aiPopover, text]);

  return (
    <SourcePopoverShell onClose={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '92vw',
          background: 'var(--color-bg-card)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-subtle)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Write a text</span>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Textarea area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px 20px', minHeight: 0, position: 'relative' }}>
          {aiPopover && (
            <AiEditPopover
              selectedText={aiPopover.text}
              position={{ x: aiPopover.x, y: aiPopover.y }}
              onApply={handleApply}
              onClose={() => setAiPopover(null)}
            />
          )}
          <textarea
            ref={textareaRef}
            className="nowheel form-textarea"
            style={{ flex: 1, minHeight: 280, resize: 'none' }}
            placeholder="Paste your article, transcript, or notes..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onMouseUp={onMouseUp}
            autoFocus
          />
          <div style={{ textAlign: 'right', fontSize: 'var(--text-sm)', color: charColor, marginTop: 6, flexShrink: 0 }}>
            {charCount.toLocaleString()} / 50,000
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle)', flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(text)} disabled={charCount > 50000}>Save</button>
        </div>
      </div>
    </SourcePopoverShell>
  );
}

// ─── Text source node ─────────────────────────────────────────────

export function TextSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const text = (config?.text as string) ?? '';
  const title = (config?.title as string) ?? '';
  const [open, setOpen] = useState(false);

  const handleSave = useCallback(async (newText: string) => {
    setOpen(false);
    updateConfig(id, { text: newText });
    setOutput(id, { text: newText });
    if (newText.trim()) {
      const t = await generateSourceTitle(newText);
      updateConfig(id, { title: t });
    }
  }, [id, updateConfig, setOutput]);

  const displayTitle = title || (text ? text.trim().split(/\s+/).slice(0, 5).join(' ') : '');
  const wordCount = text ? text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div
      className="nowheel"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}
    >
      {text ? (
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
          }}
        >
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
              color: 'var(--color-text-primary)', lineHeight: 'var(--leading-snug)',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
            }}>
              {displayTitle}
            </div>
            {text && (
              <div style={{
                flex: 1, minHeight: 0, marginTop: 4,
                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-snug)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
                WebkitMaskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
                maskImage: 'linear-gradient(to bottom, #000 70%, transparent 100%)',
              }}>
                {text}
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
              {wordCount.toLocaleString()} words
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            style={{
              marginTop: 10, alignSelf: 'flex-start',
              background: 'none', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)', padding: '3px 10px',
              fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            flex: 1,
            border: '1px dashed var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            background: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
            color: 'var(--color-text-placeholder)',
            transition: 'background 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderStyle = 'solid'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderStyle = 'dashed'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Write a text
        </button>
      )}

      {open && (
        <TextSourcePopover
          initialText={text}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ─── File source node (unchanged) ─────────────────────────────────────────────

export function FileSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const text = (config?.text as string) ?? '';
  const fileName = config?.fileName as string | undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => { const c = reader.result as string; updateConfig(id, { text: c, fileName: f.name, fileSize: f.size }); setOutput(id, { text: c }); };
    reader.onerror = () => { console.error('Failed to read file'); };
    reader.readAsText(f);
  }, [id, updateConfig, setOutput]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 'var(--space-2)' }}>
      {fileName ? (
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] rounded-lg px-2 py-1.5">
          <span>{fileName}</span><span>·</span><span>{text.split(/\s+/).length.toLocaleString()} words</span><span>·</span><span>{((config?.fileSize as number ?? 0) / 1024).toFixed(0)} KB</span>
          <button className="ml-auto w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-placeholder)] hover:text-[var(--color-danger)]" aria-label="Remove file" onClick={() => updateConfig(id, { text: '', fileName: undefined })}>✕</button>
        </div>
      ) : (
        <div className={`border border-dashed border-[var(--color-text-disabled)] rounded-lg flex-1 flex flex-col items-center justify-center text-sm text-[var(--color-text-placeholder)] cursor-pointer hover:border-solid hover:bg-[var(--color-bg-surface)] transition ${dragOver ? 'border-solid bg-[var(--color-bg-surface)]' : ''}`}
          role="button" tabIndex={0} aria-label="Upload file"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
          ↑ Drop .txt .md or click
          <input ref={fileRef} type="file" accept=".txt,.md" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      )}
    </div>
  );
}

// ─── Image source node (unchanged) ──────────────────────────────────────────────

export function ImageSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const preview = config?.imagePreview as string | undefined;
  const fileName = config?.fileName as string | undefined;
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const desc = `[Image: ${f.name}, ${img.width}×${img.height}]`;
        updateConfig(id, { imagePreview: url, fileName: f.name, dimensions: `${img.width} × ${img.height}` });
        setOutput(id, { text: desc });
      };
      img.src = url;
    };
    reader.onerror = () => { console.error('Failed to read image'); };
    reader.readAsDataURL(f);
  }, [id, updateConfig, setOutput]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 'var(--space-2)' }}>
      {preview ? (
        <div className="relative flex-1">
          <img src={preview} alt={fileName || 'Uploaded image'} className="w-full h-full object-contain rounded-lg" style={{ background: 'var(--color-bg-surface)' }} />
          <button className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--color-overlay-backdrop)] text-white text-xs flex items-center justify-center"
            onClick={() => updateConfig(id, { imagePreview: undefined, fileName: undefined, dimensions: undefined })}>✕</button>
          <div className="text-sm text-[var(--color-text-placeholder)] mt-1">{fileName} · {config?.dimensions as string}</div>
        </div>
      ) : (
        <div className={`w-full flex-1 border border-dashed border-[var(--color-text-disabled)] rounded-lg flex flex-col items-center justify-center text-sm text-[var(--color-text-placeholder)] cursor-pointer hover:border-solid hover:bg-[var(--color-bg-surface)] transition ${dragOver ? 'border-solid bg-[var(--color-bg-surface)]' : ''}`}
          role="button" tabIndex={0} aria-label="Upload image"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
          ↑ Drop image or click
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      )}
    </div>
  );
}

// ─── Link source popover ───────────────────────────────────────────────────

async function fetchLinkTitle(url: string): Promise<string> {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      const match = (data.contents as string | undefined)?.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (match?.[1]) return match[1].trim().slice(0, 80);
    }
  } catch { /* fall through */ }
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { /* fall through */ }
  return url;
}

function LinkSourcePopover({ initialUrl, onSave, onClose }: {
  initialUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <SourcePopoverShell onClose={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '92vw',
          background: 'var(--color-bg-card)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-subtle)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>Paste a link</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* URL input */}
        <div style={{ padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>URL</label>
          <input
            ref={inputRef}
            type="url"
            className="form-input"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) onSave(url.trim()); }}
            autoFocus
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--color-border-subtle)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { if (url.trim()) onSave(url.trim()); }} disabled={!url.trim()}>Save</button>
        </div>
      </div>
    </SourcePopoverShell>
  );
}

// ─── Link source node ───────────────────────────────────────────────────

export function LinkSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const url = (config?.url as string) ?? '';
  const title = (config?.title as string) ?? '';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = useCallback(async (newUrl: string) => {
    setOpen(false);
    setLoading(true);
    const fetchedTitle = await fetchLinkTitle(newUrl);
    updateConfig(id, { url: newUrl, title: fetchedTitle });
    setOutput(id, { text: `[Link: ${newUrl}]\nTitle: ${fetchedTitle}` });
    setLoading(false);
  }, [id, updateConfig, setOutput]);

  const displayTitle = title || (url ? (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } })() : '');

  return (
    <div
      className="nowheel"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}
    >
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-placeholder)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
          Fetching title…
        </div>
      ) : url ? (
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500,
              color: 'var(--color-text-primary)', lineHeight: 'var(--leading-snug)',
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {displayTitle}
            </div>
            <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {url}
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            style={{
              marginTop: 10, alignSelf: 'flex-start',
              background: 'none', border: '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-sm)', padding: '3px 10px',
              fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)',
              color: 'var(--color-text-secondary)', cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{
            flex: 1,
            border: '1px dashed var(--color-border-default)',
            borderRadius: 'var(--radius-lg)',
            background: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
            color: 'var(--color-text-placeholder)',
            transition: 'background 150ms, border-color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-surface)'; e.currentTarget.style.borderStyle = 'solid'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderStyle = 'dashed'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Paste a link
        </button>
      )}

      {open && (
        <LinkSourcePopover
          initialUrl={url}
          onSave={handleSave}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
