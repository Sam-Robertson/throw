// Deterministic categorical palette for calendar event chips, keyed by
// session type id — the same type always gets the same color across
// renders and refetches, independent of fetch/array order. Hues are chosen
// to read clearly as a light tint + solid border on a white background,
// starting with the brand's own sage/terracotta/rust before falling back
// to additional distinguishable hues.
const PALETTE: { bg: string; border: string; text: string }[] = [
  { bg: '#E5EBE1', border: '#8B9D82', text: '#2C3529' }, // sage (brand primary)
  { bg: '#F3E4D3', border: '#C28043', text: '#4A2F14' }, // terracotta (brand secondary)
  { bg: '#FBE1D6', border: '#D56032', text: '#5A2210' }, // rust (brand tertiary)
  { bg: '#DCE8F0', border: '#5B8DAE', text: '#1D3A4A' }, // slate blue
  { bg: '#E9E1F2', border: '#8B6BAE', text: '#3A2A4A' }, // lavender
  { bg: '#F5E8C8', border: '#C9A227', text: '#4A3B0A' }, // mustard
  { bg: '#DCEFE6', border: '#4C9A78', text: '#1B3A2C' }, // teal green
  { bg: '#F2DDE4', border: '#B15C7C', text: '#4A1F2C' }, // dusty rose
  { bg: '#E0E5EC', border: '#6B7A8F', text: '#242C36' }, // steel gray
  { bg: '#F5DCC8', border: '#C97A3A', text: '#4A2A0F' }, // ochre
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getSessionTypeColor(sessionTypeId: string) {
  return PALETTE[hashString(sessionTypeId) % PALETTE.length];
}
