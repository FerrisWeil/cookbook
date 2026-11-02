import { assertCoverIds, repoCatalog } from "./catalog.js";

export function covers(id: string, ...rest: string[]): void {
  assertCoverIds(repoCatalog(), [id, ...rest]);
}
