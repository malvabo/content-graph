import { useState, useRef, useEffect, useCallback } from 'react';
import { useCardsStore, type Card } from '../../store/cardsStore';
import { useSettingsStore } from '../../store/settingsStore';
import FloatingChat from '../ui/FloatingChat';

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
  const [chatOpen, setChatOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // DnD
  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: 'before' | 'after' } | null>(null);

  const toggleSelect = (id: string) => {
    setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const [groupInput, setGroupInput] = useState('');
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupRenameInput, setGroupRenameInput] = useState('');

  const groupSelected = () => {
    if (selected.size < 2) return;
    if (!showGroupInput) { setShowGroupInput(true); setGroupInput('Untitled group'); return; }
    const name = groupInput.trim() || 'Untitled group';
    const updated = cards.map(c => selected.has(c.id) ? { ...c, group: name } : c);
    updateCards(currentSet!.id, updated);
    setSelected(new Set());
    setShowGroupInput(false);
  };

  const commitGroupRename = (oldName: string) => {
    const name = groupRenameInput.trim();
    if (name && name !== oldName) {
      const updated = cards.map(c => c.group === oldName ? { ...c, group: name } : c);
      updateCards(currentSet!.id, updated);
    }
    setEditingGroup(null);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (messages.length > 0) setChatOpen(true); }, [messages.length]);

  const setCards = useCallback((newCards: Card[]) => {
    if (currentSet) updateCards(currentSet.id, newCards);
  }, [currentSet, updateCards]);


  const updateCard = (id: string, field: 'headline' | 'body', value: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const [toast, setToast] = useState<{ msg: string; undo: () => void } | null>(null);

  const removeCard = (id: string) => {
    const removed = cards.find(c => c.id === id);
    if (!removed) return;
    const prev = [...cards];
    setCards(cards.filter(c => c.id !== id));
    setToast({ msg: `"${removed.headline}" deleted`, undo: () => { setCards(prev); setToast(null); } });
    setTimeout(() => setToast(t => t?.msg === `"${removed.headline}" deleted` ? null : t), 5000);
  };


  const send = useCallback(async (overrideText?: string) => {
    const msg = (overrideText || input).trim();
    if (!msg || loading || !currentSet) return;
    if (!overrideText) setInput('');
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
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--color-bg)', position: 'relative' }}>
      {/* Selection popover — floats above content, centered at top */}
      {selected.size > 0 && (
        <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: '6px 10px 6px 14px', background: 'var(--color-bg-popover)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{selected.size} selected</span>
          {showGroupInput
            ? <input autoFocus className="form-input" value={groupInput} onChange={e => setGroupInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') groupSelected(); if (e.key === 'Escape') setShowGroupInput(false); }} style={{ width: 140 }} />
            : null}
          <button className="btn btn-sm btn-primary" onClick={groupSelected} disabled={selected.size < 2}>{showGroupInput ? 'Create group' : 'Group'}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => { setSelected(new Set()); setShowGroupInput(false); }}>Cancel</button>
        </div>
      )}
      {/* Cards — full width */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6) var(--space-8)', paddingBottom: 120 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h1 style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-lg)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', margin: 0 }}>
            {currentSet.name}
          </h1>
        </div>


        {/* Grouped cards */}
        {(() => {
          const groups = new Map<string, typeof cards>();
          const ungrouped: typeof cards = [];
          cards.forEach(c => {
            if (c.group) { const g = groups.get(c.group) || []; g.push(c); groups.set(c.group, g); }
            else ungrouped.push(c);
          });
          // Upgrade legacy keyword HTML to individual pill tags
          const fixBody = (html: string) =>
            html
              .replace(/<span style="opacity:0\.6;font-size:0\.9em">([^<]*)<\/span>/g, (_: string, content: string) => {
                const tags = content.split(/\s*·\s*|\s*•\s*/).filter(Boolean);
                return `<span class="card-tags">${tags.map((t: string) => `<span class="card-tag">${t.trim()}</span>`).join('')}</span>`;
              })
              .replace(/<span class="card-keywords">([^<]*)<\/span>/g, (_: string, content: string) => {
                const tags = content.split(/\s*·\s*|\s*•\s*/).filter(Boolean);
                return `<span class="card-tags">${tags.map((t: string) => `<span class="card-tag">${t.trim()}</span>`).join('')}</span>`;
              });

          const renderCard = (card: typeof cards[0]) => {
            const isSel = selected.has(card.id);
            const isDragging = draggingId === card.id;
            const dropPos = dropTarget?.id === card.id ? dropTarget.pos : null;
            return (
            <div key={card.id}
              draggable
              onDragStart={e => {
                dragIdRef.current = card.id;
                setDraggingId(card.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                dragIdRef.current = null;
                setDraggingId(null);
                setDropTarget(null);
              }}
              onDragOver={e => {
                e.preventDefault();
                e.stopPropagation();
                if (!dragIdRef.current || dragIdRef.current === card.id) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                setDropTarget(prev => prev?.id === card.id && prev.pos === pos ? prev : { id: card.id, pos });
              }}
              onDrop={e => {
                e.preventDefault();
                const fromId = dragIdRef.current;
                if (!fromId || fromId === card.id) { setDropTarget(null); return; }
                const from = cards.find(c => c.id === fromId);
                if (!from) { setDropTarget(null); return; }
                const rest = cards.filter(c => c.id !== fromId);
                const toIdx = rest.findIndex(c => c.id === card.id);
                const insertIdx = dropTarget?.pos === 'after' ? toIdx + 1 : toIdx;
                setCards([...rest.slice(0, insertIdx), { ...from, group: card.group }, ...rest.slice(insertIdx)]);
                dragIdRef.current = null;
                setDraggingId(null);
                setDropTarget(null);
              }}
              onClick={e => { if (e.target instanceof HTMLElement && (e.target.tagName === 'INPUT' || e.target.closest('[contenteditable="true"]'))) return; toggleSelect(card.id); }}
              style={{
                background: 'linear-gradient(150deg, var(--color-bg-card) 0%, var(--color-bg-surface) 100%)',
                border: isSel ? '2px solid var(--color-accent)' : '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)',
                display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'relative',
                transition: 'border-color 100ms, box-shadow 100ms, opacity 100ms', textAlign: 'left', minHeight: 120,
                cursor: isDragging ? 'grabbing' : 'grab',
                opacity: isDragging ? 0.4 : 1,
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
                dangerouslySetInnerHTML={{ __html: fixBody(card.body) }}
                data-placeholder="Write something…"
                style={{ fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-relaxed)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', outline: 'none', minHeight: 'var(--space-10)', cursor: 'text' }} />
            </div>
          ); };
          const dropLine = (
            <div aria-hidden key="drop-line" style={{ gridColumn: '1 / -1', height: 2, background: 'var(--color-accent)', borderRadius: 2, pointerEvents: 'none', margin: '-4px 0' }} />
          );
          const withDropLine = (list: typeof cards) => {
            const out: React.ReactNode[] = [];
            list.forEach(card => {
              if (dropTarget?.id === card.id && dropTarget.pos === 'before') out.push(dropLine);
              out.push(renderCard(card));
              if (dropTarget?.id === card.id && dropTarget.pos === 'after') out.push(dropLine);
            });
            return out;
          };

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
                <div key={name}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const fromId = dragIdRef.current;
                    if (!fromId) return;
                    const from = cards.find(c => c.id === fromId);
                    if (!from || from.group === name) return;
                    // Append to end of this group
                    const rest = cards.filter(c => c.id !== fromId);
                    setCards([...rest, { ...from, group: name }]);
                    dragIdRef.current = null;
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                  style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 'var(--radius-xl)', padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    {editingGroup === name ? (
                      <input
                        autoFocus
                        value={groupRenameInput}
                        onChange={e => setGroupRenameInput(e.target.value)}
                        onBlur={() => commitGroupRename(name)}
                        onKeyDown={e => { if (e.key === 'Enter') commitGroupRename(name); if (e.key === 'Escape') setEditingGroup(null); }}
                        style={{ fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: c.label, background: 'none', border: 'none', borderBottom: `1px solid ${c.border}`, outline: 'none', padding: '0 2px', width: 160 }}
                      />
                    ) : (
                      <span
                        onClick={() => { setEditingGroup(name); setGroupRenameInput(name); }}
                        title="Click to rename"
                        style={{ fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)', color: c.label, cursor: 'text' }}
                      >{name}</span>
                    )}
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)' }}>{groupCards.length}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                    {withDropLine(groupCards)}
                  </div>
                </div>
              ); })}
              {/* Ungrouped */}
              {ungrouped.length > 0 && (
                <div
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const fromId = dragIdRef.current;
                    if (!fromId) return;
                    const from = cards.find(c => c.id === fromId);
                    if (!from || from.group === undefined) return;
                    const rest = cards.filter(c => c.id !== fromId);
                    setCards([...rest, { ...from, group: undefined }]);
                    dragIdRef.current = null;
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                >
                  {groups.size > 0 && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-disabled)', marginBottom: 'var(--space-3)' }}>Ungrouped</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                    {withDropLine(ungrouped)}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      <FloatingChat
        open={chatOpen}
        onOpenChange={setChatOpen}
        title={currentSet?.name ?? 'Cards'}
        messages={messages}
        input={input}
        loading={loading}
        onInputChange={setInput}
        onSend={send}
        chatEndRef={chatEndRef}
        suggestions={['Rewrite all as questions', 'Add a summary card', 'Make tone more casual', 'Split the longest card', 'Add 2 more cards', 'Remove the last card']}
      />
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 300, background: 'var(--color-bg-card)', border: '1px solid var(--color-border-default)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{toast.msg}</span>
          <button onClick={toast.undo} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, padding: 0 }}>Undo</button>
        </div>
      )}
    </div>
  );
}
