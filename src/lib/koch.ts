/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal international Koch sequence (G4FON / LCWO standard).
 * Starts with K and M at full operational target speed (e.g. 20 WPM),
 * adding one character per level once 90% accuracy is reached.
 */
export const KOCH_SEQUENCE: readonly string[] = [
  'K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O',
  'W', 'I', '.', 'N', 'J', 'E', 'F', '0', 'Y', ',',
  'V', 'G', '5', '/', 'Q', '9', 'Z', 'H', '3', '8',
  'B', '?', '4', '2', '7', 'C', '1', 'D', '6', 'X',
] as const;

export const MAX_KOCH_LEVEL = KOCH_SEQUENCE.length - 1; // 39 (Levels 1 to 39, where 1 has 2 characters: K, M)
export const KOCH_PASS_ACCURACY = 0.9; // 90% threshold to advance

/**
 * Returns all active characters for a given Koch level (1-indexed, 1 to 40).
 * Level 1: ['K', 'M']
 * Level 2: ['K', 'M', 'R']
 * Level 40: all 40 characters
 */
export function getKochLevelCharacters(level: number): string[] {
  const safeLevel = Math.max(1, Math.min(KOCH_SEQUENCE.length - 1, Math.floor(level || 1)));
  // Level 1 includes first 2 characters ('K', 'M')
  return KOCH_SEQUENCE.slice(0, safeLevel + 1);
}

/**
 * Returns the newest character introduced at this specific level.
 */
export function getKochNewCharacter(level: number): string {
  const safeLevel = Math.max(1, Math.min(KOCH_SEQUENCE.length - 1, Math.floor(level || 1)));
  return KOCH_SEQUENCE[safeLevel];
}

/**
 * Checks whether the round score qualifies for advancing to the next level (>= 90%).
 */
export function checkKochLevelPass(correct: number, total: number = 10): boolean {
  if (total <= 0) return false;
  return correct / total >= KOCH_PASS_ACCURACY;
}

/**
 * Selects a random target from the available level characters,
 * giving a slightly higher weight (35%) to the newly introduced character
 * so the learner encounters the new sound frequently while reinforcing earlier characters.
 */
export function pickKochQuestionTarget(characters: string[], previousTarget?: string): string {
  if (!characters.length) return 'K';
  if (characters.length === 1) return characters[0];

  const newestChar = characters[characters.length - 1];
  const olderChars = characters.slice(0, -1);

  // 35% chance to pick newest character if there are older characters
  if (olderChars.length > 0 && Math.random() < 0.35 && previousTarget !== newestChar) {
    return newestChar;
  }

  // Filter out previous target if possible for better variety
  const pool = characters.filter((c) => c !== previousTarget);
  const eligible = pool.length > 0 ? pool : characters;
  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Calculates Farnsworth timing metrics.
 * Character elements (dit/dah/intra-char gap) are sent at characterWpm (e.g. 20 WPM),
 * while inter-character spacing is expanded according to effectiveWpm (e.g. 10-12 WPM).
 */
export interface FarnsworthTiming {
  characterWpm: number;
  effectiveWpm: number;
  ditDurationMs: number;
  dahDurationMs: number;
  farnsworthInterCharGapMs: number;
}

export function calculateFarnsworthTiming(
  characterWpm: number = 20,
  effectiveWpm: number = 12
): FarnsworthTiming {
  const safeCharWpm = Math.max(15, Math.min(45, Math.round(characterWpm)));
  const safeEffWpm = Math.max(5, Math.min(safeCharWpm, Math.round(effectiveWpm)));

  const unitMs = 1200 / safeCharWpm;
  const ditDurationMs = unitMs;
  const dahDurationMs = unitMs * 3;

  // Standard PARIS inter-character gap is 3 units at effective speed minus intra-char compensation
  const effUnitMs = 1200 / safeEffWpm;
  // Gap between characters is expanded to the effective unit timing
  const farnsworthInterCharGapMs = Math.max(unitMs * 3, effUnitMs * 3);

  return {
    characterWpm: safeCharWpm,
    effectiveWpm: safeEffWpm,
    ditDurationMs,
    dahDurationMs,
    farnsworthInterCharGapMs,
  };
}
