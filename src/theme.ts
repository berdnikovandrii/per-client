import type { FontVariant } from 'react-native';

// Noir Concierge (2026-11-18): near-black surfaces, warm off-white text, one gold accent, serif headings.
// Every colour in the app comes from here.
export const C = {
  // surfaces
  bg: '#0B0B0C',
  black: '#0B0B0C',
  card: '#161617',
  cardHi: '#1B1B1D',
  cardLo: '#131314',
  raised: '#222224',
  track: '#2B2B30',
  bar: 'rgba(22,22,24,0.72)',
  // lines
  line: 'rgba(255,255,255,0.09)',
  lineHi: 'rgba(255,255,255,0.14)',
  // gold
  gold: '#C8A85F',
  goldHi: '#E2C98A',
  goldText: '#D9BD7A',
  goldLine: 'rgba(200,168,95,0.28)',
  goldSoft: 'rgba(200,168,95,0.16)',
  onGold: '#1A1408',
  // text
  ink: '#F4F1EA',
  text: '#D8D4CB',
  muted: '#A9A397',
  faint: '#8E897E',
  chip: 'rgba(255,255,255,0.08)',
  // status
  green: '#8FE0B0',
  greenDot: '#6FCF97',
  greenSoft: 'rgba(111,207,151,0.14)',
  red: '#FF9A8F',
  redSoft: 'rgba(255,120,105,0.13)',
  blue: '#9CC3FF',
  blueSoft: 'rgba(120,170,255,0.16)',
  orange: '#F2B56B',
  orangeSoft: 'rgba(242,181,107,0.15)',
};

/** Headings are set in Cormorant Garamond (loaded in App.tsx); everything else is the system font. */
export const F = { serif: 'CormorantGaramond_600SemiBold' };
/** The serif with lining figures: its default old-style digits make "$80" read like "$8o". */
export const SERIF: { fontFamily: string; fontVariant: FontVariant[] } = { fontFamily: F.serif, fontVariant: ['lining-nums'] };

/** Room at the bottom of every tab screen for the floating tab bar. */
export const TAB_SPACE = 124;
