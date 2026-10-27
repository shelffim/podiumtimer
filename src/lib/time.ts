export function computeOffset(serverNow: number, requestedAt: number, receivedAt: number): number {
  return serverNow + (receivedAt - requestedAt) / 2 - receivedAt;
}
