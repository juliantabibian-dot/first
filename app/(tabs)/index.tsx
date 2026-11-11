import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Button, Card, ErrorText } from '@/components/ui';
import { usePhotos, type Photo } from '@/lib/photos';
import { useWatchers } from '@/lib/watchers';
import { useTheme } from '@/lib/theme';

const COLUMNS = 3;
const GAP = 4;
const PADDING = 16;
const MAX_WIDTH = 560;

export default function Photos() {
  const t = useTheme();
  const { photos, loading, error, refresh, refreshIfStale, setPending } = usePhotos();
  const { watchers } = useWatchers();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, MAX_WIDTH) - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  useFocusEffect(refreshIfStale);

  const pick = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (result.canceled || !result.assets.length) return;
    setPending(result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height })));
    router.push('/add-photos');
  }, [setPending]);

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const hasConfirmed = watchers.some((w) => w.status === 'verified');

  const renderTile = useCallback(
    ({ item }: { item: Photo }) => {
      const count = watchers.filter(
        (w) => w.status === 'verified' && item.watcherIds.includes(w.id),
      ).length;
      return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open photo"
        onPress={() => router.push(`/photo/${item.id}`)}
        style={{ width: tile, height: tile, backgroundColor: t.line }}>
        {/* pointerEvents="none" keeps the image itself from being pressed, dragged or saved. */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={item.url ? { uri: item.url, cacheKey: item.storage_path } : null}
            recyclingKey={item.id}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={[styles.tag, !count && { backgroundColor: 'rgba(180,83,9,0.9)' }]}>
          {count ? (
            <SymbolView
              name={{ ios: 'eye.fill', android: 'visibility', web: 'visibility' }}
              tintColor="#ffffff"
              size={12}
            />
          ) : null}
          <Text style={styles.tagText}>{count ? count : 'No watchers'}</Text>
        </View>
        {item.download_policy === 'blocked' ? (
          <View style={styles.badge}>
            <SymbolView
              name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              tintColor="#ffffff"
              size={12}
            />
          </View>
        ) : null}
      </Pressable>
      );
    },
    [tile, t.line, watchers],
  );

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      data={photos}
      keyExtractor={(p) => p.id}
      numColumns={COLUMNS}
      columnWrapperStyle={{ gap: GAP }}
      renderItem={renderTile}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={t.muted} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {hasConfirmed ? null : (
            <View style={[styles.banner, { backgroundColor: t.warnSoft }]}>
              <Text style={[styles.bannerTitle, { color: t.warn }]}>Add a watcher first</Text>
              <Text style={[styles.bannerBody, { color: t.warn }]}>
                On the Watchers tab, add someone's phone number and confirm it with the code they
                get. Then you can choose them for your photos.
              </Text>
            </View>
          )}
          <Button title="＋ Upload from camera roll" onPress={pick} />
          {error ? (
            <View style={{ marginTop: 12 }}>
              <ErrorText>{error}</ErrorText>
            </View>
          ) : null}
          <Text style={[styles.section, { color: t.muted }]}>My photos · {photos.length}</Text>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={t.muted} style={{ marginTop: 24 }} />
        ) : error ? undefined : (
          <Card>
            <Text style={[styles.empty, { color: t.muted }]}>
              No photos yet. Upload one to start.
            </Text>
          </Card>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: {
    padding: PADDING,
    gap: GAP,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  header: { marginBottom: 6 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 20,
    marginLeft: 4,
  },
  empty: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
  banner: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  bannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  bannerBody: { fontSize: 14, lineHeight: 20 },
  tag: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  tagText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
