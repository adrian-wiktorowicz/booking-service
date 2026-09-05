import React, { useState, useEffect } from 'react';
import { useWhisperTranscriber, WhisperTranscriberOptions } from './useWhisperTranscriber';

export interface VoiceJournalButtonProps extends WhisperTranscriberOptions {
  onDictate?: (transcript: string) => void;
  disabled?: boolean;
  className?: string;
}

const MAX_RECORDING_SECONDS = 300; // 5 minutes cap
const WARNING_THRESHOLD_SECONDS = 270; // 4 minutes 30 seconds

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
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(12).fill(25));

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
    isInterrupted,
    startRecording,
    stopRecording,
    getAnalyser,
  } = useWhisperTranscriber({
    onTranscript: handleTranscript,
    model,
    language,
    workerFactory,
    recorderFactory,
  });

  useEffect(() => {
    if (!isRecording) {
      setSecondsElapsed(0);
      return;
    }
    const timerId = setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= MAX_RECORDING_SECONDS) return MAX_RECORDING_SECONDS;
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && secondsElapsed >= MAX_RECORDING_SECONDS) {
      void stopRecording();
    }
  }, [isRecording, secondsElapsed, stopRecording]);

  useEffect(() => {
    if (!isRecording) return;
    let animId: number;
    let lastUpdate = 0;
    const analyser = getAnalyser();
    const bufferLength = analyser?.frequencyBinCount || 32;
    const dataArray = new Uint8Array(bufferLength);

    const updateBars = (timestamp: number) => {
      if (analyser) {
        analyser.getByteFrequencyData(dataArray);

        if (timestamp - lastUpdate >= 60) {
          lastUpdate = timestamp;
          const step = Math.max(1, Math.floor(bufferLength / 12));
          const nextBars: number[] = [];
          for (let i = 0; i < 12; i++) {
            const idx = Math.min(i * step, bufferLength - 1);
            const val = dataArray[idx] ?? 0;
            const heightPct = Math.max(20, Math.min(100, Math.round((val / 255) * 100)));
            nextBars.push(heightPct);
          }
          setBars(nextBars);
        }
      }
      animId = requestAnimationFrame(updateBars);
    };

    animId = requestAnimationFrame(updateBars);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isRecording, getAnalyser]);

  const formatTime = (secs: number) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s} / 05:00`;
  };

  const isNearLimit = secondsElapsed >= WARNING_THRESHOLD_SECONDS;

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
              ? 'bg-[#8c2a1c] text-[#faf9f6] border-[#8c2a1c] animate-pulse ring-2 ring-[#8c2a1c]/30'
              : isTranscribing
              ? 'bg-[#3b2314] text-[#faf9f6] border-[#3b2314]'
              : 'bg-[#faf9f6] text-[#4a3525] hover:bg-[#f0ede6] hover:text-[#171513] border-[#ded8ce]'
          }`}
        >
          {isRecording ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#faf9f6]" />
              </span>
              <span>Zatrzymaj nagrywanie</span>
            </>
          ) : isTranscribing ? (
            <>
              <svg
                className="animate-spin -ml-0.5 mr-1 h-3.5 w-3.5 text-[#faf9f6]"
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

        {isRecording && (
          <div
            className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border ${
              isNearLimit
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400'
                : 'bg-[#fdf2f0] border-[#f5c6cb] text-[#8c2a1c]'
            }`}
          >
            <div
              data-testid="audio-wave-visualizer"
              className="flex items-center gap-0.5 h-4 px-0.5"
              aria-hidden="true"
            >
              {bars.map((height, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isNearLimit ? 'bg-amber-600' : 'bg-[#8c2a1c]'
                  }`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <span className="text-xs font-mono font-medium">
              {formatTime(secondsElapsed)}
            </span>
            {isNearLimit && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                (Pozostało {MAX_RECORDING_SECONDS - secondsElapsed}s)
              </span>
            )}
          </div>
        )}

        {isModelLoading && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-[#4a3525] bg-[#faf9f6] border border-[#ded8ce] rounded-md">
            <span className="animate-spin inline-block h-2.5 w-2.5 border-2 border-[#3b2314] border-t-transparent rounded-full" />
            <span>Pobieranie modelu Whisper: {loadingProgress}%</span>
          </div>
        )}
      </div>

      {isInterrupted && (
        <div
          role="status"
          className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mt-1"
        >
          Nagrywanie zostało przerwane (np. połączenie przychodzące). Zapisano dotychczasowe audio.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="text-[11px] text-[#8c2a1c] bg-[#fdf2f0] border border-[#f5c6cb] rounded-md px-2.5 py-1.5 mt-1"
        >
          <p className="font-semibold">{error}</p>
          <p className="text-[#70685f] mt-0.5">Fallback: Wpisz treść ręcznie w polu notatki.</p>
        </div>
      )}
    </div>
  );
};
