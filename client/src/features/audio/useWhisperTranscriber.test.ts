import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWhisperTranscriber } from './useWhisperTranscriber';

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn((type: string, listener: any) => {
    if (type === 'message') this.onmessage = listener;
  });
  removeEventListener = vi.fn();

  // Helper for test to simulate worker message
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
    return new Float32Array([0.1, 0.2, 0.3]);
  });
}

describe('useWhisperTranscriber', () => {
  let mockWorker: MockWorker;
  let mockRecorder: MockAudioRecorder;

  beforeEach(() => {
    mockWorker = new MockWorker();
    mockRecorder = new MockAudioRecorder();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('provides initial default states', () => {
    const { result } = renderHook(() =>
      useWhisperTranscriber({
        workerFactory: () => mockWorker as unknown as Worker,
        recorderFactory: () => mockRecorder as unknown as any,
      })
    );

    expect(result.current.isModelLoading).toBe(false);
    expect(result.current.loadingProgress).toBe(0);
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('tracks model loading progress from worker events', () => {
    const { result } = renderHook(() =>
      useWhisperTranscriber({
        workerFactory: () => mockWorker as unknown as Worker,
        recorderFactory: () => mockRecorder as unknown as any,
      })
    );

    act(() => {
      mockWorker.emitMessage({ type: 'status', status: 'loading' });
      mockWorker.emitMessage({ type: 'loading_progress', status: 'progress', progress: 42.5 });
    });

    expect(result.current.isModelLoading).toBe(true);
    expect(result.current.loadingProgress).toBe(43);

    act(() => {
      mockWorker.emitMessage({ type: 'status', status: 'ready' });
    });

    expect(result.current.isModelLoading).toBe(false);
    expect(result.current.loadingProgress).toBe(100);
  });

  it('starts recording and updates isRecording state', async () => {
    const { result } = renderHook(() =>
      useWhisperTranscriber({
        workerFactory: () => mockWorker as unknown as Worker,
        recorderFactory: () => mockRecorder as unknown as any,
      })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(mockRecorder.start).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('captures errors when startRecording fails (e.g. mic permission denied)', async () => {
    mockRecorder.start.mockRejectedValueOnce(
      new Error('Brak uprawnień do mikrofonu. Zezwól na dostęp w ustawieniach przeglądarki.')
    );

    const { result } = renderHook(() =>
      useWhisperTranscriber({
        workerFactory: () => mockWorker as unknown as Worker,
        recorderFactory: () => mockRecorder as unknown as any,
      })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.error).toContain('Brak uprawnień do mikrofonu');
  });

  it('stops recording, submits audio to worker, and receives transcript', async () => {
    const onTranscriptMock = vi.fn();
    const { result } = renderHook(() =>
      useWhisperTranscriber({
        onTranscript: onTranscriptMock,
        workerFactory: () => mockWorker as unknown as Worker,
        recorderFactory: () => mockRecorder as unknown as any,
      })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isTranscribing).toBe(true);
    expect(mockWorker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transcribe',
        audio: expect.any(Float32Array),
      })
    );

    // Simulate worker returning transcript
    act(() => {
      mockWorker.emitMessage({
        type: 'transcribe_complete',
        transcript: 'Dzisiejszy dzień był bardzo produktywny.',
      });
    });

    expect(result.current.isTranscribing).toBe(false);
    expect(result.current.transcript).toBe('Dzisiejszy dzień był bardzo produktywny.');
    expect(onTranscriptMock).toHaveBeenCalledWith('Dzisiejszy dzień był bardzo produktywny.');
  });
});
