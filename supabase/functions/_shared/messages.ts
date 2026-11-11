// The exact wording of every text. `owner` is the app user's display name.

/** Stands in for the code wherever a text is stored for the owner to read. */
export const MASKED_CODE = '••••••';

export function codeText(owner: string, code: string): string {
  return `Lookout: ${owner} wants to add you as a photo watcher. Your code is ${code}. Give it to ${owner} to confirm. Reply STOP to opt out.`;
}

export function confirmedText(owner: string): string {
  return `Lookout: You're confirmed. ${owner} can now pick photos for you to watch.`;
}

export function testText(owner: string): string {
  return `Lookout test from ${owner}: alerts to this number are working. You don't need to reply.`;
}

/** Sent when the owner removes someone from their watcher list altogether. */
export function removedText(owner: string, photoCount: number): string {
  const photos = photoCount === 1 ? '1 photo' : `${photoCount} photos`;
  const scope = photoCount > 0 ? ` on ${photos}` : '';
  return `Lookout alert: ${owner} removed you as a watcher${scope}. You won't get alerts from them anymore.`;
}

/** Sent when someone is chosen to watch one or more photos. */
export function assignedText(owner: string, photoCount: number): string {
  const one = photoCount === 1;
  return `Lookout: ${owner} made you a watcher on ${one ? 'a photo' : `${photoCount} photos`}. You'll get a text if ${one ? "it's" : 'any of them is'} shared, downloaded or screenshotted.`;
}

/** Sent when someone is taken off one or more photos but stays on the watcher list. */
export function unassignedText(owner: string, photoCount: number): string {
  const one = photoCount === 1;
  return `Lookout alert: ${owner} removed you as a watcher on ${one ? 'a photo' : `${photoCount} photos`}. You won't be told about ${one ? 'it' : 'them'} anymore.`;
}
