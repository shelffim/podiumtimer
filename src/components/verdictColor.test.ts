import { describe, expect, it } from "vitest";
import { verdictColor, verdictTone } from "./verdictColor";

describe("verdictColor", () => {
  it("colors late red, early blue and on time neutral, never green", () => {
    expect(verdictColor).toEqual({ late: "text-red-400", early: "text-blue-400", on_time: "text-neutral-300" });
  });

  it("tints a verdict badge with the same meaning color behind the same text color", () => {
    expect(verdictTone).toEqual({
      late: "bg-red-400/15 text-red-400",
      early: "bg-blue-400/15 text-blue-400",
      on_time: "bg-white/10 text-neutral-300",
    });
  });
});
