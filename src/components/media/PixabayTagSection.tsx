import { useState, useEffect } from 'react';
import { MediaCard } from './MediaCard';
import type { Media } from '@/types/index';
import { useHiddenMedia } from '@/lib/hooks/useHiddenMedia';

interface Props {
  tagSlug:  string;
  tagLabel: string;
}

function itemToMedia(item: Record<string, unknown>): Media {
  return {
    id:           item.id as string,
    type:         item.type as Media['type'],
    division:     'sight',
    slug:         item.slug as string,
    title:        item.title as string,
    description:  `Free ${item.type as string} — royalty-free download, no attribution required.`,
    creator:      '',
    thumbnail:    item.thumbnail as string,
    category:     'nature',
    tags:         (item.tags as string[]) ?? [],
    moods:        [],
    styles:       [],
    colors:       [],
    orientation:  (item.orientation as Media['orientation']) ?? 'landscape',
    license:      'pixabay',
    attribution:  '',
    source:       'pixabay',
    featured:     false,
    trending:     (item.views as number) > 50000,
    editorsPick:  false,
    stats:        { views: (item.views as number) ?? 0, downloads: 0, likes: 0, saves: 0, comments: 0 },
    createdAt:    '',
    updatedAt:    '',
    seo:          { title: item.title as string, description: '', keywords: (item.tags as string[]) ?? [] },
    data: {
      width:        640,
      height:       480,
      aspectRatio:  '4:3',
      format:       'jpg',
      thumbnailUrl: item.thumbnail as string,
      previewUrl:   (item.previewUrl as string) ?? (item.thumbnail as string),
      fullUrl:      (item.previewUrl as string) ?? (item.thumbnail as string),
      altText:      `Free ${item.title as string} — royalty-free`,
      colors:       [],
    },
  } as unknown as Media;
}

export function PixabayTagSection({ tagSlug, tagLabel }: Props) {
  const [items, setItems]   = useState<Media[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);
  const hiddenIds = useHiddenMedia();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/data/pb/tags/${tagSlug}.json`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (cancelled) return;
        setItems((data.items ?? []).map(itemToMedia));
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [tagSlug]);

  const visibleItems = hiddenIds.size > 0 ? items.filter(m => !hiddenIds.has(m.id)) : items;

  if (loading) {
    return (
      <div className="py-10">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-2 h-2 rounded-full bg-senses-sight animate-pulse" />
          <p className="text-senses-sight text-xs tracking-widest uppercase font-medium">
            Free {tagLabel} Images
          </p>
        </div>
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="break-inside-avoid rounded-xl bg-senses-surface animate-pulse aspect-[4/3]" />
          ))}
        </div>
      </div>
    );
  }

  if (error || visibleItems.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-senses-sight" />
          <h2 className="text-senses-sight text-xs tracking-widest uppercase font-medium">
            Free {tagLabel} Images
          </h2>
        </div>
        {total > visibleItems.length && (
          <p className="text-senses-text-3 text-xs">
            Showing {visibleItems.length} of {total.toLocaleString()} free {tagLabel} images
          </p>
        )}
      </div>
      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
        {visibleItems.map(m => (
          <div key={m.id} className="break-inside-avoid">
            <MediaCard media={m} layout="masonry" />
          </div>
        ))}
      </div>
    </section>
  );
}
