export type HudItemKind = 'task' | 'note';

export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export type UserPresenceMode = 'available' | 'focus' | 'reviewing';

export const PRESENCE_MODE_LABELS: Record<UserPresenceMode, string> = {
  available: 'Disponible',
  focus: 'Enfocado (No molestar)',
  reviewing: 'En revisión',
};

export interface HudAttachment {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface HudItemReply {
  id: string;
  author: string;
  content: string;
  mentionedUsers: string[];
  createdAt: string;
}

export interface HudWorkItem {
  id: string;
  kind: HudItemKind;
  title: string;
  description?: string;
  attachments?: HudAttachment[];
  sender: string;
  recipient: string;
  sharedWith?: string[];
  replies?: HudItemReply[];
  roomCode: string;
  priority?: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  archived: boolean;
  createdAt: string;
  isPendingWrite?: boolean;
}

export interface IncomingHudNotification {
  id: string;
  itemId: string;
  kind: HudItemKind;
  title: string;
  sender: string;
  recipient: string;
  priority?: TaskPriority;
  isReply?: boolean;
  createdAt: string;
}

export interface LeaveItemDraft {
  kind: HudItemKind;
  recipient: string;
  title: string;
  description: string;
  attachments?: HudAttachment[];
  sharedWith?: string[];
  priority: TaskPriority;
  dueDate: string;
}

export interface LeaveItemValidationResult {
  valid: boolean;
  errors: {
    title?: string;
    recipient?: string;
    description?: string;
    attachments?: string;
  };
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'Pendiente',
  'in-progress': 'En curso',
  'done': 'Hecho',
};

export const NOTE_STATUS_LABELS: Record<TaskStatus, string> = {
  'todo': 'Por ver',
  'in-progress': 'Viendo',
  'done': 'Completo',
};

export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_ATTACHMENTS_COUNT = 4;

/** Extract @mentions (e.g. @Luis, @Mati) from any text block. */
export function extractMentionedUsers(text?: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(/@([a-zA-Z0-9_ÁÉÍÓÚáéíóúñÑ-]{2,24})/g);
  const names = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      names.add(match[1].trim());
    }
  }
  return Array.from(names);
}

/**
 * Per-user privacy check (RFC v3):
 * A task or note is strictly private to its sender, its direct recipient,
 * or users explicitly tagged (@mention) / shared in `sharedWith`,
 * unless sent to the public 'Equipo Recepción' group.
 */
export function canUserViewWorkItem(item: HudWorkItem, currentNickname: string): boolean {
  const me = (currentNickname || '').trim().toLowerCase();
  if (!me) return true;

  const sender = (item.sender || '').trim().toLowerCase();
  const recipient = (item.recipient || '').trim().toLowerCase();

  if (sender === me || recipient === me) return true;
  if (recipient === 'equipo recepción' || recipient === 'todos') return true;

  if (item.sharedWith && item.sharedWith.some(u => u.trim().toLowerCase() === me)) {
    return true;
  }

  const descMentions = extractMentionedUsers(item.description);
  if (descMentions.some(u => u.toLowerCase() === me)) {
    return true;
  }

  if (item.replies) {
    for (const reply of item.replies) {
      if (reply.author.trim().toLowerCase() === me) return true;
      if (reply.mentionedUsers?.some(u => u.trim().toLowerCase() === me)) return true;
    }
  }

  return false;
}

export const INITIAL_RECEPTION_ITEMS: readonly HudWorkItem[] = [
  {
    id: 'seed-task-1',
    kind: 'task',
    title: 'Revisar colisiones del mostrador en recepción',
    description: 'Confirmar que el radio de navegación permita rodear el sillón de espera.',
    sender: 'Luis',
    recipient: 'Equipo Recepción',
    sharedWith: ['Mati'],
    replies: [
      {
        id: 'seed-reply-1',
        author: 'Luis',
        content: 'Avisame @Mati cuando puedas probar el borde del sillón.',
        mentionedUsers: ['Mati'],
        createdAt: '2026-10-28T14:35:00.000Z',
      },
    ],
    roomCode: 'global',
    priority: 'high',
    status: 'in-progress',
    dueDate: '2026-10-29',
    archived: false,
    createdAt: '2026-10-28T14:30:00.000Z',
  },
  {
    id: 'seed-task-2',
    kind: 'task',
    title: 'Validar contraste de tarjetas en modo reducido',
    description: 'Verificar lectura de etiquetas de prioridad sin depender solo del color.',
    sender: 'Agus',
    recipient: 'Equipo Recepción',
    roomCode: 'global',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-10-30',
    archived: false,
    createdAt: '2026-10-28T15:00:00.000Z',
  },
  {
    id: 'seed-note-1',
    kind: 'note',
    title: 'Bienvenida en mostrador',
    description: 'Dejé las notas de orientación listas sobre el escritorio de entrada para que las vayan viendo.',
    sender: 'Alejo',
    recipient: 'Equipo Recepción',
    roomCode: 'global',
    status: 'todo',
    archived: false,
    createdAt: '2026-10-28T15:15:00.000Z',
  },
];

export function validateLeaveItemDraft(draft: LeaveItemDraft): LeaveItemValidationResult {
  const errors: LeaveItemValidationResult['errors'] = {};
  const cleanTitle = draft.title.trim();
  const cleanRecipient = draft.recipient.trim();
  const cleanDescription = draft.description.trim();

  if (!cleanRecipient) {
    errors.recipient = 'Elegí a qué persona dejarle la tarea o nota.';
  }

  if (cleanTitle.length < 3) {
    errors.title = 'El título debe tener al menos 3 caracteres.';
  } else if (cleanTitle.length > 100) {
    errors.title = 'El título no puede superar los 100 caracteres.';
  }

  if (cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `El detalle no puede superar los ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  }

  if (draft.attachments && draft.attachments.length > MAX_ATTACHMENTS_COUNT) {
    errors.attachments = `Podés adjuntar hasta ${MAX_ATTACHMENTS_COUNT} imágenes por envío.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatArgentinaTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return '';
  }
}
