import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';
import { useInfographicStore } from '../../store/infographicStore';
import { useGraphStore } from '../../store/graphStore';
import { useSettingsStore } from '../../store/settingsStore';

export interface InfographicData {
  title: string;
  subtitle?: string;
  footer?: string;
  type?: 'cards' | 'bar' | 'pie';
  points: { stat: string; label: string; detail?: string; icon?: string; max?: number }[];
}

const SYSTEM_FONTS = new Set(['system-ui','sans-serif','serif','monospace','cursive','-apple-system','blinkmacsystemfont','segoe ui','georgia','courier new','times new roman','arial','helvetica','verdana','trebuchet ms','comic sans ms']);

function sanitizeFont(raw: string): string { return raw.replace(/[<>"&]/g, ''); }
function escSvg(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function loadGoogleFont(name: string) {
  if (typeof document === 'undefined') return;
  const id = `gfont-${name.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;500;700;900&display=swap`;
  document.head.appendChild(link);
}

function resolveFont(raw: string | undefined, onFontLoad?: () => void): { family: string; primary: string } {
  const r = raw || 'system-ui, sans-serif';
  const primary = sanitizeFont(r.split(',')[0].trim().replace(/['"]/g, ''));
  if (!SYSTEM_FONTS.has(primary.toLowerCase())) {
    loadGoogleFont(primary);
    if (onFontLoad && typeof document !== 'undefined') document.fonts?.ready?.then(onFontLoad);
  }
  return { family: `${primary}, system-ui, sans-serif`, primary };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function mix(hex: string, target: string, amount: number): string {
  const a = hexToRgb(hex); const b = hexToRgb(target);
  if (!a || !b) return hex;
  const m = (x: number, y: number) => Math.round(x + (y - x) * amount);
  return `#${[m(a.r, b.r), m(a.g, b.g), m(a.b, b.b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
function luminance(hex: string): number {
  const rgb = hexToRgb(hex); if (!rgb) return 0.5;
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

export function renderSVG(data: InfographicData, onFontLoad?: () => void): string {
  const { title, subtitle, footer, points, type = 'cards' } = data;
  const brand = useSettingsStore.getState().brand;

  const bg = brand.colors.secondary;
  const accent = brand.colors.primary;
  const isDarkBg = luminance(bg) < 0.5;
  const textColor = isDarkBg ? '#e8e6e3' : '#1a1a18';
  const mutedText = isDarkBg ? '#908e85' : '#6a6a66';
  const cardBg = mix(bg, isDarkBg ? '#ffffff' : '#000000', 0.06);
  const cardBorder = mix(bg, isDarkBg ? '#ffffff' : '#000000', 0.12);
  const titleSize = 22;
  const statSize = 26;
  const radius = 12;
  const gap = 16;

  const titleFontRes = resolveFont(brand.fonts.title, onFontLoad);
  const bodyFontRes = resolveFont(brand.fonts.body, onFontLoad);
  const titleFont = titleFontRes.family;
  const bodyFont = bodyFontRes.family;

  const W = 960;
  const titleX = W / 2;
  const titleY = subtitle ? 50 : 60;
  const subtitleY = titleY + 26;
  const contentStartY = subtitle ? subtitleY + 32 : titleY + 40;

  let content = '';
  let H = 540;

  if (type === 'bar') {
    const barH = 32, barGap = gap + 4;
    const maxVal = Math.max(...points.map(p => parseFloat(p.stat.replace(/[^0-9.]/g, '')) || 0), 1);
    const chartX = 140, chartW = W - chartX - 60;
    H = Math.max(540, contentStartY + points.length * (barH + barGap) + 60 + (footer ? 40 : 0));
    points.forEach((p, i) => {
      const y = contentStartY + i * (barH + barGap);
      const val = parseFloat(p.stat.replace(/[^0-9.]/g, '')) || 0;
      const w = Math.max(4, (val / maxVal) * chartW);
      content += `<text x="${chartX - 12}" y="${y + barH / 2 + 5}" text-anchor="end" font-size="12" font-weight="500" fill="${escSvg(textColor)}" font-family="${bodyFont}">${escSvg(p.label)}</text>`;
      content += `<rect x="${chartX}" y="${y}" width="${chartW}" height="${barH}" rx="${Math.min(radius, barH / 2)}" fill="${escSvg(cardBg)}"/>`;
      content += `<rect x="${chartX}" y="${y}" width="${w}" height="${barH}" rx="${Math.min(radius, barH / 2)}" fill="${escSvg(accent)}"/>`;
      content += `<text x="${chartX + w + 8}" y="${y + barH / 2 + 5}" font-size="12" font-weight="700" fill="${escSvg(accent)}" font-family="${bodyFont}">${escSvg(p.stat)}</text>`;
    });
  } else if (type === 'pie') {
    const cx = W / 2, cy = contentStartY + 180, r = 140;
    H = Math.max(540, cy + r + 80 + (footer ? 40 : 0));
    const values = points.map(p => parseFloat(p.stat.replace(/[^0-9.]/g, '')) || 1);
    const total = values.reduce((a, b) => a + b, 0);
    let startAngle = -Math.PI / 2;
    const palette = [
      accent,
      mix(accent, isDarkBg ? '#ffffff' : '#000000', 0.3),
      mix(accent, isDarkBg ? '#ffffff' : '#000000', 0.5),
      mix(accent, brand.colors.accent, 0.5),
      brand.colors.accent,
      mix(brand.colors.accent, isDarkBg ? '#ffffff' : '#000000', 0.3),
      mix(accent, '#ffffff', 0.15),
      mix(accent, '#000000', 0.25),
    ];
    points.forEach((p, i) => {
      const slice = (values[i] / total) * Math.PI * 2;
      const endAngle = startAngle + slice;
      const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
      const large = slice > Math.PI ? 1 : 0;
      const color = palette[i % palette.length];
      content += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${escSvg(color)}"/>`;
      const ly = cy + r + 30 + i * 20;
      content += `<rect x="${W / 2 - 120}" y="${ly - 8}" width="10" height="10" rx="2" fill="${escSvg(color)}"/>`;
      content += `<text x="${W / 2 - 104}" y="${ly}" font-size="11" fill="${escSvg(textColor)}" font-family="${bodyFont}">${escSvg(p.label)} — ${escSvg(p.stat)}</text>`;
      startAngle = endAngle;
    });
    H = Math.max(H, cy + r + 30 + points.length * 20 + 30);
  } else {
    const cols = points.length <= 4 ? 2 : 3;
    const gapX = gap + 8, gapY = gap;
    const cardW = Math.floor((W - 80 - (cols - 1) * gapX) / cols);
    const gridW = cols * cardW + (cols - 1) * gapX;
    const startX = (W - gridW) / 2;
    const rows = Math.ceil(points.length / cols);
    const cardH = 100;
    H = Math.max(540, contentStartY + rows * (cardH + gapY) + 24 + (footer ? 40 : 0));

    points.forEach((p, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = contentStartY + row * (cardH + gapY);
      content += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="${radius}" fill="${escSvg(cardBg)}" stroke="${escSvg(cardBorder)}" stroke-width="1"/>`;
      if (p.icon) {
        content += `<text x="${x + 20}" y="${y + 22}" font-size="16">${escSvg(p.icon)}</text>`;
      }
      const statY = p.icon ? y + 50 : y + 38;
      content += `<text x="${x + 20}" y="${statY}" font-size="${statSize}" font-weight="700" fill="${escSvg(accent)}" font-family="${bodyFont}">${escSvg(p.stat)}</text>`;
      content += `<text x="${x + 20}" y="${statY + 24}" font-size="13" font-weight="500" fill="${escSvg(textColor)}" font-family="${bodyFont}">${escSvg(p.label)}</text>`;
      if (p.detail) {
        content += `<text x="${x + 20}" y="${statY + 44}" font-size="11" fill="${escSvg(mutedText)}" font-family="${bodyFont}">${escSvg(p.detail.slice(0, 50))}</text>`;
      }
      if (p.max) {
        const val = parseFloat(p.stat.replace(/[^0-9.]/g, '')) || 0;
        const pct = Math.min(val / p.max, 1);
        const barY = statY + (p.detail ? 52 : 32);
        content += `<rect x="${x + 20}" y="${barY}" width="${cardW - 40}" height="4" rx="2" fill="${escSvg(cardBorder)}"/>`;
        content += `<rect x="${x + 20}" y="${barY}" width="${(cardW - 40) * pct}" height="4" rx="2" fill="${escSvg(accent)}"/>`;
      }
    });
  }

  const footerSvg = footer ? `<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="10" fill="${escSvg(mutedText)}" font-family="${bodyFont}">${escSvg(footer)}</text>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">
<rect width="${W}" height="${H}" fill="${escSvg(bg)}" rx="16"/>
<text x="${titleX}" y="${titleY}" text-anchor="middle" font-size="${titleSize}" font-weight="700" fill="${escSvg(textColor)}" font-family="${titleFont}">${escSvg(title)}</text>
${subtitle ? `<text x="${titleX}" y="${subtitleY}" text-anchor="middle" font-size="13" fill="${escSvg(mutedText)}" font-family="${titleFont}">${escSvg(subtitle)}</text>` : ''}
${content}
${footerSvg}
</svg>`;
}

export function parseInfographicData(text: string): InfographicData | null {
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const raw = JSON.parse(cleaned);
    return normalizeInfographicData(raw);
  } catch { return null; }
}

export function normalizeInfographicData(raw: any): InfographicData | null {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.title !== 'string') return null;
  if (!Array.isArray(raw.points) || raw.points.length === 0) return null;
  const points = raw.points
    .filter((p: any) => p && typeof p.stat === 'string' && typeof p.label === 'string')
    .map((p: any) => ({
      stat: p.stat,
      label: p.label,
      ...(typeof p.detail === 'string' ? { detail: p.detail } : {}),
      ...(typeof p.icon === 'string' ? { icon: p.icon } : {}),
      ...(typeof p.max === 'number' ? { max: p.max } : {}),
    }));
  if (!points.length) return null;
  return {
    title: raw.title,
    ...(typeof raw.subtitle === 'string' ? { subtitle: raw.subtitle } : {}),
    ...(typeof raw.footer === 'string' ? { footer: raw.footer } : {}),
    ...(['cards', 'bar', 'pie'].includes(raw.type) ? { type: raw.type } : {}),
    points,
  };
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
                <button className="btn btn-primary btn-sm" onClick={() => { sendToPanel(); setModalOpen(false); window.location.hash = `infographics:${id}`; }}>Edit infographic</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
