import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePhotos } from '@/lib/photos';
import { ago } from '@/lib/time';

/**
 * Full-screen viewer. There is deliberately no way to save from here:
 * the image ignores touches (no long-press, no drag), and the only route
 * out of the app will be the Download and Share buttons, which alert watchers.
 */
export default function PhotoViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, loading } = usePhotos();
  const photo = photos.find((p) => p.id === id);

  if (!photo) return loading ? <View style={styles.screen} /> : <Redirect href="/" />;

  const blocked = photo.download_policy === 'blocked';

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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
});
