/**
 * Best-effort parse of Moneycontrol date strings into JS Date
 * Falls back to current date if parsing fails.
 * @param {string} dateString
 * @returns {Date}
 */
export function parseMoneycontrolDate(dateString) {
  if (!dateString) return new Date();

  // They often use formats like "January 19, 2026 10:30 AM IST" or similar.
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback: strip extra labels like "Updated:" / "Published:"
  const cleaned = dateString
    .replace(/(Updated|Published)\s*:?/i, '')
    .replace(/\s+IST/i, '')
    .trim();

  const parsedCleaned = new Date(cleaned);
  if (!isNaN(parsedCleaned.getTime())) {
    return parsedCleaned;
  }

  return new Date();
}
