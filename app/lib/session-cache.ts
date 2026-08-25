/** In-memory session cache so agency / TX paint last data immediately. */
const TTL_MS = 30_000;

type Entry<T> = { t: number; v: T };

const store = new Map<string, Entry<unknown>>();

export function sessionCachePeek<T>(key: string): {
  data: T;
  stale: boolean;
} | null {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return null;
  return { data: e.v, stale: Date.now() - e.t > TTL_MS };
}

export function sessionCacheSet<T>(key: string, v: T): void {
  store.set(key, { t: Date.now(), v });
}
