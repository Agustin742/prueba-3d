import type { AvatarBody, AvatarConfiguration } from './AvatarCustomizer';
import type { AppearanceCatalogue } from './avatar-appearance';

export const appearancePreferenceKey = 'avatar_appearance:v1';
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
export interface LoadedAvatarPreferences { configuration: AvatarConfiguration; warning?: string }
export interface SavedAvatarPreferences { saved: boolean; warning?: string }
// Match the existing customizer palettes; arbitrary CSS colors are not accepted.
const hairColors = ['#6c4d48', '#af6d63', '#e5ad58', '#353849', '#c77daa'];
const clothingColors = ['#5b4f96', '#75b7da', '#f2c85c', '#efa5ae', '#7eba8b', '#f4e6d2'];
const storageWarning = 'No pudimos guardar o recuperar tu selección en este navegador. Podés continuar sin guardarla; no se guarda en una cuenta.';
const invalidWarning = 'La selección guardada no es válida. Usamos opciones iniciales sin sobrescribirla; revisá tu avatar antes de entrar.';

/** Editable in-memory defaults from a parsed catalogue; empty nickname still requires entry input. */
export function defaultAvatarConfiguration(catalogue: AppearanceCatalogue, body: AvatarBody = 'male'): AvatarConfiguration {
  const selected = catalogue.bodies.find(item => item.id === body);
  if (!selected?.hair[0] || !selected.tops[0]) throw Error('A validated appearance catalogue is required');
  return { body, hairId: selected.hair[0].id, topId: selected.tops[0].id, accessoryId: null,
    hairColor: hairColors[0], clothingColor: clothingColors[0], nickname: '' };
}
/** Return a field-only configuration or null. Nickname may be empty for drafts; save requires it. */
export function validateAvatarConfiguration(value: unknown, catalogue: AppearanceCatalogue): AvatarConfiguration | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  const { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname } = config;
  if ((body !== 'male' && body !== 'female') || typeof hairId !== 'string' || typeof topId !== 'string'
    || (accessoryId !== null && typeof accessoryId !== 'string') || typeof hairColor !== 'string'
    || typeof clothingColor !== 'string' || typeof nickname !== 'string') return null;
  const selected = catalogue.bodies.find(item => item.id === body);
  if (!selected?.hair.some(item => item.id === hairId) || !selected.tops.some(item => item.id === topId)
    || (accessoryId !== null && !selected.accessories.some(item => item.id === accessoryId))
    || !hairColors.includes(hairColor) || !clothingColors.includes(clothingColor)) return null;
  return { body, hairId, topId, accessoryId, hairColor, clothingColor, nickname };
}
function browserStorage(): PreferenceStorage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}
/** Read only: never repairs or autosaves preferences. Omit storage for browser localStorage;
 * pass null for unavailable storage or a Storage-like object for tests. Caller owns in-memory state.
 * Legacy nickname is read only when the versioned preference is absent, never written here.
 */
export function loadAvatarPreferences(catalogue: AppearanceCatalogue, storage: PreferenceStorage | null = browserStorage()): LoadedAvatarPreferences {
  const defaults = defaultAvatarConfiguration(catalogue);
  if (!storage) return { configuration: defaults, warning: storageWarning };
  try {
    const raw = storage.getItem(appearancePreferenceKey);
    if (raw === null) {
      return { configuration: { ...defaults, nickname: storage.getItem('avatar_nickname') ?? '' } };
    }
    const envelope: unknown = JSON.parse(raw);
    if (envelope && typeof envelope === 'object' && !Array.isArray(envelope)) {
      const stored = envelope as Record<string, unknown>;
      const configuration = stored.version === 1 ? validateAvatarConfiguration(stored.configuration, catalogue) : null;
      if (configuration && configuration.nickname.trim()) return { configuration };
    }
    return { configuration: defaults, warning: invalidWarning };
  } catch {
    return { configuration: defaults, warning: storageWarning };
  }
}
/** Call only on confirmed entry, never on draft changes. Success means this browser only.
 * Writes one versioned field-only record; no account, network or legacy-key writes.
 */
export function saveAvatarPreferences(value: unknown, catalogue: AppearanceCatalogue, storage: PreferenceStorage | null = browserStorage()): SavedAvatarPreferences {
  const configuration = validateAvatarConfiguration(value, catalogue);
  if (!configuration || !configuration.nickname.trim()) return { saved: false, warning: 'Revisá las opciones y escribí tu apodo antes de guardar.' };
  if (!storage) return { saved: false, warning: storageWarning };
  try {
    storage.setItem(appearancePreferenceKey, JSON.stringify({ version: 1, configuration }));
    return { saved: true };
  } catch {
    return { saved: false, warning: storageWarning };
  }
}
