import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MoodGlyph } from './MoodGlyphs';

describe('MoodGlyph', () => {
  it('renders minimalist SVG glyph for bad mood', () => {
    const { container } = render(<MoodGlyph mood="bad" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-mood', 'bad');
  });

  it('renders minimalist SVG glyph for neutral mood', () => {
    const { container } = render(<MoodGlyph mood="neutral" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-mood', 'neutral');
  });

  it('renders minimalist SVG glyph for good mood', () => {
    const { container } = render(<MoodGlyph mood="good" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-mood', 'good');
  });

  it('renders minimalist SVG glyph for very_good mood', () => {
    const { container } = render(<MoodGlyph mood="very_good" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('data-mood', 'very_good');
  });

  it('applies custom className and size', () => {
    const { container } = render(<MoodGlyph mood="good" className="text-amber-600" size={32} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-amber-600');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });
});
