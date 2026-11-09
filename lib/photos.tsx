import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useAuth } from './auth';
import { supabase } from './supabase';

/**
 * Chosen once at upload and locked by the database afterwards.
 * 'alert' = can be downloaded, watchers are texted. 'blocked' = can never leave the app.
 */
export type DownloadPolicy = 'alert' | 'blocked';

export type Photo = {
  id: string;
  storage_path: string;
  created_at: string;
  download_policy: DownloadPolicy;
  width: number | null;
  height: number | null;
  /** Short-lived signed URL; null if it couldn't be created. */
  url: string | null;
};

/** A photo picked from the camera roll that hasn't been uploaded yet. */
export type PickedPhoto = { uri: string; width: number; height: number };

/** `failed` holds the picks that still need uploading, so a retry never duplicates photos. */
type UploadResult = { added: number; failed: PickedPhoto[] };

type PhotosState = {
  photos: Photo[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Reloads only if the signed URLs are close to expiring. */
  refreshIfStale: () => void;
  pending: PickedPhoto[];
  setPending: (picked: PickedPhoto[]) => void;
  uploadPending: (
    policy: DownloadPolicy,
    onProgress: (done: number, total: number) => void,
  ) => Promise<UploadResult>;
};

const BUCKET = 'photos';
const URL_LIFETIME_S = 60 * 60;
const STALE_AFTER_MS = 45 * 60 * 1000;
const MAX_SIDE = 1600;

const PhotosContext = createContext<PhotosState | null>(null);

/** Shrink to at most 1600px and re-encode as JPEG, which also drops location and other EXIF data. */
async function prepare(photo: PickedPhoto): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > MAX_SIDE) {
    context.resize(photo.width >= photo.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  return image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') return (await fetch(uri)).arrayBuffer();
  return new File(uri).arrayBuffer();
}

export function PhotosProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const userId = profile ? (session?.user.id ?? null) : null;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PickedPhoto[]>([]);
  const loadedAt = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const { data: rows, error: rowsError } = await supabase
      .from('photos')
      .select('id, storage_path, created_at, download_policy, width, height')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });
    if (rowsError) {
      setError("Couldn't load your photos. Pull down to try again.");
      setLoading(false);
      return;
    }

    const urls = new Map<string, string>();
    if (rows.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(
        rows.map((r) => r.storage_path),
        URL_LIFETIME_S,
      );
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
      }
    }

    setPhotos(rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? null })));
    setError(null);
    setLoading(false);
    loadedAt.current = Date.now();
  }, [userId]);

  useEffect(() => {
    setPhotos([]);
    setPending([]);
    setError(null);
    setLoading(true);
    loadedAt.current = 0;
    refresh();
  }, [refresh]);

  const refreshIfStale = useCallback(() => {
    if (loadedAt.current && Date.now() - loadedAt.current > STALE_AFTER_MS) refresh();
  }, [refresh]);

  const uploadPending = useCallback(
    async (policy: DownloadPolicy, onProgress: (done: number, total: number) => void) => {
      const result: UploadResult = { added: 0, failed: [] };
      if (!userId) return { added: 0, failed: pending };

      for (const [index, picked] of pending.entries()) {
        onProgress(index, pending.length);
        try {
          const ready = await prepare(picked);
          const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
          const upload = await supabase.storage
            .from(BUCKET)
            .upload(path, await readBytes(ready.uri), { contentType: 'image/jpeg' });
          if (upload.error) throw upload.error;
          const insert = await supabase.from('photos').insert({
            owner_id: userId,
            storage_path: path,
            download_policy: policy,
            width: ready.width,
            height: ready.height,
          });
          if (insert.error) throw insert.error;
          result.added += 1;
        } catch {
          result.failed.push(picked);
        }
      }

      if (result.added) await refresh();
      return result;
    },
    [pending, refresh, userId],
  );

  const value = useMemo<PhotosState>(
    () => ({ photos, loading, error, refresh, refreshIfStale, pending, setPending, uploadPending }),
    [photos, loading, error, refresh, refreshIfStale, pending, uploadPending],
  );

  return <PhotosContext.Provider value={value}>{children}</PhotosContext.Provider>;
}

export function usePhotos(): PhotosState {
  const ctx = useContext(PhotosContext);
  if (!ctx) throw new Error('usePhotos must be used inside PhotosProvider');
  return ctx;
}
