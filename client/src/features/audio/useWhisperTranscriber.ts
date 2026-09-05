import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorder } from './audioRecorder';
import { validateContentSafety } from './contentFilter';

export interface WhisperTranscriberOptions {
  onTranscript?: (transcript: string) => void;
  model?: string;
  language?: string;
  workerFactory?: () => Worker;
  recorderFactory?: () => AudioRecorder;
}

export interface WhisperTranscriberResult {
  isModelLoading: boolean;
  loadingProgress: number;
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  error: string | null;
  elapsedSeconds: number;
  isInterrupted: boolean;
  getAnalyser: () => AnalyserNode | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

export function useWhisperTranscriber(
  options: WhisperTranscriberOptions = {}
): WhisperTranscriberResult {
  const { onTranscript, model = 'Xenova/whisper-tiny', language, workerFactory, recorderFactory } = options;

  const [isModelLoading, setIsModelLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isInterrupted, setIsInterrupted] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const getWorker = useCallback((): Worker | null => {
    if (typeof window === 'undefined' || (typeof Worker === 'undefined' && !workerFactory)) {
      return null;
    }

    if (!workerRef.current) {
      workerRef.current = workerFactory
        ? workerFactory()
        : new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });

      workerRef.current.addEventListener('message', (event: MessageEvent) => {
        const data = event.data || {};

        if (data.type === 'status') {
          if (data.status === 'loading') {
            setIsModelLoading(true);
          } else if (data.status === 'ready') {
            setIsModelLoading(false);
            setLoadingProgress(100);
          } else if (data.status === 'transcribing') {
            setIsTranscribing(true);
          }
        } else if (data.type === 'loading_progress') {
          setIsModelLoading(true);
          if (typeof data.progress === 'number') {
            setLoadingProgress(Math.round(data.progress));
          }
        } else if (data.type === 'transcribe_complete') {
          setIsTranscribing(false);
          const resultText = data.transcript || '';

          // Validate against harmful content & terroristic threats
          const safety = validateContentSafety(resultText);
          if (!safety.isSafe) {
            setError(safety.reason || 'Wykryto niedozwolone treści. Zapis zablokowany.');
            setTranscript('');
            return;
          }

          setTranscript(resultText);
          onTranscriptRef.current?.(resultText);
        } else if (data.type === 'error') {
          setIsTranscribing(false);
          setIsModelLoading(false);
          setError(data.error || 'Błąd transkrypcji Whisper');
        }
      });
    }
    return workerRef.current;
  }, [workerFactory]);

  const stopRecording = useCallback(async () => {
    try {
      if (!recorderRef.current) return;
      const audioData = await recorderRef.current.stop();
      setIsRecording(false);
      setElapsedSeconds(0);

      if (!audioData || audioData.length === 0) {
        // Empty audio buffer, skip inference
        return;
      }

      setIsTranscribing(true);
      const worker = getWorker();
      if (!worker) {
        throw new Error('Web Worker nie jest dostępny w tej przeglądarce.');
      }

      // Zero-copy ArrayBuffer transfer
      worker.postMessage(
        {
          type: 'transcribe',
          audio: audioData,
          model,
          language,
        },
        [audioData.buffer]
      );
    } catch (err: unknown) {
      setIsRecording(false);
      setIsTranscribing(false);
      setElapsedSeconds(0);
      const message = err instanceof Error ? err.message : 'Błąd podczas zatrzymywania nagrywania';
      setError(message);
    }
  }, [getWorker, model, language]);

  const getAnalyser = useCallback((): AnalyserNode | null => {
    return recorderRef.current?.analyser ?? null;
  }, []);

  const getRecorder = useCallback((): AudioRecorder => {
    if (!recorderRef.current) {
      recorderRef.current = recorderFactory ? recorderFactory() : new AudioRecorder();
      recorderRef.current.onDurationUpdate = (sec) => setElapsedSeconds(sec);
      recorderRef.current.onMaxDurationReached = () => {
        stopRecording();
      };
      recorderRef.current.onTrackEnded = () => {
        setIsInterrupted(true);
        stopRecording();
      };
    }
    return recorderRef.current;
  }, [recorderFactory, stopRecording]);

  useEffect(() => {
    const worker = getWorker();
    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [getWorker]);

  const startRecording = useCallback(async () => {
    setError(null);
    setElapsedSeconds(0);
    setIsInterrupted(false);
    try {
      const recorder = getRecorder();
      await recorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      setIsRecording(false);
      setElapsedSeconds(0);
      const message = err instanceof Error ? err.message : 'Nie udało się rozpocząć nagrywania';
      setError(message);
    }
  }, [getRecorder]);

  return {
    isModelLoading,
    loadingProgress,
    isRecording,
    isTranscribing,
    transcript,
    error,
    elapsedSeconds,
    isInterrupted,
    getAnalyser,
    startRecording,
    stopRecording,
  };
}
