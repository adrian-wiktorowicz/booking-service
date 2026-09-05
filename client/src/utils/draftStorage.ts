export interface JournalDraft {
  entryDate: string;
  mood: 'bad' | 'neutral' | 'good' | 'very_good';
  note: string;
  tags: string[];
}

const DRAFT_PREFIX = 'draft_';

export function saveDraft(date: string, draft: JournalDraft): void {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${date}`, JSON.stringify(draft));
  } catch {
    // Graceful fallback if storage quota exceeded or unavailable
  }
}

export function getDraft(date: string): JournalDraft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${date}`);
    if (!raw) return null;
    return JSON.parse(raw) as JournalDraft;
  } catch {
    return null;
  }
}

export function clearDraft(date: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${date}`);
  } catch {
    // Graceful fallback
  }
}
