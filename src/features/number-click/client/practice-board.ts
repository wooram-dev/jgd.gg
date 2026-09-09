import { shuffleNumberClickBoard } from "../domain/shuffle";

function browserRandomIndex(upperExclusive: number): number {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("CRYPTO_UNAVAILABLE");
  }

  const maximumUint32 = 0x1_0000_0000;
  const acceptedRange = maximumUint32 - (maximumUint32 % upperExclusive);
  const buffer = new Uint32Array(1);

  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= acceptedRange);

  return buffer[0] % upperExclusive;
}

export function createPracticeBoard(): number[] {
  return shuffleNumberClickBoard(browserRandomIndex);
}
