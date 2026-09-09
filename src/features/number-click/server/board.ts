import { randomInt } from "node:crypto";

import { shuffleNumberClickBoard } from "../domain/shuffle";

export function createOfficialBoard(): number[] {
  return shuffleNumberClickBoard((upperExclusive) => randomInt(upperExclusive));
}
