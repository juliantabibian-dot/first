import { Alert, Platform } from 'react-native';

/** Asks before something that can't be undone. Resolves to true only if they agree. */
export function confirmDestructive(title: string, message: string, action: string): Promise<boolean> {
  // Alert.alert does nothing on web, so the browser's own dialog is used there.
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: action, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
