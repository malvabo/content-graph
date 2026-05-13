import { useRef, useState, useCallback, useEffect, memo } from 'react';
import { useQuickModeStore, type SourceType } from '../../store/quickModeStore';
import { useSettingsStore } from '../../store/settingsStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_OUTPUTS = [
  { key: 'linkedin-post',  label: 'LinkedIn Post' },
  { key: 'twitter-thread', label: 'Twitter Thread' },
  { key: 'twitter-single', label: 'Twitter Single' },
  { key: 'ig-carousel',    label: 'IG Carousel' },
  { key: 'blog-article',   label: 'Blog Article' },
  { key: 'newsletter',     label: 'Newsletter' },
  { key: 'infographic',    label: 'Infographic' },
  { key: 'quote-card',     label: 'Quote Card' },
  { key: 'image-prompt',   label: 'Image Prompt' },
] as const;

const QUICK_TEMPLATES = [
  { key: 'social',    label: 'Repurpose for social',  text: 'Turn this into social content. Adapt the tone and length for each format. Keep the core message intact.' },
  { key: 'extract',   label: 'Extract key points',    text: 'Extract the most important points from this source. Be concise. Use plain language. No filler.' },
  { key: 'summarise', label: 'Summarise',              text: 'Summarise this in plain language. Aim for clarity over completeness. One paragraph maximum.' },
  { key: 'audience',  label: 'Rewrite for audience',  text: 'Rewrite this for a general audience with no specialist knowledge. Keep the meaning. Remove jargon.' },
  { key: 'series',    label: 'Content series',         text: 'Turn this into a multi-part content series. Each piece should stand alone but connect to the others.' },
  { key: 'draft',     label: 'Draft from notes',       text: 'Use these notes as a brief. Write a first draft. Fill in gaps with reasonable assumptions and flag them.' },
];

const SOURCE_DEFS: { key: SourceType; label: string; icon: JSX.Element }[] = [
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

const CHIP_BASE: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 14px', borderRadius: 'var(--radius-full)',
  fontSize: 13, lineHeight: '18px', fontFamily: 'var(--font-sans)',
  cursor: 'pointer', border: '1px solid var(--color-border-subtle)',
  background: 'var(--color-bg-surface)', color: 'var(--color-text-tertiary)',
  transition: 'border-color 120ms, background 120ms, color 120ms',
  whiteSpace: 'nowrap', userSelect: 'none',
};
const CHIP_ACTIVE: React.CSSProperties = {
  border: '1px solid var(--color-accent)',
  background: 'var(--color-bg-surface)',
  color: 'var(--color-accent)',
};
const FIELD_LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
  color: 'var(--color-text-secondary)', marginBottom: 6, letterSpacing: 0.1,
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
        style={{ ...TEXTAREA, minHeight: 120 }}
        placeholder="Paste or type your source text here"
        value={value}
        onChange={e => set(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
      />
      <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
        {value.length.toLocaleString()}
      </div>
    </div>
  );
}

function UrlInput() {
  const urlValue = useQuickModeStore(s => s.urlValue);
  const urlFetchedText = useQuickModeStore(s => s.urlFetchedText);
  const setUrl = useQuickModeStore(s => s.setUrlValue);
  const setFetched = useQuickModeStore(s => s.setUrlFetched);
  const clearUrl = useQuickModeStore(s => s.clearUrl);
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
          background: 'transparent', border: '1.5px solid var(--color-accent)',
          borderRadius: 'var(--radius-md)', color: 'var(--color-accent)',
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
  const fileText = useQuickModeStore(s => s.fileText);
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
  const recRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef(transcript);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  const [recState, setRecState] = useState<'idle' | 'recording' | 'processing' | 'done'>(
    transcript ? 'done' : 'idle'
  );

  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition)
    : undefined;

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
              background: 'var(--color-bg-surface)',
              border: `1px solid ${copied ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
              color: copied ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer', transition: 'all 120ms',
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

// ─── Accordion section ────────────────────────────────────────────────────────

function AccordionSection({ title, sub, open, onToggle, children }: {
  title: string; sub: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 40px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', lineHeight: '22px' }}>{title}</span>
          <span style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>— {sub}</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      {open && <div style={{ padding: '0 40px 24px' }}>{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type RunState = 'idle' | 'running' | 'done' | 'error';
type View = 'setup' | 'results';

export default function QuickMode() {
  const store = useQuickModeStore();

  const [view, setView] = useState<View>('setup');
  const [sectionsOpen, setSectionsOpen] = useState({ sources: true, prompt: true, outputs: true });
  const toggleSection = (k: keyof typeof sectionsOpen) =>
    setSectionsOpen(s => ({ ...s, [k]: !s[k] }));

  // Run state lives locally — resets on mode switch, which is fine
  const [runState, setRunState] = useState<RunState>('idle');
  const [runError, setRunError] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});
  const [streamingText, setStreamingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const isRunning = runState === 'running';
  const isDone = runState === 'done';

  // ── Validation ──
  const hasSourceContent = store.selectedSources.length > 0 && store.selectedSources.some(t => {
    if (t === 'text') return store.textValue.trim().length > 0;
    if (t === 'url') return store.urlFetchedText.trim().length > 0;
    if (t === 'file') return store.fileText.trim().length > 0;
    if (t === 'voice') return store.voiceTranscript.trim().length > 0;
    return false;
  });
  const canRun = hasSourceContent && store.promptValue.trim().length > 0 && store.selectedOutputs.length > 0;

  // ── Source chip toggle ──
  const toggleSource = useCallback((type: SourceType) => {
    const cur = store.selectedSources;
    if (cur.includes(type)) {
      if (cur.length === 1) return;
      store.setSources(cur.filter(t => t !== type));
    } else {
      store.setSources([...cur, type]);
    }
  }, [store]);

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

  const STYLES = `
    @keyframes qm-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,48,48,0.4); } 50% { box-shadow: 0 0 0 8px rgba(201,48,48,0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .qm-source-input { transition: opacity 200ms; }
  `;

  // ── Results page ──
  if (view === 'results') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
        <style>{STYLES}</style>
        <div style={{ padding: '28px 40px', maxWidth: 720 }}>
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
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--color-bg)', fontFamily: 'var(--font-sans)' }}>
      <style>{STYLES}</style>

      <AccordionSection
        title="Sources" sub="Choose what you're working with"
        open={sectionsOpen.sources} onToggle={() => toggleSection('sources')}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: store.selectedSources.length > 0 ? 20 : 0 }}>
          {SOURCE_DEFS.map(({ key, label, icon }) => {
            const active = store.selectedSources.includes(key);
            return (
              <button key={key} onClick={() => toggleSource(key)} style={{ ...CHIP_BASE, ...(active ? CHIP_ACTIVE : {}) }}>
                {icon}{label}
              </button>
            );
          })}
        </div>
        {store.selectedSources.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {store.selectedSources.map(type => (
              <div key={type} className="qm-source-input">
                {type === 'text'  && <TextInput />}
                {type === 'url'   && <UrlInput />}
                {type === 'file'  && <FileInput />}
                {type === 'voice' && <VoiceInput />}
              </div>
            ))}
          </div>
        )}
      </AccordionSection>

      <div style={SECTION_DIVIDER} />

      <AccordionSection
        title="Prompt" sub="Tell it what to do"
        open={sectionsOpen.prompt} onToggle={() => toggleSection('prompt')}
      >
        <div style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 12 }}>
          {QUICK_TEMPLATES.map(tpl => {
            const active = store.templateKey === tpl.key;
            return (
              <button
                key={tpl.key}
                onClick={() => selectTemplate(tpl.key)}
                style={{ ...CHIP_BASE, ...(active ? CHIP_ACTIVE : {}), flexShrink: 0 }}
              >
                {tpl.label}
              </button>
            );
          })}
        </div>
        <textarea
          style={{ ...TEXTAREA, minHeight: 100 }}
          placeholder="Write your instruction here, or pick a template above"
          value={store.promptValue}
          onChange={e => { store.setPrompt(e.target.value); if (store.templateKey) store.setTemplate(null); }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; }}
        />
      </AccordionSection>

      <div style={SECTION_DIVIDER} />

      <AccordionSection
        title="Outputs" sub="Pick your formats"
        open={sectionsOpen.outputs} onToggle={() => toggleSection('outputs')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {QUICK_OUTPUTS.map(({ key, label }) => {
            const active = store.selectedOutputs.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleOutput(key)}
                style={{ ...CHIP_BASE, ...(active ? CHIP_ACTIVE : {}), borderRadius: 'var(--radius-md)', padding: '10px 14px', justifyContent: 'flex-start' }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </AccordionSection>

      <div style={SECTION_DIVIDER} />

      <div style={{ padding: '20px 40px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={doRun}
          disabled={!canRun}
          className="btn btn-run"
          style={{ opacity: !canRun ? 0.45 : 1, cursor: !canRun ? 'default' : 'pointer' }}
        >
          Run →
        </button>
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
