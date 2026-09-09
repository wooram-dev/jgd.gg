export function formatScore(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new RangeError("Milliseconds must be a finite non-negative number.");
  }

  const roundedCentiseconds = Math.round(milliseconds / 10);
  const totalSeconds = Math.floor(roundedCentiseconds / 100);
  const centiseconds = roundedCentiseconds % 100;

  if (totalSeconds < 60) {
    return `${totalSeconds}.${centiseconds.toString().padStart(2, "0")}초`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds
    .toString()
    .padStart(2, "0")}`;
}
