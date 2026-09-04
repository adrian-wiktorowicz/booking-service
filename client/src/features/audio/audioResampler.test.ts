import { describe, it, expect } from 'vitest';
import { resampleTo16kMono, mergeAudioChunks } from './audioResampler';

describe('audioResampler', () => {
  it('returns exact same data if already 16000 Hz', () => {
    const input = new Float32Array([0.1, -0.2, 0.5, 0.8]);
    const output = resampleTo16kMono(input, 16000);
    expect(output).toEqual(input);
  });

  it('correctly downsamples 48000 Hz to 16000 Hz (3:1 ratio)', () => {
    // 6 samples at 48000 Hz should become 2 samples at 16000 Hz
    const input = new Float32Array([0.0, 0.3, 0.6, 0.9, 0.6, 0.3]);
    const output = resampleTo16kMono(input, 48000);
    expect(output.length).toBe(2);
    expect(output[0]).toBeCloseTo(0.0, 4);
    expect(output[1]).toBeCloseTo(0.9, 4);
  });

  it('correctly downsamples 44100 Hz to 16000 Hz', () => {
    const input = new Float32Array(44100);
    input.fill(0.5);
    const output = resampleTo16kMono(input, 44100);
    expect(output.length).toBe(16000);
    expect(output[0]).toBeCloseTo(0.5, 4);
    expect(output[7999]).toBeCloseTo(0.5, 4);
  });

  it('handles empty input gracefully', () => {
    const input = new Float32Array(0);
    const output = resampleTo16kMono(input, 48000);
    expect(output.length).toBe(0);
  });

  it('merges audio chunks into a single Float32Array', () => {
    const chunk1 = new Float32Array([0.1, 0.2]);
    const chunk2 = new Float32Array([0.3, 0.4, 0.5]);
    const merged = mergeAudioChunks([chunk1, chunk2]);
    expect(merged).toEqual(new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]));
  });
});
