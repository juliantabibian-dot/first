import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText } from '@/components/ui';
import { CAN_DELETE_ORIGINALS, deleteOriginals } from '@/lib/photoActions';
import { usePhotos, type DownloadPolicy } from '@/lib/photos';
import { useTheme } from '@/lib/theme';

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip}>
        {pending.map((p) => (
          <Image
            key={p.uri}
            source={{ uri: p.uri }}
            contentFit="cover"
            style={[styles.thumb, { backgroundColor: t.line }]}
          />
        ))}
      </ScrollView>

      <Text style={[styles.heading, { color: t.ink }]}>
        Can {many ? `these ${pending.length} photos` : 'this photo'} be downloaded?
      </Text>
      <Text style={[styles.sub, { color: t.muted }]}>
        You choose once. It can't be changed after the upload.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.options}>
        {OPTIONS.map((option) => {
          const selected = policy === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              aria-checked={selected}
              accessibilityState={{ selected, checked: selected, disabled: busy }}
              accessibilityLabel={option.title}
              disabled={busy}
              onPress={() => setPolicy(option.value)}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? t.accentSoft : t.card,
                  borderColor: selected ? t.accent : t.line,
                },
              ]}>
              <View style={[styles.radio, { borderColor: selected ? t.accent : t.muted }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: t.accent }]} /> : null}
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: t.ink }]}>{option.title}</Text>
                <Text style={[styles.optionBody, { color: t.muted }]}>{option.body(many)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {canDeleteOriginals ? (
        <Pressable
          accessibilityRole="checkbox"
          aria-checked={deleteAfter}
          accessibilityState={{ checked: deleteAfter, disabled: busy }}
          accessibilityLabel="Delete the originals from my camera roll"
          disabled={busy}
          onPress={() => setDeleteAfter(!deleteAfter)}
          style={[
            styles.option,
            styles.originals,
            {
              backgroundColor: deleteAfter ? t.accentSoft : t.card,
              borderColor: deleteAfter ? t.accent : t.line,
            },
          ]}>
          <View
            style={[
              styles.checkbox,
              {
                borderColor: deleteAfter ? t.accent : t.muted,
                backgroundColor: deleteAfter ? t.accent : 'transparent',
              },
            ]}>
            {deleteAfter ? <Text style={[styles.tick, { color: t.onAccent }]}>✓</Text> : null}
          </View>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: t.ink }]}>
              Delete the {many ? 'originals' : 'original'} from my camera roll
            </Text>
            <Text style={[styles.optionBody, { color: t.muted }]}>
              After the upload, so the only copy is the one in Lookout. Lookout keeps a smaller
              copy (up to 1600 pixels), so the full-size {many ? 'originals' : 'original'} will be
              gone. iPhone asks you to confirm, then keeps {many ? 'them' : 'it'} in Recently
              Deleted for 30 days.
            </Text>
          </View>
        </Pressable>
      ) : null}

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
      <View style={{ height: 8 }} />
      <Button
        title="Cancel"
        variant="ghost"
        disabled={busy}
        onPress={() => {
          router.back();
          setPending([]);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  strip: { marginBottom: 20, flexGrow: 0 },
  thumb: { width: 88, height: 88, borderRadius: 12, marginRight: 8 },
  heading: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, marginTop: 4 },
  options: { gap: 10, marginTop: 16, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  originals: { marginBottom: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 14, fontWeight: '800', lineHeight: 17 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600' },
  optionBody: { fontSize: 14, lineHeight: 20, marginTop: 2 },
});
