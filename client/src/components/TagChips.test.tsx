import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagChips } from './TagChips';

describe('TagChips', () => {
  it('renders preset tag chips and input field', () => {
    render(<TagChips tags={[]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /spacer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trening/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /praca/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /relaks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rodzina/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /czytanie/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /medytacja/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/tagi/i)).toBeInTheDocument();
  });

  it('toggles preset chip on and off', () => {
    const handleChange = vi.fn();
    const { rerender } = render(<TagChips tags={[]} onChange={handleChange} />);

    // Click 'spacer' preset
    fireEvent.click(screen.getByRole('button', { name: /spacer/i }));
    expect(handleChange).toHaveBeenCalledWith(['spacer']);

    // Rerender with 'spacer' active, click again to remove
    rerender(<TagChips tags={['spacer']} onChange={handleChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^#?spacer$/i }));
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it('adds custom tag on Enter and normalizes to lowercase and trimmed', () => {
    const handleChange = vi.fn();
    render(<TagChips tags={['spacer']} onChange={handleChange} />);

    const input = screen.getByLabelText(/tagi/i);
    fireEvent.change(input, { target: { value: '  Mindfulness  ' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(['spacer', 'mindfulness']);
  });

  it('ignores duplicate tags when adding custom tag', () => {
    const handleChange = vi.fn();
    render(<TagChips tags={['spacer']} onChange={handleChange} />);

    const input = screen.getByLabelText(/tagi/i);
    fireEvent.change(input, { target: { value: 'spacer' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleChange).not.toHaveBeenCalled();
  });

  it('strictly enforces maximum 10 tags limit', () => {
    const tenTags = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10'];
    const handleChange = vi.fn();
    render(<TagChips tags={tenTags} onChange={handleChange} />);

    // Try clicking preset chip that is not in active tags
    fireEvent.click(screen.getByRole('button', { name: /spacer/i }));
    expect(handleChange).not.toHaveBeenCalled();

    // Try typing and pressing enter
    const input = screen.getByLabelText(/tagi/i);
    fireEvent.change(input, { target: { value: 't11' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(handleChange).not.toHaveBeenCalled();

    // Should indicate max limit reached
    expect(screen.getByText(/maksymalnie 10 tagów/i)).toBeInTheDocument();
  });

  it('allows removing an active tag via its remove button', () => {
    const handleChange = vi.fn();
    render(<TagChips tags={['spacer', 'własny']} onChange={handleChange} />);

    const removeBtn = screen.getByRole('button', { name: /usuń tag własny|remove własny/i });
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(['spacer']);
  });
});
