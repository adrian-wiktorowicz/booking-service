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
  colorClass: string;
}

const MOODS: MoodOption[] = [
  { value: 'bad', label: 'Źle', emoji: '🌧️', colorClass: 'border-rose-500/50 hover:bg-rose-500/10 has-checked:bg-rose-500/20 has-checked:border-rose-500' },
  { value: 'neutral', label: 'Neutralnie', emoji: '☁️', colorClass: 'border-amber-500/50 hover:bg-amber-500/10 has-checked:bg-amber-500/20 has-checked:border-amber-500' },
  { value: 'good', label: 'Dobrze', emoji: '⛅', colorClass: 'border-emerald-500/50 hover:bg-emerald-500/10 has-checked:bg-emerald-500/20 has-checked:border-emerald-500' },
  { value: 'very_good', label: 'Bardzo dobrze', emoji: '☀️', colorClass: 'border-sky-500/50 hover:bg-sky-500/10 has-checked:bg-sky-500/20 has-checked:border-sky-500' },
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
      <header className="flex items-center justify-between py-4 border-b border-slate-800 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Dziennik</h1>
          <p className="text-xs text-slate-400">Zapisz swoje dzisiejsze myśli</p>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-slate-700 rounded-lg transition cursor-pointer"
          >
            Wyloguj
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="journal-date" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Data wpisu
          </label>
          <input
            id="journal-date"
            type="date"
            required
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Nastrój
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MOODS.map((m) => (
              <label
                key={m.value}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition select-none ${m.colorClass}`}
              >
                <input
                  type="radio"
                  name="mood"
                  value={m.value}
                  checked={mood === m.value}
                  onChange={() => setMood(m.value)}
                  className="sr-only"
                  aria-label={m.label}
                />
                <span className="text-2xl mb-1" role="img" aria-label={m.label}>
                  {m.emoji}
                </span>
                <span className="text-xs font-medium text-slate-200">{m.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="journal-note" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
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
            className="w-full p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-y placeholder-slate-500"
          />
        </div>

        <div>
          <label htmlFor="journal-tags" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Tagi (oddzielone przecinkami)
          </label>
          <input
            id="journal-tags"
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="spacer, trening, praca, relaks"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm"
          />
        </div>

        {savedSuccess && (
          <div className="p-3 text-sm rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center animate-fade-in">
            Wpis zapisany pomyślnie!
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 font-semibold text-slate-950 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/20"
        >
          {saving ? 'Zapisywanie...' : 'Zapisz wpis'}
        </button>
      </form>
    </div>
  );
};
