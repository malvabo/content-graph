const TRAILING_STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from', 'but', 'nor',
]);

const FALLBACK_STOP_WORDS = new Set([
  ...TRAILING_STOP_WORDS,
  'is', 'it', 'as', 'be', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'did', 'will', 'would', 'could', 'should',
  'i', 'me', 'my', 'you', 'we', 'they', 'this', 'that', 'these', 'those',
  'okay', 'ok', 'so', 'basically', 'actually', 'just', 'like', 'really', 'kind', 'sort', 'thing', 'things',
  'wanted', 'want', 'talk', 'talking', 'think', 'thinking', 'about',
]);

function wordsFrom(text: string): string[] {
  return text
    .split(/[^A-Za-z0-9]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

function sentenceCase(words: string[]): string {
  return words
    .map((word, idx) => {
      const isAcronym = word.length <= 5 && word === word.toUpperCase() && /[A-Z]/.test(word);
      if (isAcronym) return word;
      const lower = word.toLowerCase();
      return idx === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

export function sanitizeTitle(raw: string): string {
  let title = raw.trim();
  const firstLine = title.split(/\r?\n/).find((line) => line.trim());
  title = (firstLine ?? title).trim();
  title = title.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').trim();
  title = title.replace(/^title\s*:\s*/i, '').trim();
  title = title.replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '').trim();
  title = title.replace(/[.!?;:,\u2013\u2014-]+$/g, '').trim();

  let words = wordsFrom(title).slice(0, 6);
  while (words.length && TRAILING_STOP_WORDS.has(words[words.length - 1].toLowerCase())) {
    words = words.slice(0, -1);
  }

  return sentenceCase(words);
}

export function titleDuplicatesFirstLine(title: string, text: string): boolean {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) ?? text;
  const normalize = (value: string) => wordsFrom(value).join(' ').toLowerCase();
  const cleanTitle = normalize(title);
  const cleanFirstLine = normalize(firstLine);
  if (!cleanTitle || !cleanFirstLine) return cleanTitle === cleanFirstLine;
  return cleanTitle === cleanFirstLine || cleanFirstLine.includes(cleanTitle) || cleanTitle.includes(cleanFirstLine);
}

export function fallbackTitle(text: string): string {
  const picked = wordsFrom(text)
    .filter((word) => word.length > 2 && !FALLBACK_STOP_WORDS.has(word.toLowerCase()))
    .slice(0, 5);
  return picked.length ? sentenceCase(picked) : 'Untitled note';
}

export function buildTitleContext(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 1200) return trimmed;
  return `${trimmed.slice(0, 800)}\n\n[ending]\n${trimmed.slice(-400)}`;
}

export function cleanGeneratedTitle(raw: string, sourceText: string): string {
  const title = sanitizeTitle(raw);
  if (!title || titleDuplicatesFirstLine(title, sourceText)) return '';
  return title;
}
