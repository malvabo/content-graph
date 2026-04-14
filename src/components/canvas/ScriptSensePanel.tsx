import { useState, useRef, useCallback, useEffect } from 'react';

const RULES: Record<string, [RegExp, string][]> = {
  improve: [[/\bvery\s+/gi,''],[/\breally\s+/gi,''],[/\bjust\s+/gi,''],[/\bin order to\b/gi,'to'],[/\bdue to the fact that\b/gi,'because'],[/\bat this point in time\b/gi,'now'],[/\bhas the ability to\b/gi,'can'],[/\ba large number of\b/gi,'many']],
  clarity: [[/\butilize\b/gi,'use'],[/\bfacilitate\b/gi,'help'],[/\bleverage\b/gi,'use'],[/\boptimal\b/gi,'best'],[/\bcommence\b/gi,'start'],[/\bterminate\b/gi,'end']],
  concise: [[/\bbasically,?\s*/gi,''],[/\bactually,?\s*/gi,''],[/\bhonestly,?\s*/gi,''],[/\bin my opinion,?\s*/gi,''],[/\bneedless to say,?\s*/gi,'']],
  tone: [[/\bhey\b/gi,'Hello'],[/\bguys\b/gi,'team'],[/\bstuff\b/gi,'materials'],[/\bcool\b/gi,'excellent'],[/\bgot\b/gi,'received'],[/\bwanna\b/gi,'want to'],[/\bgonna\b/gi,'going to']],
  grammar: [[/\bi\b/g,'I'],[/\bdont\b/gi,"don't"],[/\bcant\b/gi,"can't"],[/\bwont\b/gi,"won't"],[/\bteh\b/gi,'the'],[/\brecieve\b/gi,'receive'],[/\s{2,}/g,' ']],
};

const MODES = ['improve','clarity','concise','tone','grammar'] as const;

function improve(text: string, mode: string): string {
  let r = text;
  (RULES[mode] ?? RULES.improve).forEach(([p, s]) => { r = r.replace(p, s); });
  return r.replace(/\s{2,}/g, ' ').replace(/(^|[.!?]\s+)([a-z])/g, (_m, p, c) => p + c.toUpperCase()).trim();
}

interface Props { initialText?: string }

export default function ScriptSensePanel({ initialText }: Props) {
  const [input, setInput] = useState(initialText ?? '');
  const [output, setOutput] = useState('');
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialText) setInput(initialText);
  }, [initialText]);

  const run = useCallback((mode: string) => {
    if (!input.trim()) return;
    setActiveMode(mode);
    setRunning(true);
    setTimeout(() => {
      setOutput(improve(input, mode));
      setRunning(false);
    }, 400);
  }, [input]);

  const useOutput = () => { setInput(output); setOutput(''); setActiveMode(null); };
  const copy = () => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  const words = input.trim() ? input.trim().split(/\s+/).length : 0;
  const outWords = output.trim() ? output.trim().split(/\s+/).length : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--cg-canvas)' }}>
      {/* Header */}
      <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--cg-border)' }}>
        <div style={{ font: '500 15px/20px var(--font-sans)', color: 'var(--cg-ink)' }}>ScriptSense</div>
        <div style={{ font: '400 12px/1 var(--font-sans)', color: 'var(--cg-ink-3)', marginTop: 4 }}>Improve, clarify, and refine text</div>
      </div>

      {/* Input */}
      <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 gap-3">
        <div className="text-eyebrow">Input</div>
        <textarea
          ref={inputRef}
          className="flex-1 resize-none outline-none rounded-lg p-3"
          style={{ font: '400 14px/1.8 var(--font-sans)', color: 'var(--cg-ink)', background: 'var(--cg-card)', border: '1px solid var(--cg-border)', scrollbarWidth: 'thin' }}
          placeholder="Paste text or use voice to import..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--cg-ink-3)' }}>{words} words · {input.length} chars</span>
        </div>

        {/* Mode buttons */}
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button key={m} className={activeMode === m ? 'btn-sm btn-tonal' : 'btn-sm btn-outline'}
              onClick={() => run(m)} style={{ textTransform: 'capitalize' }}>{m}</button>
          ))}
        </div>

        {/* Output */}
        {(output || running) && (
          <>
            <div className="text-eyebrow mt-2">Output</div>
            <div className="flex-1 overflow-y-auto rounded-lg p-3"
              style={{ font: '400 14px/1.8 var(--font-sans)', color: 'var(--cg-ink)', background: 'var(--cg-card)', border: '1px solid var(--cg-border)', scrollbarWidth: 'thin', minHeight: 80 }}>
              {running ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[var(--cg-green)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : output}
            </div>
            {!running && output && (
              <div className="flex items-center gap-2">
                <span style={{ font: '400 11px/1 var(--font-mono)', color: 'var(--cg-ink-3)' }}>
                  {Math.abs(words - outWords)} words {words > outWords ? 'removed' : 'added'} · {words} → {outWords}
                </span>
                <div className="flex-1" />
                <button className={copied ? 'btn-sm btn-tonal' : 'btn-sm btn-outline'} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
                <button className="btn-sm btn-primary" onClick={useOutput}>Use this</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
