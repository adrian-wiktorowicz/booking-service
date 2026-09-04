import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { JournalView } from './JournalView';

describe('JournalView', () => {
  it('renders date picker, mood selectors, note field, tags and VoiceJournalSlot', () => {
    render(<JournalView onSave={vi.fn()} />);

    expect(screen.getByLabelText(/data|date/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^bardzo dobrze$|^very_good$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^dobrze$|^good$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^neutralnie$|^neutral$/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^źle$|^bad$/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/notatka|treść|note/i)).toBeInTheDocument();
    expect(screen.getByTestId('voice-journal-slot')).toBeInTheDocument();
    expect(screen.getByLabelText(/tagi|tags/i)).toBeInTheDocument();
  });

  it('submits entry with selected mood, date, note, and parsed tags', async () => {
    const handleSave = vi.fn();
    render(<JournalView onSave={handleSave} />);

    fireEvent.change(screen.getByLabelText(/data|date/i), { target: { value: '2026-09-04' } });
    fireEvent.click(screen.getByRole('radio', { name: /bardzo dobrze|very_good/i }));
    fireEvent.change(screen.getByLabelText(/notatka|treść|note/i), { target: { value: 'Dzisiaj był świetny dzień.' } });
    fireEvent.change(screen.getByLabelText(/tagi|tags/i), { target: { value: 'spacer, mindfulness, kodowanie' } });

    fireEvent.click(screen.getByRole('button', { name: /zapisz wpis|zapisz|save/i }));

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        entryDate: '2026-09-04',
        mood: 'very_good',
        note: 'Dzisiaj był świetny dzień.',
        tags: ['spacer', 'mindfulness', 'kodowanie'],
      });
      expect(screen.getByText(/wpis zapisany pomyślnie/i)).toBeInTheDocument();
    });
  });
});
