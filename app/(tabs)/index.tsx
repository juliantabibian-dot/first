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

import { AccountButton } from '@/components/AccountButton';
import { Button, ErrorText, ScreenHeader, TextButton } from '@/components/ui';
import { usePhotoShield } from '@/lib/capture';
import { usePhotos, type Photo } from '@/lib/photos';
import { type, useTheme } from '@/lib/theme';
import { useWatchers } from '@/lib/watchers';

const COLUMNS = 3;
const GAP = 2;
const MAX_WIDTH = 720;

export default function Photos() {
  const t = useTheme();
  const { photos, loading, error, refresh, refreshIfStale, setPending } = usePhotos();
  const { watchers } = useWatchers();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const tile = (Math.min(width, MAX_WIDTH) - GAP * (COLUMNS - 1)) / COLUMNS;

  useFocusEffect(refreshIfStale);
  usePhotoShield('photo-grid');

  const pick = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 20,
      quality: 1,
    });
    if (result.canceled || !result.assets.length) return;
    setPending(
      result.assets.map((a) => ({
        uri: a.uri,
        width: a.width,
        height: a.height,
        assetId: a.assetId ?? null,
      })),
    );
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
          style={{ width: tile, height: tile, backgroundColor: t.fill }}>
          {/* pointerEvents="none" keeps the image itself from being pressed, dragged or saved. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
              source={item.url ? { uri: item.url, cacheKey: item.storage_path } : null}
              recyclingKey={item.id}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.tag}>
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
            <View style={styles.lock}>
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                tintColor="#ffffff"
                size={11}
              />
            </View>
          ) : null}
        </Pressable>
      );
    },
    [tile, t.fill, watchers],
  );

  const subtitle = loading
    ? undefined
    : photos.length
      ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
      : 'No photos yet';

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader
        title="Photos"
        subtitle={subtitle}
        right={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload from camera roll"
              hitSlop={8}
              onPress={pick}
              style={({ pressed }) => [
                styles.add,
                { backgroundColor: t.accent, opacity: pressed ? 0.7 : 1 },
              ]}>
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                tintColor={t.onAccent}
                size={18}
              />
            </Pressable>
            <AccountButton />
          </>
        }
      />
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={styles.grid}
        renderItem={renderTile}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={t.muted} />
        }
        ListHeaderComponent={
          <View style={styles.notes}>
            {error ? <ErrorText>{error}</ErrorText> : null}
            {hasConfirmed || loading ? null : (
              <View style={styles.hint}>
                <Text style={[type.headline, { color: t.ink }]}>Add a watcher first</Text>
                <Text style={[type.callout, styles.hintBody, { color: t.muted }]}>
                  Add someone's phone number and confirm it with the code they get. Then you can
                  choose them for your photos.
                </Text>
                <View style={styles.hintAction}>
                  <TextButton title="Go to Watchers  ›" onPress={() => router.navigate('/watchers')} />
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={t.muted} style={{ marginTop: 32 }} />
          ) : error ? undefined : (
            <View style={styles.empty}>
              <Text style={[type.callout, styles.emptyText, { color: t.muted }]}>
                No photos yet. Upload one to start.
              </Text>
              <Button title="Upload from camera roll" onPress={pick} />
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  grid: { gap: GAP, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingBottom: 24 },
  add: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  notes: { paddingHorizontal: 20 },
  hint: { paddingTop: 4, paddingBottom: 20 },
  hintBody: { marginTop: 4 },
  hintAction: { marginTop: 10, alignItems: 'flex-start' },
  empty: { paddingHorizontal: 20, paddingTop: 8 },
  emptyText: { marginBottom: 16 },
  tag: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tagText: { color: '#ffffff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  lock: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
