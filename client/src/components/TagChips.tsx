import React, { useState } from 'react';

export const PRESET_TAGS = [
  'spacer',
  'trening',
  'praca',
  'relaks',
  'sen',
  'rodzina',
  'czytanie',
  'medytacja',
];

export interface TagChipsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  id?: string;
}

export const TagChips: React.FC<TagChipsProps> = ({
  tags,
  onChange,
  maxTags = 10,
  id = 'journal-tags',
}) => {
  const [inputValue, setInputValue] = useState('');

  const normalize = (t: string) => t.trim().toLowerCase();

  const handleTogglePreset = (preset: string) => {
    const norm = normalize(preset);
    if (tags.includes(norm)) {
      onChange(tags.filter((t) => t !== norm));
    } else {
      if (tags.length >= maxTags) return;
      onChange([...tags, norm]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddCustom = () => {
    const norm = normalize(inputValue);
    if (!norm) return;

    // Support comma-separated input in single submission
    const candidates = norm
      .split(',')
      .map((c) => normalize(c))
      .filter((c) => c.length > 0);

    let updated = [...tags];
    for (const cand of candidates) {
      if (updated.length >= maxTags) break;
      if (!updated.includes(cand)) {
        updated.push(cand);
      }
    }

    if (updated.length !== tags.length) {
      onChange(updated);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddCustom();
    }
  };

  const isMaxReached = tags.length >= maxTags;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-[#4a3525] uppercase tracking-wider"
        >
          Tagi ({tags.length}/{maxTags})
        </label>
        {isMaxReached && (
          <span className="text-[11px] text-[#8c2a1c] font-medium">
            Maksymalnie {maxTags} tagów
          </span>
        )}
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sugerowane tematy">
        {PRESET_TAGS.map((preset) => {
          const isActive = tags.includes(preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => handleTogglePreset(preset)}
              disabled={!isActive && isMaxReached}
              className={`px-2.5 py-1 text-xs rounded-full border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[#3b2314] text-[#faf9f6] border-[#3b2314] shadow-xs'
                  : 'bg-[#faf9f6] text-[#4a3525] border-[#ded8ce] hover:border-[#b8b0a2] hover:bg-[#f0ede6]'
              }`}
              aria-pressed={isActive}
            >
              #{preset}
            </button>
          );
        })}
      </div>

      {/* Active Selected Tags (Custom and Presets) */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ebe7df] text-[#171513] border border-[#ded8ce]"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                aria-label={`Usuń tag ${tag}`}
                className="hover:text-[#8c2a1c] cursor-pointer ml-0.5 text-xs font-bold leading-none p-0.5"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom Tag Input */}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          aria-label="Tagi"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleAddCustom}
          disabled={isMaxReached}
          placeholder={
            isMaxReached
              ? `Osiągnięto limit ${maxTags} tagów`
              : 'Wpisz własny tag i naciśnij Enter...'
          }
          className="w-full px-3 py-2 rounded-xl bg-[#faf9f6] border border-[#ded8ce] text-[#171513] focus:outline-none focus:ring-2 focus:ring-[#3b2314] focus:border-[#3b2314] text-sm placeholder-[#70685f]/60 disabled:opacity-50"
        />
        {!isMaxReached && inputValue.trim() && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleAddCustom();
            }}
            className="absolute right-2 px-2 py-1 text-xs font-medium text-[#faf9f6] bg-[#3b2314] rounded-lg hover:bg-[#2b2724] cursor-pointer"
          >
            Dodaj
          </button>
        )}
      </div>
    </div>
  );
};
