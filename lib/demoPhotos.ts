import { Directory, File, Paths } from 'expo-file-system';

// Native: photos are copied into the app's documents folder, so they survive restarts.

function folder(): Directory {
  const dir = new Directory(Paths.document, 'demo-photos');
  dir.create({ idempotent: true, intermediates: true });
  return dir;
}

export async function storePhoto(path: string, uri: string): Promise<string> {
  const target = new File(folder(), path.replace(/\//g, '_'));
  new File(uri).copy(target);
  return target.uri;
}

/** Native files are already on disk; nothing to load. */
export async function loadPhotos(paths: string[], known: Map<string, string>): Promise<void> {
  for (const path of paths) {
    const file = new File(folder(), path.replace(/\//g, '_'));
    if (file.exists) known.set(path, file.uri);
  }
}

export async function clearPhotos(): Promise<void> {
  try {
    new Directory(Paths.document, 'demo-photos').delete();
  } catch {}
}
