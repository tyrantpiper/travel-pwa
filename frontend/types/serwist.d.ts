declare interface ServiceWorkerGlobalScope {
  __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
}

interface PrecacheEntry {
  url: string;
  revision: string | null;
}
