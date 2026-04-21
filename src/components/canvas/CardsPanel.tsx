import { useState, useRef, useEffect, useCallback } from 'react';
import { useCardsStore, type Card } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';

interface ChatMsg { role: 'user' | 'assistant'; text: string }


async function chatWithCards(messages: ChatMsg[], cards: Card[], signal?: AbortSignal): Promise<string> {
  const { anthropicKey, groqKey } = useSettingsStore.getState();
  const cardsJson = JSON.stringify(cards);
  const system = `You are a card editor. The user has a set of content cards. Each card has an id, headline, and body (supports basic HTML: <mark>, <ul>, <li>, <strong>).

Current cards JSON:
${cardsJson}

When the user asks to add, edit, remove, or reorganize cards, return ONLY a JSON object:
{ "cards": [...updated cards array...], "message": "short description of what you did" }

When the user asks a question that doesn't require editing, respond with plain text (no JSON).

Rules:
- Keep existing card ids when editing
- Generate new ids (like "c${Date.now().toString(36)}") for new cards
- Return the COMPLETE cards array, not just changed ones
- No markdown fences, no explanation outside the JSON`;

  const msgs = messages.map(m => ({ role: m.role, content: m.text }));

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4096, system, messages: msgs }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }
  if (groqKey) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 4096, messages: [{ role: 'system', content: system }, ...msgs] }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
  throw new Error('No API key configured. Add one in Settings.');
}

export default function CardsPanel({ setId }: { setId?: string }) {
  const { sets, updateCards } = useCardsStore();
  const currentSet = sets.find(s => s.id === setId) || sets[0];
  const cards = currentSet?.cards || [];

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const groupSelected = () => {
    if (selected.size < 2) return;
    const groupName = prompt('Group name', 'Untitled group');
    if (!groupName) return;
    const updated = cards.map(c => selected.has(c.id) ? { ...c, group: groupName } : c);
    updateCards(currentSet!.id, updated);
    setSelected(new Set());
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const setCards = useCallback((newCards: Card[]) => {
    if (currentSet) updateCards(currentSet.id, newCards);
  }, [currentSet, updateCards]);


  const updateCard = (id: string, field: 'headline' | 'body', value: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCard = (id: string) => {
    setCards(cards.filter(c => c.id !== id));
  };


  const send = useCallback(async () => {
    if (!input.trim() || loading || !currentSet) return;
    const msg = input.trim();
    setInput('');
    const next: ChatMsg[] = [...messages, { role: 'user', text: msg }];
    setMessages(next);
    setLoading(true);
    abortRef.current = new AbortController();
    try {
      const reply = await chatWithCards(next, cards, abortRef.current.signal);
      // Try to parse as card update
      const cleaned = reply.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.cards && Array.isArray(parsed.cards)) {
          setCards(parsed.cards);
          setMessages(m => [...m, { role: 'assistant', text: parsed.message || 'Updated cards.' }]);
        } else {
          setMessages(m => [...m, { role: 'assistant', text: reply }]);
        }
      } catch {
        setMessages(m => [...m, { role: 'assistant', text: reply }]);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setMessages(m => [...m, { role: 'assistant', text: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  }, [input, loading, messages, cards, currentSet, setCards]);

  if (!currentSet) return null;

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Left — Cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>
            {currentSet.name}
          </h1>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>{cards.length} cards</span>
        </div>

        {/* Selection toolbar */}
        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', padding: 'var(--space-2) var(--space-4)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', fontWeight: 500 }}>{selected.size} selected</span>
            <button className="btn btn-sm btn-primary" onClick={groupSelected} disabled={selected.size < 2}>Group</button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Cancel</button>
          </div>
        )}

        {/* Grouped cards */}
        {(() => {
          const groups = new Map<string, typeof cards>();
          const ungrouped: typeof cards = [];
          cards.forEach(c => {
            if (c.group) { const g = groups.get(c.group) || []; g.push(c); groups.set(c.group, g); }
            else ungrouped.push(c);
          });
          const renderCard = (card: typeof cards[0]) => {
            const isSel = selected.has(card.id);
            return (
            <div key={card.id} onClick={e => { if (e.target instanceof HTMLElement && (e.target.contentEditable === 'true' || e.target.tagName === 'INPUT')) return; toggleSelect(card.id); }} style={{
              background: 'var(--color-bg-card)', border: isSel ? '2px solid var(--color-accent)' : '1px solid var(--color-border-default)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative',
              transition: 'border-color 150ms, box-shadow 150ms', textAlign: 'left', minHeight: 120,
              cursor: 'pointer',
            }}
              onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = 'var(--color-border-strong)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; } }}
              onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.boxShadow = 'none'; } }}
            >
              {/* Remove button */}
              <button onClick={() => removeCard(card.id)}
                style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', background: 'var(--color-overlay-light)', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', width: 24, height: 24, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 150ms', backdropFilter: 'blur(4px)' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>

              {/* Headline */}
              {editingId === card.id ? (
                <input value={card.headline} onChange={e => updateCard(card.id, 'headline', e.target.value)}
                  onBlur={() => setEditingId(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingId(null); }}
                  autoFocus
                  style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-1) var(--space-2)', outline: 'none', width: '100%', lineHeight: 'var(--leading-tight)' }} />
              ) : (
                <div onClick={() => setEditingId(card.id)}
                  style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--weight-medium)', lineHeight: 'var(--leading-tight)', color: 'var(--color-text-primary)', cursor: 'text', paddingRight: 'var(--space-6)' }}>
                  {card.headline}
                </div>
              )}

              {/* Body */}
              <div contentEditable suppressContentEditableWarning
                onBlur={e => updateCard(card.id, 'body', e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: card.body }}
                data-placeholder="Write something…"
                style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', outline: 'none', minHeight: 'var(--space-10)', cursor: 'text' }} />
            </div>
          ); };
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              {/* Named groups */}
              {[...groups.entries()].map(([name, groupCards], gi) => {
                const colors = [
                  { bg: 'rgba(13,191,90,0.08)', border: 'rgba(13,191,90,0.2)', label: 'var(--color-accent-subtle)' },
                  { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', label: '#3b82f6' },
                  { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', label: 'var(--color-text-tertiary)' },
                ];
                const c = colors[gi % colors.length];
                return (
                <div key={name} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: c.label }}>{name}</span>
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>{groupCards.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                    {groupCards.map(renderCard)}
                  </div>
                </div>
              ); })}
              {/* Ungrouped */}
              {ungrouped.length > 0 && (
                <div>
                  {groups.size > 0 && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', marginBottom: 'var(--space-3)' }}>Ungrouped</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                    {ungrouped.map(renderCard)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Right — Chat */}
      <div className="hidden md:flex" style={{ width: 320, flexShrink: 0, borderLeft: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-card)', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Chat</div>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>Add, edit, or reorganize cards</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {messages.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'var(--space-6)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', lineHeight: 'var(--leading-snug)' }}>
                "Add 3 cards about AI safety" · "Make the first card shorter" · "Remove the last card" · "Rewrite all cards as questions"
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
              }}>{msg.text}</div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 'var(--space-1)', padding: 'var(--space-3)' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 'var(--size-status-dot)', height: 'var(--size-status-dot)', borderRadius: 'var(--radius-full)', background: 'var(--color-text-disabled)', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask to add or edit cards…" rows={1}
              style={{ flex: 1, resize: 'none', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', background: 'var(--color-bg-card)', outline: 'none', lineHeight: 'var(--leading-relaxed)' }} />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{ width: 'var(--size-control-md)', height: 'var(--size-control-md)', borderRadius: 'var(--radius-md)', border: 'none', background: input.trim() ? 'var(--color-accent)' : 'var(--color-bg-surface)', color: input.trim() ? 'var(--color-text-inverse)' : 'var(--color-text-disabled)', cursor: input.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background var(--duration-base) var(--ease-default)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="m22 2-11 11"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
