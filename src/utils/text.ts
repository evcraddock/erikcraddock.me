/**
 * Truncate text to a maximum length, breaking on word boundaries.
 * Adds ellipsis if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find the last space before maxLength
  const lastSpace = text.lastIndexOf(" ", maxLength);

  // If no space found, just cut at maxLength (single long word)
  const cutoff = lastSpace > 0 ? lastSpace : maxLength;

  return text.slice(0, cutoff) + "...";
}
