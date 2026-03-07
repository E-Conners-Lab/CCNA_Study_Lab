// ---------------------------------------------------------------------------
// SM-2 Spaced Repetition Algorithm (shared between server and client)
// ---------------------------------------------------------------------------

export interface SM2Result {
  repetitions: number;
  ease: number;
  interval: number;
  nextReview: string; // ISO date string
}

/**
 * SuperMemo SM-2 spaced repetition algorithm.
 *
 * @param quality     - Rating 0-5 (0=blackout, 5=perfect)
 * @param repetitions - Number of consecutive correct repetitions so far
 * @param ease        - Easiness factor (>= 1.3, default 2.5)
 * @param interval    - Current interval in days
 * @returns Updated { repetitions, ease, interval, nextReview }
 */
export function sm2(
  quality: number,
  repetitions: number,
  ease: number,
  interval: number,
): SM2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let newRepetitions = repetitions;
  let newEase = ease;
  let newInterval = interval;

  if (q >= 3) {
    if (newRepetitions === 0) newInterval = 1;
    else if (newRepetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * ease);
    newRepetitions += 1;
  } else {
    newRepetitions = 0;
    newInterval = 1;
  }

  // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
  newEase = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (newEase < 1.3) newEase = 1.3;
  newEase = Math.round(newEase * 100) / 100;

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    repetitions: newRepetitions,
    ease: newEase,
    interval: newInterval,
    nextReview: nextReview.toISOString(),
  };
}
