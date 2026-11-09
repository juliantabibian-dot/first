import { EmptyState } from '@/components/ui';

export default function Photos() {
  return (
    <EmptyState
      title="No photos yet"
      body="Uploading from your camera roll is the next thing being built. Photos you add here are the ones your watchers will be texted about."
    />
  );
}
