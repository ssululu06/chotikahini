// In-memory active visitor tracker (visitorId -> timestamp)
const activeVisitors = new Map<string, number>();

export function recordActiveVisitor(visitorId: string): number {
  const now = Date.now();
  activeVisitors.set(visitorId, now);

  const fiveMinsAgo = now - 5 * 60 * 1000;
  for (const [id, timestamp] of activeVisitors.entries()) {
    if (timestamp < fiveMinsAgo) {
      activeVisitors.delete(id);
    }
  }

  return getActiveVisitorsCount();
}

export function getActiveVisitorsCount(): number {
  const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
  let count = 0;
  for (const [, timestamp] of activeVisitors.entries()) {
    if (timestamp >= fiveMinsAgo) count++;
  }
  return Math.max(count, 1);
}
