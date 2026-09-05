import React from 'react';

export type MoodType = 'bad' | 'neutral' | 'good' | 'very_good';

export interface MoodGlyphProps {
  mood: MoodType;
  className?: string;
  size?: number;
}

const GLYPH_PATHS: Record<MoodType, React.ReactNode> = {
  bad: (
    <>
      <path d="M17.5 15a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.2 8.35 4 4 0 0 0 5 15h12.5" />
      <line x1="8" y1="18" x2="8" y2="21" />
      <line x1="12" y1="17" x2="12" y2="20" />
      <line x1="16" y1="18" x2="16" y2="21" />
    </>
  ),
  neutral: (
    <path d="M17.5 16a4.5 4.5 0 0 0 .5-8.97A7 7 0 0 0 4.2 9.35 4 4 0 0 0 5 16h12.5" />
  ),
  good: (
    <>
      <circle cx="12" cy="7" r="3" />
      <line x1="12" y1="2" x2="12" y2="3" />
      <line x1="16.5" y1="3.5" x2="15.8" y2="4.2" />
      <line x1="7.5" y1="3.5" x2="8.2" y2="4.2" />
      <path d="M17.5 17a3.5 3.5 0 0 0 .5-6.96A5.5 5.5 0 0 0 7.2 11.8 3.2 3.2 0 0 0 8 17h9.5" />
    </>
  ),
  very_good: (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" />
      <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
      <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" />
      <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
    </>
  ),
};

export const MoodGlyph: React.FC<MoodGlyphProps> = ({ mood, className = 'w-6 h-6', size = 24 }) => {
  const content = GLYPH_PATHS[mood];
  if (!content) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-mood={mood}
      aria-hidden="true"
    >
      {content}
    </svg>
  );
};
