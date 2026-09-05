---
title: 'Story: Client Journal Interaction & Resilience Shell (Two-Tier Auto-Save, Tag Chips, Audio Wave, Prompts, SVG Glyphs)'
type: 'feature'
created: '2026-09-05'
status: 'done'
baseline_commit: '30c1ac5'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The current journal editor relies on an administrative, high-friction single-submit form with comma-separated text tags, raw emojis, a blank canvas without reflection catalysts, and a cramped voice button devoid of audio level visualization or recording duration. In addition, lack of continuous auto-save exposes users to catastrophic data loss on accidental browser refreshes, while 401 auth expiration risks silent form clearing.

**Approach:** Implement a resilient, low-friction journaling interaction shell in `client/src/`:
1. Two-Tier Auto-Save: Instant local-first draft in `localStorage` (`draft_${entryDate}`) on every input, paired with a 1500ms debounced cloud upsert to `PUT /api/journal/entries/:date` with a 3-state sync indicator (`Zapisano lokalnie`, `Synchronizacja...`, `Zsynchronizowano w chmurze`).
2. Tappable preset tag chips (8 normalized tags) + custom tag input, bounded at 10 tags and mapped 1:1 to PostgreSQL `tags: text[]`.
3. Daily reflection prompts with a one-tap "Użyj tej inspiracji" button injecting the prompt into the note field.
4. Voice recording UX with an active recording timer (`00:00 / 02:00`), real-time 12-bar audio wave visualizer via native Web Audio `AnalyserNode`, and robust buffer preservation on unexpected stream disconnects.
5. Minimalist SVG mood glyphs and editorial serif styling, with a psychological closure button ("Zakończ wpis na dziś").

## Boundaries & Constraints

**Always:**
- Two-Tier Auto-Save: Local draft must update synchronously without blocking typing. Debounced cloud upsert must only fire when `isDirty === true`.
- Silent Auth Expiry Protection: If debounced cloud save encounters HTTP 401, the form content must NEVER be cleared or redirected away; the draft remains intact in local storage and displays a non-intrusive re-authentication banner.
- Tag Safety: Tags must be normalized (trimmed, lowercased, deduped). Selection must strictly enforce `tags.length <= 10` to avoid backend HTTP 422 errors.
- Web Audio Lifecycle: `AudioContext` and `AnalyserNode` must be instantiated exclusively upon user gesture (record click) and properly released (`close()` / `suspend()`) when recording ends or the component unmounts.
- Visualizer Performance: Audio waveform must render smoothly via `requestAnimationFrame` with a compact 12-bar CSS flex/grid layout, without heavy canvas drawing loops.
- Error Handling & Boundaries: Form must respect Architecture AD-2 constraints (notes <= 50,000 characters).
- Ponytail Minimalism: All features must use browser standard Web APIs (Web Audio API, localStorage, native fetch) without adding external npm dependencies.

**Ask First:**
- Introducing external charting, waveform, or animation libraries when native CSS and `AnalyserNode` achieve the required aesthetic.

**Never:**
- Never modify backend API contracts, Fastify schemas, or database tables in `server/`.
- Never lose or overwrite unsaved local text when switching dates without confirming or restoring the target date's draft.
- Never let audio recording run unconstrained beyond 2 minutes to prevent mobile memory bloat.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Keystroke auto-save | User types a word in note | Local draft updated instantly in storage; status shows "Zapisano lokalnie" | Silent fallback if storage quota exceeded |
| Debounced cloud sync | 1500ms elapsed since last change | Cloud PUT request dispatched; status transitions to "Synchronizacja..." then "Zsynchronizowano w chmurze" | Error status displayed if network offline |
| Offline / Network down | Device loses network during sync | Local draft remains preserved; status shows "Brak sieci (zapisano lokalnie)" | Next edit or reconnect retries sync |
| Token expired during writing | Cloud sync returns HTTP 401 | Note and mood remain preserved in local draft; non-intrusive re-auth banner displayed | Form is not reset; user can re-login |
| Preset chip toggle | User taps preset chip "Spacer" | Chip toggles active; added to tags array; normalized to lowercase | Max 10 tags limit disables adding more |
| Add custom tag | User inputs "medytacja" + Enter | Tag normalized and appended to active tags list | Disallowed if tag already present or >= 10 tags |
| Prompt injection | User clicks "Użyj tej inspiracji" | Current prompt prepended/inserted into note text with cursor positioned | If note already contains prompt, avoid duplicates |
| Audio recording wave | User taps "Dyktafon AI" | Timer starts at 00:00; 12-bar wave animates with live voice volume | Web Audio failsafe degrades gracefully if unsupported |
| Call interrupt during audio | Phone call interrupts mic stream | `MediaStreamTrack.onended` triggers; captured audio chunk preserved for transcription | Error banner informs user; partial text retained |
| Psychological closure | User clicks "Zakończ wpis na dziś" | Forces immediate cloud sync; triggers visual checkmark and celebration feedback | Standard network retry if offline |

</frozen-after-approval>

## Code Map

- `client/src/views/JournalView.tsx` -- Main journal view refactored with two-tier auto-save, preset tag chips, daily prompts, SVG mood glyphs, serif headings, and closure action.
- `client/src/views/JournalView.test.tsx` -- Comprehensive unit tests covering auto-save state, tag toggling, prompt insertion, and mood selection.
- `client/src/features/audio/VoiceJournalButton.tsx` -- Audio recorder button enriched with recording timer, Web Audio `AnalyserNode` 12-bar visualizer, and stream interrupt safety.
- `client/src/features/audio/VoiceJournalButton.test.tsx` -- Unit tests for timer display, audio wave rendering lifecycle, and interrupted recording handling.
- `client/src/features/audio/audioRecorder.ts` -- Audio recorder enhanced with `AudioContext` analyser node exposure and `track.onended` safety.
- `client/src/components/MoodGlyphs.tsx` -- Minimalist SVG line-art glyphs for moods (`bad`, `neutral`, `good`, `very_good`).
- `client/src/components/TagChips.tsx` -- Reusable chip selector with 8 presets, custom tag entry, and 10-tag limit enforcement.
- `client/src/utils/draftStorage.ts` -- Local-first storage utility managing `draft_${date}` persistence, expiry, and retrieval.

## Tasks & Acceptance

**Execution:**
- [x] `client/src/utils/draftStorage.ts` -- Create local draft storage manager with `saveDraft`, `getDraft`, and `clearDraft`.
- [x] `client/src/components/MoodGlyphs.tsx` -- Create minimalist SVG mood glyphs with refined line art.
- [x] `client/src/components/TagChips.tsx` -- Create preset chip selector with 8 presets, custom input, and 10-item cap.
- [x] `client/src/features/audio/audioRecorder.ts` -- Expose analyser node and handle stream track interruptions.
- [x] `client/src/features/audio/VoiceJournalButton.tsx` -- Add recording timer and 12-bar audio wave visualizer with proper Web Audio cleanup.
- [x] `client/src/views/JournalView.tsx` -- Integrate two-tier auto-save, prompt catalyst, TagChips, MoodGlyphs, serif typography, and closure action.
- [x] `client/src/views/JournalView.test.tsx` & `client/src/features/audio/VoiceJournalButton.test.tsx` -- Author and update unit tests verifying all new behaviors and edge cases.
- [x] Verification -- Run `npm test` and `npm run build` to confirm 100% green tests and clean compilation.

**Acceptance Criteria:**
- Given the user types in the journal note, when 1500ms elapse, then local storage contains the draft and debounced cloud sync executes without requiring a manual save button.
- Given the user selects or types tags, when total tags reach 10, then further additions are disabled and all tags are normalized to lowercase.
- Given the voice recorder is active, when the user speaks, then a live timer and 12-bar audio visualizer reflect voice activity in real time.
- Given cloud sync fails with HTTP 401, when the error occurs, then the local note draft remains intact and an in-place re-auth notice is shown.
- Given the user clicks "Zakończ wpis na dziś", when clicked, then immediate synchronization is triggered with celebratory completion feedback.

## Verification

**Commands:**
- `npm test` -- Vitest passes all test suites with 100% success rate.
- `npm run build` -- Production build succeeds with 0 errors.

## Suggested Review Order

**Entry Point & Interaction Shell**

- Main view orchestrating local draft, debounced sync, daily catalyst, and closure action
  [`JournalView.tsx:32`](../../client/src/views/JournalView.tsx#L32)

- Two-tier auto-save effect triggering cloud sync 1500ms after user stops typing
  [`JournalView.tsx:89`](../../client/src/views/JournalView.tsx#L89)

- Date switching logic preserving departing draft and loading target draft
  [`JournalView.tsx:123`](../../client/src/views/JournalView.tsx#L123)

**Resilience & Offline Handling**

- Local draft manager with quota resilience and zero speculative state
  [`draftStorage.ts:11`](../../client/src/utils/draftStorage.ts#L11)

- HTTP 401 silent auth expiration banner and local note preservation
  [`JournalView.tsx:75`](../../client/src/views/JournalView.tsx#L75)

- API client mapping client `note` to server `notes` in Fastify contract
  [`client.ts:116`](../../client/src/api/client.ts#L116)

**Voice Recording & Visualizer**

- Stream interruption recovery and lifecycle cleanup on component unmount
  [`useWhisperTranscriber.ts:90`](../../client/src/features/audio/useWhisperTranscriber.ts#L90)

- Audio recorder Web Audio setup, analyser exposure, and track interruption safety
  [`audioRecorder.ts:25`](../../client/src/features/audio/audioRecorder.ts#L25)

- 120-second automatic recording cutoff and 12-bar real-time wave animation
  [`VoiceJournalButton.tsx:45`](../../client/src/features/audio/VoiceJournalButton.tsx#L45)

**Minimalist Design & UI Components**

- Preset chips with 10-item cap and normalized custom tag input
  [`TagChips.tsx:21`](../../client/src/components/TagChips.tsx#L21)

- Single SVG component with declarative mood path dictionary
  [`MoodGlyphs.tsx:50`](../../client/src/components/MoodGlyphs.tsx#L50)

- Daily reflection inspiration injection with cursor positioning
  [`JournalView.tsx:173`](../../client/src/views/JournalView.tsx#L173)

**Verification & Tests**

- Unit tests for two-tier auto-save, draft persistence across dates, and 401 auth resilience
  [`JournalView.test.tsx:51`](../../client/src/views/JournalView.test.tsx#L51)

- Unit tests for audio recorder analyser node exposure and track ended safety
  [`audioRecorder.test.ts:277`](../../client/src/features/audio/audioRecorder.test.ts#L277)

- Unit tests for 120s cutoff, wave visualizer, and interrupt banner
  [`VoiceJournalButton.test.tsx:138`](../../client/src/features/audio/VoiceJournalButton.test.tsx#L138)

