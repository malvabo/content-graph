import { useCallback, useRef, useState, useEffect } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';

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
        result = selectedText.replace(/\bis\b/g, 'becomes').replace(/\bwas\b/g, 'proved to be');
      } else if (action === 'expand') {
        const sentences = selectedText.match(/[^.!?]+[.!?]+/g) || [selectedText];
        const last = sentences[sentences.length - 1]?.trim() || selectedText;
        result = selectedText + ` To elaborate — ${last.charAt(0).toLowerCase() + last.slice(1).replace(/[.!?]+$/, '')} has broader implications worth exploring.`;
      } else if (action === 'condense') {
        const sentences = selectedText.match(/[^.!?]+[.!?]+/g) || [selectedText];
        result = sentences.length <= 1 ? selectedText.split(/,\s*/).slice(0, Math.ceil(selectedText.split(/,\s*/).length / 2)).join(', ') : sentences.slice(0, Math.ceil(sentences.length / 2)).join(' ').trim();
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

  // Preview state: show accept/revert
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

export function TextSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const text = (config?.text as string) ?? '';
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popover, setPopover] = useState<{ x: number; y: number; start: number; end: number; text: string } | null>(null);

  const onChange = useCallback((val: string) => { updateConfig(id, { text: val }); setOutput(id, { text: val }); }, [id, updateConfig, setOutput]);

  const onMouseUp = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) { setPopover(null); return; }
    const selected = text.slice(start, end);
    if (selected.trim().length < 3) { setPopover(null); return; }
    // Measure Y of selection within textarea using a mirror div
    const mirror = document.createElement('div');
    const cs = getComputedStyle(ta);
    mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;width:${ta.clientWidth}px;font-size:${cs.fontSize};font-family:${cs.fontFamily};line-height:${cs.lineHeight};padding:${cs.padding};border:${cs.border};letter-spacing:${cs.letterSpacing};`;
    mirror.textContent = ta.value.slice(0, start);
    document.body.appendChild(mirror);
    const h = mirror.scrollHeight;
    document.body.removeChild(mirror);
    const y = ta.offsetTop + h - ta.scrollTop;
    setPopover({ x: ta.offsetWidth / 2, y, start, end, text: selected });
  }, [text]);

  const handleApply = useCallback((newText: string, preview?: boolean) => {
    if (!popover) return;
    const updated = text.slice(0, popover.start) + newText + text.slice(popover.end);
    onChange(updated);
    if (!preview) setPopover(null);
    else setPopover({ ...popover, end: popover.start + newText.length, text: newText });
  }, [popover, text, onChange]);

  const charCount = text.length;
  const charColor = charCount > 50000 ? 'var(--color-danger)' : charCount > 40000 ? 'var(--p-amber-600)' : 'var(--color-text-placeholder)';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, position: 'relative' }}>
      {popover && (
        <AiEditPopover
          selectedText={popover.text}
          position={{ x: popover.x, y: popover.y }}
          onApply={handleApply}
          onClose={() => setPopover(null)}
        />
      )}
      <textarea ref={textareaRef} className="nowheel form-textarea" style={{ flex: 1, minHeight: 0 }}
        placeholder="Paste your article, transcript, or notes..." value={text} onChange={(e) => onChange(e.target.value)} onMouseUp={onMouseUp} />
      <div className="text-right text-sm" style={{ color: charColor }}>{charCount.toLocaleString()} / 50,000</div>
    </div>
  );
}

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
    reader.readAsText(f);
  }, [id, updateConfig, setOutput]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 8 }}>
      {fileName ? (
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] rounded-lg px-2 py-1.5">
          <span>{fileName}</span><span>·</span><span>{text.split(/\s+/).length.toLocaleString()} words</span><span>·</span><span>{((config?.fileSize as number ?? 0) / 1024).toFixed(0)} KB</span>
          <button className="ml-auto w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-placeholder)] hover:text-[var(--color-danger)]" aria-label="Remove file" onClick={() => updateConfig(id, { text: '', fileName: undefined })}>✕</button>
        </div>
      ) : (
        <div className={`border border-dashed border-[var(--color-text-disabled)] rounded-lg flex-1 flex flex-col items-center justify-center text-sm text-[var(--color-text-placeholder)] cursor-pointer hover:border-solid hover:bg-[var(--color-bg-surface)] transition ${dragOver ? 'border-solid bg-[var(--color-bg-surface)]' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
          ↑ Drop .txt .md .docx or click
          <input ref={fileRef} type="file" accept=".txt,.md,.docx" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      )}
    </div>
  );
}

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
    reader.readAsDataURL(f);
  }, [id, updateConfig, setOutput]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 8 }}>
      {preview ? (
        <div className="relative flex-1">
          <img src={preview} alt={fileName || 'Uploaded image'} className="w-full h-full object-contain rounded-lg" style={{ background: 'var(--color-bg-surface)' }} />
          <button className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[var(--color-overlay-backdrop)] text-white text-xs flex items-center justify-center"
            onClick={() => updateConfig(id, { imagePreview: undefined, fileName: undefined, dimensions: undefined })}>✕</button>
          <div className="text-sm text-[var(--color-text-placeholder)] mt-1">{fileName} · {config?.dimensions as string}</div>
        </div>
      ) : (
        <div className={`w-full flex-1 border border-dashed border-[var(--color-text-disabled)] rounded-lg flex flex-col items-center justify-center text-sm text-[var(--color-text-placeholder)] cursor-pointer hover:border-solid hover:bg-[var(--color-bg-surface)] transition ${dragOver ? 'border-solid bg-[var(--color-bg-surface)]' : ''}`}
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
