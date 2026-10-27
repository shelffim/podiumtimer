import type { Api } from "@/types/api";
import { mockApi } from "./mock";

export type DataMode = "mock" | "live";

export function resolveDataMode(value: string | undefined): DataMode {
  return value === "live" ? "live" : "mock";
}

export const dataMode: DataMode = resolveDataMode(process.env.NEXT_PUBLIC_DATA_MODE);
export const api: Api = mockApi;
export { device } from "./device";
