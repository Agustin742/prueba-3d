import React, { useEffect, useRef, useState } from 'react';
import {
  PRIORITY_LABELS,
  type HudItemKind,
  type IncomingHudNotification,
} from './task-types';
import { getSenderColor } from '../network/sender-color';

export interface TaskNotificationBannerProps {
  notification: IncomingHudNotification | null;
  autoCloseMs?: number;
  onOpenInTray(kind: HudItemKind, itemId: string): void;
  onDismiss(): void;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
}

export function TaskNotificationBanner({
  notification,
  autoCloseMs = 6000,
  onOpenInTray,
  onDismiss,
}: TaskNotificationBannerProps) {
  const [paused, setPaused] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setPaused(false);
  }, [notification?.id]);

  useEffect(() => {
    if (!notification || paused || autoCloseMs <= 0) return;
    const timer = setTimeout(() => {
      onDismissRef.current();
    }, autoCloseMs);
    return () => clearTimeout(timer);
  }, [notification, paused, autoCloseMs]);

  if (!notification) return null;

  const stopWorldEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const isTask = notification.kind === 'task';
  const priority = notification.priority || 'medium';
  const priorityLabel = PRIORITY_LABELS[priority];
  const senderColor = getSenderColor(notification.sender);

  return (
    <aside
      className={`hud-notification-banner ${isTask ? `priority-${priority}` : 'kind-note'}`}
      role="status"
      aria-live="polite"
      aria-label="Notificación de nueva tarea o nota"
      onPointerDown={stopWorldEvent}
      onPointerUp={stopWorldEvent}
      onClick={stopWorldEvent}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hud-notification-top">
        <div className="hud-notification-sender-row">
          <span
            className="hud-avatar-monogram"
            style={{ background: senderColor }}
          >
            {getInitial(notification.sender)}
          </span>
          <div className="hud-notification-sender-info">
            <span className="hud-notification-meta">
              {notification.isReply ? 'Respuesta de ' : 'De '}
              <strong style={{ color: senderColor }}>@{notification.sender}</strong> para{' '}
              <strong>{notification.recipient}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          className="hud-notification-close"
          aria-label="Descartar notificación"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>

      <div className="hud-notification-body">
        {isTask ? (
          <span className={`hud-badge hud-badge-priority ${priority}`}>
            Tarea · Prioridad {priorityLabel}
          </span>
        ) : (
          <span className="hud-badge hud-badge-note">
            Nota rápida
          </span>
        )}
        <p className="hud-notification-title">{notification.title}</p>
      </div>

      <div className="hud-notification-actions">
        <span className="hud-notification-timer-hint">
          {paused ? 'Pausado' : 'Se cierra automáticamente'}
        </span>
        <button
          type="button"
          className="hud-notification-open-btn"
          onClick={() => onOpenInTray(notification.kind, notification.itemId)}
        >
          Ver en {isTask ? 'Tareas' : 'Notas'}
        </button>
      </div>
    </aside>
  );
}
