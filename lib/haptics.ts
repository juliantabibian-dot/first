import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Small taps that confirm what happened, on iPhone only. Never allowed to throw.
const on = Platform.OS !== 'web';

export const haptic = {
  /** A choice was toggled. */
  tick: () => on && Haptics.selectionAsync().catch(() => {}),
  /** Something worked: a watcher confirmed, watchers saved, a photo uploaded. */
  success: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  /** Watchers were alerted, or something was deleted. */
  warning: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  /** Something was refused. */
  error: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
