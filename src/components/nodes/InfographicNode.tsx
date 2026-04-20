import { useExecutionStore } from '../../store/executionStore';
import { useOutputStore } from '../../store/outputStore';

interface InfographicData {
  title: string;
  subtitle?: string;
  points: { stat: string; label: string; detail?: string }[];
}

function renderSVG(data: InfographicData): string {
  const { title, subtitle, points } = data;
  const cols = points.length <= 4 ? 2 : 3;
  const cardW = cols === 2 ? 340 : 220;
  const cardH = 120;
  const gapX = 30;
  const gapY = 24;
  const gridW = cols * cardW + (cols - 1) * gapX;
  const startX = (800 - gridW) / 2;
  const titleY = subtitle ? 60 : 70;
  const subtitleY = titleY + 30;
  const gridStartY = subtitle ? subtitleY + 40 : titleY + 50;

  let cards = '';
  points.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = gridStartY + row * (cardH + gapY);
    cards += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="#2a2a26" stroke="#3a3a36" stroke-width="1"/>`;
    cards += `<text x="${x + 20}" y="${y + 42}" font-size="28" font-weight="700" fill="#0DBF5A" font-family="Inter, system-ui, sans-serif">${escSvg(p.stat)}</text>`;
    cards += `<text x="${x + 20}" y="${y + 68}" font-size="14" font-weight="500" fill="#e8e6e3" font-family="Inter, system-ui, sans-serif">${escSvg(p.label)}</text>`;
    if (p.detail) {
      cards += `<text x="${x + 20}" y="${y + 92}" font-size="11" fill="#908e85" font-family="Inter, system-ui, sans-serif">${escSvg(p.detail.slice(0, 50))}</text>`;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
<rect width="800" height="600" fill="#1a1a18" rx="16"/>
<text x="400" y="${titleY}" text-anchor="middle" font-size="24" font-weight="700" fill="#e8e6e3" font-family="Inter, system-ui, sans-serif">${escSvg(title)}</text>
${subtitle ? `<text x="400" y="${subtitleY}" text-anchor="middle" font-size="14" fill="#908e85" font-family="Inter, system-ui, sans-serif">${escSvg(subtitle)}</text>` : ''}
${cards}
</svg>`;
}

function escSvg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function InfographicInline({ id }: { id: string }) {
  const status = useExecutionStore((s) => s.status[id] ?? 'idle');
  const text = useOutputStore((s) => s.outputs[id]?.text);

  if (status === 'idle' || status === 'stale') return null;
  if (status === 'running') return (
    <div className="flex flex-col gap-2 mt-2" role="status" aria-label="Loading">
      {[100, 90, 95, 85, 100, 88].map((w, i) => <div key={i} className="h-2.5 rounded-sm skeleton-bar" style={{ width: `${w}%`, animationDelay: `${i * 0.1}s` }} />)}
    </div>
  );
  if (status === 'warning') return <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning-text)', background: 'var(--color-warning-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-2)' }}>⚠ No input</div>;

  if (!text) return null;

  // Try to parse JSON from the output
  let data: InfographicData | null = null;
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    data = JSON.parse(cleaned);
  } catch {
    // Show error state with raw response
    return (
      <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-danger-text)', background: 'var(--color-danger-bg)', padding: 'var(--space-2)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxHeight: 80 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Failed to parse infographic data</div>
        <div style={{ opacity: 0.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text.slice(0, 200)}</div>
      </div>
    );
  }

  if (!data || !data.points?.length) return null;

  const svg = renderSVG(data);

  return (
    <div style={{ marginTop: 'var(--space-2)', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
      <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', lineHeight: 0 }} />
    </div>
  );
}
