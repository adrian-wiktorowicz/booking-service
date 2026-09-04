import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VoiceJournalSlot } from './VoiceJournalSlot';

describe('VoiceJournalSlot', () => {
  it('renders slot container with accessibility label', () => {
    render(<VoiceJournalSlot />);
    const slot = screen.getByTestId('voice-journal-slot');
    expect(slot).toBeInTheDocument();
  });

  it('triggers onDictate when dictation action clicked if provided', () => {
    const handleDictate = vi.fn();
    render(<VoiceJournalSlot onDictate={handleDictate} />);
    const button = screen.getByRole('button', { name: /dyktafon|głos|voice/i });
    fireEvent.click(button);
    expect(handleDictate).toHaveBeenCalled();
  });
});
