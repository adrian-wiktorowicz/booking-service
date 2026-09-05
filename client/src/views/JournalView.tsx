import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VoiceJournalSlot } from '../components/VoiceJournalSlot';
import { VoiceJournalButton } from '../features/audio/VoiceJournalButton';
import { MoodGlyph, MoodType } from '../components/MoodGlyphs';
import { TagChips } from '../components/TagChips';
import { saveDraft, getDraft } from '../utils/draftStorage';
import { JournalEntryPayload } from '../api/client';

export interface JournalViewProps {
  initialEntry?: Partial<JournalEntryPayload>;
  onSave: (entry: JournalEntryPayload) => Promise<unknown> | void;
  onLogout?: () => void;
}

type SyncStatus = 'idle' | 'saved_locally' | 'syncing' | 'synced' | 'offline';

const MOODS: { value: MoodType; label: string; activeColor: string }[] = [
  { value: 'bad', label: 'Źle', activeColor: 'bg-[#8c2a1c] text-[#faf9f6] border-[#8c2a1c]' },
  { value: 'neutral', label: 'Neutralnie', activeColor: 'bg-[#70685f] text-[#faf9f6] border-[#70685f]' },
  { value: 'good', label: 'Dobrze', activeColor: 'bg-[#4d6046] text-[#faf9f6] border-[#4d6046]' },
  { value: 'very_good', label: 'Bardzo dobrze', activeColor: 'bg-[#3b2314] text-[#faf9f6] border-[#3b2314]' },
];

const DAILY_PROMPTS = [
  'Za co jesteś dzisiaj najbardziej wdzięczny/a?',
  'Jaki drobny moment przyniósł Ci dzisiaj spokój lub radość?',
  'Jakie wyzwanie dzisiaj pokonałeś/aś lub czego się z niego nauczyłeś/aś?',
  'Czego nowego dowiedziałeś/aś się dzisiaj o sobie lub o świecie?',
  'Jaka jedna myśl lub intencja towarzyszyła Ci w ciągu dnia?',
];

export const JournalView: React.FC<JournalViewProps> = ({ initialEntry, onSave, onLogout }) => {
  const initialDate = initialEntry?.entryDate ?? new Date().toISOString().split('T')[0];

  // Initialize from draft or initialEntry
  const existingDraft = getDraft(initialDate);

  const [entryDate, setEntryDate] = useState(initialDate);
  const [mood, setMood] = useState<MoodType>(
    existingDraft?.mood ?? initialEntry?.mood ?? 'good'
  );
  const [note, setNote] = useState(
    existingDraft?.note ?? initialEntry?.note ?? ''
  );
  const [tags, setTags] = useState<string[]>(
    existingDraft?.tags ?? initialEntry?.tags ?? []
  );

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    existingDraft ? 'saved_locally' : 'idle'
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isAuthExpired, setIsAuthExpired] = useState(false);
  const [showClosureCelebration, setShowClosureCelebration] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Deterministic daily prompt based on date
  const promptIndex = Math.abs(new Date(entryDate).getDate()) % DAILY_PROMPTS.length;
  const currentPrompt = DAILY_PROMPTS[promptIndex];

  // Cloud sync handler
  const performCloudSync = useCallback(
    async (payload: JournalEntryPayload): Promise<boolean> => {
      setSyncStatus('syncing');
      try {
        await onSave(payload);
        setSyncStatus('synced');
        setIsDirty(false);
        setIsAuthExpired(false);
        return true;
      } catch (err: unknown) {
        const error = err as { status?: number; statusCode?: number; message?: string };
        const status = error.status ?? error.statusCode;
        if (status === 401 || String(error.message).includes('401')) {
          setIsAuthExpired(true);
          setSyncStatus('saved_locally');
        } else {
          setSyncStatus('offline');
        }
        return false;
      }
    },
    [onSave]
  );

  // Debounced auto-save effect
  useEffect(() => {
    if (!isDirty) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      void performCloudSync({
        entryDate,
        mood,
        note,
        tags,
      });
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [entryDate, mood, note, tags, isDirty, performCloudSync]);

  // Synchronous draft save helper
  const updateFieldAndSaveDraft = (
    newMood: MoodType,
    newNote: string,
    newTags: string[],
    newDate = entryDate
  ) => {
    saveDraft(newDate, {
      entryDate: newDate,
      mood: newMood,
      note: newNote,
      tags: newTags,
    });
    setSyncStatus('saved_locally');
    setIsDirty(true);
  };

  const handleDateChange = (newDate: string) => {
    if (newDate === entryDate) return;

    // Persist current state before switching only if modified
    if (isDirty) {
      saveDraft(entryDate, {
        entryDate,
        mood,
        note,
        tags,
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Load draft for target date if present
    const targetDraft = getDraft(newDate);
    setEntryDate(newDate);

    if (targetDraft) {
      setMood(targetDraft.mood ?? 'good');
      setNote(targetDraft.note ?? '');
      setTags(Array.isArray(targetDraft.tags) ? targetDraft.tags : []);
      setSyncStatus('saved_locally');
      setIsDirty(false);
    } else {
      setMood('good');
      setNote('');
      setTags([]);
      setSyncStatus('idle');
      setIsDirty(false);
    }
  };

  const handleMoodSelect = (newMood: MoodType) => {
    setMood(newMood);
    updateFieldAndSaveDraft(newMood, note, tags);
  };

  const handleNoteChange = (newNote: string) => {
    if (newNote.length > 50000) return;
    setNote(newNote);
    updateFieldAndSaveDraft(mood, newNote, tags);
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    updateFieldAndSaveDraft(mood, note, newTags);
  };

  const handleInjectPrompt = () => {
    if (note.includes(currentPrompt)) return;
    const injected = note ? `${currentPrompt}\n\n${note}` : `${currentPrompt}\n\n`;
    if (injected.length > 50000) return;
    setNote(injected);
    updateFieldAndSaveDraft(mood, injected, tags);
    if (noteTextareaRef.current) {
      noteTextareaRef.current.focus();
      const cursorTarget = currentPrompt.length + 2;
      noteTextareaRef.current.setSelectionRange(cursorTarget, cursorTarget);
    }
  };

  const handleClosure = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsClosing(true);
    try {
      const ok = await performCloudSync({
        entryDate,
        mood,
        note,
        tags,
      });
      if (ok) {
        setShowClosureCelebration(true);
        setTimeout(() => setShowClosureCelebration(false), 4000);
      }
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-12 flex flex-col font-sans">
      <div className="bg-[#fffefc] rounded-2xl border border-[#ded8ce] p-6 shadow-sm">
        {/* Editorial Header */}
        <header className="flex items-center justify-between pb-4 border-b border-[#e8e4dc] mb-6">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#171513] tracking-tight">
              Dziennik Uważności
            </h1>
            <p className="text-xs text-[#70685f] mt-0.5">Zapisz swoje dzisiejsze myśli</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 3-State Sync Indicator */}
            <div className="text-right" role="status" aria-live="polite">
              {syncStatus === 'syncing' && (
                <span className="text-xs font-medium text-[#70685f] inline-flex items-center gap-1.5">
                  <span className="animate-spin inline-block h-2 w-2 border-2 border-[#70685f] border-t-transparent rounded-full" />
                  Synchronizacja...
                </span>
              )}
              {syncStatus === 'saved_locally' && (
                <span className="text-xs font-medium text-[#8c6d48] inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#b89767]" />
                  Zapisano lokalnie
                </span>
              )}
              {syncStatus === 'synced' && (
                <span className="text-xs font-medium text-[#2d572c] inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#4d6046]" />
                  Zsynchronizowano w chmurze
                </span>
              )}
              {syncStatus === 'offline' && (
                <span className="text-xs font-medium text-[#8c2a1c] inline-flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#8c2a1c]" />
                  Brak sieci (zapisano lokalnie)
                </span>
              )}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-3 py-1.5 text-xs text-[#4a3525] hover:text-[#171513] hover:bg-[#faf9f6] border border-[#ded8ce] rounded-lg transition cursor-pointer"
              >
                Wyloguj
              </button>
            )}
          </div>
        </header>

        {/* Silent Auth Expiration Banner */}
        {isAuthExpired && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-xl bg-[#fdf2f0] border border-[#f5c6cb] text-[#8c2a1c] text-xs flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">Twoja sesja wygasła.</p>
              <p className="text-[#70685f] mt-0.5">
                Wpis jest bezpiecznie zachowany lokalnie. Zaloguj się ponownie, aby zsynchronizować z chmurą.
              </p>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="ml-3 px-2.5 py-1 text-xs font-medium bg-[#8c2a1c] text-white rounded-lg hover:bg-[#6e2015] cursor-pointer shrink-0"
              >
                Zaloguj ponownie
              </button>
            )}
          </div>
        )}

        {/* Celebration Feedback Banner */}
        {showClosureCelebration && (
          <div
            role="status"
            className="mb-5 p-3 text-sm rounded-xl bg-[#edf4ed] border border-[#c4dbc4] text-[#2d572c] text-center font-medium animate-fade-in flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4 text-[#2d572c]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>Wpis zakończony pomyślnie! Świętuj chwilę refleksji.</span>
          </div>
        )}

        <form onSubmit={handleClosure} className="space-y-6">
          {/* Calendar Date Picker */}
          <div>
            <label
              htmlFor="journal-date"
              className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-2"
            >
              Data wpisu
            </label>
            <input
              id="journal-date"
              type="date"
              required
              value={entryDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-sm"
            />
          </div>

          {/* Mood Glyphs Selection */}
          <div>
            <span className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-2">
              Nastrój
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Wybierz nastrój">
              {MOODS.map((m) => {
                const isSelected = mood === m.value;
                return (
                  <label
                    key={m.value}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition select-none ${
                      isSelected
                        ? `${m.activeColor} shadow-xs font-medium`
                        : 'bg-[#faf9f6] border-[#ded8ce] text-[#4a3525] hover:border-[#b8b0a2]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mood"
                      value={m.value}
                      checked={isSelected}
                      onChange={() => handleMoodSelect(m.value)}
                      className="sr-only"
                      aria-label={m.label}
                    />
                    <div className="mb-1">
                      <MoodGlyph
                        mood={m.value}
                        className={isSelected ? 'text-[#faf9f6]' : 'text-[#4a3525]'}
                        size={26}
                      />
                    </div>
                    <span className="text-xs">{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Daily Reflection Prompt Card */}
          <div className="p-3.5 rounded-xl bg-[#faf9f6] border border-[#e8e4dc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-[#70685f] uppercase tracking-wider">
                Inspiracja na dziś
              </span>
              <p className="text-xs font-serif italic text-[#171513]">„{currentPrompt}”</p>
            </div>
            <button
              type="button"
              onClick={handleInjectPrompt}
              className="self-start sm:self-auto shrink-0 px-3 py-1.5 text-xs font-medium text-[#3b2314] bg-white border border-[#ded8ce] hover:border-[#3b2314] rounded-lg transition cursor-pointer shadow-2xs"
            >
              Użyj tej inspiracji
            </button>
          </div>

          {/* Note Field with Voice Recorder Slot */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor="journal-note"
                className="text-xs font-semibold text-[#4a3525] uppercase tracking-wider"
              >
                Notatka
              </label>
              <VoiceJournalSlot>
                <VoiceJournalButton
                  onDictate={(text) => {
                    if (text) {
                      const updated = note ? `${note} ${text}` : text;
                      handleNoteChange(updated);
                    }
                  }}
                />
              </VoiceJournalSlot>
            </div>
            <textarea
              id="journal-note"
              ref={noteTextareaRef}
              rows={6}
              maxLength={50000}
              value={note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Co dzisiaj chodzi Ci po głowie? Jak się czujesz?"
              className="w-full p-3 rounded-xl bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-sm resize-y placeholder-[#70685f]/60 font-sans"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[11px] text-[#70685f]">
                {note.length} / 50 000 znaków
              </span>
            </div>
          </div>

          {/* Tag Chips Component */}
          <TagChips tags={tags} onChange={handleTagsChange} id="journal-tags" />

          {/* Psychological Closure Action Button */}
          <button
            type="submit"
            disabled={isClosing}
            className="w-full py-3.5 px-4 rounded-xl bg-[#141311] hover:bg-[#2b2724] font-medium text-sm text-[#faf9f6] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            {isClosing ? (
              <>
                <span className="animate-spin inline-block h-4 w-4 border-2 border-[#faf9f6] border-t-transparent rounded-full" />
                <span>Zapisywanie...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 text-[#faf9f6]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Zakończ wpis na dziś</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
