import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveDraft, getDraft, clearDraft, JournalDraft } from './draftStorage';

describe('draftStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('saves and retrieves a journal draft for a specific date', () => {
    const draft: JournalDraft = {
      entryDate: '2026-09-05',
      mood: 'very_good',
      note: 'Wspaniały poranny spacer.',
      tags: ['spacer', 'zen'],
    };

    saveDraft('2026-09-05', draft);
    const retrieved = getDraft('2026-09-05');

    expect(retrieved).toEqual(draft);
    expect(localStorage.getItem('draft_2026-09-05')).toBe(JSON.stringify(draft));
  });

  it('returns null when draft does not exist', () => {
    expect(getDraft('2026-01-01')).toBeNull();
  });

  it('returns null and handles corrupted JSON safely', () => {
    localStorage.setItem('draft_2026-09-05', 'invalid-json{{{');
    expect(getDraft('2026-09-05')).toBeNull();
  });

  it('clears draft for a specific date', () => {
    saveDraft('2026-09-05', {
      entryDate: '2026-09-05',
      mood: 'good',
      note: 'Notatka',
      tags: ['test'],
    });

    expect(getDraft('2026-09-05')).not.toBeNull();
    clearDraft('2026-09-05');
    expect(getDraft('2026-09-05')).toBeNull();
    expect(localStorage.getItem('draft_2026-09-05')).toBeNull();
  });

  it('gracefully handles localStorage quota exceeded errors without crashing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => {
      saveDraft('2026-09-05', {
        entryDate: '2026-09-05',
        mood: 'bad',
        note: 'Długi tekst',
        tags: [],
      });
    }).not.toThrow();
  });
});
