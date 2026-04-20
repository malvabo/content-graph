import { useState, useRef, useEffect, useCallback } from 'react';
import { useGraphStore, type NodeCategory } from '../../store/graphStore';
import { useOutputStore } from '../../store/outputStore';
import { useSettingsStore } from '../../store/settingsStore';

const SendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></svg>;

const CATEGORY_ORDER: NodeCategory[] = ['source', 'transform', 'generate', 'output'];
const CATEGORY_LABEL: Record<NodeCategory, string> = { source: 'Sources', transform: 'Transforms', generate: 'Generated', output: 'Outputs' };

interface ChatMsg { role: 'user' | 'assistant'; text: string }

async function chatWithAI(messages: ChatMsg[], context: string, signal?: AbortSignal): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const system = `You are a helpful assistant discussing content from a workflow. Here is the current content:\n\n${context}\n\nAnswer questions, suggest edits, and help improve the content.`;

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2048, system, messages: messages.map(m => ({ role: m.role, content: m.text })) }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 2048, messages: [{ role: 'system', content: system }, ...messages.map(m => ({ role: m.role, content: m.text }))] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  throw new Error('No API key configured. Add one in Settings.');
}

export default function CardsPanel() {
  const nodes = useGraphStore(s => s.nodes);
  const outputs = useOutputStore(s => s.outputs);
  const graphName = useGraphStore(s => s.graphName);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    label: CATEGORY_LABEL[cat],
    items: nodes.filter(n => n.data.category === cat).map(n => ({ node: n, output: outputs[n.id] })),
  })).filter(g => g.items.length > 0);

  const contextStr = nodes.map(n => {
    const out = outputs[n.id];
    return `[${n.data.label}]: ${out?.text || '(no output)'}`;
  }).join('\n\n');

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    const next: ChatMsg[] = [...messages, { role: 'user', text: msg }];
    setMessages(next);
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const reply = await chatWithAI(next, contextStr, abortRef.current.signal);
      setMessages(m => [...m, { role: 'assistant', text: reply }]);
    } catch (e: any) {
      if (e.name !== 'AbortError') setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }, [input, loading, messages, contextStr]);

  const hasContent = grouped.length > 0;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: '0 0 var(--space-1)' }}>
          Cards
        </h1>
        {graphName && graphName !== 'Untitled' && (
          <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-6)' }}>{graphName}</div>
        )}
        {!graphName || graphName === 'Untitled' ? <div style={{ marginBottom: 'var(--space-6)' }} /> : null}

        {!hasContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-10)', flex: 1, minHeight: 300 }}>
            <div style={{ width: 'var(--space-12)', height: 'var(--space-12)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', marginBottom: 'var(--space-5)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/><rect x="2" y="13" width="8" height="8" rx="1.5"/><rect x="14" y="13" width="8" height="8" rx="1.5"/></svg>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>No content yet</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', maxWidth: 280, lineHeight: 'var(--leading-snug)' }}>Run a workflow to see your content as cards here</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
            {grouped.map(group => (
              <div key={group.category}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', marginBottom: 'var(--space-3)' }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
                  {group.items.map(({ node, output }) => (
                    <div key={node.id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)' }}>{node.data.badge}</span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>{node.data.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', padding: 'var(--space-0) var(--space-2)', borderRadius: 'var(--radius-full)', background: `var(--color-badge-${node.data.category}-bg)`, color: `var(--color-badge-${node.data.category}-text)` }}>
                          {node.data.category}
                        </span>
                      </div>
                      {output?.imageBase64 && (
                        <img src={`data:image/png;base64,${output.imageBase64}`} alt={node.data.label} style={{ width: '100%', borderRadius: 'var(--radius-md)', objectFit: 'cover', maxHeight: 200 }} />
                      )}
                      {output?.text ? (
                        <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical' }}>
                          {output.text}
                        </div>
                      ) : (
                        <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', fontStyle: 'italic' }}>No output yet</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right — Chat */}
      <div style={{ width: 360, flexShrink: 0, borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Chat</div>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>Ask about your content</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', lineHeight: 'var(--leading-snug)' }}>
                Ask questions about your content, request edits, or get suggestions
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)',
                background: msg.role === 'user' ? 'var(--color-bg-surface)' : 'var(--color-bg-card)',
                border: msg.role === 'assistant' ? '1px solid var(--color-border-subtle)' : 'none',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)',
                lineHeight: 'var(--leading-relaxed)', whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-3)' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: 'var(--size-status-dot)', height: 'var(--size-status-dot)', borderRadius: 'var(--radius-full)', background: 'var(--color-text-disabled)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your content…"
              rows={1}
              style={{
                flex: 1, resize: 'none', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
                color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', outline: 'none',
                lineHeight: 'var(--leading-relaxed)',
              }}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{
                width: 'var(--size-control-md)', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)',
                border: 'none', background: input.trim() ? 'var(--color-accent)' : 'var(--color-bg-surface)',
                color: input.trim() ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)',
                cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `background var(--duration-base) var(--ease-default)`,
              }}>
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
