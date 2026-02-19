import { describe, expect, it } from "vitest";
import { topologicalSort } from "./dag";

describe("topologicalSort", () => {
  it("returns valid order for DAG", () => {
    const result = topologicalSort(
      ["a", "b", "c"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
      ],
    );

    expect(result.hasCycle).toBe(false);
    expect(result.order).toEqual(["a", "b", "c"]);
  });

  it("detects cycle", () => {
    const result = topologicalSort(
      ["a", "b"],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
      ],
    );

    expect(result.hasCycle).toBe(true);
  });
});