---
title: 'In-Browser Whisper Speech-to-Text Engine with Web Worker'
type: 'feature'
created: '2026-09-04'
status: 'done'
baseline_commit: 'c1ab0e4'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Users dictating daily journal reflections on mobile or desktop need a private, zero-latency speech-to-text engine. Long uncapped recordings risk catastrophic out-of-memory (OOM) browser crashes, varied audio hardware (e.g. 8kHz Bluetooth headsets vs 96kHz studio mics) can distort sampling, and lack of content moderation creates severe safety risks if terroristic or mass violence plans are persisted.

**Approach:** Implement a client-side Whisper transcription engine using `@xenova/transformers` inside a dedicated Web Worker with zero-copy buffer transfer, resilient cross-device resampling (8 kHz to 96 kHz) with multi-channel downmix, an enforced 5-minute (300s) recording limit with automated stop, and a deterministic local intent & harmful content guard (`contentFilter.ts`) intercepting violent extremism and terroristic threats before journal persistence.

## Boundaries & Constraints

**Always:**
- Execute ONNX weight downloads and Whisper inference in `whisper.worker.ts` off the main UI thread.
- Enforce a hard recording cap of 5 minutes (300 seconds) with visual countdown starting at 4:30 and automatic graceful stop.
- Transfer `Float32Array` buffers using `postMessage(..., [audio.buffer])` zero-copy transferable objects to minimize mobile memory footprint.
- Dynamically detect and handle input sample rates from 8 kHz (Bluetooth SCO) to 96 kHz, downmixing stereo/multi-channel to mono.
- Intercept and block harmful content (terroristic threats, explosive/weapon fabrication, mass violence) locally before updating note state.
- Gracefully handle lack of microphone permissions, missing audio devices, or non-HTTPS insecure contexts with clear user guidance.

**Ask First:**
- Altering the default `Xenova/whisper-tiny` model or storing raw audio files on external servers.

**Never:**
- Never execute ONNX inference or weight downloads on the main UI thread.
- Never allow recordings longer than 5 minutes to prevent mobile OOM crashes.
- Never persist or allow journal notes containing flagged terroristic or mass violence plans.
- Never transmit unencrypted user voice data to cloud endpoints.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Microphone Recording & Transcription | User clicks mic, speaks <= 5 min, clicks stop | Web Audio captures stream, downmixes to mono, resamples to 16kHz Float32Array, zero-copy transfers to worker, returns text | If empty audio (<0.2s), skip worker inference |
| 5-Minute Hard Cap Reached | Active recording reaches 300s (5m) | Auto-stops recording immediately, visual countdown warned at 4:30, proceeds to transcribe 5m buffer | Auto-flush without dropping data or crashing |
| Harmful / Terroristic Intent Speech | User dictates bomb threat, mass violence, terror attack plan | Content filter flags text; transcript is blocked from note; UI displays safety violation banner | Sets descriptive error; does not append text |
| Device Sample Rate & Multi-channel | 8kHz Bluetooth SCO or 96kHz USB mic, stereo | Auto-detects `audioContext.sampleRate`, downmixes channels to mono, resamples cleanly to 16kHz | Handles any arbitrary sample rate |
| Initial Model Download | First transcription trigger | Web Worker downloads quantized ONNX weights; reports `loadingProgress` (0-100%) | Worker emits error status on network failure |
| Mic Permission Denied | `getUserMedia` rejects `NotAllowedError` | Hook sets descriptive error, button displays permission alert with fallback text entry note | Graceful inline banner, no app crash |
| Insecure Context / Missing API | `navigator.mediaDevices` undefined | Hook catches missing API, explains HTTPS or browser requirement | Informs user to use manual text entry |

</frozen-after-approval>

## Code Map

- `client/src/features/audio/contentFilter.ts` -- Local harmful content filter scanning for terroristic threats, mass violence, explosive fabrication, and severe harm.
- `client/src/features/audio/audioResampler.ts` -- Multi-rate resampler (8kHz to 96kHz) and multi-channel downmixer producing 16kHz mono `Float32Array`.
- `client/src/features/audio/audioRecorder.ts` -- Web Audio API recorder with 5-minute hard limit, elapsed time tracking, and auto-stop callback.
- `client/src/features/audio/whisper.worker.ts` -- Web Worker pipeline singleton using `@xenova/transformers` with zero-copy transferable ArrayBuffer support.
- `client/src/features/audio/useWhisperTranscriber.ts` -- React hook managing states, duration countdown, harmful content interceptor, and worker messaging.
- `client/src/features/audio/VoiceJournalButton.tsx` -- UI button component with Tailwind pulse animation, countdown indicator (e.g. `04:45 / 05:00`), and safety warning banner.
- `client/src/features/audio/index.ts` -- Feature entry point re-exporting public components, hooks, and utilities.

## Tasks & Acceptance

**Execution:**
- [x] `client/src/features/audio/contentFilter.ts` -- Implement local harmful content & terroristic threat intent filter -- Prevent toxic, violent extremist, and attack plans from being persisted
- [x] `client/src/features/audio/contentFilter.test.ts` -- Unit test harmful content filter with safe vs terroristic/violent prompts -- Verify deterministic blocking of hazardous text
- [x] `client/src/features/audio/audioResampler.ts` -- Enhance resampler with multi-channel stereo-to-mono downmixing and arbitrary rate support (8kHz - 96kHz) -- Ensure cross-device fidelity
- [x] `client/src/features/audio/audioRecorder.ts` -- Implement 5-minute (300s) hard limit with auto-stop and elapsed time notification -- Prevent mobile OOM crashes
- [x] `client/src/features/audio/useWhisperTranscriber.ts` -- Wire content filter, 5-minute timer countdown, and zero-copy `[audio.buffer]` worker transfer -- Coordinate reactive UI states
- [x] `client/src/features/audio/VoiceJournalButton.tsx` -- Add countdown timer display, 4:30 warning state, and safety rejection error alert -- Deliver clear user feedback

**Acceptance Criteria:**
- Given microphone input at arbitrary rates (8 kHz to 96 kHz) or stereo channels, when audio is captured, then it is converted to clean 16 000 Hz mono `Float32Array`.
- Given a recording session reaching 300 seconds, when the 5-minute timer expires, then recording automatically stops and initiates transcription without crashing.
- Given transcribed text containing terroristic attack plans or bomb threats, when passed to `validateContentSafety`, then it is flagged as unsafe and rejected from the journal note.
- Given an active recording, when duration advances past 270 seconds (4:30), then the UI displays an urgent warning indicating impending auto-stop.
- Given completed transcription, when text is verified safe, then it is automatically appended to the journal note.

## Design Notes

Zero-copy transfer:
```typescript
worker.postMessage({ type: 'transcribe', audio: audioData }, [audioData.buffer]);
```

5-minute hard limit:
```typescript
const MAX_RECORDING_SECONDS = 300;
```

## Verification

**Commands:**
- `npx vitest run src/features/audio/` -- expected: All unit tests pass for resampler, recorder, content filter, hook, and UI button.
- `npm run build` (in `client/`) -- expected: `tsc -b && vite build` succeeds with zero errors and outputs separate chunk `dist/assets/whisper.worker-*.js`.
