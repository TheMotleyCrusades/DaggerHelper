import { describe, expect, it } from "vitest";
import { createShareId, parseShareId } from "../../src/lib/share-token";

describe("character sharing tokens", () => {
  it("creates and verifies signed share links", () => {
    const shareId = createShareId(42, null);
    const parsed = parseShareId(shareId);

    expect(parsed).not.toBeNull();
    expect(parsed?.characterId).toBe(42);
  });

  it("rejects tampered share tokens", () => {
    const shareId = createShareId(7, 7);
    const tampered = `${shareId.slice(0, -3)}abc`;

    expect(parseShareId(tampered)).toBeNull();
  });
});
