import { NUMBER_CLICK_RULES } from "./rules";

export type RandomIndex = (upperExclusive: number) => number;

export function shuffleNumberClickBoard(randomIndex: RandomIndex): number[] {
  const board = Array.from({ length: NUMBER_CLICK_RULES.maxNumber }, (_, index) => index + 1);

  for (let index = board.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    if (!Number.isInteger(swapIndex) || swapIndex < 0 || swapIndex > index) {
      throw new RangeError(`Random index must be an integer between 0 and ${index}.`);
    }

    [board[index], board[swapIndex]] = [board[swapIndex], board[index]];
  }

  assertNumberClickBoard(board);
  return board;
}

export function assertNumberClickBoard(
  board: readonly number[],
): asserts board is readonly number[] {
  const expected = NUMBER_CLICK_RULES.maxNumber;
  const unique = new Set(board);
  const valid =
    board.length === expected &&
    unique.size === expected &&
    board.every((value) => Number.isInteger(value) && value >= 1 && value <= expected);

  if (!valid) {
    throw new Error("Number-click board must be a permutation of 1 through 25.");
  }
}
