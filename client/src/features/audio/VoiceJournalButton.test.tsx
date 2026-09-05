import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VoiceJournalButton } from './VoiceJournalButton';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn((type: string, listener: any) => {
    if (type === 'message') this.onmessage = listener;
  });
  removeEventListener = vi.fn();

  emitMessage(data: any) {
    if (this.onmessage) {
      this.onmessage({ data } as MessageEvent);
    }
  }
}

class MockAudioRecorder {
  isRecording = false;
  onTrackEnded?: () => void;
  analyser: any = {
    frequencyBinCount: 32,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(128)),
  };
  start = vi.fn().mockImplementation(async () => {
    this.isRecording = true;
  });
  stop = vi.fn().mockImplementation(async () => {
    this.isRecording = false;
    return new Float32Array([0.1, 0.2]);
  });
}

describe('VoiceJournalButton', () => {
  let mockWorker: MockWorker;
  let mockRecorder: MockAudioRecorder;

  beforeEach(() => {
    mockWorker = new MockWorker();
    mockRecorder = new MockAudioRecorder();
  });

  it('renders idle microphone button with accessible label', () => {
    render(
      <VoiceJournalButton
        workerFactory={() => mockWorker as unknown as Worker}
        recorderFactory={() => mockRecorder as unknown as any}
      />
    );

    const button = screen.getByRole('button', { name: /dyktafon|nagrywaj|mikrofon/i });
    expect(button).toBeInTheDocument();
  });

  it('displays model download progress indicator when model is loading', () => {
    render(
      <VoiceJournalButton
        workerFactory={() => mockWorker as unknown as Worker}
        recorderFactory={() => mockRecorder as unknown as any}
      />
    );

    act(() => {
      mockWorker.emitMessage({ type: 'status', status: 'loading' });
      mockWorker.emitMessage({ type: 'loading_progress', status: 'progress', progress: 55 });
    });

    expect(screen.getByText(/55%/)).toBeInTheDocument();
    expect(screen.getByText(/pobieranie/i)).toBeInTheDocument();
  });

  it('shows pulsing animation when recording and toggles stop on click', async () => {
    const handleTranscript = vi.fn();
    render(
      <VoiceJournalButton
        onTranscript={handleTranscript}
        workerFactory={() => mockWorker as unknown as Worker}
        recorderFactory={() => mockRecorder as unknown as any}
      />
    );

    const button = screen.getByRole('button', { name: /dyktafon|nagrywaj|mikrofon/i });

    // Start recording
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockRecorder.start).toHaveBeenCalled();
    // Verify pulse animation or recording indicator
    const recordingButton = screen.getByRole('button', { name: /zatrzymaj|nagrywanie/i });
    expect(recordingButton.className).toContain('animate-pulse');

    // Stop recording
    await act(async () => {
      fireEvent.click(recordingButton);
    });

    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(screen.getByText(/przetwarzanie|transkrypcja/i)).toBeInTheDocument();

    // Simulate transcription result
    act(() => {
      mockWorker.emitMessage({
        type: 'transcribe_complete',
        transcript: 'Notatka podyktowana głosem.',
      });
    });

    expect(handleTranscript).toHaveBeenCalledWith('Notatka podyktowana głosem.');
  });

  it('displays error message and fallback instruction when microphone permission fails', async () => {
    mockRecorder.start.mockRejectedValueOnce(
      new Error('Brak uprawnień do mikrofonu. Zezwól na dostęp w ustawieniach przeglądarki.')
    );

    render(
      <VoiceJournalButton
        workerFactory={() => mockWorker as unknown as Worker}
        recorderFactory={() => mockRecorder as unknown as any}
      />
    );

    const button = screen.getByRole('button', { name: /dyktafon|nagrywaj|mikrofon/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByText(/brak uprawnień do mikrofonu/i)).toBeInTheDocument();
    expect(screen.getByText(/wpisz treść ręcznie/i)).toBeInTheDocument();
  });

  it('displays active recording timer showing 00:00 / 02:00 and 12-bar wave visualizer', async () => {
    vi.useFakeTimers();
    try {
      render(
        <VoiceJournalButton
          workerFactory={() => mockWorker as unknown as Worker}
          recorderFactory={() => mockRecorder as unknown as any}
        />
      );

      const button = screen.getByRole('button', { name: /dyktafon|nagrywaj|mikrofon/i });

      await act(async () => {
        fireEvent.click(button);
      });

      // Check timer initial display
      expect(screen.getByText(/00:00 \/ 02:00/)).toBeInTheDocument();

      // Check 12-bar visualizer is rendered
      const visualizer = screen.getByTestId('audio-wave-visualizer');
      expect(visualizer).toBeInTheDocument();
      expect(visualizer.children).toHaveLength(12);

      // Advance time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByText(/00:05 \/ 02:00/)).toBeInTheDocument();
      expect(mockRecorder.analyser.getByteFrequencyData).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('automatically stops recording when reaching 2-minute limit (120 seconds)', async () => {
    vi.useFakeTimers();
    try {
      render(
        <VoiceJournalButton
          workerFactory={() => mockWorker as unknown as Worker}
          recorderFactory={() => mockRecorder as unknown as any}
        />
      );

      const button = screen.getByRole('button', { name: /dyktafon|nagrywaj|mikrofon/i });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockRecorder.start).toHaveBeenCalled();

      // Fast-forward 120 seconds
      await act(async () => {
        vi.advanceTimersByTime(120000);
      });

      expect(mockRecorder.stop).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles track interrupt by preserving audio, requesting transcription, and showing banner', async () => {
    render(
      <VoiceJournalButton
        workerFactory={() => mockWorker as unknown as Worker}
        recorderFactory={() => mockRecorder as unknown as any}
      />
    );

    const button = screen.getByRole('button', { name: /dyktafon|nagrywaj|mikrofon/i });

    await act(async () => {
      fireEvent.click(button);
    });

    // Simulate track interruption (e.g. phone call)
    await act(async () => {
      mockRecorder.onTrackEnded?.();
    });

    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(screen.getByText(/przerwane|zapisano dotychczasowe/i)).toBeInTheDocument();
  });
});
