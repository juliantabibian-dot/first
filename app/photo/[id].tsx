import { Image } from 'expo-image';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarStack, joinNames } from '@/components/people';
import { usePhotoShield, useScreenshotAlert } from '@/lib/capture';
import { confirmDestructive } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { reportEvent, type PhotoEvent } from '@/lib/events';
import { ACTIONS_ARE_SIMULATED, saveToCameraRoll, shareOut } from '@/lib/photoActions';
import { usePhotos } from '@/lib/photos';
import { addedOn } from '@/lib/time';
import { useWatchers } from '@/lib/watchers';

type Busy = 'share' | 'download' | 'delete' | null;

function Action({
  label,
  hint,
  symbol,
  onPress,
  busy,
  disabled,
  tone,
}: {
  label: string;
  tone?: 'danger';
  /** Small grey note under the label, e.g. "demo". */
  hint?: string;
  symbol: SymbolViewProps['name'];
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.35 : 1 }]}>
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.actionCircle,
              tone === 'danger' && styles.actionCircleDanger,
              { transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}>
            {busy ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <SymbolView name={symbol} tintColor={tone === 'danger' ? '#ff6b5e' : '#ffffff'} size={21} />
            )}
          </View>
          <Text style={styles.actionLabel} numberOfLines={1}>
            {label}
          </Text>
          {hint ? <Text style={styles.actionHint}>{hint}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

/**
 * Full-screen viewer. The picture ignores touches (no long-press, no drag) and
 * iOS blanks it out of screenshots and recordings. The only ways out of the app
 * are the Share and Download buttons, and both text the photo's watchers.
 */
export default function PhotoViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { photos, loading, refresh } = usePhotos();
  const { watchers } = useWatchers();
  const photo = photos.find((p) => p.id === id);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState('');
  /** Set once the photo has been deleted, so the screenshot listener stays quiet while closing. */
  const closing = useRef(false);

  usePhotoShield('photo-viewer');

  // Only confirmed watchers are texted.
  const names = photo
    ? watchers
        .filter((w) => w.status === 'verified' && photo.watcherIds.includes(w.id))
        .map((w) => w.name)
    : [];

  /** "Texted 2 watchers." or why nobody was. */
  function texted(count: number) {
    if (count) return `Texted ${count} ${count === 1 ? 'watcher' : 'watchers'}.`;
    return 'This photo has no watchers, so no one was texted.';
  }

  /** Reports something that already happened; says what the watchers were told. */
  async function alertWatchers(type: PhotoEvent, done: string) {
    if (!photo) return;
    const result = await reportEvent(photo.id, type);
    if (result.ok) {
      if (result.data.texted) haptic.warning();
      setNotice(`${done} ${texted(result.data.texted)}`);
    }
    else if (result.network) {
      setNotice(`${done} You're offline, so the watchers will be texted when you're back online.`);
    } else setNotice(`${done} ${result.error}`);
  }

  useScreenshotAlert(() => {
    if (photo && !closing.current) alertWatchers('screenshot', 'Screenshot noticed.');
  });

  if (!photo) return loading ? <View style={styles.screen} /> : <Redirect href="/" />;

  const blocked = photo.download_policy === 'blocked';
  const watching = names.length
    ? `${joinNames(names)} ${names.length === 1 ? 'gets' : 'get'} a text if anything happens to this photo.`
    : 'No one is watching this photo. Choose watchers so someone is told if it leaves the app.';
  const demo = ACTIONS_ARE_SIMULATED ? 'demo' : undefined;

  async function share() {
    if (!photo?.url) return;
    setNotice('');
    setBusy('share');
    const outcome = await shareOut(photo.id, photo.url);
    if (outcome === 'shared') await alertWatchers('share', ACTIONS_ARE_SIMULATED ? 'Share simulated.' : 'Shared.');
    else if (outcome === 'failed') setNotice("Couldn't open sharing. No one was texted.");
    else setNotice('Sharing cancelled, so no one was texted.');
    setBusy(null);
  }

  async function download() {
    if (!photo?.url) return;
    setNotice('');
    setBusy('download');
    const outcome = await saveToCameraRoll(photo.id, photo.url);
    if (outcome === 'saved') {
      await alertWatchers('download', ACTIONS_ARE_SIMULATED ? 'Download simulated.' : 'Saved to your camera roll.');
    } else if (outcome === 'denied') {
      setNotice("Lookout isn't allowed to add to your photos, so nothing was saved and no one was texted.");
    } else setNotice("Couldn't save the photo. No one was texted.");
    setBusy(null);
  }

  async function remove() {
    if (!photo) return;
    const agreed = await confirmDestructive(
      'Delete this photo?',
      names.length
        ? `It's removed from Lookout for good, and ${
            names.length === 1 ? `${names[0]} gets` : 'its watchers get'
          } a text saying it was deleted.`
        : "It's removed from Lookout for good.",
      'Delete',
    );
    if (!agreed) return;
    setNotice('');
    setBusy('delete');
    // The server does the deleting, so this can't happen without the watchers being told.
    const result = await reportEvent(photo.id, 'delete');
    if (!result.ok) {
      setBusy(null);
      setNotice(result.network ? "You're offline, so the photo wasn't deleted." : result.error);
      return;
    }
    closing.current = true;
    router.back();
    refresh();
  }

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
          <Text style={styles.meta}>
            {addedOn(photo.created_at)}
            {blocked ? '  ·  Downloads blocked' : ''}
          </Text>
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change who watches this photo"
        disabled={busy !== null}
        onPress={() => router.push({ pathname: '/photo-watchers', params: { ids: photo.id } })}
        style={({ pressed }) => [styles.watchRow, { opacity: pressed ? 0.6 : 1 }]}>
        {names.length ? (
          <AvatarStack names={names} size={28} max={4} ring="#000000" />
        ) : (
          <View style={styles.nobody}>
            <SymbolView
              name={{ ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' }}
              tintColor="#ff7a33"
              size={16}
            />
          </View>
        )}
        <Text style={[styles.watching, !names.length && { color: '#ffb48a' }]}>{watching}</Text>
      </Pressable>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}

      <View style={styles.actions}>
        {blocked ? null : (
          <>
            <Action
              label="Share"
              hint={demo}
              symbol={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }}
              busy={busy === 'share'}
              disabled={busy !== null}
              onPress={share}
            />
            <Action
              label="Download"
              hint={demo}
              symbol={{ ios: 'arrow.down.to.line', android: 'download', web: 'download' }}
              busy={busy === 'download'}
              disabled={busy !== null}
              onPress={download}
            />
          </>
        )}
        {Platform.OS === 'web' ? (
          // A browser can't tell when a screenshot is taken, so the demo has a button for it.
          <Action
            label="Screenshot"
            hint="test"
            symbol={{ ios: 'camera.viewfinder', android: 'screenshot', web: 'screenshot' }}
            disabled={busy !== null}
            onPress={() => alertWatchers('screenshot', 'Screenshot noticed.')}
          />
        ) : null}
        <Action
          tone="danger"
          label="Delete"
          symbol={{ ios: 'trash', android: 'delete', web: 'delete' }}
          busy={busy === 'delete'}
          disabled={busy !== null}
          onPress={remove}
        />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#9a9a9f', fontSize: 13, marginTop: 1 },
  picture: { flex: 1 },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#161618',
  },
  nobody: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3a1d0e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watching: { flex: 1, color: '#e5e5ea', fontSize: 14, lineHeight: 19 },
  notice: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 8,
  },
  action: { flex: 1, minWidth: 0, alignItems: 'center', gap: 6 },
  actionCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1f1f22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleDanger: { backgroundColor: '#2a1513' },
  actionLabel: { color: '#ffffff', fontSize: 12, fontWeight: '500', textAlign: 'center' },
  actionHint: { color: '#8e8e93', fontSize: 11, marginTop: -4 },
});
