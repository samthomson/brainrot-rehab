export const REMIX_SEGMENT_TAG = 'segment';

export interface RemixSegmentMeta {
  order: number;
  eventId: string;
  startTime: number;
  endTime: number;
  authorPubkey?: string;
}

export function buildRemixSegmentTags(segments: RemixSegmentMeta[]): string[][] {
  return segments.map((segment) => {
    const base = [
      REMIX_SEGMENT_TAG,
      String(segment.order),
      segment.eventId,
      String(segment.startTime),
      String(segment.endTime),
    ];
    return segment.authorPubkey ? [...base, segment.authorPubkey] : base;
  });
}

export function parseRemixSegmentTags(tags: string[][]): RemixSegmentMeta[] {
  const parsed: RemixSegmentMeta[] = [];
  for (const tag of tags) {
    if (tag[0] !== REMIX_SEGMENT_TAG) continue;
    const order = Number(tag[1]);
    const eventId = tag[2];
    const startTime = Number(tag[3]);
    const endTime = Number(tag[4]);
    if (!eventId) continue;
    if (!Number.isFinite(order) || !Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
    parsed.push({
      order,
      eventId,
      startTime,
      endTime,
      authorPubkey: tag[5] || undefined,
    });
  }
  parsed.sort((a, b) => a.order - b.order);
  return parsed;
}
