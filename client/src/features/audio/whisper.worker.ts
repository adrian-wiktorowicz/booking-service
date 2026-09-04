import { pipeline, env } from '@xenova/transformers';

// Configure environment for browser execution
env.allowLocalModels = false;
env.useBrowserCache = true;

export class PipelineSingleton {
  static task = 'automatic-speech-recognition' as const;
  static model = 'Xenova/whisper-tiny';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static instance: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getInstance(progress_callback?: (data: any) => void) {
    if (!this.instance) {
      this.instance = await pipeline(this.task, this.model, {
        quantized: true,
        progress_callback,
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, audio, model, language, task, id } = event.data || {};

  if (type === 'load') {
    try {
      if (model && model !== PipelineSingleton.model) {
        PipelineSingleton.model = model;
        PipelineSingleton.instance = null;
      }
      self.postMessage({ type: 'status', status: 'loading', id });
      await PipelineSingleton.getInstance((progressData) => {
        self.postMessage({ type: 'loading_progress', ...progressData, id });
      });
      self.postMessage({ type: 'status', status: 'ready', id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd ładowania modelu Whisper';
      self.postMessage({ type: 'error', error: message, id });
    }
  } else if (type === 'transcribe') {
    try {
      self.postMessage({ type: 'status', status: 'loading', id });
      const transcriber = await PipelineSingleton.getInstance((progressData) => {
        self.postMessage({ type: 'loading_progress', ...progressData, id });
      });

      self.postMessage({ type: 'status', status: 'transcribing', id });
      const output = await transcriber(audio, {
        language: language || null,
        task: task || 'transcribe',
      });

      const transcript = typeof output?.text === 'string' ? output.text.trim() : '';
      self.postMessage({ type: 'transcribe_complete', transcript, id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Błąd transkrypcji mowy';
      self.postMessage({ type: 'error', error: message, id });
    }
  }
});
