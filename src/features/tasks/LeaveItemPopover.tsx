import React, { useEffect, useId, useRef, useState } from 'react';
import {
  MAX_ATTACHMENTS_COUNT,
  MAX_DESCRIPTION_LENGTH,
  PRIORITY_LABELS,
  validateLeaveItemDraft,
  type HudAttachment,
  type HudItemKind,
  type LeaveItemDraft,
  type TaskPriority,
} from './task-types';
import { getSenderColor } from '../network/sender-color';

export interface LeaveItemPopoverProps {
  isOpen: boolean;
  initialRecipient?: string;
  initialKind?: HudItemKind;
  presentUsers: string[];
  currentNickname: string;
  onClose(): void;
  onSubmitItem(draft: LeaveItemDraft): void;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
}

export function LeaveItemPopover({
  isOpen,
  initialRecipient = '',
  initialKind = 'task',
  presentUsers,
  currentNickname,
  onClose,
  onSubmitItem,
}: LeaveItemPopoverProps) {
  const [kind, setKind] = useState<HudItemKind>(initialKind);
  const [recipient, setRecipient] = useState(initialRecipient);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<HudAttachment[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [errors, setErrors] = useState<{
    title?: string;
    recipient?: string;
    description?: string;
    attachments?: string;
  }>({});

  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setKind(initialKind);
    setRecipient(
      initialRecipient ||
        presentUsers.find(u => u !== currentNickname) ||
        presentUsers[0] ||
        'Equipo Recepción',
    );
    setErrors({});
    const timer = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 20);
    return () => clearTimeout(timer);
  }, [isOpen, initialRecipient, initialKind, presentUsers, currentNickname]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const stopWorldEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const readImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, attachments: 'Solo se permiten archivos de imagen (PNG, JPG, WEBP, GIF).' }));
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, attachments: 'Cada imagen debe pesar menos de 2.5 MB.' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      setAttachments(prev => {
        if (prev.length >= MAX_ATTACHMENTS_COUNT) {
          setErrors(err => ({
            ...err,
            attachments: `Máximo ${MAX_ATTACHMENTS_COUNT} imágenes por envío.`,
          }));
          return prev;
        }
        setErrors(err => ({ ...err, attachments: undefined }));
        return [
          ...prev,
          {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name || 'captura.png',
            dataUrl,
            mimeType: file.type,
          },
        ];
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach(readImageFile);
    event.target.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          readImageFile(file);
        }
      }
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments(prev => prev.filter(att => att.id !== attId));
    setErrors(prev => ({ ...prev, attachments: undefined }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const draft: LeaveItemDraft = {
      kind,
      recipient: recipient.trim(),
      title: title.trim(),
      description: description.trim(),
      ...(attachments.length > 0 ? { attachments } : {}),
      priority,
      dueDate,
    };
    const validation = validateLeaveItemDraft(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    onSubmitItem(draft);
    setTitle('');
    setDescription('');
    setAttachments([]);
    setDueDate('');
    setErrors({});
    onClose();
  };

  const recipientOptions = Array.from(
    new Set([
      ...(initialRecipient ? [initialRecipient] : []),
      ...presentUsers,
      'Equipo Recepción',
    ]),
  );

  return (
    <div
      className="hud-screen-backdrop"
      data-testid="leave-popover-backdrop"
      onPointerDown={stopWorldEvent}
      onPointerUp={stopWorldEvent}
      onClick={event => {
        event.stopPropagation();
        onClose();
      }}
    >
      <form
        className="hud-leave-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={stopWorldEvent}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="hud-leave-header">
          <h2 id={headingId}>
            {kind === 'task' ? 'Dejar tarea' : 'Dejar nota o revisión'}
            {recipient ? ` para ${recipient}` : ''}
          </h2>
          <button
            type="button"
            className="hud-leave-close"
            aria-label="Cerrar formulario de tarea o nota"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="hud-leave-body">
          {/* Kind Selector: Tarea vs Nota */}
          <div className="hud-kind-switch" role="group" aria-label="Elegir tipo de envío">
            <button
              type="button"
              className={`hud-kind-btn ${kind === 'task' ? 'active' : ''}`}
              aria-pressed={kind === 'task'}
              onClick={() => setKind('task')}
            >
              Tarea (con prioridad)
            </button>
            <button
              type="button"
              className={`hud-kind-btn ${kind === 'note' ? 'active' : ''}`}
              aria-pressed={kind === 'note'}
              onClick={() => setKind('note')}
            >
              Nota rápida / Revisión
            </button>
          </div>

          {/* Gmail-Style "Para:" Recipient Row */}
          <div className="hud-compose-row">
            <label className="hud-compose-row-label" htmlFor="hud-recipient-select">
              Para
            </label>
            <div className="hud-compose-row-content">
              <div className="hud-recipient-chips" role="group" aria-label="Personas presentes">
                {recipientOptions.map(person => (
                  <button
                    key={person}
                    type="button"
                    className={`hud-recipient-chip ${recipient === person ? 'selected' : ''}`}
                    onClick={() => {
                      setRecipient(person);
                      if (errors.recipient) setErrors(prev => ({ ...prev, recipient: undefined }));
                    }}
                  >
                    <span
                      className="hud-avatar-monogram small"
                      style={{ background: getSenderColor(person) }}
                    >
                      {getInitial(person)}
                    </span>
                    <span>{person}</span>
                  </button>
                ))}
              </div>
              <select
                id="hud-recipient-select"
                className="hud-form-select"
                aria-label="Destinatario"
                value={recipient}
                onChange={e => {
                  setRecipient(e.target.value);
                  if (errors.recipient) setErrors(prev => ({ ...prev, recipient: undefined }));
                }}
                onKeyDown={stopWorldEvent}
                onKeyUp={stopWorldEvent}
              >
                {recipientOptions.map(person => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {errors.recipient && (
            <span role="alert" className="hud-field-error">
              {errors.recipient}
            </span>
          )}

          {/* Priority & Due Date (Only when Tarea is selected) */}
          {kind === 'task' && (
            <div className="hud-compose-row">
              <span className="hud-compose-row-label">Prioridad</span>
              <div className="hud-compose-priority-bar">
                <div className="hud-priority-pills" role="group" aria-label="Prioridad de la tarea">
                  {(['low', 'medium', 'high'] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      className={`hud-priority-pill ${level} ${priority === level ? 'selected' : ''}`}
                      aria-pressed={priority === level}
                      onClick={() => setPriority(level)}
                    >
                      {PRIORITY_LABELS[level]}
                    </button>
                  ))}
                </div>

                <div className="hud-date-inline">
                  <label className="hud-form-label" htmlFor="hud-due-date">
                    Vence
                  </label>
                  <input
                    id="hud-due-date"
                    type="date"
                    className="hud-form-input compact"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    onKeyDown={stopWorldEvent}
                    onKeyUp={stopWorldEvent}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Gmail-Style Subject Line */}
          <div className="hud-form-field">
            <label className="hud-form-label" htmlFor="hud-item-title">
              {kind === 'task' ? 'Título de la tarea *' : 'Asunto de la nota *'}
            </label>
            <input
              ref={titleInputRef}
              id="hud-item-title"
              type="text"
              className="hud-form-input subject"
              placeholder={
                kind === 'task'
                  ? 'Ej: Revisar iluminación del pasillo...'
                  : 'Ej: Revisión de diseño / Capturas listas...'
              }
              value={title}
              maxLength={100}
              onChange={e => {
                setTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: undefined }));
              }}
              onKeyDown={stopWorldEvent}
              onKeyUp={stopWorldEvent}
            />
            {errors.title && (
              <span role="alert" className="hud-field-error">
                {errors.title}
              </span>
            )}
          </div>

          {/* Extended Description + Image Attachment Support */}
          <div className="hud-form-field">
            <div className="hud-form-label-row">
              <label className="hud-form-label" htmlFor="hud-item-desc">
                Descripción / Revisión detallada (opcional, podés pegar imágenes)
              </label>
              <span className="hud-char-counter">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <textarea
              id="hud-item-desc"
              className="hud-form-textarea extended"
              rows={5}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="Escribí una nota rápida o una revisión extensa detallando lo que hay que ver. También podés pegar capturas con Ctrl+V o adjuntar imágenes abajo..."
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
              }}
              onPaste={handlePaste}
              onKeyDown={stopWorldEvent}
              onKeyUp={stopWorldEvent}
            />
            {errors.description && (
              <span role="alert" className="hud-field-error">
                {errors.description}
              </span>
            )}
          </div>

          {/* Image Attachments Bar & Previews */}
          <div className="hud-attachments-section">
            <div className="hud-attachments-toolbar">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                aria-label="Adjuntar imagen"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="hud-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= MAX_ATTACHMENTS_COUNT}
              >
                <svg className="hud-svg-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M2.5 4.5C2.5 3.67 3.17 3 4 3H12C12.83 3 13.5 3.67 13.5 4.5V11.5C13.5 12.33 12.83 13 12 13H4C3.17 13 2.5 12.33 2.5 11.5V4.5Z"
                    stroke="currentColor"
                    strokeWidth="1.35"
                  />
                  <circle cx="5.5" cy="6" r="1" fill="currentColor" />
                  <path
                    d="M3.5 11.5L6.8 8.2L9.2 10.5L11 8.8L12.5 11.5"
                    stroke="currentColor"
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Adjuntar imagen ({attachments.length}/{MAX_ATTACHMENTS_COUNT})</span>
              </button>
              <span className="hud-attach-hint">PNG, JPG, WEBP o pegar con Ctrl+V</span>
            </div>

            {errors.attachments && (
              <span role="alert" className="hud-field-error">
                {errors.attachments}
              </span>
            )}

            {attachments.length > 0 && (
              <div className="hud-attachment-previews" aria-label="Imágenes adjuntas">
                {attachments.map(att => (
                  <div key={att.id} className="hud-attachment-thumb">
                    <img src={att.dataUrl} alt={att.name} />
                    <span className="hud-attachment-name" title={att.name}>
                      {att.name}
                    </span>
                    <button
                      type="button"
                      className="hud-attachment-remove"
                      aria-label={`Quitar imagen ${att.name}`}
                      onClick={() => handleRemoveAttachment(att.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hud-leave-actions">
          <span className="hud-leave-hint">Clic fuera de la ventana para cerrar</span>
          <div className="hud-leave-btns">
            <button
              type="button"
              className="hud-cancel-btn"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="hud-submit-btn">
              {kind === 'task' ? 'Enviar tarea' : 'Dejar nota'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
