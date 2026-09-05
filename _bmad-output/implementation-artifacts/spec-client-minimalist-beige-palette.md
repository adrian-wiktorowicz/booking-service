---
title: 'Client Minimalist Cool White & Beige Layout with Black & Brown Contrast Accents'
type: 'feature'
created: '2026-09-04'
status: 'completed'
baseline_commit: '007c4df'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/architecture/architecture-booking-service-2026-09-02/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The initial client PWA shell relied on generic dark slate/blue styling (`bg-slate-900`) that conflicts with the user's vision of a serene, contemplative daily journal. The layout requires a cool, subdued, minimalist aesthetic dominated by crisp white and soft linen/beige with high-contrast black and deep brown accents.

**Approach:** Refactor client styling across the PWA container, authentication forms (`RegisterView`, `LoginView`), daily journal entry form (`JournalView`), voice dictation slot/button (`VoiceJournalSlot`, `VoiceJournalButton`), PWA theme color, and application icon to a disciplined Scandinavian/architectural white-and-beige palette with obsidian black and deep roasted espresso accents. Add a root `package.json` with scripts delegating `dev`, `build`, and `test` to the client workspace.

## Boundaries & Constraints

**Always:**
- Main canvas background must be cool linen/beige (`#f8f7f4`), form cards must be crisp white (`#ffffff`) with subtle structural borders (`#e8e4dc` / `#ded8ce`), and input fields must be soft ivory sand (`#faf9f6`).
- Contrast accents: Primary action buttons / high contrast elements in jet obsidian black (`#141311`), secondary accents/icons/subtitles in roasted espresso brown (`#3b2314`, `#4a3525`, `#70685f`).
- Semantic mood selector cards must maintain distinct, accessible visual states with calm, natural tones for `bad`, `neutral`, `good`, and `very_good`.
- PWA meta tags in `index.html` and `manifest.json` must be updated to `theme-color: #f8f7f4`.
- All existing unit and integration tests (Auth, Journal, Voice slot, Audio recorder) must pass without regressions (`animate-pulse` maintained on recording button).
- Ponytail code minimalism: Native platform features and standard Tailwind 4 utility tokens only; zero unnecessary external CSS dependencies.

**Ask First:**
- Introducing external icon sets, component libraries, or Google Web Fonts when standard system font stack and inline SVGs suffice.

**Never:**
- Never modify backend API contracts, Fastify route schemas, or validation logic in `server/`.
- Never degrade keyboard accessibility, touch targets (minimum 44x44px), or ARIA labels.
- Never retain legacy dark slate/blue tokens (`bg-slate-900`, `text-slate-100`) in the light minimalist theme.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| App container render | Route `/login`, `/register`, or `/journal` | Main container displays `#f8f7f4` background, dark charcoal text `#171513`, preserving `pt-safe pb-safe` iOS insets | N/A |
| Mood selector interaction | User clicks `very_good` (☀️) | Radio card highlights in deep espresso background `#3b2314` with cream text `#faf9f6`; other moods retain natural sand borders | N/A |
| Voice dictation recording | User clicks "Dyktafon AI" | Button toggles to active recording state with `animate-pulse` in garnet tone `#8c2a1c` | Error alert displayed in soft rose card with fallback instruction |
| Mobile PWA browser chrome | App opened in Safari iOS / Android PWA | PWA status bar and theme-color render `#f8f7f4` with default status bar style | N/A |
| Root script execution | Developer executes `npm run dev` in project root | Spawns client dev server seamlessly via `npm --prefix client run dev` | Process exits with standard exit code |

</frozen-after-approval>

## Code Map

- `package.json` -- Root delegation scripts (`dev`, `build`, `test`) to prevent ENOENT errors when running commands from root.
- `client/index.html` -- Mobile HTML shell with updated `#f8f7f4` theme-color, body classes, and manifest link.
- `client/public/manifest.json` -- PWA manifest with `#f8f7f4` background and theme color.
- `client/public/icon.svg` -- App icon SVG with beige backdrop and black/brown geometry.
- `client/src/index.css` -- Base Tailwind 4 stylesheet with `--sat`/`--sab` insets and `#f8f7f4` body background.
- `client/src/App.tsx` -- Main container shell with minimalist `#f8f7f4` canvas and obsidian text `#171513`.
- `client/src/views/JournalView.tsx` -- White card container, ivory inputs, architectural borders, subdued mood cards, black CTA.
- `client/src/views/LoginView.tsx` -- Minimalist white card, sand inputs, high-contrast black submit button.
- `client/src/views/RegisterView.tsx` -- Minimalist white card matching LoginView.
- `client/src/components/VoiceJournalSlot.tsx` -- Subdued beige/brown fallback slot button.
- `client/src/features/audio/VoiceJournalButton.tsx` -- Audio dictation button styled in ivory/espresso with pulsing garnet recording state.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- Create root package.json with scripts delegating `dev`, `build`, and `test` to `client/`.
- [x] `client/index.html` & `client/public/manifest.json` & `client/public/icon.svg` -- Update PWA manifest, theme-color, and icon.
- [x] `client/src/index.css` & `client/src/App.tsx` -- Update base canvas styles and main container shell.
- [x] `client/src/views/JournalView.tsx` -- Refactor form card, inputs, mood selector, and button styling.
- [x] `client/src/views/LoginView.tsx` & `client/src/views/RegisterView.tsx` -- Refactor auth views with white/beige cards and black buttons.
- [x] `client/src/components/VoiceJournalSlot.tsx` & `client/src/features/audio/VoiceJournalButton.tsx` -- Align voice button states with the aesthetic palette.
- [x] Verification -- Run `npm test` and `npm run build` to ensure 100% green tests and clean build.

**Acceptance Criteria:**
- Given the client app is opened on any screen, when rendered, then the background is `#f8f7f4`, form cards are pure white `#ffffff`, and borders are subtle beige `#e8e4dc` / `#ded8ce`.
- Given the journal entry form, when selecting any mood, then the selection is clearly visible with accessible high contrast and semantic styling.
- Given the voice dictation button, when recording is started, then the button pulses with `animate-pulse` and displays an accessible status label.
- Given the project root, when `npm run dev` is executed, then the client development server starts without ENOENT errors.

## Verification

**Commands:**
- `npm test` -- Vitest in `client/` passes all 29 tests across 8 suites with 100% success rate.
- `npm run build` -- Production build succeeds with 0 errors.
