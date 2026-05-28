import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettingsStore } from '../../store/settingsStore';
import { useGenerationsStore } from '../../store/generationsStore';

// ─── Models ────────────────────────────────────────────────────────────────

type SourceType = 'file' | 'text' | 'link' | 'voice' | 'image';
interface SourceItem { id: string; type: SourceType; label: string; content: string }

interface ContentFormat { id: string; label: string; description: string }

const allFormats: ContentFormat[] = [
  { id: 'newsletter',     label: 'Newsletter',        description: 'Digest with key takeaways from your source' },
  { id: 'linkedin',       label: 'LinkedIn Post',     description: 'Professional hook post, 150–300 words' },
  { id: 'twitter',        label: 'Twitter Thread',    description: '5–10 tweet thread from your source' },
  { id: 'blog',           label: 'Blog Post',         description: 'Long-form SEO-friendly article' },
  { id: 'email',          label: 'Email',             description: 'Concise campaign or outreach email' },
  { id: 'instagram',      label: 'Instagram Caption', description: 'Short engaging caption with hashtags' },
  { id: 'youtube',        label: 'YouTube Script',    description: 'Hook, body & CTA for video' },
  { id: 'podcast',        label: 'Podcast Script',    description: 'Episode outline and talking points' },
  { id: 'press',          label: 'Press Release',     description: 'Formal media announcement' },
  { id: 'landing',        label: 'Landing Page',      description: 'Headline, sections and CTA copy' },
  { id: 'twitter-single', label: 'Twitter Single',    description: 'Most quotable insight, one tweet' },
  { id: 'video',          label: 'Video Script',      description: 'AI video generation script' },
];

const brands = ['Default', 'Personal', 'Work', 'Brand A', 'Brand B'];

interface FormatTemplate { id: string; label: string; formatIDs: string[] }
const popularTemplates: FormatTemplate[] = [
  { id: 'social-pack', label: 'Social pack',  formatIDs: ['linkedin', 'twitter', 'instagram'] },
  { id: 'newsletter',  label: 'Newsletter',   formatIDs: ['newsletter'] },
  { id: 'blog',        label: 'Blog post',    formatIDs: ['blog'] },
  { id: 'video',       label: 'Video script', formatIDs: ['youtube', 'video'] },
  { id: 'research',    label: 'Research pack', formatIDs: ['newsletter', 'blog', 'twitter'] },
];

interface FormatTemplate2 { id: string; name: string; description: string; formatIDs: string[] }
const allTemplates: FormatTemplate2[] = [
  { id: 'newsletter',   name: 'Newsletter',    description: 'Digest with key takeaways from your source',     formatIDs: ['newsletter'] },
  { id: 'social-pack',  name: 'Social Pack',   description: 'LinkedIn post + Twitter thread from one source', formatIDs: ['linkedin', 'twitter'] },
  { id: 'blog',         name: 'Blog Post',     description: 'Long-form SEO-friendly article',                 formatIDs: ['blog'] },
  { id: 'video-script', name: 'Video Script',  description: 'Hook, body & CTA for YouTube or Reels',          formatIDs: ['youtube', 'video'] },
  { id: 'email',        name: 'Email',         description: 'Concise campaign or outreach email',             formatIDs: ['email'] },
  { id: 'podcast',      name: 'Podcast',       description: 'Episode outline and talking points',             formatIDs: ['podcast'] },
  { id: 'press',        name: 'Press Release', description: 'Formal media announcement',                     formatIDs: ['press'] },
  { id: 'landing',      name: 'Landing Page',  description: 'Headline, sections and CTA copy',               formatIDs: ['landing'] },
];

const BG = '#1A1513';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';

// ─── AnimatedLightsButton ──────────────────────────────────────────────────

function AnimatedLightsButton({
  title, icon, isEnabled = true, onClick,
}: { title: string; icon?: 'sparkles' | null; isEnabled?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={isEnabled ? onClick : undefined}
      disabled={!isEnabled}
      style={{
        position: 'relative', width: '100%', height: 54, borderRadius: 22,
        background: '#0F121A', border: `0.5px solid rgba(255,255,255,${isEnabled ? 0.13 : 0.06})`,
        overflow: 'hidden', cursor: isEnabled ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
    >
      {isEnabled && (
        <>
          <motion.div
            initial={{ x: 80 }}
            animate={{ x: -80 }}
            transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            style={{
              position: 'absolute', width: 220, height: 100, borderRadius: '50%',
              background: 'rgba(217,115,26,0.60)', filter: 'blur(44px)', pointerEvents: 'none',
            }}
          />
          <motion.div
            initial={{ x: -80 }}
            animate={{ x: 80 }}
            transition={{ duration: 5, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            style={{
              position: 'absolute', width: 220, height: 100, borderRadius: '50%',
              background: 'rgba(191,77,13,0.45)', filter: 'blur(44px)', pointerEvents: 'none',
            }}
          />
        </>
      )}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
        color: isEnabled ? '#fff' : 'rgba(255,255,255,0.25)', fontSize: 18, fontWeight: 600,
        fontFamily: 'var(--font-sans)',
      }}>
        {icon === 'sparkles' && <SparkIcon />}
        <span>{title}</span>
      </div>
    </button>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────

function SparkIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
}

function XIcon({ size = 12 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>;
}

function ChevronRight() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>;
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 8V4h-4M14 10l6-6M4 16v4h4M10 14l-6 6"/>
    </svg>
  );
}

function SourceIcon({ type }: { type: SourceType }) {
  const stroke = 'rgba(255,255,255,0.45)';
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (type) {
    case 'voice': return <svg {...common}><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 12h2"/></svg>;
    case 'text':  return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10"/></svg>;
    case 'link':  return <svg {...common}><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>;
    case 'file':  return <svg {...common}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6"/></svg>;
    case 'image': return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
  }
}

// ─── GlassCard ─────────────────────────────────────────────────────────────

function GlassCard({ children, allowOverflow = false }: { children: React.ReactNode; allowOverflow?: boolean }) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 18,
      overflow: allowOverflow ? 'visible' : 'hidden', backdropFilter: 'blur(8px)',
      position: 'relative',
    }}>{children}</div>
  );
}

function buildSourceContext(items: SourceItem[]): string {
  return items.map(s => {
    let head: string;
    switch (s.type) {
      case 'link':  head = `LINK — ${s.label}`; break;
      case 'voice': head = 'VOICE NOTE TRANSCRIPT'; break;
      case 'text':  head = 'TEXT SOURCE'; break;
      case 'file':  head = `FILE — ${s.label}`; break;
      case 'image': head = `IMAGE — ${s.label}`; break;
    }
    return `[${head}]\n${s.content || s.label}`;
  }).join('\n\n');
}

function parseGenerationResults(raw: string): { header: string; content: string }[] {
  const out: { header: string; content: string }[] = [];
  const sections = raw.split(/\n{0,2}-{3,}\n{0,2}/);
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const nl = trimmed.indexOf('\n');
    if (nl === -1) continue;
    const header = trimmed.slice(0, nl).replace(/^#+\s*|\*\*/g, '').trim();
    const content = trimmed.slice(nl + 1).trim();
    if (header && content) out.push({ header, content });
  }
  return out;
}

function truncateLabel(raw: string, max = 32): string {
  const t = raw.trim();
  if (!t) return '';
  const oneLine = t.split(/\n/)[0].replace(/\s+/g, ' ');
  if (oneLine.length <= max) return oneLine;
  const cut = oneLine.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmedCut = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmedCut.trimEnd() + '…';
}

// ─── Sheet wrapper (bottom modal with drag-to-close) ───────────────────────

function Sheet({ isOpen, onClose, children, height = 'auto', scrollable = true }: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; height?: number | 'auto' | string; scrollable?: boolean;
}) {
  const [isMini, setIsMini] = useState(false);
  const MINI_PEEK = 108; // px visible above bottom edge when collapsed

  // Compute how far down to translate for mini state (from the height prop)
  const miniY = useMemo(() => {
    if (typeof height === 'number') return Math.max(0, height - MINI_PEEK);
    if (typeof height === 'string' && height.endsWith('vh')) {
      return Math.max(0, (window.innerHeight * parseFloat(height) / 100) - MINI_PEEK);
    }
    return Math.max(0, window.innerHeight * 0.8 - MINI_PEEK);
  }, [height]);

  useEffect(() => { if (!isOpen) setIsMini(false); }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999 }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: isMini ? miniY : 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.2, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (!isMini) {
                if (info.offset.y > 100 || info.velocity.y > 400) setIsMini(true);
              } else {
                if (info.offset.y > 60 || info.velocity.y > 300) onClose();
                else if (info.offset.y < -80 || info.velocity.y < -300) setIsMini(false);
              }
            }}
            onClick={() => { if (isMini) setIsMini(false); }}
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0,
              background: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              zIndex: 1000, maxHeight: '92vh',
              height: typeof height === 'number' ? `${height}px` : height,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.20)' }} />
            </div>
            <div style={{ flex: 1, overflowY: scrollable ? 'auto' : 'hidden', minHeight: 0 }}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── ImportSheet (source type picker) ──────────────────────────────────────

function ImportSheet({ isOpen, onClose, onPick }: {
  isOpen: boolean; onClose: () => void; onPick: (t: SourceType) => void;
}) {
  const tiles: { icon: 'file' | 'text' | 'voice' | 'image'; label: string; type: SourceType }[] = [
    { icon: 'file',  label: 'Upload a file', type: 'file' },
    { icon: 'text',  label: 'Write text',    type: 'text' },
    { icon: 'voice', label: 'Voice note',    type: 'voice' },
    { icon: 'image', label: 'Image',         type: 'image' },
  ];
  const pick = (t: SourceType) => { onPick(t); onClose(); };
  return (
    <Sheet isOpen={isOpen} onClose={onClose}>
      <div style={{ padding: '4px 16px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.88)', fontSize: 19, fontWeight: 600 }}>Import content</div>
        <button
          onClick={() => pick('link')}
          style={{
            border: 'none', background: 'rgba(255,255,255,0.06)', borderRadius: 16, height: 88,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: 'rgba(255,255,255,0.82)', cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>
          </svg>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.52)' }}>Paste a link</div>
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {tiles.map(t => (
            <button
              key={t.type}
              onClick={() => pick(t.type)}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.06)', borderRadius: 16, height: 88,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                color: 'rgba(255,255,255,0.82)', cursor: 'pointer',
              }}
            >
              <TileIcon icon={t.icon} />
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.52)' }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

function TileIcon({ icon }: { icon: 'file' | 'text' | 'voice' | 'image' }) {
  const p = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' as const, strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (icon) {
    case 'file':  return <svg {...p}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M12 13v6M9 16l3-3 3 3"/></svg>;
    case 'text':  return <svg {...p}><path d="M17 3l4 4M14 6l4 4-9 9H5v-4z"/></svg>;
    case 'voice': return <svg {...p}><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 12h2"/></svg>;
    case 'image': return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>;
  }
}

// ─── TextInputSheet ────────────────────────────────────────────────────────

function TextInputSheet({ isOpen, onClose, onSave }: {
  isOpen: boolean; onClose: () => void; onSave: (label: string, content: string) => void;
}) {
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (isOpen) { setText(''); setTimeout(() => taRef.current?.focus(), 120); } }, [isOpen]);
  const trimmed = text.trim();
  const canSave = trimmed.length > 0;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const handleSave = () => {
    if (!canSave) return;
    const label = truncateLabel(trimmed, 32) || 'Text';
    onSave(label, trimmed);
    onClose();
  };
  return (
    <Sheet isOpen={isOpen} onClose={onClose} height="80vh">
      <SheetHeader title="Text source" onCancel={onClose}
        action={<SaveButton enabled={canSave} onClick={handleSave} />} />
      <Divider />
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px 16px', minHeight: 0 }}>
        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your text, transcript or notes…"
          style={{
            width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
            color: 'rgba(255,255,255,0.88)', fontSize: 16, fontFamily: 'var(--font-sans)', lineHeight: 1.55,
          }}
        />
      </div>
      {wordCount > 0 && (
        <div style={{ padding: '6px 20px 14px', textAlign: 'right', color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>
          {wordCount} words
        </div>
      )}
    </Sheet>
  );
}

// ─── LinkInputSheet ────────────────────────────────────────────────────────

function LinkInputSheet({ isOpen, onClose, onSave }: {
  isOpen: boolean; onClose: () => void; onSave: (label: string, url: string) => void;
}) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isOpen) { setUrl(''); setTimeout(() => inputRef.current?.focus(), 120); } }, [isOpen]);
  const trimmed = url.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : (trimmed ? `https://${trimmed}` : '');
  const isValid = /^https?:\/\/[^\s.]+\.[^\s]+/i.test(withScheme);
  const handleSave = () => {
    if (!isValid) return;
    let label = withScheme;
    try { label = new URL(withScheme).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
    onSave(label, withScheme);
    onClose();
  };
  return (
    <Sheet isOpen={isOpen} onClose={onClose} height="60vh">
      <SheetHeader title="Link source" onCancel={onClose}
        action={<SaveButton enabled={isValid} onClick={handleSave} />} />
      <Divider />
      <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', display: 'inline-flex' }}>
          <SourceIcon type="link" />
        </span>
        <input
          ref={inputRef}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && isValid) handleSave(); }}
          placeholder="example.com"
          type="url"
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'rgba(255,255,255,0.88)', fontSize: 16, fontFamily: 'var(--font-sans)',
          }}
        />
        {url && (
          <button onClick={() => setUrl('')} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}>
            <XIcon size={16} />
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ─── VoiceRecordSheet (orbiting green blobs) ───────────────────────────────

export function VoiceRecordSheet({ isOpen, onClose, onSave }: {
  isOpen: boolean; onClose: () => void; onSave: (label: string, transcript: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [unsupportedMsg, setUnsupportedMsg] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const recognitionRef = useRef<{ stop?: () => void } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRecording(false); setTranscript(''); setSeconds(0); setUnsupportedMsg(null); levelRef.current = 0;
      try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
      recognitionRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Canvas + audio level
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let t = 0, spread = 88, raf = 0;
    let stream: MediaStream | null = null;
    let analyser: AnalyserNode | null = null;
    let audioCtx: AudioContext | null = null;
    const arr = new Uint8Array(128);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth || 280, h = canvas.clientHeight || 280;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    // Tracks whether the effect cleanup has already run by the time the
    // getUserMedia promise resolves. Without this, dismissing the sheet during
    // the OS permission prompt leaves the mic stream and AudioContext alive
    // because the cleanup ran while `stream` / `audioCtx` were still null.
    let cancelled = false;
    if (recording) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(s => {
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new Ctx();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.88;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
      }).catch(() => { /* permission denied */ });
    }

    const birthStart = Date.now();
    const BIRTH_MS = 950;
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight, cx = w / 2, cy = h * 0.5;
      if (analyser) {
        analyser.getByteFrequencyData(arr);
        let s = 0; for (let k = 0; k < arr.length; k++) s += arr[k];
        levelRef.current = Math.min(1, (s / arr.length) / 110);
      } else {
        levelRef.current = 0;
      }
      const lv = levelRef.current;
      spread += ((lv > 0.12 ? 10 : 60) - spread) * 0.04;
      ctx.clearRect(0, 0, w, h);

      if (recording) {
        const birthFrac = Math.min(1, (Date.now() - birthStart) / BIRTH_MS);
        const birth = Math.pow(birthFrac, 0.45);
        for (let i = 0; i < 4; i++) {
          const ang = t * 0.65 + i * (Math.PI * 0.5);
          const r = (spread + Math.sin(t * 0.45 + i * 1.1) * 14) * birth;
          const px = cx + Math.cos(ang) * r * 0.88;
          const py = cy + Math.sin(ang) * r * 0.72;
          const sz = (95 + Math.sin(t * 0.9 + i * 0.8) * 22) * (1 + lv * 0.5);
          const al = (0.22 + lv * 0.32) * birth;
          const hue = 145 + i * 5;
          const g = ctx.createRadialGradient(px, py, 0, px, py, sz);
          g.addColorStop(0, `hsla(${hue},58%,52%,${al.toFixed(2)})`);
          g.addColorStop(0.5, `hsla(${hue},50%,48%,${(al * 0.28).toFixed(2)})`);
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        }
        if (lv > 0.05) {
          const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 75 + lv * 50);
          gg.addColorStop(0, `hsla(150,60%,55%,${(lv * 0.28).toFixed(2)})`);
          gg.addColorStop(1, 'transparent');
          ctx.fillStyle = gg; ctx.fillRect(0, 0, w, h);
        }
      } else {
        const breath = 1 + Math.sin(t * 2 * Math.PI / 4.5) * 0.04;
        const orbR = 100 * breath;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR);
        g.addColorStop(0, 'rgba(255,235,210,0.95)');
        g.addColorStop(0.18, 'rgba(255,235,210,0.70)');
        g.addColorStop(0.50, 'rgba(255,235,210,0.20)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
      t += 0.010;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      stream?.getTracks().forEach(tr => tr.stop());
      audioCtx?.close().catch(() => { /* noop */ });
    };
  }, [recording, isOpen]);

  const startRec = () => {
    type WindowWithSR = Window & { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SRctor = (window as unknown as WindowWithSR).SpeechRecognition ?? (window as unknown as WindowWithSR).webkitSpeechRecognition;
    if (!SRctor) {
      // Without SpeechRecognition this sheet has no transcription fallback,
      // so entering 'recording' would leave the user stuck at "Tap orb to
      // record" forever after stopping. Tell them up front.
      setUnsupportedMsg('Voice recording isn\'t supported on this browser. Try Safari on iOS or Chrome on desktop.');
      return;
    }
    setUnsupportedMsg(null);
    setSeconds(0); setTranscript('');
    setRecording(true);
    type RecLike = { continuous: boolean; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; start: () => void; stop: () => void };
    const rec = new (SRctor as unknown as new () => RecLike)();
    rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let full = '';
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript + ' ';
      setTranscript(full.trim());
    };
    try { rec.start(); recognitionRef.current = rec; } catch { /* noop */ }
  };
  const stopRec = () => {
    setRecording(false);
    try { recognitionRef.current?.stop?.(); } catch { /* noop */ }
  };
  // Guard against rapid double-tap on the orb: React may not have re-rendered
  // by the time a second tap fires, so both reads of `recording` are still
  // false and we'd spin up two SpeechRecognition instances.
  const toggleGuardRef = useRef(false);
  const toggle = () => {
    if (toggleGuardRef.current) return;
    toggleGuardRef.current = true;
    setTimeout(() => { toggleGuardRef.current = false; }, 250);
    recording ? stopRec() : startRec();
  };
  const handleDone = () => {
    const t = transcript.trim();
    if (!t) { onClose(); return; }
    const label = truncateLabel(t, 40) || 'Voice note';
    onSave(label, t);
    onClose();
  };
  const timeLabel = `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} height="86vh">
      <SheetHeader title="Voice Note" onCancel={onClose} action={null} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 24px' }}>
        <div onClick={toggle} style={{ width: '100%', height: 280, cursor: 'pointer', position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', mixBlendMode: 'screen' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%' }}>
          <div style={{
            color: recording ? 'rgba(255,255,255,0.80)' : 'rgba(255,255,255,0.40)',
            fontSize: 17, fontFamily: recording ? 'var(--font-mono, monospace)' : 'var(--font-sans)',
          }}>
            {recording ? timeLabel : 'Tap orb to record'}
          </div>
          {unsupportedMsg && (
            <div style={{
              width: '100%', padding: '12px 14px',
              borderRadius: 14, background: 'rgba(220,90,60,0.10)', border: '1px solid rgba(220,90,60,0.25)',
              color: 'rgba(255,200,190,0.95)', fontSize: 13, lineHeight: 1.5, textAlign: 'center',
            }}>{unsupportedMsg}</div>
          )}
          {transcript && (
            <div style={{
              width: '100%', maxHeight: 140, overflowY: 'auto', padding: '12px 14px',
              borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.80)', fontSize: 14, lineHeight: 1.5,
            }}>{transcript}</div>
          )}
          {transcript && (
            <AnimatedLightsButton title={recording ? 'Done' : 'Use this'} onClick={handleDone} isEnabled={true} />
          )}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Format picker sheet ───────────────────────────────────────────────────

const GREEN = 'rgb(69,179,107)';

function FormatPickerSheet({ isOpen, onClose, selected, onChange }: {
  isOpen: boolean; onClose: () => void; selected: Set<string>; onChange: (s: Set<string>) => void;
}) {
  const [pending, setPending] = useState<Set<string>>(new Set(selected));
  const [search, setSearch] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  useEffect(() => {
    if (isOpen) { setPending(new Set(selected)); setSearch(''); setShowAllTemplates(false); }
  }, [isOpen]);

  const q = search.toLowerCase();
  const filteredTemplates = allTemplates.filter(t =>
    !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) ||
    t.formatIDs.some(id => allFormats.find(f => f.id === id)?.label.toLowerCase().includes(q))
  );
  const filteredFormats = allFormats.filter(f =>
    !q || f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
  );
  const displayedTemplates = (!q && !showAllTemplates) ? filteredTemplates.slice(0, 5) : filteredTemplates;

  const toggleFormat = (id: string) =>
    setPending(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addTemplate = (formatIDs: string[]) =>
    setPending(prev => { const n = new Set(prev); formatIDs.forEach(id => n.add(id)); return n; });

  const doneLabel = pending.size === 0 ? 'Done' : `Done · ${pending.size} selected`;
  const commit = () => { onChange(pending); onClose(); };

  const SectionHeader = ({ title }: { title: string }) => (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.06em', padding: '18px 16px 8px', textTransform: 'uppercase' }}>{title}</div>
  );
  const RowDivider = () => <div style={{ height: 0.5, background: 'rgba(255,255,255,0.06)', margin: '0 16px' }} />;
  const noResults = filteredTemplates.length === 0 && filteredFormats.length === 0;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} height="86vh" scrollable={false}>
      {/* Header */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: 16, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}>Cancel</button>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Format</div>
        <div style={{ minWidth: 56, textAlign: 'right' }} />
      </div>

      {/* Search */}
      <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 12px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search formats and templates"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#fff', fontSize: 15, fontFamily: 'var(--font-sans)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.30)', display: 'flex' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {noResults ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.30)', fontSize: 15, fontFamily: 'var(--font-sans)' }}>No matches.</div>
        ) : (
          <>
            {filteredTemplates.length > 0 && (
              <>
                <SectionHeader title="Quick picks" />
                {displayedTemplates.map((tpl, i) => {
                  const active = tpl.formatIDs.every(id => pending.has(id));
                  return (
                    <div key={tpl.id}>
                      <button
                        onClick={() => addTemplate(tpl.formatIDs)}
                        style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, fontFamily: 'var(--font-sans)' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 6 }}>{tpl.name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 5 }}>
                            {tpl.formatIDs.slice(0, 4).map(id => {
                              const fmt = allFormats.find(f => f.id === id);
                              return fmt ? (
                                <span key={id} style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.55)', background: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)', borderRadius: 999, padding: '3px 7px' }}>{fmt.label}</span>
                              ) : null;
                            })}
                            {tpl.formatIDs.length > 4 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>+{tpl.formatIDs.length - 4}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{tpl.description}</div>
                        </div>
                        {active && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                        )}
                      </button>
                      {i < displayedTemplates.length - 1 && <RowDivider />}
                    </div>
                  );
                })}
                {!q && !showAllTemplates && allTemplates.length > 5 && (
                  <>
                    <RowDivider />
                    <button
                      onClick={() => setShowAllTemplates(true)}
                      style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', color: 'rgba(255,255,255,0.50)', fontSize: 15 }}
                    >
                      See all templates
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="2.2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  </>
                )}
              </>
            )}

            {filteredFormats.length > 0 && (
              <>
                <SectionHeader title="All formats" />
                {filteredFormats.map((f, i) => {
                  const on = pending.has(f.id);
                  return (
                    <div key={f.id}>
                      <button
                        onClick={() => toggleFormat(f.id)}
                        style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'var(--font-sans)' }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? GREEN : 'none'} stroke={on ? GREEN : 'rgba(255,255,255,0.22)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          {on
                            ? <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l3 3 5-5" stroke="#fff" strokeWidth="2" fill="none"/></>
                            : <rect x="3" y="3" width="18" height="18" rx="3"/>
                          }
                        </svg>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, color: on ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.70)' }}>{f.label}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', marginTop: 3 }}>{f.description}</div>
                        </div>
                      </button>
                      {i < filteredFormats.length - 1 && <RowDivider />}
                    </div>
                  );
                })}
              </>
            )}
            <div style={{ height: 16 }} />
          </>
        )}
      </div>

      {/* Done button */}
      <div style={{ flexShrink: 0, padding: '12px 16px 28px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={commit}
          style={{
            width: '100%', height: 52, border: 'none', borderRadius: 14, cursor: 'pointer',
            background: pending.size === 0 ? 'rgba(255,255,255,0.12)' : GREEN,
            color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-sans)',
            transition: 'background 0.15s',
          }}
        >{doneLabel}</button>
      </div>
    </Sheet>
  );
}

// ─── Helpers shared by sheets ──────────────────────────────────────────────

function SheetHeader({ title, onCancel, action }: { title: string; onCancel: () => void; action: React.ReactNode }) {
  return (
    <div style={{ padding: '4px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button onClick={onCancel} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: 16, cursor: 'pointer', padding: 0, minWidth: 56, textAlign: 'left' }}>Cancel</button>
      <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{title}</div>
      <div style={{ minWidth: 56, textAlign: 'right' }}>{action}</div>
    </div>
  );
}

function SaveButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      style={{
        border: 'none', background: 'transparent', cursor: enabled ? 'pointer' : 'default',
        color: enabled ? '#F29E4D' : 'rgba(255,255,255,0.25)',
        fontSize: 16, fontWeight: 600, padding: 0, fontFamily: 'var(--font-sans)',
      }}
    >Save</button>
  );
}

function Divider() {
  return <div style={{ height: 0.5, background: 'rgba(255,255,255,0.07)' }} />;
}

// ─── CreateHome ────────────────────────────────────────────────────────────

export default function CreateHome({ onShowOnboarding }: { onShowOnboarding?: () => void }) {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [brand, setBrand] = useState('Default');

  const [showImport, setShowImport] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const [showPromptFull, setShowPromptFull] = useState(false);
  const [brandMenu, setBrandMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [showGenSheet, setShowGenSheet] = useState(false);
  const [genRunning, setGenRunning] = useState(false);
  const [genStreaming, setGenStreaming] = useState('');
  const [genResults, setGenResults] = useState<{ header: string; content: string }[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [genFormatLabels, setGenFormatLabels] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const canGenerate = sources.length > 0 && selectedFormats.size > 0 && !genRunning;
  const generateLabel = genRunning ? 'Generating…' : (selectedFormats.size === 0 ? 'Generate' : `Generate ${selectedFormats.size}`);

  const doGenerate = async () => {
    if (!canGenerate) return;
    const apiKey = useSettingsStore.getState().anthropicKey;
    if (!apiKey) {
      setGenError('No Anthropic API key — add one in Settings.');
      setShowGenSheet(true);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const context = buildSourceContext(sources);
    const outputList = Array.from(selectedFormats)
      .map(id => allFormats.find(f => f.id === id)?.label ?? id)
      .join(', ');
    const brandLine = brand && brand !== 'Default' ? `\n\nBRAND VOICE: ${brand}` : '';
    const promptLine = prompt.trim() ? `\n\nADDITIONAL INSTRUCTIONS:\n${prompt.trim()}` : '';
    const fullPrompt = `You are a content generation assistant.\n\nSOURCES:\n${context}${brandLine}${promptLine}\n\nGenerate the following outputs. For each output, use the format label as a header, then produce the content below it.\n\nOUTPUTS REQUESTED:\n${outputList}\n\nFormat each output clearly. Separate outputs with ---`;

    setGenRunning(true);
    setGenStreaming('');
    setGenResults([]);
    setGenError(null);
    setCopied(false);
    setActiveResultIdx(0);
    setGenFormatLabels(Array.from(selectedFormats).map(id => allFormats.find(f => f.id === id)?.label ?? id));
    setShowGenSheet(true);

    let accumulated = '';
    let lineBuffer = '';
    let lastFlush = 0;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 8192,
          stream: true,
          messages: [{ role: 'user', content: fullPrompt }],
        }),
      });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.text();
          try { detail = JSON.parse(body)?.error?.message ?? body; } catch { detail = body; }
        } catch { /* ignore */ }
        throw new Error(`API error ${res.status}${detail ? `: ${detail}` : ''}`);
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response stream');
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) {
          const tail = decoder.decode();
          if (tail) lineBuffer += tail;
          done = true;
        } else {
          lineBuffer += decoder.decode(chunk.value, { stream: true });
        }
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              accumulated += parsed.delta.text;
              const now = Date.now();
              if (now - lastFlush > 150) {
                setGenStreaming(accumulated);
                lastFlush = now;
              }
            }
          } catch { /* skip */ }
        }
      }
      setGenStreaming(accumulated);
      const parsedResults = parseGenerationResults(accumulated);
      setGenResults(parsedResults);
      setActiveResultIdx(0);
      if (parsedResults.length > 0) {
        const firstSource = sources[0];
        const titleSeed = firstSource?.content || firstSource?.label || parsedResults[0].header;
        const title = truncateLabel(titleSeed, 60) || 'Untitled generation';
        const firstLabel = parsedResults[0].header;
        const outputType = parsedResults.length > 1
          ? `${firstLabel} +${parsedResults.length - 1}`
          : firstLabel;
        const preview = parsedResults[0].content.slice(0, 160).replace(/\s+/g, ' ').trim();
        useGenerationsStore.getState().addProject({
          id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          outputType,
          preview,
          results: parsedResults,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setGenError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setGenRunning(false);
    }
  };

  const onPickSource = (t: SourceType) => {
    setShowImport(false);
    setTimeout(() => {
      if (t === 'text') setShowText(true);
      else if (t === 'link') setShowLink(true);
      else if (t === 'voice') setShowVoice(true);
      else if (t === 'file') fileInputRef.current?.click();
      else if (t === 'image') imageInputRef.current?.click();
    }, 280);
  };
  const addSource = (item: Omit<SourceItem, 'id'>) =>
    setSources(s => [...s, { ...item, id: crypto.randomUUID() }]);
  const removeSource = (id: string) =>
    setSources(s => s.filter(x => x.id !== id));

  const formatsSummary = useMemo(() => {
    const labels = allFormats.filter(f => selectedFormats.has(f.id)).map(f => f.label);
    if (labels.length === 0) return '';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
  }, [selectedFormats]);

  return (
    <div style={{
      height: '100%', overflowY: 'auto', background: BG, color: '#fff',
      fontFamily: 'var(--font-sans)', position: 'relative',
    }}>
      <style>{`
        .create-prompt::placeholder { color: rgba(255,255,255,0.18); }
        .create-prompt::-webkit-input-placeholder { color: rgba(255,255,255,0.18); }
      `}</style>
      {/* Background tints */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(380px circle at 5% 5%, rgba(140,77,20,0.35), transparent 70%),' +
          'radial-gradient(320px circle at 100% 85%, rgba(77,51,20,0.22), transparent 70%)',
      }} />
      <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto', padding: '24px 16px calc(80px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 16px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#fff' }}>Create</h1>
          {onShowOnboarding && (
            <button
              onClick={onShowOnboarding}
              aria-label="Replay intro animation"
              style={{
                height: 32,
                padding: '0 12px',
                borderRadius: 16,
                border: '1px solid rgba(217, 115, 26, 0.45)',
                background: 'rgba(217, 115, 26, 0.18)',
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer',
                color: 'rgba(255, 224, 184, 0.96)',
                fontFamily: 'var(--font-sans, system-ui)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
              </svg>
              Intro
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sources */}
          <GlassCard>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Sources</div>
              <button
                onClick={() => setShowImport(true)}
                aria-label="Add source"
                style={{
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.09)',
                  cursor: 'pointer',
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.80)',
                }}
              >
                <PlusIcon />
              </button>
            </div>
            {sources.map(item => (
              <div key={item.id}>
                <div style={{ height: 0.5, background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px' }}>
                  <SourceIcon type={item.type} />
                  <div style={{ flex: 1, fontSize: 15, color: 'rgba(255,255,255,0.80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                  <button
                    onClick={() => removeSource(item.id)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'rgba(255,255,255,0.28)', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  ><XIcon /></button>
                </div>
              </div>
            ))}
          </GlassCard>

          {/* Formats */}
          <GlassCard>
            <button
              onClick={() => setShowFormats(true)}
              style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: '16px', display: 'flex', alignItems: 'center', gap: 12, color: '#fff', textAlign: 'left' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Format</div>
                {selectedFormats.size > 0 && (
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatsSummary}</div>
                )}
              </div>
              {selectedFormats.size === 0 ? (
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>None</div>
              ) : (
                <div style={{
                  minWidth: 24, height: 24, borderRadius: 12, padding: '0 8px',
                  background: '#fff', color: BG, fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{selectedFormats.size}</div>
              )}
              <span style={{ color: 'rgba(255,255,255,0.20)' }}><ChevronRight /></span>
            </button>
            <div
              style={{
                display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 14px',
                scrollbarWidth: 'none',
              }}
              className="hide-scrollbar"
            >
              <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
              {popularTemplates.map(tpl => {
                const ids = new Set(tpl.formatIDs);
                const active = ids.size === selectedFormats.size
                  && Array.from(ids).every(id => selectedFormats.has(id));
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedFormats(new Set(tpl.formatIDs))}
                    style={{
                      flexShrink: 0,
                      border: '0.5px solid ' + (active ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.10)'),
                      background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                      color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                      borderRadius: 999, padding: '7px 14px',
                      fontSize: 13, fontWeight: 500, cursor: 'pointer',
                      fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                    }}
                  >{tpl.label}</button>
                );
              })}
            </div>
          </GlassCard>

          {/* Prompt */}
          <GlassCard>
            <div style={{ padding: '14px 16px 6px' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Extra details</div>
            </div>
            <textarea
              className="create-prompt create-prompt-mini"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Leave empty to generate from sources and format."
              style={{
                width: '100%', padding: '4px 16px 4px', border: 'none', background: 'transparent', outline: 'none',
                resize: 'none', color: 'rgba(255,255,255,0.88)', fontSize: 16, fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box',
                height: 72, minHeight: 72, maxHeight: 72,
                lineHeight: 1.35, display: 'block',
                WebkitAppearance: 'none', appearance: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 12px 12px' }}>
              <button
                type="button"
                onClick={() => setShowPromptFull(true)}
                aria-label="Expand"
                style={{
                  border: '0.5px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.09)',
                  cursor: 'pointer',
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.70)',
                }}
              >
                <ExpandIcon />
              </button>
            </div>
          </GlassCard>

          {/* Brand */}
          <GlassCard allowOverflow>
            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Brand voice</div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>How the output should sound</div>
              </div>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setBrandMenu(v => !v)}
                  style={{
                    border: '0.5px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.09)',
                    borderRadius: 999, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 5,
                    color: 'rgba(255,255,255,0.70)', fontSize: 15, fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  <span>{brand}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6-6 6 6M6 15l6 6 6-6"/></svg>
                </button>
                {brandMenu && (
                  <>
                    <div onClick={() => setBrandMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 50 }} />
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 6px)', right: 0, minWidth: 160,
                      background: '#23201E', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
                      padding: 4, zIndex: 51, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}>
                      {brands.map(b => (
                        <button
                          key={b}
                          onClick={() => { setBrand(b); setBrandMenu(false); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px',
                            border: 'none', background: brand === b ? 'rgba(255,255,255,0.06)' : 'transparent',
                            cursor: 'pointer', color: '#fff', fontSize: 14, borderRadius: 8, textAlign: 'left',
                            fontFamily: 'var(--font-sans)',
                          }}
                        >
                          <span style={{ width: 14, color: brand === b ? '#F29E4D' : 'transparent' }}>✓</span>
                          {b}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </div>

        <div style={{ marginTop: 24 }}>
          <AnimatedLightsButton
            title={generateLabel}
            icon="sparkles"
            isEnabled={canGenerate}
            onClick={doGenerate}
          />
        </div>
      </div>

      {/* Sheets */}
      <ImportSheet isOpen={showImport} onClose={() => setShowImport(false)} onPick={onPickSource} />
      <TextInputSheet isOpen={showText} onClose={() => setShowText(false)} onSave={(label, content) => addSource({ type: 'text', label, content })} />
      <LinkInputSheet isOpen={showLink} onClose={() => setShowLink(false)} onSave={(label, content) => addSource({ type: 'link', label, content })} />
      <VoiceRecordSheet isOpen={showVoice} onClose={() => setShowVoice(false)} onSave={(label, content) => addSource({ type: 'voice', label, content })} />
      <FormatPickerSheet isOpen={showFormats} onClose={() => setShowFormats(false)} selected={selectedFormats} onChange={setSelectedFormats} />
      <Sheet isOpen={showPromptFull} onClose={() => setShowPromptFull(false)} height="80vh" scrollable={false}>
        <SheetHeader title="Extra details" onCancel={() => setShowPromptFull(false)}
          action={<button onClick={() => setShowPromptFull(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#F29E4D', fontSize: 16, fontWeight: 600, padding: 0, fontFamily: 'var(--font-sans)' }}>Done</button>} />
        <Divider />
        <div style={{ padding: '14px 16px', height: 'calc(100% - 56px)', boxSizing: 'border-box' }}>
          <textarea
            className="create-prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Leave empty to generate from sources and format."
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              color: 'rgba(255,255,255,0.88)', fontSize: 16, fontFamily: 'var(--font-sans)', lineHeight: 1.55,
              boxSizing: 'border-box',
              height: '60vh', minHeight: '60vh', maxHeight: '60vh', display: 'block',
              WebkitAppearance: 'none', appearance: 'none',
            }}
          />
        </div>
      </Sheet>

      {/* Full-screen generation view */}
      <AnimatePresence>
        {showGenSheet && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: BG, display: 'flex', flexDirection: 'column',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <style>{`
              @keyframes gen-pulse { 0%,100% { transform: scale(1); opacity: 0.15; } 50% { transform: scale(1.28); opacity: 0.25; } }
              @keyframes gen-pulse2 { 0%,100% { transform: scale(1); opacity: 0.22; } 50% { transform: scale(1.18); opacity: 0.32; } }
            `}</style>

            {genRunning ? (
              /* ── Generating state ── */
              <>
                <div style={{ padding: 'max(16px, env(safe-area-inset-top, 0px) + 12px) 16px 0' }}>
                  <button
                    onClick={() => { abortRef.current?.abort(); setShowGenSheet(false); }}
                    style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: 16, fontWeight: 500, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)' }}
                  >Cancel</button>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32, padding: '0 32px', position: 'relative', overflow: 'hidden' }}>
                  {/* Amber radial bg glow */}
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(217,115,26,0.13), transparent 70%)', pointerEvents: 'none' }} />

                  {/* Pulsing circles + icon */}
                  <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', background: 'rgba(217,115,26,0.15)', animation: 'gen-pulse 1.4s ease-in-out infinite' }} />
                    <div style={{ position: 'absolute', width: 88, height: 88, borderRadius: '50%', background: 'rgba(217,115,26,0.22)', animation: 'gen-pulse2 1.4s ease-in-out infinite' }} />
                    <div style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%', background: 'rgba(217,115,26,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
                      </svg>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', zIndex: 1 }}>
                    <div style={{ fontSize: 19, fontWeight: 600, color: 'rgba(255,255,255,0.88)', marginBottom: 10 }}>Creating your content</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>{genFormatLabels.join(' · ')}</div>
                  </div>

                  {/* Live streaming text */}
                  {genStreaming && (
                    <div style={{ width: '100%', maxHeight: 200, overflowY: 'auto', zIndex: 1 }}>
                      <p style={{
                        margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        color: 'rgba(255,255,255,0.40)', fontSize: 14, lineHeight: 1.6,
                        fontFamily: 'var(--font-sans)',
                      }}>{genStreaming}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Results / error state ── */
              <>
                {/* Top bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: 'max(18px, env(safe-area-inset-top, 0px) + 14px) 16px 14px',
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => setShowGenSheet(false)}
                    aria-label="Back"
                    style={{
                      width: 28, height: 28, borderRadius: '50%', border: 'none',
                      background: 'rgba(255,255,255,0.10)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'rgba(255,255,255,0.60)', flexShrink: 0,
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>

                  {/* Format tabs */}
                  {genResults.length > 1 ? (
                    <div style={{ flex: 1, overflowX: 'auto', scrollbarWidth: 'none', display: 'flex', gap: 6 }}>
                      {genResults.map((r, i) => {
                        const on = activeResultIdx === i;
                        return (
                          <button
                            key={i}
                            onClick={() => { setActiveResultIdx(i); setCopied(false); }}
                            style={{
                              flexShrink: 0, border: 'none',
                              background: on ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
                              color: on ? '#fff' : 'rgba(255,255,255,0.40)',
                              borderRadius: 999, padding: '5px 10px',
                              fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                            }}
                          >{r.header}</button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ flex: 1, fontSize: 16, fontWeight: 600, color: '#fff' }}>
                      {genError ? 'Generation failed' : (genResults[0]?.header ?? '')}
                    </div>
                  )}

                  {/* Copy button */}
                  {!genError && (genResults.length > 0 || genStreaming) && (
                    <button
                      onClick={() => {
                        const text = genResults.length > 0
                          ? (genResults[activeResultIdx]?.content ?? '')
                          : genStreaming;
                        navigator.clipboard?.writeText(text).catch(() => {});
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', gap: 5,
                        color: copied ? GREEN : 'rgba(255,255,255,0.60)',
                        fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)', flexShrink: 0,
                        transition: 'color 0.15s',
                      }}
                    >
                      {copied
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg> Copied</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
                      }
                    </button>
                  )}
                </div>

                <div style={{ height: 0.5, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

                {/* Scrollable content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px calc(32px + env(safe-area-inset-bottom, 0px))' }}>
                  {genError ? (
                    <div style={{
                      padding: '14px 16px', borderRadius: 12,
                      background: 'rgba(220,80,60,0.12)', border: '1px solid rgba(220,80,60,0.30)',
                      color: 'rgba(255,200,190,0.95)', fontSize: 15, lineHeight: 1.55,
                    }}>{genError}</div>
                  ) : (
                    <p style={{
                      margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      color: 'rgba(255,255,255,0.85)', fontSize: 17, lineHeight: 1.7,
                      fontFamily: 'var(--font-sans)',
                    }}>
                      {genResults.length > 0
                        ? genResults[activeResultIdx]?.content
                        : genStreaming}
                    </p>
                  )}
                </div>

                {/* Saved to Library badge */}
                {!genError && genResults.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))',
                    borderTop: '0.5px solid rgba(255,255,255,0.07)', flexShrink: 0,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={GREEN} stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5l-4.5-4.5 1.41-1.41L10 13.67l7.09-7.09 1.41 1.41L10 16.5z"/></svg>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', fontFamily: 'var(--font-sans)' }}>Saved to Library</span>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file pickers */}
      <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const text = await f.text().catch(() => '');
          addSource({ type: 'file', label: f.name, content: text });
          e.target.value = '';
        }} />
      <input ref={imageInputRef} type="file" accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]; if (!f) return;
          addSource({ type: 'image', label: f.name || 'Image', content: '' });
          e.target.value = '';
        }} />
    </div>
  );
}
