import { useState, useEffect, useMemo } from 'react';
import type { Media } from '@/types/index';
import { getHiddenIds, saveHiddenIds, toggleHidden } from '@/lib/utils/hidden-media';

interface Props { allMedia: Media[] }

type FilterMode = 'all' | 'visible' | 'hidden';
type DivFilter  = 'all' | 'sight' | 'hearing';

export function MediaAdmin({ allMedia }: Props) {
  const [hidden,       setHidden]       = useState<Set<string>>(new Set());
  const [search,       setSearch]       = useState('');
  const [filterMode,   setFilterMode]   = useState<FilterMode>('all');
  const [divFilter,    setDivFilter]    = useState<DivFilter>('all');
  const [extraIds,     setExtraIds]     = useState('');
  const [saved,        setSaved]        = useState(false);
  const [mounted,      setMounted]      = useState(false);

  useEffect(() => {
    const ids = getHiddenIds();
    setHidden(ids);
    // Populate the extra-IDs textarea with any IDs not in allMedia
    const curatedIds = new Set(allMedia.map(m => m.id));
    const extra = [...ids].filter(id => !curatedIds.has(id));
    if (extra.length) setExtraIds(extra.join('\n'));
    setMounted(true);
  }, []);

  function toggle(id: string) {
    const next = toggleHidden(id);
    setHidden(new Set(next));
  }

  function hideAll() {
    const ids = getHiddenIds();
    allMedia.forEach(m => ids.add(m.id));
    saveHiddenIds(ids);
    setHidden(new Set(ids));
  }

  function showAll() {
    const ids = getHiddenIds();
    allMedia.forEach(m => ids.delete(m.id));
    saveHiddenIds(ids);
    setHidden(new Set(ids));
  }

  function saveExtraIds() {
    const curatedIds = new Set(allMedia.map(m => m.id));
    const extraParsed = extraIds.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean);
    // Keep existing curated hidden state; replace extra ids
    const ids = getHiddenIds();
    // Remove old extras
    [...ids].filter(id => !curatedIds.has(id)).forEach(id => ids.delete(id));
    // Add new extras
    extraParsed.forEach(id => ids.add(id));
    saveHiddenIds(ids);
    setHidden(new Set(ids));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function exportJson() {
    const data = JSON.stringify([...hidden], null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'hidden-media.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    if (!confirm('Clear all hidden IDs? This will make all media visible again.')) return;
    saveHiddenIds(new Set());
    setHidden(new Set());
    setExtraIds('');
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allMedia.filter(m => {
      if (divFilter !== 'all' && m.division !== divFilter) return false;
      if (filterMode === 'visible' && hidden.has(m.id)) return false;
      if (filterMode === 'hidden'  && !hidden.has(m.id)) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q) ||
        m.tags.some(t => t.toLowerCase().includes(q))
      );
    });
  }, [allMedia, hidden, search, filterMode, divFilter]);

  const hiddenCount  = allMedia.filter(m => hidden.has(m.id)).length;
  const visibleCount = allMedia.length - hiddenCount;
  const curatedIds   = new Set(allMedia.map(m => m.id));
  const extraHidden  = [...hidden].filter(id => !curatedIds.has(id)).length;

  if (!mounted) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-senses-text-3 text-sm animate-pulse">Loading…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-senses-bg text-senses-text">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-10">

        {/* Header */}
        <div className="mb-8 pb-6 border-b border-senses-border">
          <p className="text-senses-accent text-[10px] tracking-[0.3em] uppercase font-semibold mb-1">Admin</p>
          <h1 className="text-3xl font-light tracking-tight mb-2">Media Manager</h1>
          <p className="text-senses-text-3 text-sm">
            Hide media from search, galleries, and tag pages. Changes are saved immediately to this browser.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-6 mt-5">
            {[
              { label: 'Total curated',    value: allMedia.length,  color: 'text-senses-text' },
              { label: 'Visible',          value: visibleCount,     color: 'text-green-400' },
              { label: 'Hidden (curated)', value: hiddenCount,      color: 'text-senses-accent' },
              { label: 'Hidden (extra IDs)', value: extraHidden,    color: 'text-orange-400' },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p className={`text-2xl font-light ${color}`}>{value}</p>
                <p className="text-senses-text-3 text-[11px] uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <input
            type="text"
            placeholder="Search by title, tag, ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] bg-senses-surface border border-senses-border rounded-xl px-4 py-2 text-sm text-senses-text placeholder-senses-text-3 focus:outline-none focus:border-senses-accent/50"
          />

          {/* Filter mode */}
          <div className="flex rounded-xl border border-senses-border overflow-hidden text-xs">
            {(['all', 'visible', 'hidden'] as FilterMode[]).map(m => (
              <button
                key={m}
                onClick={() => setFilterMode(m)}
                className={`px-4 py-2 capitalize transition-colors ${
                  filterMode === m
                    ? 'bg-senses-surface-2 text-senses-text'
                    : 'text-senses-text-3 hover:text-senses-text'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Division filter */}
          <div className="flex rounded-xl border border-senses-border overflow-hidden text-xs">
            {(['all', 'sight', 'hearing'] as DivFilter[]).map(d => (
              <button
                key={d}
                onClick={() => setDivFilter(d)}
                className={`px-4 py-2 capitalize transition-colors ${
                  divFilter === d
                    ? 'bg-senses-surface-2 text-senses-text'
                    : 'text-senses-text-3 hover:text-senses-text'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={showAll}
              className="px-4 py-2 rounded-xl border border-senses-border text-xs text-senses-text-2 hover:border-green-400/40 hover:text-green-400 transition-all"
            >
              Show All
            </button>
            <button
              onClick={hideAll}
              className="px-4 py-2 rounded-xl border border-senses-border text-xs text-senses-text-2 hover:border-senses-accent/40 hover:text-senses-accent transition-all"
            >
              Hide All
            </button>
            <button
              onClick={exportJson}
              className="px-4 py-2 rounded-xl border border-senses-border text-xs text-senses-text-2 hover:border-senses-border-2 hover:text-senses-text transition-all"
            >
              Export JSON
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 rounded-xl border border-red-900/40 text-xs text-red-400/70 hover:border-red-500/40 hover:text-red-400 transition-all"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Results count */}
        <p className="text-senses-text-3 text-xs mb-4">
          Showing {filtered.length} of {allMedia.length} items
        </p>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-12">
          {filtered.map(m => {
            const isHidden = hidden.has(m.id);
            const thumb = m.thumbnail || (m.data as any)?.thumbnailUrl || '';
            return (
              <div
                key={m.id}
                onClick={() => toggle(m.id)}
                className={`relative group cursor-pointer rounded-xl border overflow-hidden transition-all duration-200 ${
                  isHidden
                    ? 'border-senses-accent/40 opacity-50 ring-1 ring-senses-accent/20'
                    : 'border-senses-border hover:border-senses-border-2'
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-senses-surface relative">
                  {thumb && (
                    <img
                      src={thumb}
                      alt={m.title}
                      loading="lazy"
                      className={`w-full h-full object-cover transition-opacity ${isHidden ? 'opacity-40' : 'opacity-100'}`}
                    />
                  )}

                  {/* Hidden overlay */}
                  {isHidden && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-senses-accent/20 backdrop-blur-sm rounded-full p-2">
                        <svg className="w-5 h-5 text-senses-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {isHidden ? '✓ Show' : '✕ Hide'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-2">
                  <p className={`text-xs font-medium truncate ${isHidden ? 'text-senses-text-3 line-through' : 'text-senses-text'}`}>
                    {m.title}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`text-[10px] capitalize ${
                      m.division === 'sight' ? 'text-senses-sight' : 'text-senses-hearing'
                    }`}>
                      {m.type}
                    </span>
                    <span className="text-[9px] text-senses-text-3 font-mono">{m.id}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <p className="text-senses-text-3 text-sm">No items match your filter.</p>
            </div>
          )}
        </div>

        {/* Extra IDs section */}
        <div className="border border-senses-border rounded-2xl p-6 mb-8">
          <h2 className="text-base font-medium mb-1">Block by ID</h2>
          <p className="text-senses-text-3 text-xs mb-4">
            Paste Pixabay item IDs you want to hide (one per line or comma-separated). Find an ID in the URL of any item page on the site.
          </p>
          <textarea
            value={extraIds}
            onChange={e => setExtraIds(e.target.value)}
            rows={6}
            placeholder={'pb-123456\npb-789012\n...'}
            className="w-full bg-senses-surface border border-senses-border rounded-xl px-4 py-3 text-sm text-senses-text placeholder-senses-text-3 font-mono focus:outline-none focus:border-senses-accent/50 resize-y"
          />
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={saveExtraIds}
              className="px-5 py-2 rounded-xl bg-senses-accent text-white text-xs font-medium hover:bg-senses-accent/90 transition-colors"
            >
              {saved ? '✓ Saved' : 'Save Block List'}
            </button>
            <p className="text-senses-text-3 text-xs">
              {extraHidden} extra ID{extraHidden !== 1 ? 's' : ''} blocked
            </p>
          </div>
        </div>

        {/* Note */}
        <div className="rounded-xl border border-senses-border/50 bg-senses-surface/50 p-4">
          <p className="text-senses-text-3 text-xs leading-relaxed">
            <strong className="text-senses-text-2">Note:</strong> Hidden items are removed from search results, tag pages,
            gallery wall, and suggested sections. Static pages (homepage, explore) are generated at build time and are
            not affected — redeploy the site to remove hidden items from those pages too.
          </p>
        </div>

      </div>
    </div>
  );
}
