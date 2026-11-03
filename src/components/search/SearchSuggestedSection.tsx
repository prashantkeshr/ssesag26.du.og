import { useState, useEffect, useRef, useCallback } from 'react';
import { MediaCard } from '@/components/media/MediaCard';
import type { Media } from '@/types/index';

interface Props {
  query:          string;
  primaryTagSlug: string;
  excludeIds:     string[];
}

const PAGE = 30;

function rawToMedia(item: any): Media {
  return {
    id: item.id, type: (item.type ?? 'photo') as Media['type'],
    division: 'sight', slug: item.slug, title: item.title,
    description: `Free ${item.type ?? 'photo'} — royalty-free, no attribution required.`,
    creator: '', thumbnail: item.thumbnail, category: 'general',
    tags: Array.isArray(item.tags) ? item.tags : [],
    moods: [], styles: [], colors: [],
    orientation: (item.orientation ?? 'landscape') as Media['orientation'],
    license: 'pixabay' as any, attribution: '', source: 'pixabay',
    featured: false, trending: (item.views ?? 0) > 50000, editorsPick: false,
    stats: { views: item.views ?? 0, downloads: 0, likes: 0, saves: 0 },
    createdAt: '', updatedAt: '',
    seo: { title: item.title, description: '', keywords: Array.isArray(item.tags) ? item.tags : [] },
    data: {
      width: item.thumbnailWidth ?? 640, height: item.thumbnailHeight ?? 480,
      aspectRatio: '4:3', format: 'jpg',
      thumbnailUrl: item.thumbnail, previewUrl: item.previewUrl ?? item.thumbnail,
      fullUrl: item.previewUrl ?? item.thumbnail,
      altText: `Free ${item.title} — royalty-free`, colors: [],
    },
  } as unknown as Media;
}

// Extract co-occurring tags sorted by frequency, excluding the primary slug
function getRelatedTags(items: any[], skipSlug: string): string[] {
  const freq = new Map<string, number>();
  for (const item of items) {
    for (const tag of (item.tags ?? [])) {
      const s = (tag as string).toLowerCase().replace(/\s+/g, '-');
      if (s === skipSlug || s.length < 3) continue;
      freq.set(s, (freq.get(s) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([s]) => s);
}

export function SearchSuggestedSection({ query, primaryTagSlug, excludeIds }: Props) {
  const [items,     setItems]     = useState<Media[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [label,     setLabel]     = useState('');

  // Mutable refs — queue/buffer/seenIds don't need re-renders
  const tagQueueRef = useRef<string[]>([]);
  const bufRef      = useRef<Media[]>([]);
  const seenRef     = useRef<Set<string>>(new Set());

  // Drain one tag file into the buffer, skip 404s silently
  async function drainTag(tag: string): Promise<void> {
    try {
      const res = await fetch(`/data/pb/tags/${encodeURIComponent(tag)}.json`);
      if (!res.ok) return;
      const data = await res.json();
      const fresh = (data.items ?? [])
        .map(rawToMedia)
        .filter((m: Media) => !seenRef.current.has(m.id));
      bufRef.current.push(...fresh);
    } catch {}
  }

  // Fill buffer to at least PAGE items, then splice out one batch and append to state
  async function fillAndShow(): Promise<boolean> {
    while (bufRef.current.length < PAGE && tagQueueRef.current.length > 0) {
      const tag = tagQueueRef.current.shift()!;
      await drainTag(tag);
    }
    const batch = bufRef.current.splice(0, PAGE);
    batch.forEach(m => seenRef.current.add(m.id));
    if (batch.length === 0) {
      setExhausted(true);
      return false;
    }
    setItems(prev => [...prev, ...batch]);
    if (tagQueueRef.current.length === 0 && bufRef.current.length === 0) {
      setExhausted(true);
    }
    return true;
  }

  // Initialise / reset when the searched tag changes
  useEffect(() => {
    if (!primaryTagSlug) return;
    let cancelled = false;

    setItems([]);
    setLoading(true);
    setExhausted(false);
    setLabel('');
    tagQueueRef.current = [];
    bufRef.current      = [];
    seenRef.current     = new Set(excludeIds);

    fetch(`/data/pb/tags/${encodeURIComponent(primaryTagSlug)}.json`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(async data => {
        if (cancelled) return;
        const related = getRelatedTags(data.items ?? [], primaryTagSlug);
        if (related.length === 0) {
          setExhausted(true);
          setLoading(false);
          return;
        }
        tagQueueRef.current = related;
        setLabel(related.slice(0, 3).map(t => t.replace(/-/g, ' ')).join(' · '));
        await fillAndShow();
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setExhausted(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [primaryTagSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (loading || exhausted) return;
    setLoading(true);
    await fillAndShow();
    setLoading(false);
  }, [loading, exhausted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Nothing to show yet and not loading → render nothing
  if (!primaryTagSlug || (items.length === 0 && !loading)) return null;

  return (
    <section className="mb-12 pt-10 border-t border-senses-border">

      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-senses-accent text-[10px] tracking-[0.3em] uppercase font-semibold mb-1">
            Related to {query}
          </p>
          <h2 className="text-xl md:text-2xl font-light tracking-tight text-senses-text">
            You Might Also Like
          </h2>
          {label && (
            <p className="text-senses-text-3 text-xs mt-1 capitalize">{label}</p>
          )}
        </div>
        {items.length > 0 && (
          <p className="text-senses-text-3 text-xs flex-shrink-0 ml-4">
            {items.length} items shown
          </p>
        )}
      </div>

      {/* Masonry grid */}
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
        {items.map(m => (
          <div key={m.id} className="break-inside-avoid">
            <MediaCard media={m} layout="masonry" />
          </div>
        ))}
        {loading && Array.from({ length: 10 }).map((_, i) => (
          <div
            key={`skel-${i}`}
            className={`break-inside-avoid rounded-xl bg-senses-surface animate-pulse ${
              i % 3 === 0 ? 'aspect-[3/4]' : i % 3 === 1 ? 'aspect-[4/3]' : 'aspect-square'
            }`}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col items-center gap-3">
        {!exhausted ? (
          <button
            onClick={loadMore}
            disabled={loading}
            className="group relative px-10 py-3.5 rounded-2xl border border-senses-border text-senses-text-2 text-sm
                       hover:border-senses-accent/40 hover:text-senses-text hover:bg-senses-surface
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
          >
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,45,85,0.08), transparent)' }}
            />
            <span className="relative flex items-center gap-2">
              {loading
                ? <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Loading more…
                  </>
                : 'Load 30 More'
              }
            </span>
          </button>
        ) : (
          items.length > 0 && (
            <p className="text-senses-text-3 text-xs py-2 italic">
              You've seen it all — {items.length} related items found
            </p>
          )
        )}
      </div>

    </section>
  );
}
