import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Choice, Divider, ErrorText, Group, NoteText, TextButton } from '@/components/ui';
import { Avatar } from '@/components/people';
import { haptic } from '@/lib/haptics';
import { formatPhone } from '@/lib/phone';
import { usePhotos } from '@/lib/photos';
import { type, useTheme } from '@/lib/theme';
import { useWatchers } from '@/lib/watchers';

/**
 * Choose who watches one photo, or a batch that was just uploaded.
 * `ids` is a comma-separated list of photo ids.
 */
export default function PhotoWatchers() {
  const t = useTheme();
  const { ids, kept } = useLocalSearchParams<{ ids: string; kept?: string }>();
  const { photos, loading, setWatchers } = usePhotos();
  const { watchers } = useWatchers();

  const photoIds = useMemo(() => (ids ?? '').split(',').filter(Boolean), [ids]);
  const chosen = photos.filter((p) => photoIds.includes(p.id));
  const many = photoIds.length > 1;

  // One photo starts from who watches it now; a fresh batch starts empty.
  const current = chosen.length === 1 ? chosen[0].watcherIds : [];
  const [picked, setPicked] = useState<string[] | null>(null);
  const selected = picked ?? current;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Confirmed watchers can be chosen. Someone already on the photo stays listed
  // (so they can be taken off) even if they have since opted out.
  const options = watchers.filter((w) => w.status === 'verified' || current.includes(w.id));

  if (!photoIds.length || (!loading && chosen.length !== photoIds.length)) {
    return <Redirect href="/" />;
  }

  function toggle(id: string) {
    setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  async function save() {
    setError('');
    setBusy(true);
    const result = await setWatchers(photoIds, selected);
    setBusy(false);
    if (!result.ok) {
      haptic.error();
      return setError(result.error);
    }
    haptic.success();
    router.back();
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      {kept ? (
        <NoteText>The originals weren't deleted, so they are still in your camera roll.</NoteText>
      ) : null}
      <Text accessibilityRole="header" style={[type.title, { color: t.ink }]}>
        Who watches {many ? `these ${photoIds.length} photos` : 'this photo'}?
      </Text>
      <Text style={[type.callout, styles.sub, { color: t.muted }]}>
        They get a text if {many ? 'any of them is' : "it's"} shared, downloaded or screenshotted.
        Anyone you add or remove gets a text about that too.
      </Text>

      {options.length ? (
        <Group style={styles.group}>
          {options.map((w, index) => (
            <View key={w.id}>
              {index ? <Divider inset={94} /> : null}
              <Choice
                kind="checkbox"
                selected={selected.includes(w.id)}
                title={w.name}
                body={`${formatPhone(w.phone_e164)}${
                  w.status === 'opted_out' ? ' · opted out of texts' : ''
                }`}
                disabled={busy}
                leading={<Avatar name={w.name} size={34} />}
                onPress={() => toggle(w.id)}
              />
            </View>
          ))}
        </Group>
      ) : (
        <Text style={[type.callout, styles.empty, { color: t.muted }]}>
          You don't have any confirmed watchers yet. Add someone's number on the Watchers tab and
          confirm it with the code they get. Then come back to this photo.
        </Text>
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {options.length ? (
        <Button title="Save" onPress={save} loading={busy} />
      ) : (
        <Button title="Go to Watchers" onPress={() => router.replace('/watchers')} />
      )}
      <View style={styles.later}>
        <TextButton title="Not now" onPress={() => router.back()} disabled={busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  sub: { marginTop: 4 },
  group: { marginTop: 16, marginBottom: 20 },
  empty: { marginTop: 16, marginBottom: 20 },
  later: { alignItems: 'center', marginTop: 18 },
});
