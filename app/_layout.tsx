import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/lib/auth';
import { PhotosProvider } from '@/lib/photos';
import { isConfigured } from '@/lib/supabase';
import { WatchersProvider } from '@/lib/watchers';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <PhotosProvider>
        <WatchersProvider>
          <RootNav />
        </WatchersProvider>
      </PhotosProvider>
    </AuthProvider>
  );
}

function RootNav() {
  const scheme = useColorScheme();
  const { loading, session, profile } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  const signedIn = Boolean(session);
  const ready = signedIn && Boolean(profile);

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!isConfigured}>
          <Stack.Screen name="setup" />
        </Stack.Protected>
        <Stack.Protected guard={isConfigured && !signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !profile}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="account"
            options={{ presentation: 'modal', headerShown: true, title: 'Account' }}
          />
          <Stack.Screen
            name="add-photos"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Add photos',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="photo/[id]"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
