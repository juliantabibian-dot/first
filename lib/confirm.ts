import { Alert, Platform } from 'react-native';

export type ConfirmRequest = {
  title: string;
  message: string;
  action: string;
  resolve: (agreed: boolean) => void;
};

/** Set by <ConfirmHost />, which draws the question on the web. */
let show: ((request: ConfirmRequest) => void) | null = null;

export function setConfirmHandler(handler: typeof show) {
  show = handler;
}

/** Asks before something that can't be undone. Resolves to true only if they agree. */
export function confirmDestructive(title: string, message: string, action: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        title,
        message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: action, style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
      return;
    }
    // Browsers' own confirm() is blocked inside embedded pages, so the app draws its own.
    if (show) show({ title, message, action, resolve });
    else resolve(false);
  });
}
