import { useState, useEffect, useRef, useCallback } from 'react';
import type { Media, Creator, ImageData, AudioData, VideoData } from '@/types/index';
import { toggleLike, toggleSave, getLocalState } from '@/lib/utils/localState';
import { formatCount } from '@/lib/utils/formatters';
import { ShareModal } from '@/components/ui/ShareModal';
import { downloadFile } from '@/lib/utils/download';

interface MusicTrack {
  id: string;
  title: string;
  creatorName: string;
  artworkUrl: string;
  streamUrl: string;
}

interface Props {
  media:    Media[];
  creators: Creator[];
  musicPool: MusicTrack[];
}

// ── Shuffle ────────────────────────────────────────────────────────────────────

function randomShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function interleave<T extends { division?: string }>(arr: T[]): T[] {
  const sight   = arr.filter(m => m.division !== 'hearing');
  const hearing = arr.filter(m => m.division === 'hearing');
  const result: T[] = [];
  const maxLen = Math.max(sight.length, hearing.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < sight.length)   result.push(sight[i]);
    if (i < hearing.length) result.push(hearing[i]);
  }
  return result;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function HeartIcon({ filled, className = 'w-5 h-5' }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z"/>
    </svg>
  );
}

function UnmuteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"/>
    </svg>
  );
}

function PortraitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <rect x="7" y="2" width="10" height="20" rx="2"/>
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
    </svg>
  );
}

// ── Spinning vinyl disc for Now Playing ───────────────────────────────────────

function VinylDisc({ artworkUrl, spinning }: { artworkUrl: string; spinning: boolean }) {
  return (
    <div
      className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex-shrink-0 relative"
      style={{
        animation: spinning ? 'senses-spin 3s linear infinite' : 'none',
        boxShadow: spinning ? '0 0 8px rgba(143,174,192,0.4)' : 'none',
      }}
    >
      <img src={artworkUrl} alt="" className="w-full h-full object-cover" />
      <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,0,0,0.4) 25%, transparent 50%)' }} />
    </div>
  );
}

// ── Now Playing strip ─────────────────────────────────────────────────────────

function NowPlaying({ track, isActive, isAudio }: {
  track: MusicTrack | null;
  isActive: boolean;
  isAudio: boolean;
}) {
  if (!track) return null;
  const label = isAudio ? `Original sound · ${track.title}` : `♪ ${track.title} · ${track.creatorName}`;
  return (
    <div className="flex items-center gap-2 mt-2.5 overflow-hidden">
      <style>{`@keyframes senses-spin { to { transform: rotate(360deg); } } @keyframes senses-scroll { 0%,20% { transform: translateX(0); } 80%,100% { transform: translateX(-50%); } }`}</style>
      <VinylDisc artworkUrl={track.artworkUrl} spinning={isActive} />
      <div className="overflow-hidden flex-1 min-w-0">
        <div
          className="whitespace-nowrap text-white/70 text-[11px]"
          style={{ animation: isActive ? 'senses-scroll 8s linear infinite' : 'none' }}
        >
          {label}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{label}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bgImage(m: Media): string {
  const d = m.data as ImageData & { artworkUrl?: string; thumbnailUrl?: string; fullUrl?: string; thumbnail?: string };
  if (m.division === 'hearing') return d.artworkUrl ?? d.thumbnailUrl ?? m.thumbnail;
  // For videos use the thumbnail, not the video URL (video element handles playback)
  if (m.type === 'video') return (d as any).thumbnail ?? d.thumbnailUrl ?? m.thumbnail;
  return d.fullUrl ?? d.previewUrl ?? d.thumbnailUrl ?? m.thumbnail;
}

function videoStreamUrl(m: Media): string | null {
  if (m.type !== 'video') return null;
  const d = m.data as any;
  return d.streamUrl ?? d.videoUrl ?? null;
}

function detailHref(m: Media) {
  return m.division === 'hearing'
    ? `/hearing/${m.type}/${m.slug}`
    : `/sight/${m.type}/${m.slug}`;
}

// ── Side action button ────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  active = false,
  activeClass = '',
  label,
  count,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  activeClass?: string;
  label: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} aria-label={label} className="flex flex-col items-center gap-1">
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 ${
          active ? activeClass : 'bg-black/35 border-white/15 text-white/80 hover:bg-black/55 hover:text-white hover:scale-105'
        }`}
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
      >
        {children}
      </div>
      {count !== undefined && (
        <span className="text-white/55 text-[10px] tabular-nums font-medium">{count}</span>
      )}
    </button>
  );
}

// ── DiscoverFeed ──────────────────────────────────────────────────────────────

export function DiscoverFeed({ media, creators, musicPool }: Props) {
  const [items,       setItems]       = useState<Media[]>([]);
  const [current,     setCurrent]     = useState(0);
  const [liked,       setLiked]       = useState<Set<string>>(new Set());
  const [saved,       setSaved]       = useState<Set<string>>(new Set());
  const [shareTarget, setShareTarget] = useState<Media | null>(null);
  const [playing,     setPlaying]     = useState<string | null>(null); // hearing audio
  const [muted,       setMuted]       = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [portrait,    setPortrait]    = useState(false);
  const [showHint,    setShowHint]    = useState(false);
  const [bgTrackMap,  setBgTrackMap]  = useState<Map<string, MusicTrack>>(new Map());

  const containerRef  = useRef<HTMLDivElement>(null);
  const audioRefs     = useRef<Record<string, HTMLAudioElement | null>>({});  // hearing items
  const bgAudioRefs   = useRef<Record<string, HTMLAudioElement | null>>({});  // sight background
  const videoRefs     = useRef<Record<string, HTMLVideoElement | null>>({});  // video items

  const creatorMap = Object.fromEntries(creators.map(c => [c.id, c]));

  useEffect(() => {
    const state = getLocalState();
    setLiked(new Set(state.likedMediaIds));
    setSaved(new Set(state.savedMediaIds));
    const shuffled = interleave(randomShuffle(media));
    setItems(shuffled);
    setPortrait(window.innerWidth >= 768);

    // Assign a random track from the pool to every non-hearing item
    if (musicPool.length > 0) {
      const pool = randomShuffle([...musicPool]);
      const map = new Map<string, MusicTrack>();
      shuffled.forEach((m, i) => {
        map.set(m.id, pool[i % pool.length]);
      });
      setBgTrackMap(map);
    }

    try {
      if (!localStorage.getItem('senses:reels-hint-shown')) {
        setShowHint(true);
        setTimeout(() => {
          setShowHint(false);
          localStorage.setItem('senses:reels-hint-shown', '1');
        }, 2500);
      }
    } catch {}
    setMounted(true);
  }, [media, musicPool]);

  // Sync muted state to all audio/video elements
  useEffect(() => {
    Object.values(bgAudioRefs.current).forEach(a => { if (a) a.muted = muted; });
    Object.values(videoRefs.current).forEach(v => { if (v) v.muted = muted; });
    Object.values(audioRefs.current).forEach(a => { if (a) a.muted = muted; });
  }, [muted]);

  // Play/pause based on active card
  const activateCard = useCallback((idx: number, itemsList: Media[]) => {
    const m = itemsList[idx];
    if (!m) return;

    // Pause everything else
    Object.entries(bgAudioRefs.current).forEach(([id, a]) => {
      if (id !== m.id && a) { a.pause(); a.currentTime = 0; }
    });
    Object.entries(videoRefs.current).forEach(([id, v]) => {
      if (id !== m.id && v) v.pause();
    });
    // Pause hearing audio too unless it's this card
    Object.entries(audioRefs.current).forEach(([id, a]) => {
      if (id !== m.id && a) a.pause();
    });

    if (m.division === 'hearing') {
      // Hearing: don't auto-play — user controls it
    } else if (m.type === 'video') {
      const vid = videoRefs.current[m.id];
      if (vid) {
        // Browsers require muted=true for autoplay; unmute after play() resolves
        vid.muted = true;
        vid.play()
          .then(() => { vid.muted = muted; })
          .catch(() => {});
      }
      // Background music for the video card
      const bg = bgAudioRefs.current[m.id];
      if (bg) {
        bg.muted = muted;
        bg.play().catch(() => { bg.muted = true; bg.play().catch(() => {}); });
      }
    } else {
      // Photo / illustration / 3D — play background music unmuted
      const bg = bgAudioRefs.current[m.id];
      if (bg) {
        bg.muted = muted;
        bg.play().catch(() => { bg.muted = true; bg.play().catch(() => {}); });
      }
    }
  }, [muted]);

  // Track current card via IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !items.length) return;
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const idx = parseInt((e.target as HTMLElement).dataset.index ?? '0', 10);
            setCurrent(idx);
            setPlaying(prev => {
              if (prev && items[idx]?.id !== prev) {
                audioRefs.current[prev]?.pause();
                return null;
              }
              return prev;
            });
            activateCard(idx, items);
          }
        });
      },
      { threshold: 0.55 }
    );
    Array.from(container.children).forEach(c => io.observe(c));
    return () => io.disconnect();
  }, [items, activateCard]);

  const scrollTo = useCallback((idx: number) => {
    const container = containerRef.current;
    if (!container) return;
    (container.children[idx] as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); scrollTo(Math.min(current + 1, items.length - 1)); }
      if (e.key === 'ArrowUp'   || e.key === 'k') { e.preventDefault(); scrollTo(Math.max(current - 1, 0)); }
      if (e.key === ' ') { e.preventDefault(); toggleHearingAudio(items[current]?.id); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, items, scrollTo]);

  // Toggle mute: also start bg audio / video if it wasn't playing
  const handleMuteToggle = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      const m = items[current];
      if (m && m.division !== 'hearing') {
        if (m.type === 'video') {
          const vid = videoRefs.current[m.id];
          if (vid) { vid.muted = next; if (!next) vid.play().catch(() => {}); }
        }
        const bg = bgAudioRefs.current[m.id];
        if (bg) {
          bg.muted = next;
          if (!next) bg.play().catch(() => {});
          else bg.pause();
        }
      }
      return next;
    });
  }, [items, current]);

  const toggleHearingAudio = useCallback((id: string | undefined) => {
    if (!id) return;
    const audio = audioRefs.current[id];
    if (!audio) return;
    if (playing === id) {
      audio.pause(); setPlaying(null);
    } else {
      Object.values(audioRefs.current).forEach(a => a?.pause());
      audio.muted = muted;
      audio.play().then(() => setPlaying(id)).catch(() => {});
    }
  }, [playing, muted]);

  const handleLike = (id: string) => {
    toggleLike(id);
    setLiked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSave = (id: string) => {
    toggleSave(id);
    setSaved(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDownload = useCallback((m: Media) => {
    const d = m.data as { fullUrl?: string; previewUrl?: string };
    const url = d.fullUrl ?? d.previewUrl;
    if (!url) return;
    const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg';
    downloadFile(url, `senses-${m.slug}.${ext}`);
  }, []);

  if (!mounted) return null;

  const cardProps = {
    liked, saved, playing, muted, creatorMap, bgTrackMap,
    audioRefs, bgAudioRefs, videoRefs, totalItems: items.length,
    onLike: handleLike, onSave: handleSave,
    onShare: setShareTarget, onDownload: handleDownload,
    onToggleAudio: toggleHearingAudio,
  };

  return (
    <>
    {/* Controls bar */}
    <div
      className="fixed z-[65] flex items-center gap-2"
      style={{ top: 'calc(var(--nav-height) + 10px)', right: '16px' }}
    >
      <button
        onClick={handleMuteToggle}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
      >
        {muted ? <MuteIcon /> : <UnmuteIcon />}
      </button>
      <button
        onClick={() => setPortrait(p => !p)}
        aria-label={portrait ? 'Switch to fullscreen' : 'Switch to portrait'}
        className="w-8 h-8 rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white/70 hover:text-white flex items-center justify-center transition-all"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
        title={portrait ? 'Fullscreen' : 'Portrait'}
      >
        {portrait ? <FullscreenIcon /> : <PortraitIcon />}
      </button>
    </div>

    <div
      ref={containerRef}
      className={`fixed inset-0 overflow-y-scroll ${portrait ? 'bg-black' : ''}`}
      style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
    >
      {portrait
        ? items.map((m, i) => (
            <PortraitCard key={m.id} m={m} i={i} current={current} {...cardProps} onScrollTo={scrollTo} />
          ))
        : items.map((m, i) => (
            <FullscreenCard key={m.id} m={m} i={i} current={current} {...cardProps} onScrollTo={scrollTo} />
          ))
      }
    </div>

    {shareTarget && <ShareModal media={shareTarget} onClose={() => setShareTarget(null)} />}

    {showHint && (
      <div
        className="fixed left-1/2 -translate-x-1/2 z-[80] pointer-events-none flex flex-col items-center gap-1"
        style={{ bottom: '140px', animation: 'senses-hint-fade 2.5s ease forwards' }}
      >
        <style>{`@keyframes senses-hint-fade{0%,60%{opacity:1}100%{opacity:0}}`}</style>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.5} className="w-8 h-8 animate-bounce opacity-80">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
        <span className="text-white/70 text-xs tracking-widest uppercase font-medium px-3 py-1 rounded-full bg-black/40 backdrop-blur-sm">Swipe up</span>
      </div>
    )}
    </>
  );
}

// ── Shared card props ─────────────────────────────────────────────────────────

interface CardProps {
  m: Media;
  i: number;
  current: number;
  liked: Set<string>;
  saved: Set<string>;
  playing: string | null;
  muted: boolean;
  creatorMap: Record<string, Creator>;
  bgTrackMap: Map<string, MusicTrack>;
  audioRefs:   React.MutableRefObject<Record<string, HTMLAudioElement | null>>;
  bgAudioRefs: React.MutableRefObject<Record<string, HTMLAudioElement | null>>;
  videoRefs:   React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
  totalItems: number;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onShare: (m: Media) => void;
  onDownload: (m: Media) => void;
  onToggleAudio: (id: string) => void;
  onScrollTo?: (idx: number) => void;
}

// ── CardContent ───────────────────────────────────────────────────────────────

function CardContent({
  m, creator, isLiked, isSaved, isActive,
  isAudio, isVideo, isPlaying, isPlaceholder,
  audioRefs, bgAudioRefs, videoRefs,
  bgTrack, muted,
  onLike, onSave, onShare, onDownload, onToggleAudio,
}: {
  m: Media; creator?: Creator; isLiked: boolean; isSaved: boolean; isActive: boolean;
  isAudio: boolean; isVideo: boolean; isPlaying: boolean; isPlaceholder: boolean;
  muted: boolean;
  bgTrack: MusicTrack | null;
  audioRefs:   React.MutableRefObject<Record<string, HTMLAudioElement | null>>;
  bgAudioRefs: React.MutableRefObject<Record<string, HTMLAudioElement | null>>;
  videoRefs:   React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
  onLike: (id: string) => void; onSave: (id: string) => void;
  onShare: (m: Media) => void; onDownload: (m: Media) => void;
  onToggleAudio: (id: string) => void;
}) {
  const audioData = isAudio ? (m.data as AudioData) : null;
  const vidUrl    = isVideo ? videoStreamUrl(m) : null;

  // Background music for sight items
  const showNowPlaying = !isAudio && bgTrack;
  // For hearing items: show their own track in the Now Playing strip
  const nowPlayingTrack: MusicTrack | null = isAudio && audioData
    ? {
        id: m.id,
        title: m.title,
        creatorName: creator?.displayName ?? 'Unknown',
        artworkUrl: audioData.artworkUrl ?? m.thumbnail,
        streamUrl: audioData.streamUrl,
      }
    : bgTrack;

  return (
    <>
      {/* Hidden audio for hearing items */}
      {isAudio && audioData && !isPlaceholder && (
        <audio
          ref={el => { audioRefs.current[m.id] = el; }}
          src={audioData.streamUrl}
          preload="none"
          loop
          muted={muted}
        />
      )}

      {/* Background music audio for sight items */}
      {!isAudio && bgTrack && (
        <audio
          ref={el => { bgAudioRefs.current[m.id] = el; }}
          src={bgTrack.streamUrl}
          preload="none"
          loop
          muted={true}
        />
      )}

      {/* Video element — fills the background */}
      {isVideo && vidUrl && (
        <video
          ref={el => { videoRefs.current[m.id] = el; }}
          src={vidUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          playsInline
          muted={muted}
          preload="none"
          style={{ zIndex: 1 }}
        />
      )}

      {/* Hearing: album art centred */}
      {isAudio && audioData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
          <div className="flex flex-col items-center gap-5 pointer-events-auto">
            <div className={`w-44 h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/10 transition-all duration-500 ${isPlaying ? 'scale-105 shadow-[0_0_40px_rgba(143,174,192,0.2)]' : ''}`}>
              <img src={audioData.artworkUrl ?? m.thumbnail} alt={m.title} className="w-full h-full object-cover" />
            </div>
            <button
              onClick={() => isPlaceholder ? undefined : onToggleAudio(m.id)}
              disabled={isPlaceholder}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 ${isPlaceholder ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' : isPlaying ? 'bg-senses-hearing/30 border-senses-hearing/40 text-senses-hearing' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}
            >
              {isPlaying
                ? <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 5h3v14H6zm9 0h3v14h-3z"/></svg>
                : <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
              }
            </button>
          </div>
        </div>
      )}

      {/* Side action rail */}
      <div className="absolute right-3 flex flex-col items-center gap-4" style={{ bottom: '110px', zIndex: 20 }}>
        <ActionBtn
          onClick={() => onLike(m.id)}
          active={isLiked}
          activeClass="bg-red-500/30 border-red-400/40 text-red-400 scale-105"
          label={isLiked ? 'Unlike' : 'Like'}
          count={formatCount(m.stats.likes + (isLiked ? 1 : 0))}
        >
          <HeartIcon filled={isLiked} />
        </ActionBtn>
        <ActionBtn
          onClick={() => onSave(m.id)}
          active={isSaved}
          activeClass="bg-amber-400/20 border-amber-300/40 text-amber-300 scale-105"
          label={isSaved ? 'Unsave' : 'Save'}
          count={formatCount(m.stats.saves + (isSaved ? 1 : 0))}
        >
          <BookmarkIcon filled={isSaved} />
        </ActionBtn>
        <ActionBtn onClick={() => onShare(m)} label="Share"><ShareIcon /></ActionBtn>
        <ActionBtn onClick={() => onDownload(m)} label="Download"><DownloadIcon /></ActionBtn>
        <a href={detailHref(m)} aria-label="View full page" className="flex flex-col items-center gap-1">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/15 bg-black/35 text-white/80 hover:bg-black/55 hover:text-white hover:scale-105 transition-all duration-200"
            style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}
          >
            <ExternalLinkIcon />
          </div>
        </a>
      </div>

      {/* Bottom info + Now Playing */}
      <div className="absolute bottom-0 left-0 right-16 p-4 pb-7" style={{ zIndex: 20 }}>
        <p className={`text-[10px] tracking-[0.22em] uppercase font-semibold mb-1.5 ${isAudio ? 'text-senses-hearing' : 'text-senses-sight'}`}>
          {isAudio ? 'HEARING' : 'SIGHT'} · {m.type}
        </p>
        <h2 className="text-white text-[17px] font-semibold leading-snug mb-2 line-clamp-2" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.5)' }}>
          {m.title}
        </h2>
        {creator && (
          <a href={`/creator/${creator.id}`} className="inline-flex items-center gap-2 mb-2.5 group">
            <img src={creator.avatar} alt={creator.displayName} className="w-6 h-6 rounded-full object-cover border border-white/25 flex-shrink-0" />
            <span className="text-white/65 text-sm group-hover:text-white/90 transition-colors font-medium">{creator.displayName}</span>
          </a>
        )}
        <div className="flex flex-wrap gap-1.5">
          {m.tags.slice(0, 3).map(t => (
            <a key={t} href={`/tag/${t}`}
              className="px-2 py-0.5 rounded-full border border-white/15 text-white/50 text-[10px] hover:text-white/80 hover:bg-white/10 transition-all"
              style={{ backdropFilter: 'blur(8px)', background: 'rgba(255,255,255,0.06)' }}
            >
              #{t}
            </a>
          ))}
        </div>

        {/* Now Playing strip */}
        <NowPlaying track={nowPlayingTrack} isActive={isActive} isAudio={isAudio} />
      </div>
    </>
  );
}

// ── FullscreenCard ────────────────────────────────────────────────────────────

function FullscreenCard({ m, i, current, liked, saved, playing, muted, creatorMap, bgTrackMap, audioRefs, bgAudioRefs, videoRefs, totalItems, onLike, onSave, onShare, onDownload, onToggleAudio, onScrollTo }: CardProps) {
  const isActive  = i === current;
  const isLiked   = liked.has(m.id);
  const isSaved   = saved.has(m.id);
  const isAudio   = m.division === 'hearing';
  const isVideo   = m.type === 'video';
  const isPlaying = playing === m.id;
  const audioData = isAudio ? (m.data as AudioData) : null;
  const isPlaceholder = !audioData?.streamUrl || audioData.streamUrl.startsWith('#');
  const bg = bgImage(m);
  const bgTrack = bgTrackMap.get(m.id) ?? null;

  return (
    <div
      data-index={i}
      className="relative w-full h-screen flex-shrink-0 overflow-hidden"
      style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as React.CSSProperties}
    >
      {/* Background image (always, video renders on top) */}
      <div className="absolute inset-0">
        <img
          src={bg}
          alt=""
          className={`w-full h-full transition-transform duration-700 ${isAudio ? 'object-cover scale-110 blur-[60px] opacity-20' : 'object-cover'}`}
          loading={i < 3 ? 'eager' : 'lazy'}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/88 pointer-events-none" style={{ zIndex: 2 }} />

      <CardContent
        m={m} creator={creatorMap[m.creator]} isLiked={isLiked} isSaved={isSaved} isActive={isActive}
        isAudio={isAudio} isVideo={isVideo} isPlaying={isPlaying} isPlaceholder={isPlaceholder}
        bgTrack={bgTrack} muted={muted}
        audioRefs={audioRefs} bgAudioRefs={bgAudioRefs} videoRefs={videoRefs}
        onLike={onLike} onSave={onSave} onShare={onShare} onDownload={onDownload} onToggleAudio={onToggleAudio}
      />

      {isAudio && <div className="absolute inset-0 pointer-events-none opacity-10" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, #8FAEC0, transparent)', zIndex: 3 }} />}
    </div>
  );
}

// ── PortraitCard ──────────────────────────────────────────────────────────────

function PortraitCard({ m, i, current, liked, saved, playing, muted, creatorMap, bgTrackMap, audioRefs, bgAudioRefs, videoRefs, totalItems, onLike, onSave, onShare, onDownload, onToggleAudio }: CardProps) {
  const isActive  = i === current;
  const isLiked   = liked.has(m.id);
  const isSaved   = saved.has(m.id);
  const isAudio   = m.division === 'hearing';
  const isVideo   = m.type === 'video';
  const isPlaying = playing === m.id;
  const audioData = isAudio ? (m.data as AudioData) : null;
  const isPlaceholder = !audioData?.streamUrl || audioData.streamUrl.startsWith('#');
  const bg = bgImage(m);
  const bgTrack = bgTrackMap.get(m.id) ?? null;

  return (
    <div
      data-index={i}
      style={{
        height: '100vh', width: '100%',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      } as React.CSSProperties}
    >
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          width: 'min(calc((100vh - 80px) * 9 / 16), calc(100vw - 32px))',
          aspectRatio: '9/16',
          boxShadow: isActive
            ? '0 0 0 2px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.7)'
            : '0 8px 32px rgba(0,0,0,0.5)',
        } as React.CSSProperties}
      >
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <img
            src={bg}
            alt=""
            className={`w-full h-full ${isAudio ? 'object-cover scale-110 blur-[60px] opacity-20' : 'object-cover'}`}
            loading={i < 3 ? 'eager' : 'lazy'}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90 rounded-2xl pointer-events-none" style={{ zIndex: 2 }} />

        <CardContent
          m={m} creator={creatorMap[m.creator]} isLiked={isLiked} isSaved={isSaved} isActive={isActive}
          isAudio={isAudio} isVideo={isVideo} isPlaying={isPlaying} isPlaceholder={isPlaceholder}
          bgTrack={bgTrack} muted={muted}
          audioRefs={audioRefs} bgAudioRefs={bgAudioRefs} videoRefs={videoRefs}
          onLike={onLike} onSave={onSave} onShare={onShare} onDownload={onDownload} onToggleAudio={onToggleAudio}
        />

        {isAudio && <div className="absolute inset-0 pointer-events-none opacity-10 rounded-2xl" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, #8FAEC0, transparent)', zIndex: 3 }} />}
      </div>
    </div>
  );
}
