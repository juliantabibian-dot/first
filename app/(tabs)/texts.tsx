import { useFocusEffect } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';

import { AccountButton } from '@/components/AccountButton';
import { ErrorText, ScreenHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatPhone } from '@/lib/phone';
import { isDemo, supabase } from '@/lib/supabase';
import { type Palette, type, useTheme } from '@/lib/theme';
import { clock, dayLabel } from '@/lib/time';
import { Text } from '@/components/Text';

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

type Kind = {
  label: string;
  symbol: SymbolViewProps['name'];
  /** Alerts are about something happening to a photo; the rest is housekeeping. */
  alert: boolean;
};

const sym = (ios: string, material: string): SymbolViewProps['name'] =>
  ({ ios, android: material, web: material }) as SymbolViewProps['name'];

/** What a text was about, read from its wording (the templates live in supabase/functions/_shared/messages.ts). */
function kindOf(body: string): Kind {
  const has = (s: string) => body.includes(s);
  if (has('downloaded a photo')) return { label: 'Downloaded', symbol: sym('arrow.down.to.line', 'download'), alert: true };
  if (has('shared a photo')) return { label: 'Shared', symbol: sym('square.and.arrow.up', 'ios_share'), alert: true };
  if (has('took a screenshot')) return { label: 'Screenshot', symbol: sym('camera.viewfinder', 'screenshot'), alert: true };
  if (has('recorded their screen')) return { label: 'Screen recording', symbol: sym('record.circle', 'screen_record'), alert: true };
  if (has('deleted a photo')) return { label: 'Deleted', symbol: sym('trash', 'delete'), alert: true };
  if (has('deleted their Lookout account')) return { label: 'Account deleted', symbol: sym('person.crop.circle.badge.xmark', 'person_off'), alert: true };
  if (has('Your code is')) return { label: 'Code', symbol: sym('number', 'pin'), alert: false };
  if (has("You're confirmed")) return { label: 'Confirmed', symbol: sym('checkmark', 'check'), alert: false };
  if (has('Lookout test')) return { label: 'Test', symbol: sym('paperplane', 'send'), alert: false };
  if (has('made you a watcher')) return { label: 'Now watching', symbol: sym('eye', 'visibility'), alert: false };
  if (has('removed you as a watcher')) return { label: 'Removed', symbol: sym('eye.slash', 'visibility_off'), alert: false };
  return { label: 'Text', symbol: sym('message', 'chat'), alert: false };
}

function TextRow({ item, t }: { item: SentText; t: Palette }) {
  const kind = kindOf(item.body);
  const note = STATUS_NOTES[item.status];
  return (
    <View style={styles.row}>
      <View
        style={[styles.icon, { backgroundColor: kind.alert ? t.alertSoft : t.fill }]}
        accessibilityElementsHidden
        importantForAccessibility="no">
        <SymbolView name={kind.symbol} tintColor={kind.alert ? t.alert : t.ink} size={15} />
      </View>
      <View style={styles.rowBody}>
        <View style={styles.to}>
          <Text style={[type.footnote, styles.kind, { color: kind.alert ? t.alert : t.muted }]}>
            {kind.label}
          </Text>
          <Text
            style={[type.footnote, styles.toText, { color: t.muted }]}
            numberOfLines={1}
            accessibilityLabel={`to ${item.watcher_name}, ${formatPhone(item.watcher_phone)}`}>
            to <Text style={{ color: t.ink, fontWeight: '600' }}>{item.watcher_name}</Text>
          </Text>
          <Text style={[type.footnote, { color: t.muted }]}>{clock(item.created_at)}</Text>
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

  // Newest first, one section per day.
  const sections = useMemo(() => {
    const out: { title: string; data: SentText[] }[] = [];
    for (const text of texts) {
      const title = dayLabel(text.created_at);
      if (out.at(-1)?.title === title) out.at(-1)!.data.push(text);
      else out.push({ title, data: [text] });
    }
    return out;
  }, [texts]);

  const alerts = texts.filter((x) => kindOf(x.body).alert).length;
  const subtitle = texts.length
    ? `${texts.length} sent${alerts ? ` · ${alerts} ${alerts === 1 ? 'alert' : 'alerts'}` : ''}`
    : 'Everything sent to your watchers';

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      <ScreenHeader title="Texts" subtitle={subtitle} right={<AccountButton />} />
      <SectionList
        contentContainerStyle={styles.content}
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[type.label, styles.day, { color: t.muted }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => <TextRow item={item} t={t} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} tintColor={t.muted} />
        }
        ListHeaderComponent={error ? <ErrorText>{error}</ErrorText> : undefined}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={t.muted} style={{ marginTop: 24 }} />
          ) : error ? undefined : (
            <View style={styles.empty}>
              <View style={[styles.sample, { backgroundColor: t.bubble }]}>
                <Text style={[type.callout, { color: t.muted }]}>
                  Lookout alert: someone downloaded a photo you're watching.
                </Text>
              </View>
              <Text style={[type.headline, { color: t.ink }]}>No texts yet</Text>
              <Text style={[type.callout, { color: t.muted, marginTop: 4 }]}>
                Every text Lookout sends to your watchers is kept here, so you can see exactly what
                they were told and when.
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
  content: { paddingHorizontal: 20, paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  day: { marginTop: 20, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 10 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  rowBody: { flex: 1, minWidth: 0, gap: 6 },
  to: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  kind: { fontWeight: '600' },
  toText: { flex: 1, fontVariant: ['tabular-nums'] },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  empty: { paddingTop: 12 },
  sample: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 20,
    opacity: 0.7,
  },
});
