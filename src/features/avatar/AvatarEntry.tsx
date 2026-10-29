import { useCallback, useRef, useState } from 'react';
import manifest from '../../../public/models/avatars/integration-catalogue.json';
import { AvatarCustomizer, type AvatarConfiguration } from './AvatarCustomizer';
import type { AppearanceCatalogue } from './avatar-appearance';
import { parseAppearanceCatalogue, toAppearanceChoices } from './avatar-catalogue';
import { loadAvatarPreferences, saveAvatarPreferences } from './avatar-preferences';
import { CustomizedAvatarPreview, appearancePreviewKey, type CustomizedPreviewStatus } from './CustomizedAvatarPreview';

interface PreparedEntry {
  catalogue: AppearanceCatalogue;
  choices: ReturnType<typeof toAppearanceChoices>;
  configuration: AvatarConfiguration;
  warning?: string;
}
export interface AvatarEntryProps {
  onConfirm(configuration: AvatarConfiguration, catalogue: AppearanceCatalogue, warning?: string): void;
}

export function AvatarEntry({ onConfirm }: AvatarEntryProps) {
  const [initial] = useState(() => {
    try {
      const catalogue = parseAppearanceCatalogue(manifest);
      return { catalogue, choices: toAppearanceChoices(catalogue), ...loadAvatarPreferences(catalogue) };
    } catch { return null; }
  });
  if (!initial) return <p role="alert">El catálogo de avatares no está disponible. Recargá para volver a intentarlo.</p>;
  return <EntryDraft initial={initial} onConfirm={onConfirm} />;
}

function EntryDraft({ initial, onConfirm }: {
  initial: PreparedEntry;
  onConfirm: AvatarEntryProps['onConfirm'];
}) {
  const [draft, setDraft] = useState({ configuration: initial.configuration, revision: 0 });
  const { configuration, revision } = draft;
  const [warning, setWarning] = useState(initial.warning);
  const key = `${revision}:${appearancePreviewKey(configuration)}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const [preview, setPreview] = useState<{ key: string; status: CustomizedPreviewStatus }>();
  const status = preview?.key === key ? preview.status : 'loading';
  const previewStatus = useCallback((status: CustomizedPreviewStatus) => {
    if (key === currentKey.current) setPreview({ key, status });
  }, [key]);

  return <AvatarCustomizer {...configuration} catalogues={initial.choices}
    status={status} persistenceWarning={warning}
    persistenceNotice="Al entrar, intentaremos recordar tu selección solo en este navegador. Si no se puede guardar, te avisaremos y podrás continuar esta sesión. No se guarda en una cuenta ni entre dispositivos. Al borrar los datos del navegador, se pierde."
    preview={<CustomizedAvatarPreview configuration={configuration} catalogue={initial.catalogue} onStatusChange={previewStatus} />}
    onChange={next => setDraft(current => ({
      configuration: next,
      revision: current.revision + (appearancePreviewKey(next) !== appearancePreviewKey(current.configuration) ? 1 : 0),
    }))}
    onEnter={confirmed => {
      if (status !== 'ready') return;
      const result = saveAvatarPreferences(confirmed, initial.catalogue);
      setWarning(result.warning);
      onConfirm(confirmed, initial.catalogue, result.warning);
    }} />;
}
