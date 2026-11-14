import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/AuthScreen';
import { Button, ErrorText, Field, TextButton } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** First sign-in only: ask for the name watchers will see in their texts. */
export default function Welcome() {
  const { saveName, signOut } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter your name.');
      return;
    }
    setBusy(true);
    const failure = await saveName(trimmed);
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <AuthScreen
      title="What's your name?"
      blurb="Your watchers see it in every text, like “Julian downloaded a photo you're watching.”">
      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        maxLength={30}
        autoFocus
        autoCapitalize="words"
        textContentType="givenName"
        placeholder="First name"
        onSubmitEditing={submit}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Continue" onPress={submit} loading={busy} />
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <TextButton title="Sign out" onPress={signOut} disabled={busy} />
      </View>
    </AuthScreen>
  );
}
