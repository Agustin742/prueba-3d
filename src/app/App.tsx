import { useState } from 'react';
import { AvatarEntry } from '../features/avatar/AvatarEntry';
import type { AvatarConfiguration } from '../features/avatar/AvatarCustomizer';
import type { AppearanceCatalogue } from '../features/avatar/avatar-appearance';
import { ReceptionPreview } from '../features/world/ReceptionPreview';

export function App() {
  const [entry, setEntry] = useState<{ configuration: AvatarConfiguration; catalogue: AppearanceCatalogue; warning?: string }>();
  return <main className="app-shell">
    {entry ? <>
      {entry.warning && <p role="status">{entry.warning}</p>}
      <ReceptionPreview multiplayer configuration={entry.configuration} catalogue={entry.catalogue} />
    </> : <AvatarEntry onConfirm={(configuration, catalogue, warning) => setEntry({ configuration, catalogue, warning })} />}
  </main>;
}
