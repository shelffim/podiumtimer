import type { PresenceMember } from "@/types/share";

function uniqueMembers(presence: PresenceMember[]): PresenceMember[] {
  const members = new Map<string, PresenceMember>();
  for (const member of presence) {
    const previous = members.get(member.clientId);
    if (!previous || member.joinedAt < previous.joinedAt) members.set(member.clientId, member);
  }
  return [...members.values()];
}

export function admit(presence: PresenceMember[], clientId: string, seatCap: number): boolean {
  const members = uniqueMembers(presence);
  const member = members.find((item) => item.clientId === clientId);
  if (!member) return false;
  if (member.role === "host") return true;
  const viewers = members.filter((item) => item.role === "viewer").sort((a, b) =>
    a.joinedAt - b.joinedAt || (a.clientId < b.clientId ? -1 : a.clientId > b.clientId ? 1 : 0));
  return viewers.findIndex((item) => item.clientId === clientId) < seatCap - 1;
}

export function seatUsage(presence: PresenceMember[], seatCap: number): { used: number; full: boolean } {
  const viewerCount = uniqueMembers(presence).filter((member) => member.role === "viewer").length;
  return { used: 1 + Math.min(viewerCount, seatCap - 1), full: viewerCount >= seatCap - 1 };
}
