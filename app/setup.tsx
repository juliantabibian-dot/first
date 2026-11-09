import { Text } from 'react-native';

import { AuthScreen } from '@/components/AuthScreen';
import { Card } from '@/components/ui';
import { useTheme } from '@/lib/theme';

/** Shown only when the app was started without Supabase keys. */
export default function Setup() {
  const t = useTheme();
  return (
    <AuthScreen title="Lookout" blurb="The app is running, but it isn't connected to a backend yet.">
      <Card>
        <Text style={{ color: t.ink, fontSize: 15, lineHeight: 22 }}>
          Copy .env.example to .env, fill in your Supabase project URL and anon key, then restart
          with “npx expo start --clear”. The README has the full steps.
        </Text>
      </Card>
    </AuthScreen>
  );
}
