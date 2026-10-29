import type { Intersection } from 'three';

export type ReceptionInteractionId =
  | 'counter-bell'
  | 'noticeboard'
  | 'waiting-seat'
  | 'portal-doorway';

export type ReceptionInteractionKind = 'decorative' | 'panel' | 'unavailable-transition';

export interface ReceptionInteractionDefinition {
  id: ReceptionInteractionId;
  label: string;
  buttonLabel: string;
  kind: ReceptionInteractionKind;
  feedback: string;
  detail: string;
}

export const RECEPTION_INTERACTIONS: readonly ReceptionInteractionDefinition[] = [
  {
    id: 'counter-bell',
    label: 'Reception desk & bell',
    buttonLabel: 'Ring reception bell',
    kind: 'decorative',
    feedback: 'Reception bell rung — local preview response only; no staff notification sent.',
    detail: 'Local decorative response: chimes the front-desk bell in the study without creating a server event.',
  },
  {
    id: 'noticeboard',
    label: 'Reception noticeboard',
    buttonLabel: 'Inspect noticeboard',
    kind: 'panel',
    feedback: 'Reception noticeboard opened — local preview notes only; persistent tasks and announcements require backend authorization.',
    detail: 'Functional interface (local preview): displays local study orientation notes. Creating or editing announcements and tasks requires backend authorization.',
  },
  {
    id: 'waiting-seat',
    label: 'Waiting lounge seat',
    buttonLabel: 'Use waiting seat',
    kind: 'decorative',
    feedback: 'Waiting area inspected — local preview response only; presence state is not synchronized.',
    detail: 'Local decorative response: highlights the reception waiting seat without broadcasting Colyseus room presence.',
  },
  {
    id: 'portal-doorway',
    label: 'Interior portal doorway',
    buttonLabel: 'Check portal doorway',
    kind: 'unavailable-transition',
    feedback: 'Room transition unavailable — additional rooms are deferred awaiting team review and server authorization.',
    detail: 'Protected transition boundary: additional rooms are deferred and server-authorized room admission is not active in this local preview.',
  },
] as const;

const INTERACTION_BY_ID: Record<ReceptionInteractionId, ReceptionInteractionDefinition> = {
  'counter-bell': RECEPTION_INTERACTIONS[0],
  'noticeboard': RECEPTION_INTERACTIONS[1],
  'waiting-seat': RECEPTION_INTERACTIONS[2],
  'portal-doorway': RECEPTION_INTERACTIONS[3],
};

const MESH_PATTERNS: ReadonlyArray<{ id: ReceptionInteractionId; pattern: RegExp }> = [
  {
    id: 'counter-bell',
    pattern: /^(Bell[ _]foot|Bell[ _]dome|Bell[ _]button|Coral[ _]counter[ _]crown|L[ _]counter[ _]warm[ _]carcass|Counter[ _]recessed[ _]toe|Counter[ _]fluted[ _]inlay([._]\d+)?|Counter[ _]letter[ _]tray|Tray[ _]stationery)$/,
  },
  {
    id: 'noticeboard',
    pattern: /^(Noticeboard[ _]frame|Noticeboard[ _]inset|Pinned[ _]notice([._]\d+)?|Notice[ _]pin([._]\d+)?)$/,
  },
  {
    id: 'waiting-seat',
    pattern: /^(Seat[ _]foot([._]\d+)?|Seat[ _]timber[ _]cradle|Upholstered[ _]back|Peach[ _]seat[ _]cushion([._]\d+)?|Seat[ _]arm([._]\d+)?)$/,
  },
  {
    id: 'portal-doorway',
    pattern: /^(Door[ _]jamb([._]\d+)?|Door[ _]header|Threshold|Portal[ _]crest|Door[ _]lintel[ _]wall)$/,
  },
];

export function getReceptionInteraction(id: ReceptionInteractionId): ReceptionInteractionDefinition {
  return INTERACTION_BY_ID[id];
}

export function receptionInteractionTarget(hit?: Intersection): ReceptionInteractionId | null {
  if (!hit) return null;
  const candidateNames = [hit.object.userData?.name, hit.object.name].filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  for (const rawName of candidateNames) {
    for (const entry of MESH_PATTERNS) {
      if (entry.pattern.test(rawName)) return entry.id;
    }
  }
  return null;
}
