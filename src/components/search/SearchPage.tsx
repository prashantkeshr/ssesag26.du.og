import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import type { Media, Creator, MediaDivision, MediaType } from '@/types/index';
import { MediaCard } from '@/components/media/MediaCard';
import { mediaTypeLabel, formatCount } from '@/lib/utils/formatters';
import { addSearchHistory } from '@/lib/utils/localState';

// Converts a raw tag-file item into the Media shape SearchPage can render
function tagItemToMedia(item: any): Media {
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

interface Props {
  media:    Media[];
  creators: Creator[];
}

type SortKey = 'relevance' | 'latest' | 'trending' | 'popular';

const SIGHT_TYPES:   MediaType[] = ['photo', 'video', 'illustration', 'vector', '3d', 'gif'];
const HEARING_TYPES: MediaType[] = ['music', 'sound', 'ambient', 'loop'];

const TYPE_LABELS: Partial<Record<MediaType, string>> = {
  photo: 'Photos', video: 'Videos', illustration: 'Illustrations',
  music: 'Music',  sound: 'Sounds',  ambient: 'Ambient', loop: 'Lo-Fi',
};

function SearchIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

const SEARCH_PAGE = 24;

export function SearchPage({ media, creators }: Props) {
  const [query,       setQuery]       = useState('');
  const [division,    setDivision]    = useState<MediaDivision | 'all'>('all');
  const [typeFilter,  setTypeFilter]  = useState<MediaType | 'all'>('all');
  const [sort,        setSort]        = useState<SortKey>('relevance');
  const [mounted,     setMounted]     = useState(false);
  const [sightPage,   setSightPage]   = useState(1);
  const [hearingPage, setHearingPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pixabay library augmentation state
  const [pbItems,   setPbItems]   = useState<Media[]>([]);
  const [pbLoading, setPbLoading] = useState(false);
  const [pbTotal,   setPbTotal]   = useState(0);
  const [pbTagSlug, setPbTagSlug] = useState('');

  const creatorMap = useMemo(
    () => Object.fromEntries(creators.map(c => [c.id, c])),
    [creators]
  );

  const fuse = useMemo(() => new Fuse(media, {
    keys: [
      { name: 'title',       weight: 3   },
      { name: 'description', weight: 2   },
      { name: 'tags',        weight: 2   },
      { name: 'moods',       weight: 1   },
      { name: 'styles',      weight: 1   },
      { name: 'category',    weight: 1.5 },
    ],
    threshold: 0.35,
    includeScore: true,
  }), [media]);

  // Bootstrap from URL params once mounted
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q   = p.get('q')        ?? '';
    const div = p.get('division') as MediaDivision | null;
    const typ = p.get('type')     as MediaType | null;
    const srt = p.get('sort')     as SortKey | null;
    setQuery(q);
    if (div) setDivision(div);
    if (typ) setTypeFilter(typ);
    if (srt) setSort(srt);
    setMounted(true);
    if (q) addSearchHistory(q);
  }, []);

  // Sync URL
  useEffect(() => {
    if (!mounted) return;
    const p = new URLSearchParams();
    if (query)              p.set('q',        query);
    if (division !== 'all') p.set('division', division);
    if (typeFilter !== 'all') p.set('type',   typeFilter);
    if (sort !== 'relevance') p.set('sort',   sort);
    const newUrl = `${window.location.pathname}${p.toString() ? '?' + p.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [query, division, typeFilter, sort, mounted]);

  // Reset type filter and pagination when division changes
  const handleDivision = useCallback((d: MediaDivision | 'all') => {
    setDivision(d);
    setTypeFilter('all');
    setSightPage(1);
    setHearingPage(1);
  }, []);

  const results = useMemo(() => {
    let items: Media[];
    if (!query.trim()) {
      items = [...media];
    } else {
      items = fuse.search(query).map(r => r.item);
    }
    if (division !== 'all')   items = items.filter(m => m.division === division);
    if (typeFilter !== 'all') items = items.filter(m => m.type === typeFilter);

    if (sort === 'latest')   return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (sort === 'trending')  return [...items].sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || b.stats.views - a.stats.views);
    if (sort === 'popular')   return [...items].sort((a, b) => b.stats.views - a.stats.views);
    // relevance: fuse order when querying, otherwise trending-first
    if (!query.trim()) return [...items].sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0));
    return items;
  }, [query, division, typeFilter, sort, fuse, media]);

  const sightResults   = useMemo(() => results.filter(m => m.division === 'sight'),   [results]);
  const hearingResults = useMemo(() => results.filter(m => m.division === 'hearing'), [results]);

  // Reset pagination when results change
  useEffect(() => { setSightPage(1); setHearingPage(1); }, [query, division, typeFilter, sort]);

  // Debounced Pixabay tag fetch — augments curated results with full library
  useEffect(() => {
    if (!mounted) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setPbItems([]); setPbTotal(0); setPbTagSlug(''); setPbLoading(false);
      return;
    }
    let cancelled = false;
    const slug = trimmed.toLowerCase().replace(/\s+/g, '-');
    const slugs = [slug, ...(slug.includes('-') ? [slug.split('-')[0]] : [])];

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setPbLoading(true);
      for (const s of slugs) {
        try {
          const res = await fetch(`/data/pb/tags/${encodeURIComponent(s)}.json`);
          if (!res.ok || cancelled) continue;
          const data = await res.json();
          if (cancelled) return;
          setPbItems((data.items ?? []).map(tagItemToMedia));
          setPbTotal(data.total ?? 0);
          setPbTagSlug(s);
          setPbLoading(false);
          return;
        } catch {}
      }
      if (!cancelled) { setPbItems([]); setPbTotal(0); setPbTagSlug(''); setPbLoading(false); }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, mounted]);

  const availableTypes = useMemo(() => {
    const base = division === 'all' ? media : media.filter(m => m.division === division);
    return [...new Set(base.map(m => m.type))];
  }, [media, division]);

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'relevance', label: 'Relevance' },
    { key: 'latest',    label: 'Latest'    },
    { key: 'trending',  label: 'Trending'  },
    { key: 'popular',   label: 'Popular'   },
  ];

  // No-query suggestions
  const suggestions = ['mountains', 'rain', 'lo-fi', 'ocean', 'minimal', 'city night', 'cinematic', 'ambient'];

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-32 text-senses-text-3 text-sm">
        <SearchIcon className="w-5 h-5 mr-2 opacity-50" />
        <span>Loading search…</span>
      </div>
    );
  }

  return (
    <div>
      {/* ── Search input ─────────────────────────────────────── */}
      <div className="mb-6">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-senses-text-3 pointer-events-none">
            <SearchIcon className="w-5 h-5" />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); inputRef.current?.blur(); } }}
            placeholder="Search photos, sounds, music, moods, creators…"
            className="w-full bg-senses-surface border border-senses-border rounded-2xl pl-12 pr-12 py-4 text-senses-text text-base placeholder:text-senses-text-3 outline-none focus:border-senses-border-2 transition-colors"
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-senses-text-3 hover:text-senses-text transition-colors"
              aria-label="Clear"
            >
              <XIcon />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-6 pb-6 border-b border-senses-border">
        {/* Division */}
        <div className="flex gap-1 p-1 rounded-xl bg-senses-surface border border-senses-border">
          {(['all', 'sight', 'hearing'] as const).map(d => (
            <button
              key={d}
              onClick={() => handleDivision(d)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                division === d
                  ? d === 'sight'   ? 'bg-senses-sight   text-senses-bg'
                  : d === 'hearing' ? 'bg-senses-hearing text-senses-bg'
                  :                   'bg-senses-surface-3 text-senses-text'
                  : 'text-senses-text-3 hover:text-senses-text'
              }`}
            >
              {d === 'all' ? 'All' : d === 'sight' ? 'SIGHT' : 'HEARING'}
            </button>
          ))}
        </div>

        {/* Type chips */}
        {availableTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {availableTypes.map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                  typeFilter === t
                    ? 'bg-senses-surface-3 border-senses-border-2 text-senses-text'
                    : 'bg-transparent border-senses-border text-senses-text-3 hover:text-senses-text hover:border-senses-border-2'
                }`}
              >
                {TYPE_LABELS[t] ?? mediaTypeLabel(t)}
              </button>
            ))}
          </div>
        )}

        {/* Sort */}
        <div className="ml-auto flex gap-1">
          {SORTS.map(s => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all border ${
                sort === s.key
                  ? 'bg-senses-surface-3 border-senses-border-2 text-senses-text'
                  : 'bg-transparent border-transparent text-senses-text-3 hover:text-senses-text'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── No-query state ───────────────────────────────────── */}
      {!query.trim() && (
        <div className="mb-8">
          <p className="text-senses-text-3 text-sm mb-3">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => { setQuery(s); addSearchHistory(s); }}
                className="px-4 py-2 rounded-full bg-senses-surface border border-senses-border text-senses-text-3 text-sm hover:text-senses-text hover:border-senses-border-2 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Results header ───────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-senses-text-2 text-sm">
          {query.trim()
            ? <>
                <span className="text-senses-text font-medium">
                  {results.length + pbItems.length}
                  {pbTotal > pbItems.length ? '+' : ''}
                </span>
                {' '}{results.length + pbItems.length === 1 ? 'result' : 'results'} for{' '}
                <span className="text-senses-accent">"{query}"</span>
              </>
            : <>Explore millions of free photos, videos &amp; music</>
          }
        </p>
        {(results.length > 0 || pbItems.length > 0) && (
          <p className="text-senses-text-3 text-xs flex items-center gap-1">
            {sightResults.length > 0 && <span className="text-senses-sight">{sightResults.length} visual</span>}
            {sightResults.length > 0 && hearingResults.length > 0 && <span className="opacity-30">·</span>}
            {hearingResults.length > 0 && <span className="text-senses-hearing">{hearingResults.length} audio</span>}
            {pbItems.length > 0 && (sightResults.length + hearingResults.length > 0) && <span className="opacity-30">·</span>}
            {pbItems.length > 0 && <span>{pbTotal.toLocaleString()}+ in library</span>}
          </p>
        )}
      </div>

      {/* ── Empty results ────────────────────────────────────── */}
      {results.length === 0 && pbItems.length === 0 && !pbLoading && query.trim() && (
        <div className="py-24 text-center">
          <SearchIcon className="w-10 h-10 mx-auto text-senses-text-3 opacity-30 mb-4" />
          <p className="text-senses-text-2 text-lg mb-2">No results for "{query}"</p>
          <p className="text-senses-text-3 text-sm mb-6">Try different words, or explore by browsing below.</p>
          <button
            onClick={() => setQuery('')}
            className="px-5 py-2.5 rounded-xl bg-senses-surface border border-senses-border text-senses-text-2 text-sm hover:border-senses-border-2 transition-all"
          >
            Clear search
          </button>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────── */}
      {results.length > 0 && (
        <>
          {/* SIGHT section */}
          {(division === 'all' || division === 'sight') && sightResults.length > 0 && (
            <section className="mb-12">
              {division === 'all' && (
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-senses-sight" />
                  <h2 className="text-senses-sight text-xs tracking-widest uppercase font-medium">
                    Visual · {sightResults.length} {sightResults.length === 1 ? 'item' : 'items'}
                  </h2>
                </div>
              )}
              <div className="masonry-grid">
                {sightResults.slice(0, sightPage * SEARCH_PAGE).map(item => (
                  <MediaCard key={item.id} media={item} creator={creatorMap[item.creator]} />
                ))}
              </div>
              {sightPage * SEARCH_PAGE < sightResults.length && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setSightPage(p => p + 1)}
                    className="px-6 py-2.5 rounded-xl bg-senses-surface border border-senses-border text-senses-text-2 hover:border-senses-border-2 hover:text-senses-text text-sm transition-all"
                  >
                    View more · {sightResults.length - sightPage * SEARCH_PAGE} remaining
                  </button>
                </div>
              )}
            </section>
          )}

          {/* HEARING section */}
          {(division === 'all' || division === 'hearing') && hearingResults.length > 0 && (
            <section className="mb-12">
              {division === 'all' && (
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-senses-hearing" />
                  <h2 className="text-senses-hearing text-xs tracking-widest uppercase font-medium">
                    Audio · {hearingResults.length} {hearingResults.length === 1 ? 'item' : 'items'}
                  </h2>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {hearingResults.slice(0, hearingPage * SEARCH_PAGE).map(item => (
                  <MediaCard key={item.id} media={item} creator={creatorMap[item.creator]} layout="grid" />
                ))}
              </div>
              {hearingPage * SEARCH_PAGE < hearingResults.length && (
                <div className="text-center mt-8">
                  <button
                    onClick={() => setHearingPage(p => p + 1)}
                    className="px-6 py-2.5 rounded-xl bg-senses-surface border border-senses-border text-senses-text-2 hover:border-senses-border-2 hover:text-senses-text text-sm transition-all"
                  >
                    View more · {hearingResults.length - hearingPage * SEARCH_PAGE} remaining
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ── Pixabay library results ──────────────────────────────── */}
          {query.trim() && (pbLoading || pbItems.length > 0) && (division === 'all' || division === 'sight') && (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-senses-sight ${pbLoading ? 'animate-pulse' : ''}`} />
                  <h2 className="text-senses-sight text-xs tracking-widest uppercase font-medium">
                    {pbLoading
                      ? 'Searching library…'
                      : `Free ${query.trim()} images — ${pbTotal.toLocaleString()}+ available`}
                  </h2>
                </div>
                {!pbLoading && pbTagSlug && (
                  <a
                    href={`/tag/${pbTagSlug}`}
                    className="text-xs text-senses-text-3 hover:text-senses-text transition-colors flex-shrink-0 ml-4"
                  >
                    View all {pbTotal.toLocaleString()} →
                  </a>
                )}
              </div>
              <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3">
                {pbLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="break-inside-avoid rounded-xl bg-senses-surface animate-pulse aspect-[4/3]" />
                    ))
                  : pbItems.map(m => (
                      <div key={m.id} className="break-inside-avoid">
                        <MediaCard media={m} layout="masonry" />
                      </div>
                    ))
                }
              </div>
              {!pbLoading && pbTagSlug && pbTotal > pbItems.length && (
                <div className="mt-6 text-center">
                  <a
                    href={`/tag/${pbTagSlug}`}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl border border-senses-border text-senses-text-2 text-sm hover:border-senses-accent/40 hover:text-senses-text transition-all"
                  >
                    Browse all {pbTotal.toLocaleString()} free {query.trim()} images →
                  </a>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
