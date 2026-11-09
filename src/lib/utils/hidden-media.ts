const KEY = 'senses:hidden-media';

export function getHiddenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

export function saveHiddenIds(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
  } catch {}
}

export function toggleHidden(id: string): Set<string> {
  const ids = getHiddenIds();
  ids.has(id) ? ids.delete(id) : ids.add(id);
  saveHiddenIds(ids);
  return ids;
}
