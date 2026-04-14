import { useEffect } from 'react';

interface OutputModalProps { title: string; text: string; wordCount: number; onClose: () => void }

export function OutputModal({ title, text, wordCount, onClose }: OutputModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-[720px] w-[90%] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
          <div>
            <div className="text-sm font-semibold text-[#18181b]">{title}</div>
            <div className="text-[10px] text-[#a1a1aa]">{wordCount} words</div>
          </div>
          <button className="text-[#a1a1aa] hover:text-[#18181b] text-lg" onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm leading-[1.8] text-[#18181b] whitespace-pre-wrap">{text}</div>
        <div className="flex gap-2 px-6 py-3 border-t border-[#e5e7eb]">
          <button className="text-xs px-3 py-1.5 border border-[#e5e7eb] rounded-md hover:bg-[#f4f4f5]" onClick={() => navigator.clipboard.writeText(text)}>Copy</button>
          <button className="text-xs px-3 py-1.5 border border-[#e5e7eb] rounded-md hover:bg-[#f4f4f5]" onClick={() => { const b = new Blob([text], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'output.txt'; a.click(); }}>Download .txt</button>
          <div className="flex-1" />
          <button className="text-xs px-3 py-1.5 bg-[#18181b] text-white rounded-md" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

interface ImageModalProps { src: string; info: string; onClose: () => void; onRegenerate?: () => void }

export function ImageModal({ src, info, onClose, onRegenerate }: ImageModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-3" onClick={onClose}>
      <img src={src} className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      <div className="text-[11px] text-white/70">{info}</div>
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button className="text-xs px-3 py-1.5 bg-white/10 text-white rounded-md hover:bg-white/20" onClick={() => { const a = document.createElement('a'); a.href = src; a.download = 'image.png'; a.click(); }}>Download ↓</button>
        {onRegenerate && <button className="text-xs px-3 py-1.5 bg-white/10 text-white rounded-md hover:bg-white/20" onClick={onRegenerate}>Regenerate</button>}
        <button className="text-xs px-3 py-1.5 bg-white/10 text-white rounded-md hover:bg-white/20" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
