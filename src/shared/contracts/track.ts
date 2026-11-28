import type { Cover } from './cover';

export interface TrackArtist {
  id: string;
  name: string;
  kind?: 'artist' | 'uploader';
  verifiedArtist?: boolean;
}

export interface TrackAlbum {
  id: string;
  title: string;
}

export interface Track {
  id: string;
  title: string;
  artists: TrackArtist[];
  album?: TrackAlbum;
  durationMs: number;
  cover?: Cover;
  explicit?: boolean;
  musicVideoType?: string;
  source?: 'youtube' | 'youtube-music';
}

export interface ApiTrack extends Track {
  type?: 'track';
  viewer?: {
    liked: boolean;
  };
}

export interface TrackDetails extends Track {
  description?: string;
  releaseDate?: string;
  viewer?: {
    liked: boolean;
  };
  relatedTracks?: Track[];
}

export type ApiTrackDetails = TrackDetails;
