import { useCallback, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';

export function TextSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const text = (config?.text as string) ?? '';

  const onChange = useCallback((val: string) => { updateConfig(id, { text: val }); setOutput(id, { text: val }); }, [id, updateConfig, setOutput]);

  const charCount = text.length;
  const charColor = charCount > 50000 ? 'var(--cg-red)' : charCount > 40000 ? '#f59e0b' : '#78716c';

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <textarea className="w-full min-h-[120px] max-h-[300px] resize-y text-sm leading-relaxed border border-[var(--cg-border)] rounded-lg p-2 outline-none focus:border-[var(--cg-green)] bg-white"
        placeholder="Paste your article, transcript, or notes..." value={text} onChange={(e) => onChange(e.target.value)} />
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
