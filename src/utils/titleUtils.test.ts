import { describe, expect, it } from 'vitest';
import {
  buildTitleContext,
  cleanGeneratedTitle,
  fallbackTitle,
  sanitizeTitle,
  titleDuplicatesFirstLine,
} from './titleUtils';

describe('titleUtils', () => {
  it('sanitizes model wrappers and punctuation', () => {
    expect(sanitizeTitle('Title: "Plant care onboarding."')).toBe('Plant care onboarding');
  });

  it('caps long model output and removes trailing connector words', () => {
    expect(sanitizeTitle('How to build the new onboarding flow for')).toBe('How to build the new onboarding');
  });

  it('builds cleaner fallbacks from transcript filler', () => {
    expect(fallbackTitle('Okay so I wanted to talk about the Copenhagen design workshop and next steps')).toBe('Copenhagen design workshop next steps');
  });

  it('detects titles that duplicate the first line', () => {
    expect(titleDuplicatesFirstLine('Fragmented speech workflow', 'Fragmented speech workflow notes\nThe rest')).toBe(true);
  });

  it('rejects duplicate generated titles', () => {
    expect(cleanGeneratedTitle('Fragmented Speech Workflow.', 'Fragmented speech workflow\nThe rest')).toBe('');
  });

  it('keeps both the opening and ending for long title context', () => {
    const text = `${'start '.repeat(300)}middle ${'end '.repeat(120)}`;
    const context = buildTitleContext(text);
    expect(context).toContain('[ending]');
    expect(context).toContain('start');
    expect(context).toContain('end');
    expect(context.length).toBeLessThan(text.length);
  });
});
