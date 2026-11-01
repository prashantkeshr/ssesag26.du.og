import { useState, useCallback, useEffect } from 'react';
import { MediaCard } from '@/components/media/MediaCard';
import type { Media } from '@/types/index';

interface Props {
  initialItems: Media[];
  photosStart:  number; // chunk index to fetch next for photos
  videosStart:  number;
  musicStart:   number;
}

const PAGE = 40;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchChunk(path: string): Promise<any[]> {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export function HomeDiscoverMore({ initialItems, photosStart, videosStart, musicStart }: Props) {
  const [items,      setItems]      = useState<Media[]>([]);
  const [photosChunk, setPhotosChunk] = useState(photosStart);
  const [videosChunk, setVideosChunk] = useState(videosStart);
  const [musicChunk,  setMusicChunk]  = useState(musicStart);
  const [loading,    setLoading]    = useState(false);
  const [exhausted,  setExhausted]  = useState(false);
  const [seenIds,    setSeenIds]    = useState<Set<string>>(new Set());

  // Client-side shuffle of initial items on mount so it's fresh every visit
  useEffect(() => {
    const seen = new Set(initialItems.map(m => m.id));
    setSeenIds(seen);
    setItems(shuffle(initialItems));
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || exhausted) return;
    setLoading(true);

    const [photos, videos, music] = await Promise.all([
      fetchChunk(`/data/pb/chunks/${photosChunk}.json`),
      fetchChunk(`/data/pb/videos/chunks/${videosChunk}.json`),
      fetchChunk(`/data/pb/music/chunks/${musicChunk}.json`),
    ]);

    const combined = shuffle([...photos, ...videos, ...music]);
    const fresh = combined.filter((m: any) => m.id && !seenIds.has(m.id));

    if (fresh.length === 0) {
      setExhausted(true);
      setLoading(false);
      return;
    }

    const page = fresh.slice(0, PAGE) as Media[];
    const newSeen = new Set(seenIds);
    page.forEach(m => newSeen.add(m.id));

    setItems(prev => [...prev, ...page]);
    setSeenIds(newSeen);
    if (photos.length > 0)  setPhotosChunk(c => c + 1);
    if (videos.length > 0)  setVideosChunk(c => c + 1);
    if (music.length > 0)   setMusicChunk(c => c + 1);
    if (photos.length === 0 && videos.length === 0 && music.length === 0) setExhausted(true);

    setLoading(false);
  }, [loading, exhausted, photosChunk, videosChunk, musicChunk, seenIds]);

  if (items.length === 0) return null;

  return (
    <section className="py-10 md:py-14">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 px-4 md:px-8">
        <div>
          <p className="text-senses-accent text-[10px] tracking-[0.3em] uppercase font-semibold mb-1">
            Random · Refreshed Every Visit
          </p>
          <h2 className="text-xl md:text-2xl font-light tracking-tight text-senses-text">
            Discover More
          </h2>
          <p className="text-senses-text-3 text-sm mt-0.5">
            Photos, videos, and music — mixed and shuffled for you
          </p>
        </div>
        <a
          href="/gallery"
          className="text-sm text-senses-text-3 hover:text-senses-text transition-colors flex-shrink-0 ml-4"
        >
          Full gallery →
        </a>
      </div>

      {/* Masonry grid */}
      <div className="masonry-grid px-4 md:px-8">
        {items.map(m => (
          <MediaCard key={m.id} media={m} layout="masonry" />
        ))}
      </div>

      {/* Footer — count + load more */}
      <div className="mt-10 flex flex-col items-center gap-3 px-4">
        <p className="text-senses-text-3 text-xs tabular-nums">
          {items.length} items shown
        </p>
        {!exhausted ? (
          <button
            onClick={loadMore}
            disabled={loading}
            className="group relative px-10 py-3.5 rounded-2xl border border-senses-border text-senses-text-2 text-sm
                       hover:border-senses-accent/40 hover:text-senses-text hover:bg-senses-surface
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                       overflow-hidden"
          >
            {/* Neon shimmer on hover */}
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,45,85,0.08), transparent)' }}
            />
            <span className="relative">
              {loading
                ? <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Loading…
                  </span>
                : 'Discover 40 More'
              }
            </span>
          </button>
        ) : (
          <p className="text-senses-text-3 text-xs py-2 italic">You've reached the end — check the gallery for more</p>
        )}
      </div>
    </section>
  );
}
