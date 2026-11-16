// The rival's letters on the soccer score bug (Wave 1): a real word, never a decade or a squashed name.
import { describe, expect, it } from 'vitest';
import { bugTag } from './controls';

describe('bugTag', () => {
  it('keeps a short first word whole and skips decades', () => {
    expect(bugTag('AI Pro')).toBe('AI');
    expect(bugTag("'10s Barcelona")).toBe('BAR');
    expect(bugTag('1990s Manchester United')).toBe('MAN');
    expect(bugTag('Rival')).toBe('RIV');
    expect(bugTag('Steph30')).toBe('STE');
    expect(bugTag('')).toBe('RIV');
    expect(bugTag('!!!')).toBe('RIV');
  });
});
