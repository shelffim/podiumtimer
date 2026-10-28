// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("api entry point", () => {
  it.each([[undefined, "mock"], ["", "mock"], ["mock", "mock"], ["LIVE", "mock"], ["other", "mock"], ["live", "live"]] as const)(
    "resolves %s to %s", async (value, expected) => {
      const { resolveDataMode } = await import("./index");
      expect(resolveDataMode(value)).toBe(expected);
    },
  );

  it.each([[undefined, "mock"], ["live", "live"]] as const)("exports mode %s while api always points to mock", async (value, expected) => {
    vi.stubEnv("NEXT_PUBLIC_DATA_MODE", value);
    const entry = await import("./index");
    const { mockApi } = await import("./mock");
    const { device } = await import("./device");
    expect(entry.dataMode).toBe(expected);
    expect(entry.api).toBe(mockApi);
    expect(entry.device).toBe(device);
  });

  it("imports safely on the server without touching browser globals", async () => {
    const access = vi.fn(() => { throw new Error("browser access during import"); });
    vi.stubGlobal("window", new Proxy({}, { get: access }));
    vi.stubGlobal("localStorage", new Proxy({}, { get: access }));
    await expect(import("./index")).resolves.toBeDefined();
    expect(access).not.toHaveBeenCalled();
  });
});
