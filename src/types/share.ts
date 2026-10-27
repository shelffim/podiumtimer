import type { RunState } from "./run";
import type { Segment } from "./timer";

export type ShareView = {
  timerName: string;
  segments: Segment[];
  seatCap: number;
  state: RunState;
  rev: number;
};
export type PresenceRole = "host" | "viewer";
export type PresenceMember = { clientId: string; nickname: string; role: PresenceRole; joinedAt: number };
