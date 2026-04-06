export type MediaEmbedProvider = 'youtube' | 'vimeo' | 'spotify' | 'soundcloud';

export type MediaEmbedMatch = {
  provider: MediaEmbedProvider;
  embedUrl: string;
  originalUrl: string;
};

export const isMediaEmbedProvider = (value: unknown): value is MediaEmbedProvider =>
  value === 'youtube' || value === 'vimeo' || value === 'spotify' || value === 'soundcloud';

const normalizeHostname = (hostname: string): string => hostname.trim().toLowerCase().replace(/^www\./, '');

const readYouTubeVideoId = (url: URL): string | null => {
  const hostname = normalizeHostname(url.hostname);
  const pathSegments = url.pathname.split('/').filter(Boolean);

  if (hostname === 'youtu.be') {
    const candidate = pathSegments[0];
    return candidate ? candidate : null;
  }

  if (hostname !== 'youtube.com' && hostname !== 'm.youtube.com') {
    return null;
  }

  if (url.pathname === '/watch') {
    const videoId = url.searchParams.get('v');
    return videoId && videoId.trim() ? videoId.trim() : null;
  }

  if (pathSegments[0] === 'shorts' || pathSegments[0] === 'embed') {
    const candidate = pathSegments[1];
    return candidate ? candidate : null;
  }

  return null;
};

const matchYouTubeEmbed = (url: URL, originalUrl: string): MediaEmbedMatch | null => {
  const videoId = readYouTubeVideoId(url);
  if (!videoId) {
    return null;
  }

  return {
    provider: 'youtube',
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    originalUrl,
  };
};

const matchVimeoEmbed = (url: URL, originalUrl: string): MediaEmbedMatch | null => {
  const hostname = normalizeHostname(url.hostname);
  if (hostname !== 'vimeo.com') {
    return null;
  }

  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length !== 1 || !/^\d+$/.test(pathSegments[0])) {
    return null;
  }

  return {
    provider: 'vimeo',
    embedUrl: `https://player.vimeo.com/video/${pathSegments[0]}`,
    originalUrl,
  };
};

const matchSpotifyEmbed = (url: URL, originalUrl: string): MediaEmbedMatch | null => {
  const hostname = normalizeHostname(url.hostname);
  if (hostname !== 'open.spotify.com') {
    return null;
  }

  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length < 2) {
    return null;
  }

  const [resourceType, resourceId] = pathSegments;
  if (!['track', 'album', 'playlist', 'episode'].includes(resourceType) || !resourceId) {
    return null;
  }

  return {
    provider: 'spotify',
    embedUrl: `https://open.spotify.com/embed/${resourceType}/${resourceId}`,
    originalUrl,
  };
};

const matchSoundCloudEmbed = (url: URL, originalUrl: string): MediaEmbedMatch | null => {
  const hostname = normalizeHostname(url.hostname);
  if (hostname !== 'soundcloud.com') {
    return null;
  }

  const pathSegments = url.pathname.split('/').filter(Boolean);
  const isTrack = pathSegments.length === 2;
  const isPlaylist = pathSegments.length === 3 && pathSegments[1] === 'sets';
  if (!isTrack && !isPlaylist) {
    return null;
  }

  return {
    provider: 'soundcloud',
    embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(originalUrl)}`,
    originalUrl,
  };
};

export const matchMediaEmbed = (candidate: string): MediaEmbedMatch | null => {
  const originalUrl = candidate.trim();
  if (!originalUrl || /\s/.test(originalUrl)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }

  return (
    matchYouTubeEmbed(url, originalUrl)
    || matchVimeoEmbed(url, originalUrl)
    || matchSpotifyEmbed(url, originalUrl)
    || matchSoundCloudEmbed(url, originalUrl)
  );
};

export const resolveSerializedMediaEmbed = (
  provider: unknown,
  embedUrl: string,
  originalUrl: string,
): MediaEmbedMatch | null => {
  if (!isMediaEmbedProvider(provider)) {
    return null;
  }

  const match = matchMediaEmbed(originalUrl);
  if (!match || match.provider !== provider) {
    return null;
  }

  if (match.embedUrl !== embedUrl.trim()) {
    return match;
  }

  return match;
};
