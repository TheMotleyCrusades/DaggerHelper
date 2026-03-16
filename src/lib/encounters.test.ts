import { describe, expect, it } from "vitest";
import {
  calculateBaseBudget,
  calculateEncounterCost,
  classifyDifficulty,
} from "./encounters";

describe("encounter calculations", () => {
  it("calculates base budget from party size", () => {
    expect(calculateBaseBudget(3)).toBe(11);
    expect(calculateBaseBudget(4)).toBe(14);
  });

  it("calculates encounter spend from role quantities", () => {
    expect(
      calculateEncounterCost([
        { type: "leader", quantity: 1 },
        { type: "minion", quantity: 3 },
      ])
    ).toBe(6);
  });

  it("classifies difficulty from spend vs budget", () => {
    expect(classifyDifficulty(7, 14)).toBe("easy");
    expect(classifyDifficulty(13, 14)).toBe("moderate");
    expect(classifyDifficulty(17, 14)).toBe("hard");
    expect(classifyDifficulty(20, 14)).toBe("deadly");
  });
});
