import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

function Sheet({ isOpen, onClose, children, height = 'auto' }: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; height?: number | 'auto' | string;
}) {
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
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => { if (info.offset.y > 120 || info.velocity.y > 500) onClose(); }}
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0,
              background: BG, borderTopLeftRadius: 20, borderTopRightRadius: 20,
              zIndex: 1000, maxHeight: '92vh',
              height: typeof height === 'number' ? `${height}px` : height,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 4, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.20)' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
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

function VoiceRecordSheet({ isOpen, onClose, onSave }: {
  isOpen: boolean; onClose: () => void; onSave: (label: string, transcript: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [seconds, setSeconds] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levelRef = useRef(0);
  const recognitionRef = useRef<{ stop?: () => void } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRecording(false); setTranscript(''); setSeconds(0); levelRef.current = 0;
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

    if (recording) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(s => {
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
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      stream?.getTracks().forEach(tr => tr.stop());
      audioCtx?.close().catch(() => { /* noop */ });
    };
  }, [recording, isOpen]);

  const startRec = () => {
    setSeconds(0); setTranscript('');
    setRecording(true);
    type WindowWithSR = Window & { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown };
    const SRctor = (window as unknown as WindowWithSR).SpeechRecognition ?? (window as unknown as WindowWithSR).webkitSpeechRecognition;
    if (!SRctor) return;
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
  const toggle = () => recording ? stopRec() : startRec();
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

function FormatPickerSheet({ isOpen, onClose, selected, onChange }: {
  isOpen: boolean; onClose: () => void; selected: Set<string>; onChange: (s: Set<string>) => void;
}) {
  const [pending, setPending] = useState<Set<string>>(new Set(selected));
  useEffect(() => { if (isOpen) setPending(new Set(selected)); }, [isOpen, selected]);
  const toggle = (id: string) => {
    setPending(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const addLabel = pending.size === 0 ? 'Add' : `Add ${pending.size} format${pending.size > 1 ? 's' : ''}`;
  const commit = () => { onChange(pending); onClose(); };
  return (
    <Sheet isOpen={isOpen} onClose={onClose} height="86vh">
      <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.55)', fontSize: 16, cursor: 'pointer', padding: 0 }}>Cancel</button>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Choose formats</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, minWidth: 40, textAlign: 'right' }}>{pending.size || ''}</div>
      </div>
      <Divider />
      <div style={{ padding: '8px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allFormats.map(f => {
          const on = pending.has(f.id);
          return (
            <button
              key={f.id}
              onClick={() => toggle(f.id)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 14px', borderRadius: 14,
                background: on ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${on ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', color: '#fff', textAlign: 'left', fontFamily: 'var(--font-sans)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{f.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{f.description}</div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                background: on ? '#fff' : 'transparent',
                border: `1.5px solid ${on ? '#fff' : 'rgba(255,255,255,0.20)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A1513" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{
        position: 'sticky', bottom: 0, left: 0, right: 0,
        padding: '12px 16px 24px',
        background: `linear-gradient(to top, ${BG} 70%, transparent)`,
      }}>
        <AnimatedLightsButton title={addLabel} isEnabled={pending.size > 0} onClick={commit} />
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

export default function CreateHome() {
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

  const canGenerate = sources.length > 0 && selectedFormats.size > 0;
  const generateLabel = selectedFormats.size === 0 ? 'Generate' : `Generate ${selectedFormats.size}`;

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
      minHeight: '100vh', background: BG, color: '#fff',
      fontFamily: 'var(--font-sans)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background tints */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage:
          'radial-gradient(380px circle at 5% 5%, rgba(140,77,20,0.35), transparent 70%),' +
          'radial-gradient(320px circle at 100% 85%, rgba(77,51,20,0.22), transparent 70%)',
      }} />
      <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto', padding: '24px 16px 56px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 16px', color: '#fff' }}>Create</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sources */}
          <GlassCard>
            <div style={{ padding: '14px 16px 10px' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Sources</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 3 }}>What the output should be based on</div>
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
            <div style={{ height: 0.5, background: 'rgba(255,255,255,0.06)' }} />
            <button
              onClick={() => setShowImport(true)}
              style={{
                width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 16px',
                color: 'rgba(255,255,255,0.38)', fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-sans)',
              }}
            >
              <PlusIcon /> <span>Add source</span>
            </button>
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
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatsSummary}</div>
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
          </GlassCard>

          {/* Prompt */}
          <GlassCard>
            <div style={{ padding: '14px 16px 6px' }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>Extra details</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 3 }}>Optional notes or instructions</div>
            </div>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Leave empty to generate from sources and format."
              rows={3}
              style={{
                width: '100%', padding: '4px 16px 4px', border: 'none', background: 'transparent', outline: 'none',
                resize: 'none', color: 'rgba(255,255,255,0.88)', fontSize: 15, fontFamily: 'var(--font-sans)',
                boxSizing: 'border-box', height: 66, lineHeight: 1.35, display: 'block',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '2px 6px 6px' }}>
              <button
                type="button"
                onClick={() => setShowPromptFull(true)}
                aria-label="Expand"
                style={{
                  border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
                  width: 28, height: 28, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.50)',
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
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginTop: 3 }}>How the output should sound</div>
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
            onClick={() => {
              // eslint-disable-next-line no-console
              console.log('[CreateHome] generate', { sources, selectedFormats: Array.from(selectedFormats), prompt, brand });
            }}
          />
        </div>
      </div>

      {/* Sheets */}
      <ImportSheet isOpen={showImport} onClose={() => setShowImport(false)} onPick={onPickSource} />
      <TextInputSheet isOpen={showText} onClose={() => setShowText(false)} onSave={(label, content) => addSource({ type: 'text', label, content })} />
      <LinkInputSheet isOpen={showLink} onClose={() => setShowLink(false)} onSave={(label, content) => addSource({ type: 'link', label, content })} />
      <VoiceRecordSheet isOpen={showVoice} onClose={() => setShowVoice(false)} onSave={(label, content) => addSource({ type: 'voice', label, content })} />
      <FormatPickerSheet isOpen={showFormats} onClose={() => setShowFormats(false)} selected={selectedFormats} onChange={setSelectedFormats} />
      <Sheet isOpen={showPromptFull} onClose={() => setShowPromptFull(false)} height="92vh">
        <SheetHeader title="Extra details" onCancel={() => setShowPromptFull(false)}
          action={<button onClick={() => setShowPromptFull(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#F29E4D', fontSize: 16, fontWeight: 600, padding: 0, fontFamily: 'var(--font-sans)' }}>Done</button>} />
        <Divider />
        <div style={{ flex: 1, overflow: 'hidden', padding: '14px 16px', minHeight: 0 }}>
          <textarea
            autoFocus
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Leave empty to generate from sources and format."
            style={{
              width: '100%', height: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              color: 'rgba(255,255,255,0.88)', fontSize: 16, fontFamily: 'var(--font-sans)', lineHeight: 1.55,
            }}
          />
        </div>
      </Sheet>

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
