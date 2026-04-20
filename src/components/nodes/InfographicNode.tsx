import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useInfographicStore } from '../../store/infographicStore';
import { useGraphStore } from '../../store/graphStore';

export interface InfographicData {
  title: string;
  subtitle?: string;
  theme?: { bg?: string; accent?: string; text?: string; cardBg?: string; cardBorder?: string; font?: string };
  points: { stat: string; label: string; detail?: string; color?: string }[];
}

export function renderSVG(data: InfographicData): string {
  const { title, subtitle, points, theme } = data;
  const bg = theme?.bg || '#1a1a18';
  const accent = theme?.accent || '#0DBF5A';
  const textColor = theme?.text || '#e8e6e3';
  const cardBg = theme?.cardBg || '#2a2a26';
  const cardBorder = theme?.cardBorder || '#3a3a36';
  const font = theme?.font || 'system-ui, sans-serif';
  const subtitleColor = '#908e85';

  // Load Google Font dynamically if it's not a system font
  const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI'];
  const primaryFont = font.split(',')[0].trim().replace(/['"]/g, '');
  const isSystemFont = systemFonts.some(sf => primaryFont.toLowerCase() === sf.toLowerCase());
  const googleFontImport = !isSystemFont ? `<defs><style>@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@400;500;700&amp;display=swap');</style></defs>` : '';

  // Also inject into page for html-to-image export
  if (!isSystemFont && typeof document !== 'undefined') {
    const linkId = `gfont-${primaryFont.replace(/\s+/g, '-')}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(primaryFont)}:wght@400;500;700&display=swap`;
      document.head.appendChild(link);
    }
  }

  const W = 960, cols = points.length <= 4 ? 2 : 3;
  const cardW = cols === 2 ? 400 : 270, cardH = 100, gapX = 24, gapY = 16;
  const gridW = cols * cardW + (cols - 1) * gapX;
  const startX = (W - gridW) / 2;
  const titleY = subtitle ? 50 : 60;
  const subtitleY = titleY + 26;
  const gridStartY = subtitle ? subtitleY + 32 : titleY + 40;
  const rows = Math.ceil(points.length / cols);
  const H = Math.max(540, gridStartY + rows * (cardH + gapY) + 24);

  let cards = '';
  points.forEach((p, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = gridStartY + row * (cardH + gapY);
    const pointColor = p.color || accent;
    cards += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="${escSvg(cardBg)}" stroke="${escSvg(cardBorder)}" stroke-width="1"/>`;
    cards += `<text x="${x + 20}" y="${y + 38}" font-size="26" font-weight="700" fill="${escSvg(pointColor)}" font-family="${primaryFont}, system-ui, sans-serif">${escSvg(p.stat)}</text>`;
    cards += `<text x="${x + 20}" y="${y + 62}" font-size="13" font-weight="500" fill="${escSvg(textColor)}" font-family="${primaryFont}, system-ui, sans-serif">${escSvg(p.label)}</text>`;
    if (p.detail) {
      cards += `<text x="${x + 20}" y="${y + 82}" font-size="11" fill="${subtitleColor}" font-family="${primaryFont}, system-ui, sans-serif">${escSvg(p.detail.slice(0, 50))}</text>`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
${googleFontImport}
<rect width="${W}" height="${H}" fill="${escSvg(bg)}" rx="16"/>
<text x="${W / 2}" y="${titleY}" text-anchor="middle" font-size="22" font-weight="700" fill="${escSvg(textColor)}" font-family="${primaryFont}, system-ui, sans-serif">${escSvg(title)}</text>
${subtitle ? `<text x="${W / 2}" y="${subtitleY}" text-anchor="middle" font-size="13" fill="${subtitleColor}" font-family="${primaryFont}, system-ui, sans-serif">${escSvg(subtitle)}</text>` : ''}
${cards}
</svg>`;
}

function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function parseInfographicData(text: string): InfographicData | null {
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch { return null; }
}

export function InfographicInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const text = useOutputStore((s) => s.outputs[id]?.text);
  const [modalOpen, setModalOpen] = useState(false);

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return (
    <div className="flex flex-col gap-2 mt-2" role="status" aria-label="Loading">
      {[100, 90, 95, 85, 100, 88].map((w, i) => <div key={i} className="h-2.5 rounded-sm skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />)}
    </div>
  );
  if (status === 'warning') return <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }}>⚠ No input</div>;

  if (!text) return null;
  const data = parseInfographicData(text);
  if (!data || !data.points?.length) return (
    <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 80 }}>
      <div style={{ fontWeight: 500, marginBottom: 4 }}>Failed to parse infographic data</div>
      <div style={{ opacity: 0.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text.slice(0, 200)}</div>
    </div>
  );

  const svg = renderSVG(data);

  const sendToPanel = () => {
    const node = useGraphStore.getState().nodes.find(n => n.id === id);
    useInfographicStore.getState().add({ id, nodeId: id, label: node?.data.label || 'Infographic', json: text });
  };

  return (
    <>
      <div
        onMouseDown={e => e.stopPropagation()}
        onClick={() => setModalOpen(true)}
        style={{ marginTop: 'var(--space-2)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)', cursor: 'pointer', transition: 'box-shadow 150ms', width: '100%', minWidth: 0 }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', lineHeight: 0 }} />
      </div>

      {modalOpen && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-overlay-backdrop)', backdropFilter: 'blur(2px)' }}
          onClick={() => setModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--color-bg-card)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-default)', boxShadow: 'var(--shadow-lg)', maxWidth: 800, width: '90%', maxHeight: '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 'var(--space-4) var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)' }}>Infographic</span>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', display: 'flex', padding: 'var(--space-1)', borderRadius: 'var(--radius-sm)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div id={`ig-modal-${id}`} style={{ padding: '0 var(--space-6) var(--space-4)' }}>
              <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', lineHeight: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }} />
            </div>
            <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-sm btn-ghost" onClick={async () => {
                const el = document.getElementById(`ig-modal-${id}`);
                if (!el) return;
                const { toPng } = await import('html-to-image');
                const url = await toPng(el, { pixelRatio: 3 });
                const a = document.createElement('a'); a.href = url; a.download = 'infographic.png'; a.click();
              }}>↓ Download PNG</button>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary btn-sm" onClick={() => { sendToPanel(); setModalOpen(false); window.location.hash = 'infographics'; }}>Edit infographic</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
