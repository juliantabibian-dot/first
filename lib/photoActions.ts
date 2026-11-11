import { File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Platform, Share } from 'react-native';

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

/** Deleting the camera-roll originals after an upload is offered on iPhone only for now. */
export const CAN_DELETE_ORIGINALS = Platform.OS === 'ios';

/**
 * Deletes photos from the camera roll by the ids the picker gave us. iOS shows
 * its own "Allow Lookout to delete N photos?" prompt; saying no there counts as 'kept'.
 */
export async function deleteOriginals(assetIds: string[]): Promise<'deleted' | 'kept'> {
  try {
    const permission = await requestPermissionsAsync(false);
    if (!permission.granted) return 'kept';
    // The library wants "ph://<id>"; the picker hands back the bare id.
    await Asset.delete(assetIds.map((id) => new Asset(id.startsWith('ph://') ? id : `ph://${id}`)));
    return 'deleted';
  } catch {
    return 'kept';
  }
}
