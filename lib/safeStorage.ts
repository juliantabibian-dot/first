import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage that never throws. On the web it is backed by localStorage,
 * which a private window or an embedded page can refuse; values then live in
 * memory for the session instead of breaking sign-in.
 */
const memory = new Map<string, string>();

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};
