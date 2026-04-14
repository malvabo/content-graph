import { useCallback, useRef } from 'react';
import { useGraphStore } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';

export function TextSourceInline({ id }: { id: string }) {
  const config = useGraphStore((s) => s.nodes.find((n) => n.id === id)?.data.config);
  const updateConfig = useGraphStore((s) => s.updateNodeConfig);
  const setOutput = useOutputStore((s) => s.setOutput);
  const text = (config?.text as string) ?? '';
  const file = config?.fileName as string | undefined;
  const fileRef = useRef<HTMLInputElement>(null);

  const onChange = useCallback((val: string) => { updateConfig(id, { text: val }); setOutput(id, { text: val }); }, [id, updateConfig, setOutput]);
  const onFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => { const c = reader.result as string; updateConfig(id, { text: c, fileName: f.name }); setOutput(id, { text: c }); };
    reader.readAsText(f);
  }, [id, updateConfig, setOutput]);

  const charCount = text.length;
  const charColor = charCount > 50000 ? '#ef4444' : charCount > 40000 ? '#f59e0b' : '#a1a1aa';

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <textarea className="w-full min-h-[120px] max-h-[300px] resize-y text-xs leading-relaxed border border-[#e5e7eb] rounded-lg p-2 outline-none focus:border-[#6366f1] bg-white"
        placeholder="Paste your article, transcript, or notes..." value={text} onChange={(e) => onChange(e.target.value)} />
      <div className="text-right text-[10px]" style={{ color: charColor }}>{charCount.toLocaleString()} / 50,000</div>
      {file ? (
        <div className="flex items-center gap-1.5 text-[11px] text-[#71717a] bg-[#f4f4f5] rounded-lg px-2 py-1.5">
          <span>{file}</span><span>·</span><span>{text.split(/\s+/).length.toLocaleString()} words</span>
          <button className="ml-auto text-[#a1a1aa] hover:text-[#ef4444]" onClick={() => updateConfig(id, { text: '', fileName: undefined })}>✕</button>
        </div>
      ) : (
        <div className="border border-dashed border-[#d1d5db] rounded-lg h-9 flex items-center justify-center text-[11px] text-[#a1a1aa] cursor-pointer hover:border-solid hover:bg-[#fafafa] transition"
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
  const preview = config?.imagePreview as string | undefined;
  const fileName = config?.fileName as string | undefined;
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const img = new Image();
      img.onload = () => updateConfig(id, { imagePreview: url, fileName: f.name, dimensions: `${img.width} × ${img.height}` });
      img.src = url;
    };
    reader.readAsDataURL(f);
  }, [id, updateConfig]);

  return (
    <div className="mt-2">
      {preview ? (
        <div className="relative">
          <img src={preview} className="w-full h-[140px] object-cover rounded-lg" />
          <button className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center"
            onClick={() => updateConfig(id, { imagePreview: undefined, fileName: undefined, dimensions: undefined })}>✕</button>
          <div className="text-[10px] text-[#a1a1aa] mt-1">{fileName} · {config?.dimensions as string}</div>
        </div>
      ) : (
        <div className="w-full h-[140px] border border-dashed border-[#d1d5db] rounded-lg flex flex-col items-center justify-center text-[11px] text-[#a1a1aa] cursor-pointer hover:border-solid hover:bg-[#fafafa] transition"
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
