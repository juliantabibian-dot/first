import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AccountButton } from '@/components/AccountButton';
import { ErrorText, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/phone';
import { isDemo, supabase } from '@/lib/supabase';
import { type, useTheme } from '@/lib/theme';
import { ago } from '@/lib/time';

type SentText = {
  id: string;
  watcher_name: string;
  watcher_phone: string;
  body: string;
  /** 'sent', 'failed', 'queued', or 'simulated' when no real text could go out. */
  status: string;
  created_at: string;
};

const STATUS_NOTES: Record<string, string> = {
  simulated: isDemo ? 'Demo: not actually sent' : "Not sent. Real texting isn't switched on yet.",
  failed: "Couldn't be sent",
};

function TextRow({ item }: { item: SentText }) {
  const t = useTheme();
  const alert = item.body.startsWith('Lookout alert');
  const note = STATUS_NOTES[item.status];
  return (
    <View style={styles.row}>
      <View style={styles.to}>
        {/* A red dot marks the texts that report something happening to a photo. */}
        {alert ? <View style={[styles.dot, { backgroundColor: t.danger }]} /> : null}
        <Text style={[type.callout, styles.toText, { color: t.muted }]} numberOfLines={1}>
          <Text style={{ color: t.ink, fontWeight: '600' }}>{item.watcher_name}</Text>
          {'  '}
          {formatPhone(item.watcher_phone)}
        </Text>
        <Text style={[type.footnote, { color: t.muted }]}>{ago(item.created_at)}</Text>
      </View>
      <View style={[styles.bubble, { backgroundColor: t.bubble }]}>
        <Text style={[type.callout, { color: t.ink }]}>{item.body}</Text>
      </View>
      {note ? (
        <Text style={[type.footnote, { color: item.status === 'failed' ? t.danger : t.muted }]}>
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
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader title="Texts" subtitle="Sent to your watchers" right={<AccountButton />} />
      <FlatList
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
            <View>
              <Text style={[type.headline, { color: t.ink }]}>No texts yet</Text>
              <Text style={[type.callout, { color: t.muted, marginTop: 4 }]}>
                Every text Lookout sends to your watchers will be listed here.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 22,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  row: { gap: 6 },
  to: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  toText: { flex: 1, fontVariant: ['tabular-nums'] },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
