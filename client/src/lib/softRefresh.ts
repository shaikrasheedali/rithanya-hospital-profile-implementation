/**
 * Portal-wide soft refresh.
 *
 * Data loaders register themselves while mounted; `softRefresh()` re-fetches
 * their data in place instead of a full-page reload. This keeps scroll
 * position, open panels and form state — CRUD actions feel instant even on a
 * slow connection. Falls back to a hard reload when nothing is mounted.
 */
const handlers = new Set<() => void>();

export function registerSoftRefresh(fn: () => void): () => void {
  handlers.add(fn);
  return () => {
    handlers.delete(fn);
  };
}

export function softRefresh(): void {
  if (!handlers.size) {
    window.location.reload();
    return;
  }
  for (const fn of handlers) {
    try {
      fn();
    } catch {
      // a stale handler must never break the refresh loop
    }
  }
}
