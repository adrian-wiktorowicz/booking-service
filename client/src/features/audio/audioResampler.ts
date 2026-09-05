/**
 * Resamples a single-channel Float32Array audio buffer to 16,000 Hz mono
 * as required by the Whisper speech recognition model.
 * Supports downsampling (e.g. 48kHz, 96kHz) and upsampling (e.g. 8kHz Bluetooth SCO).
 */
export function resampleTo16kMono(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate = 16000
): Float32Array {
  if (audioData.length === 0) {
    return new Float32Array(0);
  }

  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const originIdx = i * ratio;
    const index = Math.floor(originIdx);
    const nextIndex = Math.min(index + 1, audioData.length - 1);
    const weight = originIdx - index;
    result[i] = audioData[index] * (1 - weight) + audioData[nextIndex] * weight;
  }

  return result;
}

/**
 * Downmixes multi-channel audio buffers (e.g. stereo Left + Right) into mono
 * by averaging corresponding channel samples.
 */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (!channels || channels.length === 0) {
    return new Float32Array(0);
  }
  if (channels.length === 1) {
    return channels[0];
  }

  const length = channels[0].length;
  const numChannels = channels.length;
  const mono = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < numChannels; c++) {
      sum += channels[c][i] || 0;
    }
    mono[i] = sum / numChannels;
  }

  return mono;
}

/**
 * Merges multiple Float32Array chunks into a contiguous Float32Array.
 */
export function mergeAudioChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}
