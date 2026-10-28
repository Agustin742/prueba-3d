import React, { useEffect, useRef, useState } from 'react';
import {
  PRESENCE_MODE_LABELS,
  type HudItemKind,
  type UserPresenceMode,
} from './task-types';
import { getSenderColor } from '../network/sender-color';

export interface TopNavbarIslandsProps {
  currentNickname: string;
  currentRoomName?: string;
  isConnected: boolean;
  presentUsers: string[];
  activeTasksCount: number;
  activeNotesCount: number;
  unreadCount: number;
  isTrayOpen: boolean;
  autoCloseDropdownMs?: number;
  presenceMode?: UserPresenceMode;
  onChangePresenceMode?(mode: UserPresenceMode): void;
  onToggleTray(): void;
  onOpenLeavePopover(recipient?: string, kind?: HudItemKind): void;
  onOpenQuickNoticeboard?(): void;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
}

export function TopNavbarIslands({
  currentNickname,
  currentRoomName = 'Recepción',
  isConnected,
  presentUsers,
  activeTasksCount,
  activeNotesCount,
  unreadCount,
  isTrayOpen,
  autoCloseDropdownMs = 8000,
  presenceMode = 'available',
  onChangePresenceMode,
  onToggleTray,
  onOpenLeavePopover,
  onOpenQuickNoticeboard,
}: TopNavbarIslandsProps) {
  const [presenceOpen, setPresenceOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [hoveredDropdown, setHoveredDropdown] = useState(false);
  const presenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!presenceOpen && !statusMenuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (presenceRef.current && !presenceRef.current.contains(event.target as Node)) {
        setPresenceOpen(false);
        setStatusMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPresenceOpen(false);
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [presenceOpen, statusMenuOpen]);

  // RFC v3: Auto-close interactive dropdowns after inactivity period
  useEffect(() => {
    if ((!presenceOpen && !statusMenuOpen) || hoveredDropdown || autoCloseDropdownMs <= 0) return;
    const timer = setTimeout(() => {
      setPresenceOpen(false);
      setStatusMenuOpen(false);
    }, autoCloseDropdownMs);
    return () => clearTimeout(timer);
  }, [presenceOpen, statusMenuOpen, hoveredDropdown, autoCloseDropdownMs]);

  const stopWorldEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const totalActive = activeTasksCount + activeNotesCount;

  return (
    <header
      className="hud-top-islands"
      aria-label="Barra de navegación principal y acciones de sala"
      onPointerDown={stopWorldEvent}
      onPointerUp={stopWorldEvent}
      onClick={stopWorldEvent}
    >
      {/* Left Floating Island: Spatial Context & Quick 2D Board */}
      <div className="hud-island hud-island-context">
        <span className="hud-office-badge" title="Oficina activa">
          <svg className="hud-svg-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 13.5V3.5C2.5 2.95 2.95 2.5 3.5 2.5H9.5C10.05 2.5 10.5 2.95 10.5 3.5V13.5M10.5 6.5H12.5C13.05 6.5 13.5 6.95 13.5 7.5V13.5M1.5 13.5H14.5M5 5.5H8M5 8H8M5 10.5H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Mi Oficina</span>
        </span>
        <span className="hud-island-divider" aria-hidden="true">/</span>
        <label className="hud-room-selector-label">
          <span className="sr-only">Habitación actual</span>
          <select
            className="hud-room-select"
            aria-label="Cambiar de habitación"
            defaultValue="reception"
            onKeyDown={stopWorldEvent}
          >
            <option value="reception">{currentRoomName} · Principal</option>
            <option value="workspace" disabled>Sala de Equipo (Próximamente)</option>
          </select>
        </label>

        {onOpenQuickNoticeboard && (
          <button
            type="button"
            className="hud-board-quick-btn"
            title="Abrir cartelera de avisos de recepción"
            onClick={onOpenQuickNoticeboard}
          >
            📌 Cartelera
          </button>
        )}
      </div>

      {/* Center Floating Island: Inbox Toggle & Compose Action */}
      <div className="hud-island hud-island-actions">
        <button
          type="button"
          className={`hud-tray-toggle-btn ${isTrayOpen ? 'active' : ''}`}
          aria-expanded={isTrayOpen}
          aria-controls="hud-task-menu-panel"
          onClick={onToggleTray}
        >
          <svg className="hud-svg-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 4C2.5 3.17 3.17 2.5 4 2.5H12C12.83 2.5 13.5 3.17 13.5 4V12C13.5 12.83 12.83 13.5 12 13.5H4C3.17 13.5 2.5 12.83 2.5 12V4Z" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M2.5 9.5H5.5L6.5 11H9.5L10.5 9.5H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Bandeja</span>
          <span className="hud-count-pill" title={`${activeTasksCount} tareas y ${activeNotesCount} notas visibles para vos`}>
            {totalActive}
          </span>
          {unreadCount > 0 && (
            <span className="hud-unread-badge" aria-label={`${unreadCount} nuevas sin revisar`}>
              +{unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          className="hud-leave-cta-btn"
          onClick={() => onOpenLeavePopover(undefined, 'task')}
        >
          <svg className="hud-svg-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3.25V12.75M3.25 8H12.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>Dejar tarea / nota</span>
        </button>
      </div>

      {/* Right Floating Island: Real Connected Users & Interactive Presence Mode */}
      <div
        className="hud-island hud-island-presence"
        ref={presenceRef}
        onMouseEnter={() => setHoveredDropdown(true)}
        onMouseLeave={() => setHoveredDropdown(false)}
      >
        <button
          type="button"
          className={`hud-presence-trigger ${presenceOpen ? 'active' : ''}`}
          aria-expanded={presenceOpen}
          aria-haspopup="true"
          onClick={() => {
            setPresenceOpen(prev => !prev);
            setStatusMenuOpen(false);
          }}
        >
          <span
            className={`online-indicator ${isConnected ? 'online' : 'offline'}`}
            aria-hidden="true"
          />
          <span>{presentUsers.length} presentes</span>
        </button>

        <button
          type="button"
          className={`hud-user-chip hud-user-chip-interactive mode-${presenceMode}`}
          title="Cambiar tu estado de disponibilidad en la oficina"
          aria-expanded={statusMenuOpen}
          onClick={() => {
            setStatusMenuOpen(prev => !prev);
            setPresenceOpen(false);
          }}
        >
          <span
            className="hud-avatar-monogram"
            style={{ background: getSenderColor(currentNickname || 'Yo') }}
          >
            {getInitial(currentNickname || 'Recepción')}
          </span>
          <span className="hud-user-name">{currentNickname || 'Recepción'}</span>
          <span className={`hud-role-badge mode-${presenceMode}`}>
            {PRESENCE_MODE_LABELS[presenceMode]}
          </span>
        </button>

        {statusMenuOpen && (
          <div
            className="hud-presence-dropdown hud-status-dropdown"
            role="menu"
            aria-label="Cambiar estado de disponibilidad"
          >
            <div className="hud-presence-dropdown-header">
              <span>Tu estado en Recepción</span>
              <span className="hud-presence-hint">Auto-cierre activo</span>
            </div>
            <div className="hud-status-mode-options">
              {(['available', 'focus', 'reviewing'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  role="menuitem"
                  className={`hud-status-mode-btn ${presenceMode === mode ? 'active' : ''}`}
                  onClick={() => {
                    onChangePresenceMode?.(mode);
                    setStatusMenuOpen(false);
                  }}
                >
                  <span className={`hud-mode-dot mode-${mode}`} />
                  <span>{PRESENCE_MODE_LABELS[mode]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {presenceOpen && (
          <div
            className="hud-presence-dropdown"
            role="menu"
            aria-label="Personas conectadas en el servidor"
          >
            <div className="hud-presence-dropdown-header">
              <span>Conectados en {currentRoomName} ({presentUsers.length})</span>
              <span className="hud-presence-hint">Servidor en vivo</span>
            </div>
            <ul className="hud-presence-list">
              {presentUsers.map(person => {
                const isSelf = person === currentNickname;
                return (
                  <li key={person} className="hud-presence-item">
                    <div className="hud-presence-person">
                      <span
                        className="hud-avatar-monogram"
                        style={{ background: getSenderColor(person) }}
                      >
                        {getInitial(person)}
                      </span>
                      <span className="hud-person-name">
                        {person} {isSelf ? '(Vos)' : ''}
                      </span>
                    </div>
                    <div className="hud-presence-actions">
                      <button
                        type="button"
                        className="hud-mini-action-btn task"
                        title={`Dejar tarea a ${person}`}
                        onClick={() => {
                          setPresenceOpen(false);
                          onOpenLeavePopover(person, 'task');
                        }}
                      >
                        Tarea
                      </button>
                      <button
                        type="button"
                        className="hud-mini-action-btn note"
                        title={`Dejar nota a ${person}`}
                        onClick={() => {
                          setPresenceOpen(false);
                          onOpenLeavePopover(person, 'note');
                        }}
                      >
                        Nota
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
