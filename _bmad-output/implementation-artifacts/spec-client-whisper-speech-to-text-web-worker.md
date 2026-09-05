---
title: 'In-Browser Whisper Speech-to-Text Engine with Web Worker'
type: 'feature'
created: '2026-09-04'
status: 'draft'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users typing journal notes on mobile or desktop experience friction when capturing thoughts quickly, and existing speech solutions either send sensitive audio to external clouds or freeze the mobile browser UI during local machine-learning execution.

**Approach:** Implement a private, client-side Whisper speech-to-text transcription engine using `@xenova/transformers` running inside a Web Worker, coupled with Web Audio API recording and 16 kHz mono resampling, delivered via a React hook and an animated `VoiceJournalButton`.

## Boundaries & Constraints

**Always:**
- Execute model weight downloading and ONNX inference inside a separate Web Worker (`whisper.worker.ts`) to ensure zero main-thread blocking.
- Resample microphone audio streams to 16 000 Hz, mono, `Float32Array` before passing to Whisper pipeline.
- Gracefully handle lack of microphone permissions, missing audio devices, or non-HTTPS insecure contexts with clear user guidance.
- Guard against non-Worker environments (such as headless unit tests/SSR) without crashing.
- Maintain minimal viable code with zero speculative abstractions.

**Ask First:**
- Changing default model from quantized `Xenova/whisper-tiny` to heavier models or altering the journal entry schema.

**Never:**
- Never execute ONNX inference or weight downloads on the main thread.
- Never add heavy third-party DSP or WebRTC libraries when native Web Audio API and standard TypeScript suffice.
- Never send audio data to external server endpoints.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Microphone Recording & Transcription | User clicks mic, speaks, clicks stop | Web Audio captures stream, resamples to 16kHz mono `Float32Array`, sends to worker, returns text | If empty audio, skip worker inference |
| Initial Model Download | First transcription trigger | Web Worker downloads quantized ONNX weights; reports `loadingProgress` (0-100%) | Worker emits error status on network failure |
| Mic Permission Denied | `navigator.mediaDevices.getUserMedia` rejects `NotAllowedError` | Hook sets descriptive error, button displays permission alert with fallback text entry note | Graceful inline banner, no app crash |
| Insecure Context / Missing API | `navigator.mediaDevices` undefined | Hook catches missing API, explains HTTPS or browser requirement | Informs user to use manual text entry |

</frozen-after-approval>

## Code Map

- `client/src/features/audio/audioResampler.ts` -- Pure linear resampling functions (`resampleTo16kMono`, `mergeAudioChunks`) converting arbitrary sample rates to 16kHz mono Float32Array.
- `client/src/features/audio/audioRecorder.ts` -- Web Audio API wrapper managing `getUserMedia`, `AudioContext`, `createScriptProcessor` capture, track cleanup, and permission error translation.
- `client/src/features/audio/whisper.worker.ts` -- Dedicated Web Worker executing quantized `@xenova/transformers` Whisper pipeline and posting progress and results.
- `client/src/features/audio/useWhisperTranscriber.ts` -- React hook coordinating worker messaging, recording lifecycle, loading states, and transcript delivery.
- `client/src/features/audio/VoiceJournalButton.tsx` -- UI button component with Tailwind pulse animation (`animate-pulse`), model download indicator, transcribing spinner, and error banner.
- `client/src/features/audio/index.ts` -- Feature entry point re-exporting public components, hooks, and utilities.
- `client/src/views/JournalView.tsx` -- Journal view integrating `VoiceJournalButton` to append transcribed voice text to the daily note.

## Tasks & Acceptance

**Execution:**
- [x] `client/src/features/audio/audioResampler.ts` -- Pure linear interpolation resampler and chunk merger -- Convert phone microphone streams to 16kHz mono Float32Array required by Whisper
- [x] `client/src/features/audio/audioRecorder.ts` -- Web Audio API recorder with permission error handling -- Capture microphone PCM data and gracefully release hardware resources
- [x] `client/src/features/audio/whisper.worker.ts` -- Web Worker pipeline singleton using `@xenova/transformers` -- Prevent UI freezes during weight download and ONNX inference
- [x] `client/src/features/audio/useWhisperTranscriber.ts` -- React hook managing states (`isModelLoading`, `loadingProgress`, `isRecording`, `isTranscribing`, `transcript`, `error`) -- Provide clean reactive interface to UI
- [x] `client/src/features/audio/VoiceJournalButton.tsx` -- Tailwind CSS button with pulsing animation and progress indicator -- Provide intuitive voice input directly into journal notes
- [x] `client/src/views/JournalView.tsx` -- Integrate `VoiceJournalButton` into the journal note header -- Enable one-tap voice dictation for user reflections
- [x] `client/src/features/audio/*.test.ts(x)` -- Unit test suite covering resampler, recorder, hook, and button -- Ensure regression protection and offline mock verification

**Acceptance Criteria:**
- Given microphone input at 48 000 Hz, when audio is recorded and stopped, then it is resampled to 16 000 Hz mono `Float32Array` without distortion.
- Given the initial model load, when download progress events occur, then `loadingProgress` reflects percentage (0-100%) and `isModelLoading` is true.
- Given user denies microphone permission, when recording is requested, then an informative Polish error message is set and fallback advice is shown.
- Given active recording, when `isRecording` is true, then `VoiceJournalButton` renders with Tailwind `animate-pulse` and a red recording indicator.
- Given completed speech transcription, when worker returns transcript, then text is automatically appended to the journal note.

## Design Notes

Linear resampler formula for audio downsampling/upsampling:
```typescript
const ratio = sourceSampleRate / targetSampleRate;
const targetLength = Math.round(audioData.length / ratio);
for (let i = 0; i < targetLength; i++) {
  const originIdx = i * ratio;
  const index = Math.floor(originIdx);
  const nextIndex = Math.min(index + 1, audioData.length - 1);
  const weight = originIdx - index;
  result[i] = audioData[index] * (1 - weight) + audioData[nextIndex] * weight;
}
```

Vite worker integration:
```typescript
new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
```

## Verification

**Commands:**
- `npx vitest run src/features/audio/ src/components/VoiceJournalSlot.test.tsx src/views/JournalView.test.tsx` -- expected: All 21 tests pass across audio and journal views.
- `npm run build` (in `client/`) -- expected: `tsc -b && vite build` succeeds with zero errors and outputs separate chunk `dist/assets/whisper.worker-*.js`.
