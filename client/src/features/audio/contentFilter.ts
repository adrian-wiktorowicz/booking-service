/**
 * Harmful content & safety validation for speech transcriptions.
 * Intercepts terroristic threats, violent extremism, mass casualty plans,
 * and dangerous weapons/explosives manufacturing.
 */

export interface ContentSafetyResult {
  isSafe: boolean;
  reason?: string;
}

// Regex patterns for high-severity harmful intents (Polish & English)
const HARMFUL_INTENT_PATTERNS: RegExp[] = [
  // Terrorist attacks & plans
  /\b(atak\s+terrorystyczn\w*|zamach\w*|terrorist\s+attack|terrorism\s+plan)\b/i,
  // Bombing & explosives manufacturing / detonation
  /\b(jak\s+zrobić\s+bomb\w*|ładunk\w*\s+wybuchow\w*|zdetonowa\w*|materia[łl]\w*\s+wybuchow\w*|build\s+a\s+bomb|make\s+an\s+explosive|detonate\s+a\s+bomb)\b/i,
  // Mass violence & mass shootings / attacks
  /\b(masow\w*\s+atak\w*|zabić\s+jak\s+najwięcej\s+ludzi|mass\s+casualty|mass\s+shooting|violent\s+attack)\b/i,
];

export function validateContentSafety(text: string): ContentSafetyResult {
  if (!text || !text.trim()) {
    return { isSafe: true };
  }

  const normalized = text.toLowerCase().trim();

  for (const pattern of HARMFUL_INTENT_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        isSafe: false,
        reason: 'Wykryto niedozwolone treści naruszające bezpieczeństwo (zagrożenie przemocą lub terroryzmem). Zapis został zablokowany.',
      };
    }
  }

  return { isSafe: true };
}
