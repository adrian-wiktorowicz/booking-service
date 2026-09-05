import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioRecorder } from './audioRecorder';

describe('AudioRecorder', () => {
  let mockTracks: { stop: ReturnType<typeof vi.fn>; onended?: any }[];
  let mockStream: { getTracks: () => typeof mockTracks; getAudioTracks?: () => typeof mockTracks };
  let mockProcessor: {
    onaudioprocess: ((e: any) => void) | null;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let mockSource: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let mockAudioContext: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTracks = [{ stop: vi.fn(), onended: null as any }];
    mockStream = {
      getTracks: () => mockTracks,
      getAudioTracks: () => mockTracks,
    };

    mockProcessor = {
      onaudioprocess: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockSource = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    const mockAnalyser = {
      fftSize: 64,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockAudioContext = {
      sampleRate: 48000,
      createMediaStreamSource: vi.fn().mockReturnValue(mockSource),
      createScriptProcessor: vi.fn().mockReturnValue(mockProcessor),
      createAnalyser: vi.fn().mockReturnValue(mockAnalyser),
      destination: {},
      close: vi.fn().mockResolvedValue(undefined),
    };

    // Setup global AudioContext & navigator.mediaDevices
    (global as any).AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('records audio chunks and returns 16kHz resampled Float32Array on stop', async () => {
    const recorder = new AudioRecorder();
    expect(recorder.isRecording).toBe(false);

    await recorder.start();
    expect(recorder.isRecording).toBe(true);
    expect(global.navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    expect(mockSource.connect).toHaveBeenCalledWith(mockProcessor);

    // Simulate audio data arriving (48000 Hz: 6 samples downsampled to 2 samples)
    if (mockProcessor.onaudioprocess) {
      mockProcessor.onaudioprocess({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.0, 0.3, 0.6, 0.9, 0.6, 0.3]),
        },
      });
    }

    const audioData = await recorder.stop();
    expect(recorder.isRecording).toBe(false);
    expect(audioData.length).toBe(2);
    expect(mockTracks[0].stop).toHaveBeenCalled();
    expect(mockProcessor.disconnect).toHaveBeenCalled();
    expect(mockSource.disconnect).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });

  it('throws friendly Polish error when microphone permission is denied', async () => {
    const permError = new Error('Permission denied');
    permError.name = 'NotAllowedError';
    (global.navigator.mediaDevices.getUserMedia as any).mockRejectedValue(permError);

    const recorder = new AudioRecorder();
    await expect(recorder.start()).rejects.toThrow(/uprawnień do mikrofonu/i);
    expect(recorder.isRecording).toBe(false);
  });

  it('throws fallback error when mediaDevices is unavailable', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const recorder = new AudioRecorder();
    await expect(recorder.start()).rejects.toThrow(/nie obsługuje nagrywania|HTTPS/i);
    expect(recorder.isRecording).toBe(false);
  });

  it('exposes AnalyserNode when recording and cleans it up on stop', async () => {
    const recorder = new AudioRecorder();
    expect(recorder.analyser).toBeNull();

    await recorder.start();
    expect(recorder.analyser).not.toBeNull();
    expect(mockAudioContext.createAnalyser).toHaveBeenCalled();

    await recorder.stop();
    expect(recorder.analyser).toBeNull();
  });

  it('triggers onTrackEnded callback and preserves captured chunks when track ends prematurely', async () => {
    const recorder = new AudioRecorder();
    const handleTrackEnded = vi.fn();
    recorder.onTrackEnded = handleTrackEnded;

    await recorder.start();

    // Simulate audio data
    if (mockProcessor.onaudioprocess) {
      mockProcessor.onaudioprocess({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.1, 0.2, 0.3]),
        },
      });
    }

    expect(mockTracks[0].onended).toBeDefined();
    mockTracks[0].onended();
    expect(handleTrackEnded).toHaveBeenCalledTimes(1);

    const audioData = await recorder.stop();
    expect(audioData.length).toBeGreaterThan(0);
  });

  it('tracks elapsed time and enforces 5-minute (300s) maximum duration limit', async () => {
    const recorder = new AudioRecorder();
    const durationUpdates: number[] = [];
    recorder.onDurationUpdate = (sec) => durationUpdates.push(sec);
    const handleMaxDuration = vi.fn();
    recorder.onMaxDurationReached = handleMaxDuration;

    await recorder.start();
    expect(recorder.elapsedSeconds).toBe(0);

    // Advance by 10 seconds
    vi.advanceTimersByTime(10000);
    expect(durationUpdates.length).toBeGreaterThan(0);
    expect(recorder.elapsedSeconds).toBe(10);

    // Advance up to 300 seconds (5 minutes)
    vi.advanceTimersByTime(290000);
    expect(recorder.elapsedSeconds).toBe(300);
    expect(handleMaxDuration).toHaveBeenCalled();

    await recorder.stop();
    expect(recorder.elapsedSeconds).toBe(0);
  });
});
