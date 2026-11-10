// Web: photos are kept as data URLs in IndexedDB. If the browser refuses
// IndexedDB they stay in memory and are gone after a reload.

const DB = 'lookout-demo';
const STORE = 'photos';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Redraws the picked image into a data URL, which (unlike a blob: URL) can be saved. */
function toDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return Promise.resolve(uri);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = uri;
  });
}

export async function storePhoto(path: string, uri: string): Promise<string> {
  const dataUrl = await toDataUrl(uri);
  await run('readwrite', (store) => store.put(dataUrl, path));
  return dataUrl;
}

export async function loadPhotos(paths: string[], known: Map<string, string>): Promise<void> {
  for (const path of paths) {
    if (known.has(path)) continue;
    const dataUrl = await run<string>('readonly', (store) => store.get(path));
    if (typeof dataUrl === 'string') known.set(path, dataUrl);
  }
}

export async function clearPhotos(): Promise<void> {
  await run('readwrite', (store) => store.clear());
}
