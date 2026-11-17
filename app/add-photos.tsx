import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Choice, Divider, ErrorText, Group, TextButton } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { CAN_DELETE_ORIGINALS, deleteOriginals } from '@/lib/photoActions';
import { usePhotos, type DownloadPolicy } from '@/lib/photos';
import { type, useTheme } from '@/lib/theme';

const OPTIONS: { value: DownloadPolicy; title: string; body: (many: boolean) => string }[] = [
  {
    value: 'alert',
    title: 'Allow downloads',
    body: (many) =>
      `${many ? 'They' : 'It'} can be shared or saved to the camera roll from Lookout. ${
        many ? 'Their' : 'Its'
      } watchers get a text every time.`,
  },
  {
    value: 'blocked',
    title: 'Block downloads',
    body: (many) => `${many ? 'They' : 'It'} can never be saved or shared out of Lookout.`,
  },
];

/** Shown right after picking from the camera roll, before anything is uploaded. */
export default function AddPhotos() {
  const t = useTheme();
  const { pending, setPending, uploadPending } = usePhotos();
  const [policy, setPolicy] = useState<DownloadPolicy | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [deleteAfter, setDeleteAfter] = useState(false);

  /** Ids uploaded so far, kept across a retry of a partly failed batch. */
  const uploadedIds = useRef<string[]>([]);
  /** True if deleting the originals was asked for but didn't happen. */
  const originalsKept = useRef(false);
  /** Set once this screen is handing over to the watcher picker. */
  const leaving = useRef(false);

  if (!pending.length) return leaving.current ? null : <Redirect href="/" />;

  const many = pending.length > 1;
  // Only offered when the camera roll told us which photos these are.
  const canDeleteOriginals = CAN_DELETE_ORIGINALS && pending.every((p) => p.assetId);
  const busy = progress !== null;

  async function add() {
    if (!policy) return;
    setError('');
    setProgress({ done: 0, total: pending.length });
    const { added, addedIds, failed } = await uploadPending(policy, (done, total) =>
      setProgress({ done, total }),
    );
    setProgress(null);
    uploadedIds.current.push(...addedIds);
    // Originals go only for photos that are now safely in Lookout.
    const uploaded = pending.filter((p) => !failed.includes(p));
    if (deleteAfter && canDeleteOriginals && uploaded.length) {
      const outcome = await deleteOriginals(uploaded.map((p) => p.assetId as string));
      if (outcome === 'kept') originalsKept.current = true;
    }
    if (!failed.length) {
      haptic.success();
      // Straight on to "Who watches these photos?" for everything just uploaded.
      leaving.current = true;
      router.replace({
        pathname: '/photo-watchers',
        params: { ids: uploadedIds.current.join(','), kept: originalsKept.current ? '1' : '' },
      });
      setPending([]);
      return;
    }
    setError(
      added
        ? `${added} of ${pending.length} uploaded. Try again to add the rest.`
        : "Couldn't upload. Check your connection and try again.",
    );
    setPending(failed);
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.strip}
        contentContainerStyle={styles.stripContent}>
        {pending.map((p) => (
          <Image
            key={p.uri}
            source={{ uri: p.uri }}
            contentFit="cover"
            style={[styles.thumb, { backgroundColor: t.fill }]}
          />
        ))}
      </ScrollView>

      <View style={styles.body}>
        <Text accessibilityRole="header" style={[type.title, { color: t.ink }]}>
          Can {many ? `these ${pending.length} photos` : 'this photo'} be downloaded?
        </Text>
        <Text style={[type.callout, styles.sub, { color: t.muted }]}>
          You choose once. It can't be changed after the upload.
        </Text>

        <Group style={styles.group}>
          <View accessibilityRole="radiogroup">
            {OPTIONS.map((option, index) => (
              <View key={option.value}>
                {index ? <Divider inset={48} /> : null}
                <Choice
                  kind="radio"
                  selected={policy === option.value}
                  title={option.title}
                  body={option.body(many)}
                  disabled={busy}
                  onPress={() => setPolicy(option.value)}
                />
              </View>
            ))}
          </View>
        </Group>

        {canDeleteOriginals ? (
          <Group style={styles.group}>
            <Choice
              kind="checkbox"
              selected={deleteAfter}
              title={`Delete the ${many ? 'originals' : 'original'} from my camera roll`}
              body={`After the upload, so the only copy is the one in Lookout. Lookout keeps a smaller copy (up to 1600 pixels), so the full-size ${
                many ? 'originals' : 'original'
              } will be gone. iPhone asks you to confirm, then keeps ${
                many ? 'them' : 'it'
              } in Recently Deleted for 30 days.`}
              disabled={busy}
              onPress={() => setDeleteAfter(!deleteAfter)}
            />
          </Group>
        ) : null}

        <View style={styles.gap} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button
          title={
            busy
              ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
              : `Add ${many ? `${pending.length} photos` : 'photo'}`
          }
          onPress={add}
          disabled={!policy || busy}
        />
        <View style={styles.cancel}>
          <TextButton
            title="Cancel"
            disabled={busy}
            onPress={() => {
              router.back();
              setPending([]);
            }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  strip: { flexGrow: 0, marginTop: 8, marginBottom: 24 },
  stripContent: { paddingHorizontal: 20, gap: 2 },
  thumb: { width: 96, height: 96 },
  body: { paddingHorizontal: 20 },
  sub: { marginTop: 4 },
  group: { marginTop: 16 },
  gap: { height: 24 },
  cancel: { alignItems: 'center', marginTop: 18 },
});
