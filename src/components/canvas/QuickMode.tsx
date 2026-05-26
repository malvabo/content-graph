import { useRef, useState, useCallback, useEffect, memo, type ReactElement } from 'react';
import { useQuickModeStore, type SourceType } from '../../store/quickModeStore';
import { useSettingsStore } from '../../store/settingsStore';

// ─── Constants ────────────────────────────────────────────────────────────────

type OutputGroup = 'Social' | 'Long-form' | 'Visual';

const QUICK_OUTPUTS: { key: string; label: string; group: OutputGroup; meta: string }[] = [
  { key: 'linkedin-post',  label: 'LinkedIn Post',   group: 'Social',    meta: '~1,300 chars' },
  { key: 'twitter-thread', label: 'Twitter Thread',  group: 'Social',    meta: '5–8 tweets' },
  { key: 'twitter-single', label: 'Twitter Single',  group: 'Social',    meta: '≤ 280 chars' },
  { key: 'ig-carousel',    label: 'IG Carousel',     group: 'Social',    meta: '5–7 slides' },
  { key: 'blog-article',   label: 'Blog Article',    group: 'Long-form', meta: '600–1,200 words' },
  { key: 'newsletter',     label: 'Newsletter',      group: 'Long-form', meta: '2–3 sections' },
  { key: 'infographic',    label: 'Infographic',     group: 'Visual',    meta: 'data + 5 facts' },
  { key: 'quote-card',     label: 'Quote Card',      group: 'Visual',    meta: 'pull quote' },
  { key: 'image-prompt',   label: 'Image Prompt',    group: 'Visual',    meta: 'scene description' },
];

const OUTPUT_GROUPS: OutputGroup[] = ['Social', 'Long-form', 'Visual'];

const QUICK_TEMPLATES = [
  { key: 'social',    label: 'Repurpose for social',  preview: 'Turn this into social content, tuned per format',           text: 'Turn this into social content. Adapt the tone and length for each format. Keep the core message intact.' },
  { key: 'extract',   label: 'Extract key points',    preview: 'Pull out the important bits, plain language, no filler',    text: 'Extract the most important points from this source. Be concise. Use plain language. No filler.' },
  { key: 'summarise', label: 'Summarise',             preview: 'One paragraph, clarity over completeness',                  text: 'Summarise this in plain language. Aim for clarity over completeness. One paragraph maximum.' },
  { key: 'audience',  label: 'Rewrite for audience',  preview: 'For a general audience — drop the jargon, keep the meaning', text: 'Rewrite this for a general audience with no specialist knowledge. Keep the meaning. Remove jargon.' },
  { key: 'series',    label: 'Content series',        preview: 'Multi-part series, each piece stands alone',                text: 'Turn this into a multi-part content series. Each piece should stand alone but connect to the others.' },
  { key: 'draft',     label: 'Draft from notes',      preview: 'Treat as notes — write a first draft, flag assumptions',    text: 'Use these notes as a brief. Write a first draft. Fill in gaps with reasonable assumptions and flag them.' },
];

const SOURCE_DEFS: { key: SourceType; label: string; icon: ReactElement }[] = [
  {
    key: 'text', label: 'Text',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 7h16M4 12h16M4 17h10"/>
      </svg>
    ),
  },
  {
    key: 'url', label: 'URL',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
  {
    key: 'file', label: 'File / PDF',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
      </svg>
    ),
  },
  {
    key: 'voice', label: 'Voice note',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
      </svg>
    ),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function assembleContext(store: ReturnType<typeof useQuickModeStore.getState>): string {
  const parts: string[] = [];
  for (const type of store.selectedSources) {
    if (type === 'text' && store.textValue.trim()) {
      parts.push(`[TEXT SOURCE]\n${store.textValue.trim()}`);
    }
    if (type === 'url' && store.urlFetchedText.trim()) {
      let domain = '';
      try { domain = new URL(store.urlValue).hostname; } catch { domain = store.urlValue; }
      parts.push(`[URL SOURCE — ${domain}]\n${store.urlFetchedText.trim()}`);
    }
    if (type === 'file' && store.fileText.trim()) {
      parts.push(`[FILE SOURCE — ${store.fileName}]\n${store.fileText.trim()}`);
    }
    if (type === 'voice' && store.voiceTranscript.trim()) {
      parts.push(`[VOICE NOTE TRANSCRIPT]\n${store.voiceTranscript.trim()}`);
    }
  }
  return parts.join('\n\n');
}

function parseResults(raw: string): Record<string, string> {
  const results: Record<string, string> = {};
  const sections = raw.split(/\n{0,2}-{3,}\n{0,2}/);
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const nl = trimmed.indexOf('\n');
    if (nl === -1) continue;
    const header = trimmed.slice(0, nl).replace(/^#+\s*|\*\*/g, '').trim();
    const content = trimmed.slice(nl + 1).trim();
    if (header && content) results[header] = content;
  }
  return results;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const FIELD_LABEL: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-secondary)', marginBottom: 6,
};
const TEXTAREA: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '22px',
  color: 'var(--color-text-primary)', background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)',
  padding: '10px 12px', resize: 'vertical', outline: 'none',
  transition: 'border-color 120ms',
};
const INPUT_LINE: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '22px',
  color: 'var(--color-text-primary)', background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)',
  padding: '8px 12px', outline: 'none', transition: 'border-color 120ms',
};
const SECTION_DIVIDER: React.CSSProperties = {
  width: '100%', height: 1, background: 'var(--color-border-subtle)', margin: '0',
};
const ERR_TEXT: React.CSSProperties = {
  fontSize: 13, color: 'var(--color-danger-text)', fontFamily: 'var(--font-sans)', marginTop: 6,
};

// ─── Source inputs ────────────────────────────────────────────────────────────

function TextInput() {
  const value = useQuickModeStore(s => s.textValue);
  const set = useQuickModeStore(s => s.setTextValue);
  return (
    <div>
      <span style={FIELD_LABEL}>Text</span>
      <textarea
        style={{ ...TEXTAREA, minHeight: 220 }}
        placeholder="Paste or type your source text here"
        value={value}
        onChange={e => set(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
      />
    </div>
  );
}

function UrlInput() {
  const urlValue = useQuickModeStore(s => s.urlValue);
  const urlFetchedText = useQuickModeStore(s => s.urlFetchedText);
  const setUrl = useQuickModeStore(s => s.setUrlValue);
  const setFetched = useQuickModeStore(s => s.setUrlFetched);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ title: string; domain: string; excerpt: string } | null>(null);

  // Restore preview from stored fetched text on mount
  useEffect(() => {
    if (urlFetchedText && urlValue && !preview) {
      try {
        const domain = new URL(urlValue).hostname;
        setPreview({ title: urlValue, domain, excerpt: urlFetchedText.slice(0, 200) });
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doFetch = async () => {
    if (!urlValue.trim()) return;
    setFetching(true); setError(''); setPreview(null);
    try {
      const res = await fetch(urlValue, { mode: 'cors' });
      if (!res.ok) throw new Error('non-2xx');
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      doc.querySelectorAll('script,style,nav,header,footer,aside').forEach(el => el.remove());
      const title = doc.title || urlValue;
      const domain = new URL(urlValue).hostname;
      const body = (doc.body?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 8000);
      setFetched(body);
      setPreview({ title, domain, excerpt: body.slice(0, 200) });
    } catch {
      setError('Could not reach this URL. Check the address and try again.');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div>
      <span style={FIELD_LABEL}>URL</span>
      <input
        type="url"
        style={INPUT_LINE}
        placeholder="https://"
        value={urlValue}
        onChange={e => { setUrl(e.target.value); setError(''); }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
        onKeyDown={e => { if (e.key === 'Enter') doFetch(); }}
      />
      <button
        onClick={doFetch}
        disabled={fetching || !urlValue.trim()}
        style={{
          marginTop: 8, padding: '6px 14px',
          background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)', color: 'var(--color-text-primary)',
          fontSize: 13, fontFamily: 'var(--font-sans)', cursor: fetching ? 'default' : 'pointer',
          opacity: (!urlValue.trim() || fetching) ? 0.5 : 1, fontWeight: 500,
        }}
      >
        {fetching ? 'Fetching…' : 'Fetch preview'}
      </button>
      {error && <p style={ERR_TEXT}>{error}</p>}
      {preview && (
        <div style={{
          marginTop: 10, padding: '10px 12px',
          border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-subtle)', position: 'relative',
        }}>
          <button
            onClick={() => { setPreview(null); setFetched(''); }}
            style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2, fontSize: 16, lineHeight: 1 }}
            aria-label="Dismiss preview"
          >×</button>
          <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', paddingRight: 20 }}>{preview.title}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', marginTop: 2 }}>{preview.domain}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', marginTop: 6, lineHeight: '18px' }}>{preview.excerpt}{urlFetchedText.length > 200 ? '…' : ''}</div>
        </div>
      )}
    </div>
  );
}

function FileInput() {
  const fileName = useQuickModeStore(s => s.fileName);
  const fileSize = useQuickModeStore(s => s.fileSize);
  const setFile = useQuickModeStore(s => s.setFile);
  const clearFile = useQuickModeStore(s => s.clearFile);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError('');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['txt', 'md', 'pdf', 'docx'].includes(ext)) {
      setError('Unsupported file type. Use .txt, .md, .pdf, or .docx');
      return;
    }
    if (ext === 'pdf' || ext === 'docx') {
      setError('Could not extract text from this file.');
      return;
    }
    try {
      const text = await file.text();
      setFile(text, file.name, file.size);
    } catch {
      setError('Could not extract text from this file.');
    }
  }, [setFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  if (fileName) {
    return (
      <div>
        <span style={FIELD_LABEL}>File / PDF</span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', border: '1px solid var(--color-border-default)',
          borderRadius: 'var(--radius-md)', background: 'var(--color-bg-subtle)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
          </svg>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', flexShrink: 0 }}>{formatBytes(fileSize)}</span>
          <button onClick={() => { clearFile(); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 2, fontSize: 16, lineHeight: 1, flexShrink: 0 }} aria-label="Remove file">×</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <span style={FIELD_LABEL}>File / PDF</span>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px dashed ${dragging ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
          borderRadius: 'var(--radius-md)', cursor: 'pointer',
          background: dragging ? 'var(--color-bg-surface)' : 'transparent',
          transition: 'border-color 120ms, background 120ms',
          color: 'var(--color-text-tertiary)', fontSize: 13, fontFamily: 'var(--font-sans)',
        }}
      >
        Drop a file here, or click to browse
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
        />
      </div>
      {error && <p style={ERR_TEXT}>{error}</p>}
    </div>
  );
}

function VoiceInput() {
  const transcript = useQuickModeStore(s => s.voiceTranscript);
  const setVoice = useQuickModeStore(s => s.setVoice);
  interface SRInstance {
    continuous: boolean; interimResults: boolean;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    start(): void; stop(): void;
  }
  type SRConstructor = new () => SRInstance;
  const recRef = useRef<SRInstance | null>(null);
  const transcriptRef = useRef(transcript);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  const [recState, setRecState] = useState<'idle' | 'recording' | 'processing' | 'done'>(
    transcript ? 'done' : 'idle'
  );

  const w = typeof window !== 'undefined' ? (window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }) : undefined;
  const SR = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;

  const startRecording = useCallback(() => {
    if (!SR) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.onstart = () => setRecState('recording');
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = Array.from(e.results).map(r => r[0].transcript).join(' ');
      setVoice(text);
    };
    rec.onend = () => { setRecState(transcriptRef.current ? 'done' : 'idle'); };
    rec.onerror = () => setRecState('idle');
    rec.start();
    recRef.current = rec;
  }, [SR, setVoice]);

  const stopRecording = useCallback(() => {
    recRef.current?.stop();
    setRecState('processing');
    setTimeout(() => setRecState(transcriptRef.current ? 'done' : 'idle'), 400);
  }, []);

  if (!SR) {
    return (
      <div>
        <span style={FIELD_LABEL}>Voice note</span>
        <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          Voice recording requires Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div>
      <span style={FIELD_LABEL}>Voice note</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: transcript ? 10 : 0 }}>
        <button
          onClick={recState === 'recording' ? stopRecording : startRecording}
          aria-label={recState === 'recording' ? 'Stop recording' : 'Start recording'}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
            background: recState === 'recording' ? '#C93030' : 'var(--color-accent)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: recState === 'recording' ? '0 0 0 4px rgba(201,48,48,0.2)' : 'none',
            animation: recState === 'recording' ? 'qm-pulse 1.4s ease infinite' : 'none',
            transition: 'background 200ms, box-shadow 200ms',
          }}
        >
          {recState === 'recording' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>
            </svg>
          )}
        </button>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          {recState === 'recording' ? 'Recording…' : recState === 'processing' ? 'Processing…' : recState === 'done' ? 'Transcript ready' : 'Click to record'}
        </span>
      </div>
      {transcript && (
        <>
          <textarea
            style={{ ...TEXTAREA, minHeight: 80 }}
            value={transcript}
            onChange={e => setVoice(e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
          />
          <button
            onClick={() => { setVoice(''); setRecState('idle'); }}
            style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', padding: 0, textDecoration: 'underline' }}
          >
            Re-record
          </button>
        </>
      )}
    </div>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

const ResultCard = memo(function ResultCard({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div style={{
      border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)',
      overflow: 'hidden', background: 'var(--color-bg-card)',
    }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
          borderBottom: expanded ? '1px solid var(--color-border-subtle)' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={e => { e.stopPropagation(); copy(); }}
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-md)', fontSize: 12,
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              background: 'transparent',
              border: 'none',
              color: copied ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
              cursor: 'pointer', transition: 'color 120ms',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px' }}>
          <pre style={{
            margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: '22px',
            color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {content}
          </pre>
        </div>
      )}
    </div>
  );
});

// ─── Section header ───────────────────────────────────────────────────────────

const CONTENT_MAX_WIDTH = 880;
const SECTION_PAD_X = 32;

function Section({ title, sub, children }: {
  title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          padding: `20px ${SECTION_PAD_X}px 10px`, userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: '22px' }}>{title}</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{sub}</span>
      </div>
      <div style={{ padding: `0 ${SECTION_PAD_X}px 20px` }}>{children}</div>
    </div>
  );
}

const STYLES = `
  @keyframes qm-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,48,48,0.4); } 50% { box-shadow: 0 0 0 8px rgba(201,48,48,0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .qm-source-input { transition: opacity 200ms; }

  /* Source tabs */
  .qm-tabs {
    display: flex; align-items: stretch; gap: 0;
    border-bottom: 1px solid var(--color-border-subtle);
    margin-bottom: 16px;
  }
  .qm-tab {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 16px; background: transparent; border: none;
    font-family: var(--font-sans); font-size: 13px; line-height: 18px;
    color: var(--color-text-tertiary); cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -1px;
    transition: color 120ms, border-color 120ms;
  }
  .qm-tab:hover { color: var(--color-text-primary); }
  .qm-tab.active {
    color: var(--color-text-primary);
    border-bottom-color: var(--color-accent);
  }
  .qm-tab-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--color-accent); flex-shrink: 0;
  }

  /* Checklist */
  .qm-check-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: var(--radius-md);
    cursor: pointer; user-select: none;
    transition: background 120ms;
  }
  .qm-check-row:hover { background: var(--color-bg-subtle); }
  .qm-check-box {
    width: 16px; height: 16px; border-radius: 3px;
    border: 1.5px solid var(--color-border-strong);
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background 120ms, border-color 120ms;
  }
  .qm-check-row.active .qm-check-box {
    background: var(--color-accent); border-color: var(--color-accent);
  }
  .qm-check-tick {
    opacity: 0; transition: opacity 120ms;
  }
  .qm-check-row.active .qm-check-tick { opacity: 1; }

  /* Template menu */
  .qm-template-trigger {
    background: transparent; border: none; padding: 0;
    font-family: var(--font-sans); font-size: 13px;
    color: var(--color-text-secondary); cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px;
    transition: color 120ms;
  }
  .qm-template-trigger:hover { color: var(--color-accent); }
  .qm-template-menu {
    position: absolute; right: 0; top: calc(100% + 6px);
    min-width: 320px; max-width: 380px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-panel);
    z-index: 30; overflow: hidden;
  }
  .qm-template-item {
    display: block; width: 100%; text-align: left;
    padding: 10px 14px; background: transparent; border: none;
    cursor: pointer; transition: background 120ms;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .qm-template-item:last-child { border-bottom: none; }
  .qm-template-item:hover { background: var(--color-bg-subtle); }
  .qm-template-name {
    display: block; font-family: var(--font-sans);
    font-size: 13px; font-weight: 600;
    color: var(--color-text-primary); margin-bottom: 2px;
  }
  .qm-template-preview {
    display: block; font-family: var(--font-sans);
    font-size: 12px; line-height: 16px;
    color: var(--color-text-tertiary);
  }
`;

// ─── Main component ───────────────────────────────────────────────────────────

type RunState = 'idle' | 'running' | 'done' | 'error';
type View = 'setup' | 'results';

export default function QuickMode() {
  const store = useQuickModeStore();

  const [view, setView] = useState<View>('setup');
  const [activeSourceTab, setActiveSourceTab] = useState<SourceType>(
    store.selectedSources[0] ?? 'text'
  );
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!templateMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setTemplateMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', h, true);
    return () => document.removeEventListener('pointerdown', h, true);
  }, [templateMenuOpen]);

  const sourceHasContent = useCallback((type: SourceType): boolean => {
    if (type === 'text')  return store.textValue.trim().length > 0;
    if (type === 'url')   return store.urlFetchedText.trim().length > 0;
    if (type === 'file')  return store.fileText.trim().length > 0;
    if (type === 'voice') return store.voiceTranscript.trim().length > 0;
    return false;
  }, [store.textValue, store.urlFetchedText, store.fileText, store.voiceTranscript]);

  const switchTab = useCallback((type: SourceType) => {
    setActiveSourceTab(type);
    if (!store.selectedSources.includes(type)) {
      store.setSources([...store.selectedSources, type]);
    }
  }, [store]);

  // Run state lives locally — resets on mode switch, which is fine
  const [runState, setRunState] = useState<RunState>('idle');
  const [runError, setRunError] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = runState === 'running';
  const isDone = runState === 'done';

  // ── Status line for the sticky action bar ──
  const sourceCharCount =
    (store.selectedSources.includes('text')  ? store.textValue.length         : 0) +
    (store.selectedSources.includes('url')   ? store.urlFetchedText.length    : 0) +
    (store.selectedSources.includes('file')  ? store.fileText.length          : 0) +
    (store.selectedSources.includes('voice') ? store.voiceTranscript.length   : 0);

  // ── Validation ──
  const hasSourceContent = store.selectedSources.length > 0 && store.selectedSources.some(t => {
    if (t === 'text') return store.textValue.trim().length > 0;
    if (t === 'url') return store.urlFetchedText.trim().length > 0;
    if (t === 'file') return store.fileText.trim().length > 0;
    if (t === 'voice') return store.voiceTranscript.trim().length > 0;
    return false;
  });
  const canRun = hasSourceContent && store.promptValue.trim().length > 0 && store.selectedOutputs.length > 0;

  // ── Output chip toggle ──
  const toggleOutput = useCallback((key: string) => {
    const cur = store.selectedOutputs;
    if (cur.includes(key)) {
      if (cur.length === 1) return;
      store.setOutputs(cur.filter(k => k !== key));
    } else {
      store.setOutputs([...cur, key]);
    }
  }, [store]);

  // ── Template select ──
  const selectTemplate = useCallback((key: string) => {
    if (store.templateKey === key) { store.setTemplate(null); return; }
    const tpl = QUICK_TEMPLATES.find(t => t.key === key);
    if (tpl) { store.setTemplate(key); store.setPrompt(tpl.text); }
  }, [store]);

  // ── Run ──
  const doRun = useCallback(async () => {
    if (!canRun) return;
    const apiKey = useSettingsStore.getState().anthropicKey;
    if (!apiKey) {
      setRunError('No API key — add one in Settings');
      setRunState('error');
      setView('results');
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const context = assembleContext(useQuickModeStore.getState());
    const outputList = store.selectedOutputs
      .map(k => QUICK_OUTPUTS.find(o => o.key === k)?.label ?? k)
      .join(', ');

    const fullPrompt = `You are a content generation assistant.\n\nSOURCES:\n${context}\n\nINSTRUCTION:\n${store.promptValue.trim()}\n\nGenerate the following outputs. For each output, use the format label as a header, then produce the content below it.\n\nOUTPUTS REQUESTED:\n${outputList}\n\nFormat each output clearly. Separate outputs with ---`;

    setRunState('running');
    setStreamingText('');
    setResults({});
    setRunError('');
    setView('results');

    let accumulated = '';
    let lineBuffer = '';

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
              setStreamingText(accumulated);
            }
          } catch { /* skip */ }
        }
      }

      setResults(parseResults(accumulated));
      setRunState('done');
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setRunError(err instanceof Error ? err.message : 'Something went wrong. Check your connection and try again.');
      setRunState('error');
    }
  }, [canRun, store]);

  const doRunRef = useRef(doRun);
  useEffect(() => { doRunRef.current = doRun; }, [doRun]);

  const backToSetup = useCallback(() => {
    abortRef.current?.abort();
    setView('setup');
    setRunState('idle');
    setResults({});
    setStreamingText('');
    setRunError('');
  }, []);

  const runAgain = useCallback(() => {
    setRunState('idle');
    setResults({});
    setStreamingText('');
    setRunError('');
    setTimeout(() => doRunRef.current(), 50);
  }, []);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ── Results page ──
  if (view === 'results') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
        <style>{STYLES}</style>
        <div style={{ padding: `28px ${SECTION_PAD_X}px`, maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto' }}>
          <button
            onClick={backToSetup}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', padding: 0, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
            Back to setup
          </button>

          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                {streamingText ? `Generating… (${streamingText.length.toLocaleString()} chars)` : 'Connecting…'}
              </span>
            </div>
          )}

          {runState === 'error' && (
            <p style={{ ...ERR_TEXT, marginBottom: 20 }}>
              {runError || 'Something went wrong. Check your connection and try again.'}
            </p>
          )}

          {isDone && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {store.selectedOutputs.map(key => {
                  const def = QUICK_OUTPUTS.find(o => o.key === key);
                  const label = def?.label ?? key;
                  const content = results[label] ?? Object.entries(results).find(([k]) => k.toLowerCase().includes(label.toLowerCase()))?.[1] ?? '';
                  return <ResultCard key={key} label={label} content={content || '(No content generated for this output)'} />;
                })}
              </div>
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={runAgain} className="btn btn-run btn-sm">Run again →</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Setup page ──
  // Status line: what's missing, or a live summary of what's picked.
  const sourcesWithContent = (['text','url','file','voice'] as const).filter(sourceHasContent);
  let statusLine: React.ReactNode;
  if (!hasSourceContent) {
    statusLine = 'Add content to a source to start';
  } else if (store.promptValue.trim().length === 0) {
    statusLine = 'Write a prompt or pick a template';
  } else if (store.selectedOutputs.length === 0) {
    statusLine = 'Pick at least one output format';
  } else {
    const srcWord = sourcesWithContent.length === 1 ? 'source' : 'sources';
    const outWord = store.selectedOutputs.length === 1 ? 'output' : 'outputs';
    statusLine = `${sourcesWithContent.length} ${srcWord} · ${sourceCharCount.toLocaleString()} chars · ${store.selectedOutputs.length} ${outWord}`;
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <style>{STYLES}</style>

      {/* Scrollable composition area, centered with a desktop max-width. */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto' }}>
          <Section title="Sources" sub="What you're working with">
            <div className="qm-tabs">
              {SOURCE_DEFS.map(({ key, label, icon }) => {
                const active = activeSourceTab === key;
                const hasContent = sourceHasContent(key);
                return (
                  <button
                    key={key}
                    onClick={() => switchTab(key)}
                    className={`qm-tab${active ? ' active' : ''}`}
                  >
                    {icon}
                    <span>{label}</span>
                    {hasContent && <span className="qm-tab-dot" aria-label="has content" />}
                  </button>
                );
              })}
            </div>
            <div className="qm-source-input">
              {activeSourceTab === 'text'  && <TextInput />}
              {activeSourceTab === 'url'   && <UrlInput />}
              {activeSourceTab === 'file'  && <FileInput />}
              {activeSourceTab === 'voice' && <VoiceInput />}
            </div>
          </Section>

          <div style={SECTION_DIVIDER} />

          <Section title="Prompt" sub="What you want it to do">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={FIELD_LABEL}>Instruction</span>
              <div ref={templateMenuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="qm-template-trigger"
                  onClick={() => setTemplateMenuOpen(o => !o)}
                >
                  {(() => {
                    const active = QUICK_TEMPLATES.find(t => t.key === store.templateKey);
                    return active
                      ? <>Template: <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>{active.label}</span> · change</>
                      : <>Start from a template</>;
                  })()}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: templateMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                {templateMenuOpen && (
                  <div className="qm-template-menu">
                    {QUICK_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.key}
                        type="button"
                        className="qm-template-item"
                        onClick={() => { selectTemplate(tpl.key); setTemplateMenuOpen(false); }}
                      >
                        <span className="qm-template-name">{tpl.label}</span>
                        <span className="qm-template-preview">{tpl.preview}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <textarea
              style={{ ...TEXTAREA, minHeight: 120 }}
              placeholder="Write your instruction here, or pick a template"
              value={store.promptValue}
              onChange={e => { store.setPrompt(e.target.value); if (store.templateKey) store.setTemplate(null); }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
            />
          </Section>

          <div style={SECTION_DIVIDER} />

          <Section title="Outputs" sub="Formats to generate">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {OUTPUT_GROUPS.map(group => {
                const items = QUICK_OUTPUTS.filter(o => o.group === group);
                return (
                  <div key={group}>
                    <div style={{
                      fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
                      color: 'var(--color-text-tertiary)', marginBottom: 6,
                    }}>{group}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4 }}>
                      {items.map(({ key, label, meta }) => {
                        const active = store.selectedOutputs.includes(key);
                        return (
                          <div
                            key={key}
                            role="checkbox"
                            aria-checked={active}
                            tabIndex={0}
                            onClick={() => toggleOutput(key)}
                            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleOutput(key); } }}
                            className={`qm-check-row${active ? ' active' : ''}`}
                          >
                            <span className="qm-check-box">
                              <svg className="qm-check-tick" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12l5 5L20 7"/>
                              </svg>
                            </span>
                            <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', flex: 1, lineHeight: '18px' }}>
                              {label}
                            </span>
                            <span style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                              {meta}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <div style={{ height: 24 }} />
        </div>
      </div>

      {/* Sticky action bar — status on the left, Run on the right. */}
      <div style={{
        flexShrink: 0,
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border-subtle)',
      }}>
        <div style={{
          maxWidth: CONTENT_MAX_WIDTH, margin: '0 auto',
          padding: `12px ${SECTION_PAD_X}px`,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14,
        }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
            {statusLine}
          </span>
          <button
            onClick={doRun}
            disabled={!canRun}
            className="btn btn-run"
            style={{ opacity: !canRun ? 0.45 : 1, cursor: !canRun ? 'default' : 'pointer' }}
          >
            Run →
          </button>
        </div>
      </div>
    </div>
  );
}
