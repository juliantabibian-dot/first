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
  useWindowDimensions,
  View,
} from 'react-native';

import { AccountButton } from '@/components/AccountButton';
import { AvatarStack } from '@/components/people';
import { Button, ErrorText, Mark, ScreenHeader } from '@/components/ui';
import { usePhotoShield } from '@/lib/capture';
import { usePhotos, type Photo } from '@/lib/photos';
import { type, useTheme } from '@/lib/theme';
import { useWatchers } from '@/lib/watchers';
import { Text } from '@/components/Text';

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
      const names = watchers
        .filter((w) => w.status === 'verified' && item.watcherIds.includes(w.id))
        .map((w) => w.name);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open photo"
          accessibilityHint={names.length ? `Watched by ${names.join(', ')}` : 'No one is watching this photo'}
          onPress={() => router.push(`/photo/${item.id}`)}
          style={({ pressed }) => ({
            width: tile,
            height: tile,
            backgroundColor: t.fill,
            opacity: pressed ? 0.85 : 1,
          })}>
          {/* pointerEvents="none" keeps the image itself from being pressed, dragged or saved. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image
              source={item.url ? { uri: item.url, cacheKey: item.storage_path } : null}
              recyclingKey={item.id}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
            {/* A soft shade at the bottom so the faces stay readable on bright photos. */}
            <View style={styles.shade} />
          </View>
          <View style={styles.tileFoot}>
            {names.length ? (
              <AvatarStack names={names} size={20} ring="rgba(255,255,255,0.9)" />
            ) : (
              <View style={[styles.unwatched, { backgroundColor: t.alert }]}>
                <SymbolView
                  name={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
                  tintColor="#ffffff"
                  size={11}
                />
                <Text style={styles.unwatchedText}>Unwatched</Text>
              </View>
            )}
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
    [tile, t.fill, t.alert, watchers],
  );

  const unwatched = photos.filter(
    (p) => !watchers.some((w) => w.status === 'verified' && p.watcherIds.includes(w.id)),
  ).length;
  const subtitle = loading
    ? undefined
    : photos.length
      ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}${
          unwatched ? ` · ${unwatched} unwatched` : ' · all watched'
        }`
      : 'Nothing here yet';

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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a watcher first. Go to Watchers"
                onPress={() => router.navigate('/watchers')}
                style={({ pressed }) => [
                  styles.hint,
                  { backgroundColor: t.alertSoft, opacity: pressed ? 0.7 : 1 },
                ]}>
                <SymbolView
                  name={{ ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }}
                  tintColor={t.alert}
                  size={18}
                />
                <View style={styles.hintText}>
                  <Text style={[type.headline, { color: t.ink }]}>Add a watcher first</Text>
                  <Text style={[type.footnote, { color: t.muted }]}>
                    Confirm someone's number, then choose them for your photos.
                  </Text>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  tintColor={t.muted}
                  size={13}
                />
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={t.muted} style={{ marginTop: 32 }} />
          ) : error ? undefined : (
            <View style={styles.empty}>
              {/* A ghost of the grid, with the eye where the first photo will go. */}
              <View style={styles.ghost} accessibilityElementsHidden importantForAccessibility="no">
                {Array.from({ length: 6 }, (_, i) => (
                  <View key={i} style={[styles.ghostTile, { backgroundColor: t.fill }]}>
                    {i === 0 ? <Mark size={30} color={t.muted} /> : null}
                  </View>
                ))}
              </View>
              <Text style={[type.title, { color: t.ink }]}>Keep a photo here</Text>
              <Text style={[type.callout, styles.emptyText, { color: t.muted }]}>
                Photos you add stay inside Lookout. Choose who watches each one, and they get a
                text if it's shared, saved or screenshotted.
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  hintText: { flex: 1, minWidth: 0, gap: 1 },
  empty: { paddingHorizontal: 20, paddingTop: 12 },
  emptyText: { marginTop: 6, marginBottom: 20 },
  ghost: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 24, width: 3 * 72 + 6 },
  ghostTile: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  shade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
    experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.35))',
  },
  tileFoot: { position: 'absolute', left: 5, bottom: 5 },
  unwatched: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  unwatchedText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
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
