import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Share } from 'react-native';

// Taking a photo out of the app on a phone. The web build has its own version.

export const ACTIONS_ARE_SIMULATED = false;

/** A copy of the photo as a local file, which is what the share sheet and camera roll need. */
async function localCopy(id: string, url: string): Promise<{ uri: string; cleanup: () => void }> {
  if (url.startsWith('file:')) return { uri: url, cleanup: () => {} };
  const target = new File(Paths.cache, `lookout-${id}.jpg`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  return {
    uri: file.uri,
    cleanup: () => {
      try {
        file.delete();
      } catch {}
    },
  };
}

export async function saveToCameraRoll(id: string, url: string): Promise<'saved' | 'denied' | 'failed'> {
  try {
    const permission = await requestPermissionsAsync(true);
    if (!permission.granted) return 'denied';
    const copy = await localCopy(id, url);
    try {
      await Asset.create(copy.uri);
    } finally {
      copy.cleanup();
    }
    return 'saved';
  } catch {
    return 'failed';
  }
}

export async function shareOut(id: string, url: string): Promise<'shared' | 'cancelled' | 'failed'> {
  try {
    const copy = await localCopy(id, url);
    try {
      const result = await Share.share({ url: copy.uri });
      return result.action === Share.sharedAction ? 'shared' : 'cancelled';
    } finally {
      copy.cleanup();
    }
  } catch {
    return 'failed';
  }
}
