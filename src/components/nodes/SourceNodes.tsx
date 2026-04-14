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
    setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, preview, onApply, selectedText]);

  const quickAction = (action: string) => {
    setLoading(true);
    setTimeout(() => {
      let result = selectedText;
      if (action === 'engaging') result = selectedText.replace(/\.\s/g, '! ').replace(/^(.)/,(_,c)=>c.toUpperCase());
      else if (action === 'expand') result = selectedText + ' Furthermore, this point deserves deeper exploration as it connects to broader themes that impact the overall narrative.';
      else if (action === 'condense') {
        const sentences = selectedText.split(/[.!?]\s+/).filter(Boolean);
        result = sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join('. ') + '.';
      } else if (action === 'custom' && prompt) {
        result = `[${prompt}]: ${selectedText}`;
      }
      setPreview(result);
      onApply(result, true); // apply as preview
      setLoading(false);
    }, 500);
  };

  const accept = () => { if (preview) { onApply(preview, false); onClose(); } };
  const revert = () => { onApply(selectedText, false); setPreview(null); setShowPrompt(true); };

  // Preview state: show accept/revert
  if (preview) {
    return (
      <div ref={ref} className="absolute z-50" style={{ left: position.x, top: position.y }}>
        <div className="w-[240px] rounded-xl p-3 flex flex-col gap-2" style={{ background: '#f2efe9', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid #e6e3dd' }}>
          <div style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.3em', textTransform: 'uppercase' }}>AI edited text</div>
          <div className="text-sm leading-relaxed max-h-[80px] overflow-y-auto rounded-lg p-2" style={{ background: 'var(--cg-surface)', color: 'var(--cg-ink)', scrollbarWidth: 'thin' }}>{preview}</div>
          <div className="flex gap-1.5">
            <button className="btn-xs btn-outline flex-1" onClick={revert}>↩ Revert</button>
            <button className="btn-xs btn-primary flex-1" onClick={accept}>✓ Accept</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="absolute z-50" style={{ left: position.x, top: position.y }}>
      {!showPrompt ? (
        <div className="flex items-center gap-0.5 rounded-xl px-1 py-1" style={{ background: '#f2efe9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e6e3dd' }}>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--cg-surface)] transition" title="AI Edit"
            onClick={() => setShowPrompt(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cg-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
          </button>
        </div>
      ) : (
        <div className="w-[240px] rounded-xl p-3 flex flex-col gap-2.5" style={{ background: '#f2efe9', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1px solid #e6e3dd' }}>
          <div style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Edit this text</div>
          <div className="flex gap-1.5">
            <input className="flex-1 h-8 text-sm rounded-lg border border-[var(--cg-border)] px-2 outline-none focus:border-[var(--cg-green)]"
              placeholder="How to edit this text?"
              value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') quickAction('custom'); }}
              autoFocus />
            <button className="w-8 h-8 rounded-lg flex items-center justify-center border" disabled={loading}
              style={{ background: '#fff', color: 'var(--cg-ink)', borderColor: 'var(--cg-border)' }}
              onClick={() => quickAction('custom')}>→</button>
          </div>
          <div style={{ font: '500 11px/1 var(--font-mono)', color: '#6d6d6d', letterSpacing: '0.3em', textTransform: 'uppercase' }}>Writing</div>
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
    const rect = ta.getBoundingClientRect();
    const parentRect = ta.parentElement?.getBoundingClientRect();
    if (!parentRect) return;
    setPopover({ x: 0, y: rect.top - parentRect.top - 40, start, end, text: selected });
  }, [text]);

  const handleApply = useCallback((newText: string, preview?: boolean) => {
    if (!popover) return;
    const updated = text.slice(0, popover.start) + newText + text.slice(popover.end);
    onChange(updated);
    if (!preview) setPopover(null);
    else setPopover({ ...popover, end: popover.start + newText.length, text: newText });
  }, [popover, text, onChange]);

  const charCount = text.length;
  const charColor = charCount > 50000 ? 'var(--cg-red)' : charCount > 40000 ? '#f59e0b' : '#78716c';

  return (
    <div className="mt-2 flex flex-col gap-1.5 relative">
      {popover && (
        <AiEditPopover
          selectedText={popover.text}
          position={{ x: popover.x, y: popover.y }}
          onApply={handleApply}
          onClose={() => setPopover(null)}
        />
      )}
      <textarea ref={textareaRef} className="w-full min-h-[120px] max-h-[300px] resize-y text-sm leading-relaxed border border-[var(--cg-border)] rounded-lg p-2 outline-none focus:border-[var(--cg-green)] bg-white"
        placeholder="Paste your article, transcript, or notes..." value={text} onChange={(e) => onChange(e.target.value)} onMouseUp={onMouseUp} />
      <div className="text-right text-[14px]" style={{ color: charColor }}>{charCount.toLocaleString()} / 50,000</div>
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

  const onFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => { const c = reader.result as string; updateConfig(id, { text: c, fileName: f.name }); setOutput(id, { text: c }); };
    reader.readAsText(f);
  }, [id, updateConfig, setOutput]);

  return (
    <div className="mt-2">
      {fileName ? (
        <div className="flex items-center gap-1.5 text-[14px] text-[#57534e] bg-[var(--cg-surface)] rounded-lg px-2 py-1.5">
          <span>{fileName}</span><span>·</span><span>{text.split(/\s+/).length.toLocaleString()} words</span>
          <button className="ml-auto text-[#78716c] hover:text-[var(--cg-red)]" onClick={() => updateConfig(id, { text: '', fileName: undefined })}>✕</button>
        </div>
      ) : (
        <div className="border border-dashed border-[#a8a29e] rounded-lg h-20 flex flex-col items-center justify-center text-[14px] text-[#78716c] cursor-pointer hover:border-solid hover:bg-[var(--cg-surface)] transition"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
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
    <div className="mt-2">
      {preview ? (
        <div className="relative">
          <img src={preview} className="w-full h-[140px] object-cover rounded-lg" />
          <button className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center"
            onClick={() => updateConfig(id, { imagePreview: undefined, fileName: undefined, dimensions: undefined })}>✕</button>
          <div className="text-[14px] text-[#78716c] mt-1">{fileName} · {config?.dimensions as string}</div>
        </div>
      ) : (
        <div className="w-full h-[140px] border border-dashed border-[#a8a29e] rounded-lg flex flex-col items-center justify-center text-[14px] text-[#78716c] cursor-pointer hover:border-solid hover:bg-[var(--cg-surface)] transition"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}>
          ↑ Drop image or click
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
      )}
    </div>
  );
}
