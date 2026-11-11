// A browser can't open the iPhone share sheet or save to the camera roll, so on
// the web these only pretend to, and the alert that would follow is still sent.

export const ACTIONS_ARE_SIMULATED = true;

export async function saveToCameraRoll(_id: string, _url: string): Promise<'saved' | 'denied' | 'failed'> {
  return 'saved';
}

export async function shareOut(_id: string, _url: string): Promise<'shared' | 'cancelled' | 'failed'> {
  return 'shared';
}

export const CAN_DELETE_ORIGINALS = false;

export async function deleteOriginals(_assetIds: string[]): Promise<'deleted' | 'kept'> {
  return 'kept';
}
