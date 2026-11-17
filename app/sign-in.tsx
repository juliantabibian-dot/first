import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen } from '@/components/AuthScreen';
import { DemoNotice } from '@/components/DemoNotice';
import { Button, ErrorText, Field, TextButton } from '@/components/ui';
import { formatPhone, toE164 } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { type, useTheme } from '@/lib/theme';

export default function SignIn() {
  const t = useTheme();
  const [phoneInput, setPhoneInput] = useState('');
  /** Set once a code has been texted; switches the form to the code step. */
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const phone = toE164(phoneInput);
    if (!phone) {
      setError('Enter a full phone number, like (555) 123-4567.');
      return;
    }
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCode('');
    setSentTo(phone);
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: 'sms' });
    setBusy(false);
    // On success the auth listener swaps this screen out.
    if (error) setError("That code didn't work. Check it, or text a new one.");
  }

  return (
    <AuthScreen
      title="Lookout"
      blurb="Pick who watches each photo. If it gets shared, saved or screenshotted, they get a text.">
      <DemoNotice>
        Nothing is sent and everything stays on this phone. Use any phone number, and any 6 digits
        as the code.
      </DemoNotice>
      {sentTo ? (
        <>
          <Field
            label={`Code sent to ${formatPhone(sentTo)}`}
            accessibilityLabel="Code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            placeholder="6 digits"
            style={{ fontVariant: ['tabular-nums'], letterSpacing: code ? 4 : 0 }}
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button title="Sign in" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <TextButton
              title="Use a different number"
              disabled={busy}
              onPress={() => {
                setSentTo(null);
                setError('');
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Field
            label="Your phone number"
            value={phoneInput}
            onChangeText={setPhoneInput}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            onSubmitEditing={sendCode}
            style={{ fontVariant: ['tabular-nums'] }}
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button title="Text me a code" onPress={sendCode} loading={busy} />
          <Text style={[type.footnote, { color: t.muted, marginTop: 14 }]}>
            New here? This creates your account.
          </Text>

          {/* The product in one glance: the text a watcher actually receives. */}
          <View style={[styles.preview, { borderTopColor: t.line }]}>
            <Text style={[type.label, { color: t.muted }]}>What a watcher gets</Text>
            <View style={styles.thread}>
              <Text style={[type.footnote, styles.sender, { color: t.muted }]}>Lookout · now</Text>
              <View style={[styles.bubble, { backgroundColor: t.bubble }]}>
                <Text style={[type.callout, { color: t.ink }]}>
                  Lookout alert: Sam downloaded a photo you're watching. It's now saved outside
                  the app.
                </Text>
              </View>
            </View>
          </View>
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 40, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  thread: { marginTop: 12 },
  sender: { marginBottom: 6, marginLeft: 4 },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
