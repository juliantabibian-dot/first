import * as ScreenCapture from 'expo-screen-capture';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const NATIVE = Platform.OS !== 'web';

/**
 * While the screen using this is in front, iOS blanks the app out of
 * screenshots and screen recordings (iOS 13 and later). Used wherever photos
 * are on screen. `key` must be different for each screen.
 */
export function usePhotoShield(key: string) {
  useFocusEffect(
    useCallback(() => {
      if (!NATIVE) return;
      ScreenCapture.preventScreenCaptureAsync(key).catch(() => {});
      return () => {
        ScreenCapture.allowScreenCaptureAsync(key).catch(() => {});
      };
    }, [key]),
  );
}

/** Calls back when a screenshot is taken while this screen is in front. */
export function useScreenshotAlert(onScreenshot: () => void) {
  const latest = useRef(onScreenshot);
  latest.current = onScreenshot;
  useFocusEffect(
    useCallback(() => {
      if (!NATIVE) return;
      try {
        const subscription = ScreenCapture.addScreenshotListener(() => latest.current());
        return () => subscription.remove();
      } catch {
        return;
      }
    }, []),
  );
}

/** Blurs the app in the iPhone app switcher, so photos don't show in its preview. */
export function useAppSwitcherBlur() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => {});
  }, []);
}
