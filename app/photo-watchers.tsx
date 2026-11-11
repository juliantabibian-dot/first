import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, ErrorText } from '@/components/ui';
import { formatPhone } from '@/lib/phone';
import { usePhotos } from '@/lib/photos';
import { useTheme } from '@/lib/theme';
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
    if (!result.ok) return setError(result.error);
    router.back();
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      {kept ? (
        <View style={[styles.kept, { backgroundColor: t.warnSoft }]}>
          <Text style={[styles.keptText, { color: t.warn }]}>
            The originals weren't deleted, so they are still in your camera roll.
          </Text>
        </View>
      ) : null}
      <Text style={[styles.heading, { color: t.ink }]}>
        Who watches {many ? `these ${photoIds.length} photos` : 'this photo'}?
      </Text>
      <Text style={[styles.sub, { color: t.muted }]}>
        They get a text if {many ? 'any of them is' : "it's"} shared, downloaded or screenshotted.
        Anyone you add or remove gets a text about that too.
      </Text>

      {options.length ? (
        <View accessibilityRole="list" style={styles.list}>
          {options.map((w) => {
            const on = selected.includes(w.id);
            return (
              <Pressable
                key={w.id}
                accessibilityRole="checkbox"
                // aria-checked is what the web build reads; accessibilityState is for iOS.
                aria-checked={on}
                accessibilityState={{ checked: on, disabled: busy }}
                accessibilityLabel={w.name}
                disabled={busy}
                onPress={() => toggle(w.id)}
                style={[
                  styles.option,
                  { backgroundColor: on ? t.accentSoft : t.card, borderColor: on ? t.accent : t.line },
                ]}>
                <View
                  style={[
                    styles.check,
                    { borderColor: on ? t.accent : t.muted, backgroundColor: on ? t.accent : 'transparent' },
                  ]}>
                  {on ? <Text style={[styles.tick, { color: t.onAccent }]}>✓</Text> : null}
                </View>
                <View style={styles.optionText}>
                  <Text style={[styles.name, { color: t.ink }]}>{w.name}</Text>
                  <Text style={[styles.phone, { color: t.muted }]}>
                    {formatPhone(w.phone_e164)}
                    {w.status === 'opted_out' ? ' · opted out of texts' : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.list}>
          <Card>
            <Text style={[styles.empty, { color: t.muted }]}>
              You don't have any confirmed watchers yet. Add someone's number on the Watchers tab
              and confirm it with the code they get. Then come back to this photo.
            </Text>
          </Card>
        </View>
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}
      {options.length ? (
        <>
          <Button title="Save" onPress={save} loading={busy} />
          <View style={{ height: 8 }} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} disabled={busy} />
        </>
      ) : (
        <>
          <Button title="Go to Watchers" onPress={() => router.replace('/watchers')} />
          <View style={{ height: 8 }} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  kept: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14 },
  keptText: { fontSize: 14, lineHeight: 20 },
  heading: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  list: { gap: 10, marginTop: 16, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
  optionText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  phone: { fontSize: 13, marginTop: 2 },
  empty: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
