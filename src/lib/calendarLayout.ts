// Lays out same-day events the way Google Calendar does: events that overlap
// in time share the available width side-by-side instead of stacking, while
// non-overlapping events each take the full width.
export interface TimedEvent {
  startsAt: string;
  endsAt: string;
}

export interface LaidOutEvent<T> {
  event: T;
  lane: number;
  lanesInCluster: number;
}

export function layoutOverlappingEvents<T extends TimedEvent>(events: T[]): LaidOutEvent<T>[] {
  const sorted = events
    .map((event) => ({
      event,
      start: new Date(event.startsAt).getTime(),
      end: new Date(event.endsAt).getTime(),
    }))
    // Longer events first among same-start ties, so they end up in the left-most lane.
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: LaidOutEvent<T>[] = [];

  // A "cluster" is a maximal run of mutually-touching events. laneEndTimes[i]
  // tracks when lane i is next free, scoped to the current cluster.
  let cluster: { event: T; lane: number }[] = [];
  let laneEndTimes: number[] = [];
  let clusterMaxEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    const lanesInCluster = laneEndTimes.length;
    for (const c of cluster) result.push({ event: c.event, lane: c.lane, lanesInCluster });
    cluster = [];
    laneEndTimes = [];
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterMaxEnd) {
      flushCluster();
      clusterMaxEnd = -Infinity;
    }

    let lane = laneEndTimes.findIndex((endTime) => endTime <= item.start);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(item.end);
    } else {
      laneEndTimes[lane] = item.end;
    }

    cluster.push({ event: item.event, lane });
    clusterMaxEnd = Math.max(clusterMaxEnd, item.end);
  }
  flushCluster();

  return result;
}
