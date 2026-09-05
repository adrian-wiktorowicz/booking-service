import React, { useState } from 'react';
import { VoiceJournalSlot } from '../components/VoiceJournalSlot';
import { VoiceJournalButton } from '../features/audio/VoiceJournalButton';
import { JournalEntryPayload } from '../api/client';

export interface JournalViewProps {
  initialEntry?: Partial<JournalEntryPayload>;
  onSave: (entry: JournalEntryPayload) => Promise<unknown> | void;
  onLogout?: () => void;
}

export type MoodType = 'bad' | 'neutral' | 'good' | 'very_good';

interface MoodOption {
  value: MoodType;
  label: string;
  emoji: string;
  activeColor: string;
}

const MOODS: MoodOption[] = [
  { value: 'bad', label: 'Źle', emoji: '🌧️', activeColor: 'bg-[#8c2a1c] text-[#faf9f6] border-[#8c2a1c]' },
  { value: 'neutral', label: 'Neutralnie', emoji: '☁️', activeColor: 'bg-[#70685f] text-[#faf9f6] border-[#70685f]' },
  { value: 'good', label: 'Dobrze', emoji: '⛅', activeColor: 'bg-[#4d6046] text-[#faf9f6] border-[#4d6046]' },
  { value: 'very_good', label: 'Bardzo dobrze', emoji: '☀️', activeColor: 'bg-[#3b2314] text-[#faf9f6] border-[#3b2314]' },
];

export const JournalView: React.FC<JournalViewProps> = ({ initialEntry, onSave, onLogout }) => {
  const [entryDate, setEntryDate] = useState(
    initialEntry?.entryDate ?? new Date().toISOString().split('T')[0]
  );
  const [mood, setMood] = useState<MoodType>(initialEntry?.mood ?? 'good');
  const [note, setNote] = useState(initialEntry?.note ?? '');
  const [tagsInput, setTagsInput] = useState(initialEntry?.tags?.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);

    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      await onSave({
        entryDate,
        mood,
        note,
        tags: parsedTags,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 pb-12 flex flex-col">
      <div className="bg-white rounded-2xl border border-[#e8e4dc] p-6 shadow-sm">
        <header className="flex items-center justify-between pb-4 border-b border-[#e8e4dc] mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#171513] tracking-tight">Dziennik</h1>
            <p className="text-xs text-[#70685f]">Zapisz swoje dzisiejsze myśli</p>
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
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="journal-date" className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-2">
              Data wpisu
            </label>
            <input
              id="journal-date"
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-sm"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-2">
              Nastrój
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MOODS.map((m) => {
                const isSelected = mood === m.value;
                return (
                  <label
                    key={m.value}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition select-none ${
                      isSelected
                        ? `${m.activeColor} shadow-sm`
                        : 'bg-[#faf9f6] border-[#ded8ce] text-[#4a3525] hover:border-[#b8b0a2]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mood"
                      value={m.value}
                      checked={isSelected}
                      onChange={() => setMood(m.value)}
                      className="sr-only"
                      aria-label={m.label}
                    />
                    <span className="text-2xl mb-1" role="img" aria-label={m.label}>
                      {m.emoji}
                    </span>
                    <span className={`text-xs font-medium ${isSelected ? 'text-[#faf9f6]' : 'text-[#4a3525]'}`}>{m.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="journal-note" className="text-xs font-semibold text-[#4a3525] uppercase tracking-wider">
                Notatka
              </label>
              <VoiceJournalSlot>
                <VoiceJournalButton
                  onDictate={(text) => {
                    if (text) {
                      setNote((prev) => (prev ? `${prev} ${text}` : text));
                    }
                  }}
                />
              </VoiceJournalSlot>
            </div>
            <textarea
              id="journal-note"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Co dzisiaj chodzi Ci po głowie? Jak się czujesz?"
              className="w-full p-3 rounded-xl bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-sm resize-y placeholder-[#70685f]/60"
            />
          </div>

          <div>
            <label htmlFor="journal-tags" className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider mb-2">
              Tagi (oddzielone przecinkami)
            </label>
            <input
              id="journal-tags"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="spacer, trening, praca, relaks"
              className="w-full px-3 py-2.5 rounded-xl bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-sm placeholder-[#70685f]/60"
            />
          </div>

          {savedSuccess && (
            <div className="p-3 text-sm rounded-xl bg-[#edf4ed] border border-[#c4dbc4] text-[#2d572c] text-center animate-fade-in">
              Wpis zapisany pomyślnie!
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 px-4 rounded-xl bg-[#141311] hover:bg-[#2b2724] font-semibold text-[#faf9f6] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {saving ? 'Zapisywanie...' : 'Zapisz wpis'}
          </button>
        </form>
      </div>
    </div>
  );
};
