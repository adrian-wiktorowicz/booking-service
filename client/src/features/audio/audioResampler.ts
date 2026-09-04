/**
 * Resamples a single-channel Float32Array audio buffer to 16,000 Hz mono
 * as required by the Whisper speech recognition model.
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
