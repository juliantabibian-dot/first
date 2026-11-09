import { useState } from 'react';
import { View } from 'react-native';

import { AuthScreen } from '@/components/AuthScreen';
import { Button, Card, ErrorText, Field } from '@/components/ui';
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
      blurb="Your watchers see this in every text, like “Julian downloaded a photo you're watching.”">
      <Card>
        <Field
          label="Your name"
          value={name}
          onChangeText={setName}
          maxLength={30}
          autoFocus
          autoCapitalize="words"
          textContentType="givenName"
          placeholder="Julian"
          onSubmitEditing={submit}
        />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <Button title="Continue" onPress={submit} loading={busy} />
        <View style={{ height: 8 }} />
        <Button title="Sign out" variant="ghost" onPress={signOut} disabled={busy} />
      </Card>
    </AuthScreen>
  );
}
