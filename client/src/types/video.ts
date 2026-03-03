import type { NostrEvent } from '@nostrify/nostrify';

export interface Video {
  id: string;
  event: NostrEvent;
  name: string;
  url: string;
  duration: number;
  thumbnailUrl?: string;
  pubkey: string;
  publishedAt: number;
}

export interface SourceVideo extends Video {
  segments: VideoSegment[];
}

export interface VideoSegment {
  id: string;
  sourceVideoId: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface TimelineSegment extends VideoSegment {
  order: number;
  videoName: string;
  videoEventId: string;
}

export interface RemixData {
  segments: Array<{
    videoEventId: string;
    videoName: string;
    authorPubkey: string;
    startTime: number;
    endTime: number;
    duration: number;
    originalEvent: NostrEvent;
  }>;
  totalDuration: number;
}
