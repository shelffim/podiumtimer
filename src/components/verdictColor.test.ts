import { describe, expect, it } from "vitest";
import { verdictColor } from "./verdictColor";

describe("verdictColor", () => {
  it("colors late red, early blue and on time neutral, never green", () => {
    expect(verdictColor).toEqual({ late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" });
  });
});
