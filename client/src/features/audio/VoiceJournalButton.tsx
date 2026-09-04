import React from 'react';
import { useWhisperTranscriber, WhisperTranscriberOptions } from './useWhisperTranscriber';

export interface VoiceJournalButtonProps extends WhisperTranscriberOptions {
  onDictate?: (transcript: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceJournalButton: React.FC<VoiceJournalButtonProps> = ({
  onTranscript,
  onDictate,
  disabled = false,
  className = '',
  model,
  language,
  workerFactory,
  recorderFactory,
}) => {
  const handleTranscript = (text: string) => {
    onTranscript?.(text);
    onDictate?.(text);
  };

  const {
    isModelLoading,
    loadingProgress,
    isRecording,
    isTranscribing,
    error,
    startRecording,
    stopRecording,
  } = useWhisperTranscriber({
    onTranscript: handleTranscript,
    model,
    language,
    workerFactory,
    recorderFactory,
  });

  const handleClick = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <div className={`inline-flex flex-col items-start gap-1.5 ${className}`}>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || isModelLoading || isTranscribing}
          onClick={handleClick}
          aria-label={
            isRecording
              ? 'Zatrzymaj nagrywanie'
              : isTranscribing
              ? 'Transkrypcja...'
              : 'Włącz dyktafon AI'
          }
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            isRecording
              ? 'bg-rose-600/20 text-rose-400 border-rose-500/50 animate-pulse ring-2 ring-rose-500/30'
              : isTranscribing
              ? 'bg-amber-600/20 text-amber-400 border-amber-500/40'
              : 'bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 border-sky-500/30'
          }`}
        >
          {isRecording ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
              </span>
              <span>Zatrzymaj nagrywanie</span>
            </>
          ) : isTranscribing ? (
            <>
              <svg
                className="animate-spin -ml-0.5 mr-1 h-3.5 w-3.5 text-amber-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Przetwarzanie audio...</span>
            </>
          ) : (
            <>
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
            </>
          )}
        </button>

        {isModelLoading && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-sky-300 bg-sky-950/60 border border-sky-800/60 rounded-md">
            <span className="animate-spin inline-block h-2.5 w-2.5 border-2 border-sky-400 border-t-transparent rounded-full" />
            <span>Pobieranie modelu Whisper: {loadingProgress}%</span>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/50 rounded-md px-2.5 py-1.5 mt-1"
        >
          <p className="font-semibold">{error}</p>
          <p className="text-slate-400 mt-0.5">Fallback: Wpisz treść ręcznie w polu notatki.</p>
        </div>
      )}
    </div>
  );
};
