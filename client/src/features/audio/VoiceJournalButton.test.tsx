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
});
