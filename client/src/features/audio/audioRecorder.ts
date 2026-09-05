import { mergeAudioChunks, resampleTo16kMono } from './audioResampler';

export class AudioRecorder {
  public static readonly MAX_RECORDING_SECONDS = 300; // 5 minutes cap to prevent mobile OOM crashes

  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private chunks: Float32Array[] = [];
  private recording = false;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private currentElapsedSeconds = 0;

  public onTrackEnded?: () => void;
  public onDurationUpdate?: (elapsedSeconds: number) => void;
  public onMaxDurationReached?: () => void;

  get isRecording(): boolean {
    return this.recording;
  }

  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  get elapsedSeconds(): number {
    return this.currentElapsedSeconds;
  }

  async start(): Promise<void> {
    if (this.recording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Twoja przeglądarka nie obsługuje nagrywania audio lub połączenie nie jest bezpieczne (wymagane HTTPS).'
      );
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Brak uprawnień do mikrofonu. Zezwól na dostęp w ustawieniach przeglądarki.');
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('Nie wykryto mikrofonu w Twoim urządzeniu.');
      }
      throw new Error(`Błąd dostępu do mikrofonu: ${error.message || 'Nieznany błąd'}`);
    }

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Setup AnalyserNode for audio visualization
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 64;
      this.sourceNode.connect(this.analyserNode);

      // Buffer size 4096, 1 input channel, 1 output channel
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.chunks = [];

      this.processorNode.onaudioprocess = (e) => {
        if (!this.recording) return;
        const channelData = e.inputBuffer.getChannelData(0);
        this.chunks.push(new Float32Array(channelData));
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Handle unexpected track interrupts (e.g. incoming phone call)
      const tracks = this.stream.getAudioTracks();
      tracks.forEach((track) => {
        track.onended = () => {
          if (this.recording) {
            this.recording = false;
            this.stopTimer();
            this.onTrackEnded?.();
          }
        };
      });

      this.currentElapsedSeconds = 0;
      this.recording = true;
      this.startTimer();
    } catch (err) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
      throw err;
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const startTimestamp = Date.now();
    this.timerInterval = setInterval(() => {
      if (!this.recording) return;
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      this.currentElapsedSeconds = elapsed;
      this.onDurationUpdate?.(elapsed);

      if (elapsed >= AudioRecorder.MAX_RECORDING_SECONDS) {
        this.onMaxDurationReached?.();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  async stop(): Promise<Float32Array> {
    this.recording = false;
    this.stopTimer();
    this.currentElapsedSeconds = 0;

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    const sampleRate = this.audioContext?.sampleRate ?? 16000;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }

    const merged = mergeAudioChunks(this.chunks);
    this.chunks = [];
    return resampleTo16kMono(merged, sampleRate, 16000);
  }
}
