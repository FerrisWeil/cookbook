import { createHash } from "node:crypto";

export const FINGERPRINT_VERSION = "fp-v1";

export function requirementFingerprint(id: string, text: string): string {
  const payload = JSON.stringify({ v: 1, id: String(id), text });
  return createHash("sha256")
    .update("cookbook.req.fp.v1\n")
    .update(payload)
    .digest("hex")
    .slice(0, 16);
}
