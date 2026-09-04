import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioRecorder } from './audioRecorder';

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

  const getRecorder = useCallback((): AudioRecorder => {
    if (!recorderRef.current) {
      recorderRef.current = recorderFactory ? recorderFactory() : new AudioRecorder();
    }
    return recorderRef.current;
  }, [recorderFactory]);

  useEffect(() => {
    const worker = getWorker();
    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [getWorker]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const recorder = getRecorder();
      await recorder.start();
      setIsRecording(true);
    } catch (err: unknown) {
      setIsRecording(false);
      const message = err instanceof Error ? err.message : 'Nie udało się rozpocząć nagrywania';
      setError(message);
    }
  }, [getRecorder]);

  const stopRecording = useCallback(async () => {
    try {
      const recorder = getRecorder();
      const audioData = await recorder.stop();
      setIsRecording(false);

      if (!audioData || audioData.length === 0) {
        return;
      }

      setIsTranscribing(true);
      const worker = getWorker();
      if (!worker) {
        throw new Error('Web Worker nie jest dostępny w tej przeglądarce.');
      }
      worker.postMessage({
        type: 'transcribe',
        audio: audioData,
        model,
        language,
      });
    } catch (err: unknown) {
      setIsRecording(false);
      setIsTranscribing(false);
      const message = err instanceof Error ? err.message : 'Błąd podczas zatrzymywania nagrywania';
      setError(message);
    }
  }, [getRecorder, getWorker, model, language]);

  return {
    isModelLoading,
    loadingProgress,
    isRecording,
    isTranscribing,
    transcript,
    error,
    startRecording,
    stopRecording,
  };
}
