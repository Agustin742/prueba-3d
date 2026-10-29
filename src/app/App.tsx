import { useState } from 'react';
import { AvatarEntry } from '../features/avatar/AvatarEntry';
import type { AvatarConfiguration } from '../features/avatar/AvatarCustomizer';
import type { AppearanceCatalogue } from '../features/avatar/avatar-appearance';
import { ReceptionPreview } from '../features/world/ReceptionPreview';

interface ConfirmedEntry {
  configuration: AvatarConfiguration;
  catalogue: AppearanceCatalogue;
  warning?: string;
}
export function App() {
  // Remembered preferences prefill the entry, never authorize skipping it on a fresh visit.
  const [confirmed, setConfirmed] = useState<ConfirmedEntry>();
  return (
    <main className="app-shell">
      {confirmed ? <>
        {confirmed.warning && <p role="status">{confirmed.warning}</p>}
        <ReceptionPreview multiplayer configuration={confirmed.configuration} catalogue={confirmed.catalogue} />
      </> : <AvatarEntry onConfirm={(configuration, catalogue, warning) => setConfirmed({ configuration, catalogue, warning })} />}
    </main>
  );
}
