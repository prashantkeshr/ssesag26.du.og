import { useState, useEffect } from 'react';
import { getHiddenIds } from '@/lib/utils/hidden-media';

const KEY = 'senses:hidden-media';

export function useHiddenMedia(): Set<string> {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHidden(getHiddenIds());
    const handler = (e: StorageEvent) => {
      if (e.key === null || e.key === KEY) setHidden(getHiddenIds());
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return hidden;
}
