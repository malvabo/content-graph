import type { InfographicData } from '../components/nodes/InfographicNode';

export interface DiffSummary {
  labels: string[];
  short: string;
  large: boolean;
}

export function diffInfographic(prev: InfographicData, next: InfographicData): DiffSummary {
  const labels: string[] = [];
  let large = false;

  if (prev.title !== next.title) {
    const grew = next.title.length > prev.title.length * 2 || prev.title.length > next.title.length * 2;
    labels.push(grew ? 'rewrote title' : 'edited title');
  }
  if ((prev.subtitle || '') !== (next.subtitle || '')) {
    labels.push(prev.subtitle && !next.subtitle ? 'removed subtitle' : !prev.subtitle && next.subtitle ? 'added subtitle' : 'edited subtitle');
  }
  if ((prev.footer || '') !== (next.footer || '')) {
    labels.push(prev.footer && !next.footer ? 'removed footer' : !prev.footer && next.footer ? 'added footer' : 'edited footer');
  }
  if ((prev.type || 'cards') !== (next.type || 'cards')) {
    labels.push(`changed chart → ${next.type || 'cards'}`);
  }

  const prevPoints = prev.points || [];
  const nextPoints = next.points || [];
  const delta = nextPoints.length - prevPoints.length;
  if (delta > 0) {
    labels.push(`+${delta} point${delta > 1 ? 's' : ''}`);
    if (delta >= 3) large = true;
  } else if (delta < 0) {
    const removed = Math.abs(delta);
    labels.push(`-${removed} point${removed > 1 ? 's' : ''}`);
    large = true;
  }

  const overlap = Math.min(prevPoints.length, nextPoints.length);
  let editedPoints = 0;
  for (let i = 0; i < overlap; i++) {
    const a = prevPoints[i], b = nextPoints[i];
    if (a.stat !== b.stat || a.label !== b.label || (a.detail || '') !== (b.detail || '') || (a.icon || '') !== (b.icon || '')) editedPoints++;
  }
  if (editedPoints > 0) {
    labels.push(`edited ${editedPoints} point${editedPoints > 1 ? 's' : ''}`);
    if (overlap > 0 && editedPoints / overlap > 0.5) large = true;
  }

  if (labels.length === 0) labels.push('no changes');

  const short = labels.slice(0, 2).join(', ') + (labels.length > 2 ? ` +${labels.length - 2} more` : '');
  return { labels, short, large };
}
