import { useState } from 'react';
import { Text, View } from 'react-native';

import { AuthScreen } from '@/components/AuthScreen';
import { DemoNotice } from '@/components/DemoNotice';
import { Button, Card, ErrorText, Field } from '@/components/ui';
import { formatPhone, toE164 } from '@/lib/phone';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

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
      <Card>
        {sentTo ? (
          <>
            <Text style={{ color: t.muted, fontSize: 14, marginBottom: 12 }}>
              We texted a 6-digit code to {formatPhone(sentTo)}.
            </Text>
            <Field
              label="Code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="123456"
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title="Sign in" onPress={verify} loading={busy} disabled={code.length !== 6} />
            <View style={{ height: 8 }} />
            <Button
              title="Use a different number"
              variant="ghost"
              disabled={busy}
              onPress={() => {
                setSentTo(null);
                setError('');
              }}
            />
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
            />
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Button title="Text me a code" onPress={sendCode} loading={busy} />
            <Text style={{ color: t.muted, fontSize: 13, marginTop: 12, textAlign: 'center' }}>
              New here? This creates your account.
            </Text>
          </>
        )}
      </Card>
    </AuthScreen>
  );
}
