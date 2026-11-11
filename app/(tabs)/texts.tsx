import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Card, ErrorText } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/phone';
import { isDemo, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { ago } from '@/lib/time';

type SentText = {
  id: string;
  watcher_name: string;
  watcher_phone: string;
  body: string;
  /** 'sent', 'failed', 'queued', or 'simulated' when Twilio isn't connected. */
  status: string;
  created_at: string;
};

const STATUS_NOTES: Record<string, string> = {
  simulated: isDemo ? 'Demo: not actually sent' : "Not actually sent — real texting isn't switched on yet",
  failed: "Couldn't be sent",
};

function TextRow({ item }: { item: SentText }) {
  const t = useTheme();
  const alert = item.body.startsWith('Lookout alert');
  const note = STATUS_NOTES[item.status];
  return (
    <View style={[styles.row, { backgroundColor: t.card, borderColor: t.line }]}>
      <View style={styles.to}>
        <Text style={[styles.toText, { color: t.muted }]} numberOfLines={1}>
          <Text style={[styles.name, { color: t.ink }]}>{item.watcher_name}</Text>
          {' · '}
          {formatPhone(item.watcher_phone)}
        </Text>
        <Text style={[styles.when, { color: t.muted }]}>{ago(item.created_at)}</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: alert ? t.dangerSoft : t.line }]}>
        <Text style={[styles.body, { color: t.ink }]}>{item.body}</Text>
      </View>
      {note ? (
        <Text style={[styles.note, { color: item.status === 'failed' ? t.danger : t.warn }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

export default function Texts() {
  const t = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [texts, setTexts] = useState<SentText[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error: loadError } = await supabase
      .from('texts')
      .select('id, watcher_name, watcher_phone, body, status, created_at')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (loadError) {
      setError("Couldn't load your texts. Pull down to try again.");
    } else {
      setTexts(data);
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  // Texts are sent from the other tabs, so reload each time this one is opened.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.content}
      data={texts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TextRow item={item} />}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={t.muted} />
      }
      ListHeaderComponent={error ? <ErrorText>{error}</ErrorText> : undefined}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={t.muted} style={{ marginTop: 24 }} />
        ) : error ? undefined : (
          <Card>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>No texts yet</Text>
            <Text style={[styles.emptyBody, { color: t.muted }]}>
              Every text Lookout sends to your watchers will be listed here.
            </Text>
          </Card>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10, width: '100%', maxWidth: 560, alignSelf: 'center' },
  row: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  to: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  toText: { flex: 1, fontSize: 13 },
  name: { fontWeight: '700' },
  when: { fontSize: 13 },
  bubble: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  body: { fontSize: 15, lineHeight: 21 },
  note: { fontSize: 12, fontWeight: '600' },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
