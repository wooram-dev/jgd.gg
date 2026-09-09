export type RankedRecord = {
  finalMs: number;
  mistakeCount: number;
  achievedAt: Date;
  id: string;
};

export function compareRankedRecords(left: RankedRecord, right: RankedRecord): number {
  return (
    left.finalMs - right.finalMs ||
    left.mistakeCount - right.mistakeCount ||
    left.achievedAt.getTime() - right.achievedAt.getTime() ||
    left.id.localeCompare(right.id)
  );
}

export function selectBestRecord<T extends RankedRecord>(records: readonly T[]): T | null {
  if (records.length === 0) {
    return null;
  }

  return [...records].sort(compareRankedRecords)[0] ?? null;
}
