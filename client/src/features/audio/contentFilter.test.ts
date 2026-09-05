import { describe, it, expect } from 'vitest';
import { validateContentSafety } from './contentFilter';

describe('validateContentSafety', () => {
  it('approves benign journal reflections and everyday speech', () => {
    const benignNotes = [
      'Dzisiejszy dzień był bardzo produktywny, poszedłem na spacer i ugotowałem obiad.',
      'Muszę pamiętać o spotkaniu z zespołem o godzinie 14:00.',
      'Today was a peaceful day. I meditated and read a book about psychology.',
      'Biegłem 5 kilometrów w parku i czuję się świetnie.',
    ];

    for (const note of benignNotes) {
      const result = validateContentSafety(note);
      expect(result.isSafe).toBe(true);
      expect(result.reason).toBeUndefined();
    }
  });

  it('detects and blocks terroristic threats and mass violence plans (Polish)', () => {
    const harmfulNotes = [
      'Planuję atak terrorystyczny na stację metra w poniedziałek.',
      'Instrukcja jak zrobić bombę i ładunek wybuchowy w domu.',
      'Plan zamachu na budynek rządowy i zdetonowanie materiałów wybuchowych.',
      'Chcę przeprowadzić masowy atak i zabić jak najwięcej ludzi.',
    ];

    for (const note of harmfulNotes) {
      const result = validateContentSafety(note);
      expect(result.isSafe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toMatch(/bezpieczeństwa|terroryzm|przemoc/i);
    }
  });

  it('detects and blocks terroristic threats and mass violence plans (English)', () => {
    const harmfulNotes = [
      'I am going to carry out a terrorist attack tomorrow morning.',
      'How to build a bomb with improvised explosives for mass casualty.',
      'Planning a violent attack on the public square with automatic weapons.',
    ];

    for (const note of harmfulNotes) {
      const result = validateContentSafety(note);
      expect(result.isSafe).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toMatch(/safety|violence|terror/i);
    }
  });

  it('handles empty or whitespace-only input safely', () => {
    expect(validateContentSafety('')).toEqual({ isSafe: true });
    expect(validateContentSafety('   ')).toEqual({ isSafe: true });
  });
});
