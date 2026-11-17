import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useFonts } from 'expo-font';

import { ConfirmHost } from '@/components/ConfirmHost';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useAppSwitcherBlur } from '@/lib/capture';
import { FONT_FILES, fontFor } from '@/lib/fonts';
import { useTheme } from '@/lib/theme';
import { PhotosProvider } from '@/lib/photos';
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
  const t = useTheme();
  const { loading, session, profile } = useAuth();
  useAppSwitcherBlur();

  // If the font can't load for some reason, carry on in the system font.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const ready = !loading && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // React Navigation paints its own backgrounds and borders; match them to the palette.
  const base = t.bg === '#000000' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: t.bg, card: t.bg, text: t.ink, border: t.line, primary: t.ink },
  };

  const signedIn = Boolean(session);
  const inApp = signedIn && Boolean(profile);

  return (
    <ThemeProvider value={navTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.ink,
          headerTitleStyle: { fontFamily: fontFor(600) },
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !profile}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={inApp}>
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
            name="photo-watchers"
            options={{ presentation: 'modal', headerShown: true, title: 'Watchers' }}
          />
          <Stack.Screen
            name="photo/[id]"
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
      <ConfirmHost />
    </ThemeProvider>
  );
}
