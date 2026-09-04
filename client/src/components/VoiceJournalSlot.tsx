import React from 'react';

export interface VoiceJournalSlotProps {
  onDictate?: (transcript: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const VoiceJournalSlot: React.FC<VoiceJournalSlotProps> = ({
  onDictate,
  disabled = false,
  className = '',
  children,
}) => {
  return (
    <div
      data-testid="voice-journal-slot"
      className={`relative inline-flex items-center ${className}`}
    >
      {children ?? (
        <button
          type="button"
          disabled={disabled}
          aria-label="Włącz dyktafon AI"
          onClick={() => onDictate?.('')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border border-sky-500/30 transition disabled:opacity-50"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          <span>Dyktafon AI</span>
        </button>
      )}
    </div>
  );
};
