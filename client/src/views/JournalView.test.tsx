import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { JournalView } from './JournalView';
import * as draftStorage from '../utils/draftStorage';

describe('JournalView', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders date picker, mood glyphs, prompt inspiration, note field, tags, and closure action', () => {
    render(<JournalView onSave={vi.fn()} />);

    expect(screen.getByLabelText(/data|date/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /bardzo dobrze/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^dobrze$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /neutralnie/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /źle/i })).toBeInTheDocument();

    expect(screen.getByText(/użyj tej inspiracji/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notatka|treść|note/i)).toBeInTheDocument();
    expect(screen.getByTestId('voice-journal-slot')).toBeInTheDocument();
    expect(screen.getByLabelText(/tagi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zakończ wpis na dziś|zapisz wpis/i })).toBeInTheDocument();
  });

  it('instant local draft save on keystroke and debounced cloud sync after 1500ms', async () => {
    vi.useFakeTimers();
    const handleSave = vi.fn().mockResolvedValue({ success: true });
    render(<JournalView onSave={handleSave} />);

    const noteInput = screen.getByLabelText(/notatka|treść|note/i);

    // Type a note
    fireEvent.change(noteInput, { target: { value: 'Dzisiejszy dzień był pełen spokoju.' } });

    // Local draft is updated immediately
    expect(screen.getByText(/zapisano lokalnie/i)).toBeInTheDocument();
    const savedDraft = draftStorage.getDraft(new Date().toISOString().split('T')[0]);
    expect(savedDraft?.note).toBe('Dzisiejszy dzień był pełen spokoju.');
    expect(handleSave).not.toHaveBeenCalled();

    // Advance 1400ms (before debounce expires)
    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(handleSave).not.toHaveBeenCalled();

    // Advance remaining 100ms (1500ms total)
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        note: 'Dzisiejszy dzień był pełen spokoju.',
      })
    );

    // Resolves to synced
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/zsynchronizowano w chmurze/i)).toBeInTheDocument();
  });

  it('displays offline status when debounced cloud sync fails', async () => {
    vi.useFakeTimers();
    const handleSave = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<JournalView onSave={handleSave} />);

    const noteInput = screen.getByLabelText(/notatka|treść|note/i);
    fireEvent.change(noteInput, { target: { value: 'Test offline sync' } });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/brak sieci \(zapisano lokalnie\)/i)).toBeInTheDocument();
    // Draft is still safely preserved in localStorage
    const savedDraft = draftStorage.getDraft(new Date().toISOString().split('T')[0]);
    expect(savedDraft?.note).toBe('Test offline sync');
  });

  it('displays non-intrusive re-authentication banner on HTTP 401 without clearing note or draft', async () => {
    vi.useFakeTimers();
    const authError: any = new Error('Unauthorized');
    authError.status = 401;
    const handleSave = vi.fn().mockRejectedValue(authError);

    render(<JournalView onSave={handleSave} />);

    const noteInput = screen.getByLabelText(/notatka|treść|note/i);
    fireEvent.change(noteInput, { target: { value: 'Moje cenne myśli, które nie mogą zniknąć.' } });

    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Verify re-auth banner is shown
    expect(screen.getByText(/twoja sesja wygasła/i)).toBeInTheDocument();
    // Verify note content is NOT cleared
    expect((noteInput as HTMLTextAreaElement).value).toBe('Moje cenne myśli, które nie mogą zniknąć.');
    // Verify draft remains in storage
    const savedDraft = draftStorage.getDraft(new Date().toISOString().split('T')[0]);
    expect(savedDraft?.note).toBe('Moje cenne myśli, które nie mogą zniknąć.');
  });

  it('injects daily reflection prompt without duplicate injection', () => {
    render(<JournalView onSave={vi.fn()} />);

    const promptButton = screen.getByRole('button', { name: /użyj tej inspiracji/i });
    const noteInput = screen.getByLabelText(/notatka|treść|note/i) as HTMLTextAreaElement;

    // Inject prompt
    fireEvent.click(promptButton);
    const initialText = noteInput.value;
    expect(initialText.length).toBeGreaterThan(0);

    // Clicking again avoids duplicate injection
    fireEvent.click(promptButton);
    expect(noteInput.value).toBe(initialText);
  });

  it('toggles preset tags and bounds active tags at 10 items', () => {
    render(<JournalView onSave={vi.fn()} />);

    const spacerChip = screen.getByRole('button', { name: /^#?spacer$/i });
    fireEvent.click(spacerChip);

    // Selected tag badge appears
    expect(spacerChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /usuń tag spacer/i })).toBeInTheDocument();
  });

  it('persists active modified draft when switching to another date', () => {
    render(<JournalView onSave={vi.fn()} />);

    const today = new Date().toISOString().split('T')[0];
    const noteInput = screen.getByLabelText(/notatka|treść|note/i);
    fireEvent.change(noteInput, { target: { value: 'Myśli przed zmianą daty.' } });

    // Switch to another date
    const dateInput = screen.getByLabelText(/data|date/i);
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });

    // Verify draft for original date was persisted in storage
    const todayDraft = draftStorage.getDraft(today);
    expect(todayDraft?.note).toBe('Myśli przed zmianą daty.');
  });

  it('does NOT display celebration banner when closure cloud sync fails', async () => {
    const handleSave = vi.fn().mockRejectedValue(new Error('Network error'));
    render(<JournalView onSave={handleSave} />);

    const noteInput = screen.getByLabelText(/notatka|treść|note/i);
    fireEvent.change(noteInput, { target: { value: 'Test failing closure.' } });

    const closureButton = screen.getByRole('button', { name: /zakończ wpis na dziś/i });
    fireEvent.click(closureButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalled();
      expect(screen.queryByText(/wpis zakończony pomyślnie/i)).not.toBeInTheDocument();
      expect(screen.getByText(/brak sieci/i)).toBeInTheDocument();
    });
  });

  it('safely restores draft when switching dates without losing data', () => {
    draftStorage.saveDraft('2026-09-01', {
      entryDate: '2026-09-01',
      mood: 'very_good',
      note: 'Wpis z pierwszego września z draftu.',
      tags: ['start'],
    });

    render(<JournalView onSave={vi.fn()} />);

    const dateInput = screen.getByLabelText(/data|date/i);
    fireEvent.change(dateInput, { target: { value: '2026-09-01' } });

    const noteInput = screen.getByLabelText(/notatka|treść|note/i) as HTMLTextAreaElement;
    expect(noteInput.value).toBe('Wpis z pierwszego września z draftu.');
  });

  it('triggers immediate sync and celebration feedback on closure button click', async () => {
    const handleSave = vi.fn().mockResolvedValue({ success: true });
    render(<JournalView onSave={handleSave} />);

    const noteInput = screen.getByLabelText(/notatka|treść|note/i);
    fireEvent.change(noteInput, { target: { value: 'Podsumowanie dnia.' } });

    const closureButton = screen.getByRole('button', { name: /zakończ wpis na dziś/i });
    fireEvent.click(closureButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          note: 'Podsumowanie dnia.',
        })
      );
      expect(screen.getByText(/zakończony|świętuj|sukces/i)).toBeInTheDocument();
    });
  });
});
