import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { setConfirmHandler, type ConfirmRequest } from '@/lib/confirm';
import { useTheme } from '@/lib/theme';

/** The web version of the iPhone's confirmation alert. Mounted once, in the root layout. */
export function ConfirmHost() {
  const t = useTheme();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    setConfirmHandler(setRequest);
    return () => setConfirmHandler(null);
  }, []);

  function answer(agreed: boolean) {
    request?.resolve(agreed);
    setRequest(null);
  }

  return (
    <Modal transparent visible={request !== null} animationType="fade" onRequestClose={() => answer(false)}>
      <Pressable
        accessibilityLabel="Cancel"
        style={styles.scrim}
        onPress={() => answer(false)}>
        <Pressable
          accessibilityRole="alert"
          style={[styles.box, { backgroundColor: t.card, borderColor: t.line }]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: t.ink }]}>{request?.title}</Text>
          <Text style={[styles.message, { color: t.muted }]}>{request?.message}</Text>
          <View style={styles.buttons}>
            <View style={styles.flex}>
              <Button title="Cancel" variant="ghost" onPress={() => answer(false)} />
            </View>
            <View style={styles.flex}>
              <Button title={request?.action ?? 'OK'} variant="danger" onPress={() => answer(true)} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  box: { width: '100%', maxWidth: 360, borderRadius: 18, borderWidth: 1, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  message: { fontSize: 15, lineHeight: 21, marginBottom: 18 },
  buttons: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
