import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePhotos } from '@/lib/photos';
import { useWatchers } from '@/lib/watchers';
import { ago } from '@/lib/time';

/**
 * Full-screen viewer. There is deliberately no way to save from here:
 * the image ignores touches (no long-press, no drag), and the only route
 * out of the app will be the Download and Share buttons, which alert watchers.
 */
export default function PhotoViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, loading } = usePhotos();
  const { watchers } = useWatchers();
  const photo = photos.find((p) => p.id === id);

  if (!photo) return loading ? <View style={styles.screen} /> : <Redirect href="/" />;

  const blocked = photo.download_policy === 'blocked';
  // Only confirmed watchers are texted.
  const names = watchers
    .filter((w) => w.status === 'verified' && photo.watcherIds.includes(w.id))
    .map((w) => w.name);
  const watching = names.length
    ? `If anything happens to this photo, ${
        names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
      } ${names.length === 1 ? 'gets' : 'get'} a text.`
    : 'No one is watching this photo.';

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.close}>
          <SymbolView
            name={{ ios: 'xmark', android: 'close', web: 'close' }}
            tintColor="#ffffff"
            size={20}
          />
        </Pressable>
        <View>
          <Text style={styles.title}>Your photo</Text>
          <Text style={styles.meta}>Added {ago(photo.created_at)}</Text>
        </View>
      </View>

      <View pointerEvents="none" style={styles.picture}>
        <Image
          source={photo.url ? { uri: photo.url, cacheKey: photo.storage_path } : null}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Photo"
        />
      </View>

      <Text style={styles.watching}>{watching}</Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Watchers"
          onPress={() => router.push({ pathname: '/photo-watchers', params: { ids: photo.id } })}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
          <SymbolView
            name={{ ios: 'eye', android: 'visibility', web: 'visibility' }}
            tintColor="#ffffff"
            size={22}
          />
          <Text style={styles.actionLabel}>Watchers</Text>
        </Pressable>
      </View>

      <View style={styles.footer}>
        <SymbolView
          name={
            blocked
              ? { ios: 'lock.fill', android: 'lock', web: 'lock' }
              : { ios: 'arrow.down.circle', android: 'download', web: 'download' }
          }
          tintColor="#aaaaaa"
          size={16}
        />
        <Text style={styles.meta}>
          {blocked ? 'Downloads are blocked for this photo.' : 'Downloads allowed. Watchers get a text.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#aaaaaa', fontSize: 13 },
  picture: { flex: 1, marginHorizontal: 8 },
  watching: { color: '#dddddd', fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 24, paddingTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'center', paddingTop: 12 },
  action: { alignItems: 'center', gap: 4, minWidth: 72, paddingVertical: 6 },
  actionLabel: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
    paddingTop: 8,
  },
});
