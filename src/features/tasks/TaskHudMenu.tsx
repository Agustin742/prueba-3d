import React, { useEffect, useState } from 'react';
import {
  NOTE_STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  canUserViewWorkItem,
  extractMentionedUsers,
  formatArgentinaTime,
  type HudItemKind,
  type HudWorkItem,
  type TaskPriority,
  type TaskStatus,
} from './task-types';
import { getSenderColor } from '../network/sender-color';

export type TaskScopeFilter = 'active' | 'mine' | 'todo' | 'in-progress' | 'done' | 'archived';

export interface TaskHudMenuProps {
  isOpen: boolean;
  activeTab: HudItemKind;
  onChangeTab(tab: HudItemKind): void;
  onClose(): void;
  items: readonly HudWorkItem[];
  currentNickname: string;
  presentUsers?: string[];
  highlightedItemId?: string | null;
  onChangeStatus(id: string, nextStatus: TaskStatus): void;
  onToggleArchive(id: string): void;
  onDeleteItem?(id: string): void;
  onReplyItem?(id: string, content: string, mentionedUsers: string[]): void;
  onShareItem?(id: string, targetNickname: string): void;
  onOpenLeavePopover(recipient?: string, kind?: HudItemKind): void;
}

function getInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'U';
}

export function TaskHudMenu({
  isOpen,
  activeTab,
  onChangeTab,
  onClose,
  items,
  currentNickname,
  presentUsers = [],
  highlightedItemId,
  onChangeStatus,
  onToggleArchive,
  onDeleteItem,
  onReplyItem,
  onShareItem,
  onOpenLeavePopover,
}: TaskHudMenuProps) {
  const [scopeFilter, setScopeFilter] = useState<TaskScopeFilter>('active');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandAllRows, setExpandAllRows] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [shareSelections, setShareSelections] = useState<Record<string, string>>({});
  const [lightboxImage, setLightboxImage] = useState<{ name: string; dataUrl: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, lightboxImage]);

  if (!isOpen) return null;

  const stopWorldEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  // RFC v3: Only items visible to currentNickname (sender, recipient, sharedWith, or @mentioned)
  const visibleToUserItems = items.filter(item => canUserViewWorkItem(item, currentNickname));

  const activeTasksCount = visibleToUserItems.filter(item => item.kind === 'task' && !item.archived).length;
  const activeNotesCount = visibleToUserItems.filter(item => item.kind === 'note' && !item.archived).length;

  const filteredItems = visibleToUserItems.filter(item => {
    if (item.kind !== activeTab) return false;

    if (scopeFilter === 'archived') {
      if (!item.archived) return false;
    } else {
      if (item.archived) return false;
      if (scopeFilter === 'mine') {
        const me = (currentNickname || '').toLowerCase();
        const rec = item.recipient.toLowerCase();
        const isSharedWithMe = item.sharedWith?.some(u => u.toLowerCase() === me);
        if (me && rec !== me && !rec.includes('equipo') && !isSharedWithMe) return false;
      } else if (scopeFilter === 'todo' || scopeFilter === 'in-progress' || scopeFilter === 'done') {
        if (item.status !== scopeFilter) return false;
      }
    }

    if (activeTab === 'task' && priorityFilter !== 'all') {
      if ((item.priority || 'medium') !== priorityFilter) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const inTitle = item.title.toLowerCase().includes(q);
      const inDesc = (item.description || '').toLowerCase().includes(q);
      const inSender = item.sender.toLowerCase().includes(q);
      const inRecipient = item.recipient.toLowerCase().includes(q);
      const inReplies = item.replies?.some(
        r => r.content.toLowerCase().includes(q) || r.author.toLowerCase().includes(q),
      );
      if (!inTitle && !inDesc && !inSender && !inRecipient && !inReplies) return false;
    }

    return true;
  });

  const handleTabSwitch = (nextTab: HudItemKind) => {
    onChangeTab(nextTab);
  };

  const handleQuickView = (item: HudWorkItem) => {
    const nextExpanded = expandedRowId === item.id ? null : item.id;
    setExpandedRowId(nextExpanded);
    if (nextExpanded && item.status === 'todo') {
      onChangeStatus(item.id, 'in-progress');
    }
  };

  const handleSendReply = (itemId: string) => {
    const raw = (replyDrafts[itemId] || '').trim();
    if (!raw || !onReplyItem) return;
    const mentioned = extractMentionedUsers(raw);
    onReplyItem(itemId, raw, mentioned);
    setReplyDrafts(prev => ({ ...prev, [itemId]: '' }));
  };

  const handleInsertTagInReply = (itemId: string, username: string) => {
    setReplyDrafts(prev => {
      const current = prev[itemId] || '';
      const prefix = current && !current.endsWith(' ') ? `${current} ` : current;
      return { ...prev, [itemId]: `${prefix}@${username} ` };
    });
  };

  // Gmail Minimized Dock Bar Mode (RFC v3: Collapse / Expand view)
  if (isMinimized) {
    return (
      <aside
        className="hud-inbox-minimized-dock"
        role="region"
        aria-label="Bandeja de recepción minimizada"
        onPointerDown={stopWorldEvent}
        onPointerUp={stopWorldEvent}
        onClick={stopWorldEvent}
      >
        <button
          type="button"
          className="hud-minimized-expand-trigger"
          onClick={() => setIsMinimized(false)}
          aria-label="Expandir bandeja de recepción"
        >
          <span className="hud-minimized-title">
            📬 Bandeja de Recepción ({activeTasksCount} tareas · {activeNotesCount} notas)
          </span>
          <span className="hud-minimized-badge">Expandir ▲</span>
        </button>
        <button
          type="button"
          className="hud-inbox-close-btn"
          aria-label="Cerrar bandeja de tareas y notas"
          onClick={onClose}
        >
          ✕
        </button>
      </aside>
    );
  }

  return (
    <div
      className="hud-screen-backdrop"
      data-testid="task-hud-backdrop"
      onPointerDown={stopWorldEvent}
      onPointerUp={stopWorldEvent}
      onClick={event => {
        event.stopPropagation();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
      }}
    >
      <section
        id="hud-task-menu-panel"
        className="hud-workspace-inbox"
        role="dialog"
        aria-modal="true"
        aria-label="Menú de tareas y notas visibles"
        onClick={stopWorldEvent}
      >
        {/* Top Workspace Header */}
        <div className="hud-inbox-header">
          <div className="hud-inbox-brand">
            <svg className="hud-svg-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 4C2.5 3.17 3.17 2.5 4 2.5H12C12.83 2.5 13.5 3.17 13.5 4V12C13.5 12.83 12.83 13.5 12 13.5H4C3.17 13.5 2.5 12.83 2.5 12V4Z" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M2.5 9.5H5.5L6.5 11H9.5L10.5 9.5H13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h2>Bandeja de Recepción</h2>
            <span className="hud-privacy-pill" title="Solo ves tus elementos o donde te etiquetaron con @">
              🔒 Vista privada ({currentNickname})
            </span>
          </div>

          <div className="hud-inbox-toolbar-controls">
            <input
              type="search"
              className="hud-inbox-search-input"
              aria-label="Buscar en tareas y notas"
              placeholder="Buscar asunto o @persona..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={stopWorldEvent}
              onKeyUp={stopWorldEvent}
            />

            <label className="hud-filter-field">
              <span className="hud-filter-label">Vista</span>
              <select
                className="hud-filter-select"
                aria-label="Filtrar por estado o alcance"
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value as TaskScopeFilter)}
                onKeyDown={stopWorldEvent}
              >
                <option value="active">Activas</option>
                <option value="mine">Para mí / @Etiquetado</option>
                <option value="todo">
                  {activeTab === 'task' ? 'Pendiente' : 'Por ver'}
                </option>
                <option value="in-progress">
                  {activeTab === 'task' ? 'En curso / Viendo' : 'Viendo'}
                </option>
                <option value="done">
                  {activeTab === 'task' ? 'Hecho / Completo' : 'Completo'}
                </option>
                <option value="archived">Archivadas</option>
              </select>
            </label>

            {activeTab === 'task' && (
              <label className="hud-filter-field">
                <span className="hud-filter-label">Prioridad</span>
                <select
                  className="hud-filter-select"
                  aria-label="Filtrar por prioridad"
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value as 'all' | TaskPriority)}
                  onKeyDown={stopWorldEvent}
                >
                  <option value="all">Todas</option>
                  <option value="high">Alta</option>
                  <option value="medium">Media</option>
                  <option value="low">Baja</option>
                </select>
              </label>
            )}

            <button
              type="button"
              className="hud-inbox-collapse-all-btn"
              title={expandAllRows ? 'Colapsar todos los hilos' : 'Expandir todos los hilos'}
              onClick={() => setExpandAllRows(prev => !prev)}
            >
              {expandAllRows ? 'Colapsar hilos' : 'Expandir hilos'}
            </button>

            <button
              type="button"
              className="hud-inbox-minimize-btn"
              title="Minimizar bandeja a la esquina inferior (estilo Gmail)"
              aria-label="Minimizar bandeja"
              onClick={() => setIsMinimized(true)}
            >
              —
            </button>

            <button
              type="button"
              className="hud-inbox-close-btn"
              aria-label="Cerrar bandeja de tareas y notas"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Category Tabs Bar (Gmail / Workspace style) */}
        <div className="hud-inbox-tabs-bar">
          <div className="hud-task-tabs" role="tablist" aria-label="Tipo de elementos">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'task'}
              className={`hud-tab-btn ${activeTab === 'task' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('task')}
            >
              <span>Tareas</span>
              <span className="hud-tab-count">{activeTasksCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'note'}
              className={`hud-tab-btn ${activeTab === 'note' ? 'active' : ''}`}
              onClick={() => handleTabSwitch('note')}
            >
              <span>Notas</span>
              <span className="hud-tab-count">{activeNotesCount}</span>
            </button>
          </div>

          <button
            type="button"
            className="hud-compose-inline-btn"
            onClick={() => onOpenLeavePopover(undefined, activeTab)}
          >
            + Dejar {activeTab === 'task' ? 'nueva tarea' : 'nueva nota'}
          </button>
        </div>

        {/* Gmail-Style Tabular Row List */}
        <div className="hud-inbox-list">
          {filteredItems.length === 0 ? (
            <div className="hud-task-empty">
              <p>
                {scopeFilter === 'archived'
                  ? `No hay ${activeTab === 'task' ? 'tareas' : 'notas'} archivadas.`
                  : `No tenés ${activeTab === 'task' ? 'tareas' : 'notas'} visibles para este filtro.`}
              </p>
              {scopeFilter !== 'archived' && (
                <button
                  type="button"
                  className="hud-empty-action-btn"
                  onClick={() => onOpenLeavePopover(undefined, activeTab)}
                >
                  Crear {activeTab === 'task' ? 'primera tarea' : 'primera nota'}
                </button>
              )}
            </div>
          ) : (
            filteredItems.map(item => {
              const isTask = item.kind === 'task';
              const priority = item.priority || 'medium';
              const senderColor = getSenderColor(item.sender);
              const isHighlighted = highlightedItemId === item.id;
              const isExpanded = expandAllRows || expandedRowId === item.id || isHighlighted;
              const timeStr = formatArgentinaTime(item.createdAt);
              const hasAttachments = Boolean(item.attachments && item.attachments.length > 0);
              const repliesCount = item.replies?.length || 0;
              const statusMap = isTask ? STATUS_LABELS : NOTE_STATUS_LABELS;
              const sharedList = item.sharedWith || [];
              const shareCandidates = presentUsers.filter(
                u =>
                  u !== item.sender &&
                  u !== item.recipient &&
                  !sharedList.some(s => s.toLowerCase() === u.toLowerCase()),
              );

              return (
                <article
                  key={item.id}
                  className={`hud-inbox-row ${isTask ? `priority-${priority}` : 'kind-note'} ${item.status === 'done' ? 'is-done' : ''} ${item.archived ? 'is-archived' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                >
                  <div
                    className="hud-inbox-row-main"
                    onClick={() => handleQuickView(item)}
                  >
                    {/* Left Column: Sender Monogram + Names */}
                    <div className="hud-row-sender-col">
                      <span
                        className="hud-avatar-monogram"
                        style={{ background: senderColor }}
                        aria-hidden="true"
                      >
                        {getInitial(item.sender)}
                      </span>
                      <div className="hud-row-people">
                        <span className="hud-row-sender-name" style={{ color: senderColor }}>
                          @{item.sender}
                          {repliesCount > 0 && (
                            <span className="hud-thread-count-pill" title={`${repliesCount} respuestas en el hilo`}>
                              ({repliesCount + 1})
                            </span>
                          )}
                        </span>
                        <span className="hud-row-recipient-name">
                          Para: {item.recipient}
                          {sharedList.length > 0 ? ` (+${sharedList.join(', ')})` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Center Column: Priority/Type Pill + Bold Subject + Attachment Badge + Inline Snippet */}
                    <div className="hud-row-subject-col">
                      {isTask ? (
                        <span className={`hud-badge hud-badge-priority ${priority}`}>
                          Prioridad {PRIORITY_LABELS[priority]}
                        </span>
                      ) : (
                        <span className="hud-badge hud-badge-note">Nota</span>
                      )}

                      {hasAttachments && (
                        <span
                          className="hud-badge hud-badge-attachment"
                          title={`${item.attachments!.length} imagen(es) adjunta(s)`}
                        >
                          🖼️ {item.attachments!.length}
                        </span>
                      )}

                      <h3 className="hud-row-title">{item.title}</h3>

                      {item.description && (
                        <span className="hud-row-snippet">
                          — {item.description}
                        </span>
                      )}
                    </div>

                    {/* Right Column: Date/Time + Status Select (Por ver / Viendo / Completo) + Archive + Delete */}
                    <div className="hud-row-actions-col" onClick={stopWorldEvent}>
                      <span className="hud-row-date">
                        {item.dueDate ? `Vence ${item.dueDate}` : timeStr}
                      </span>

                      <label className="hud-status-select-wrap">
                        <span className="sr-only">Estado de revisión</span>
                        <select
                          className={`hud-status-select status-${item.status}`}
                          aria-label={`Estado de ${item.title}`}
                          value={item.status}
                          onChange={e => onChangeStatus(item.id, e.target.value as TaskStatus)}
                          onKeyDown={stopWorldEvent}
                        >
                          <option value="todo">{statusMap['todo']}</option>
                          <option value="in-progress">{statusMap['in-progress']}</option>
                          <option value="done">{statusMap['done']}</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        className="hud-archive-btn"
                        onClick={() => onToggleArchive(item.id)}
                      >
                        {item.archived ? 'Restaurar' : 'Archivar'}
                      </button>

                      {onDeleteItem && (
                        <button
                          type="button"
                          className="hud-delete-btn"
                          title={
                            item.status === 'done' || item.archived
                              ? 'Borrar definitivamente (revisión completa)'
                              : 'Borrar tarea o nota'
                          }
                          aria-label={`Borrar ${item.title}`}
                          onClick={() => onDeleteItem(item.id)}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="hud-inbox-row-detail" onClick={stopWorldEvent}>
                      <div className="hud-detail-review-bar">
                        <span className="hud-detail-review-status">
                          Estado actual: <strong>{statusMap[item.status]}</strong>
                          {sharedList.length > 0 && (
                            <span className="hud-shared-participants">
                              {' '}· Compartido con: <strong>{sharedList.map(u => `@${u}`).join(', ')}</strong>
                            </span>
                          )}
                        </span>

                        <div className="hud-detail-quick-actions">
                          {item.status !== 'in-progress' && (
                            <button
                              type="button"
                              className="hud-quick-status-btn viewing"
                              onClick={() => onChangeStatus(item.id, 'in-progress')}
                            >
                              👁️ Marcar como Viendo
                            </button>
                          )}
                          {item.status !== 'done' && (
                            <button
                              type="button"
                              className="hud-quick-status-btn done"
                              onClick={() => onChangeStatus(item.id, 'done')}
                            >
                              ✓ Marcar como Completo
                            </button>
                          )}
                          {onDeleteItem && (item.status === 'done' || item.archived) && (
                            <button
                              type="button"
                              className="hud-quick-status-btn delete"
                              onClick={() => onDeleteItem(item.id)}
                            >
                              🗑️ Borrar ya completado
                            </button>
                          )}

                          {/* Direct Share Control (RFC v3) */}
                          {onShareItem && shareCandidates.length > 0 && (
                            <div className="hud-share-inline-group">
                              <select
                                className="hud-filter-select"
                                aria-label={`Compartir ${item.title} con compañero`}
                                value={shareSelections[item.id] || ''}
                                onChange={e =>
                                  setShareSelections(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Compartir con...</option>
                                {shareCandidates.map(person => (
                                  <option key={person} value={person}>
                                    @{person}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="hud-quick-status-btn"
                                disabled={!shareSelections[item.id]}
                                onClick={() => {
                                  const target = shareSelections[item.id];
                                  if (target) {
                                    onShareItem(item.id, target);
                                    setShareSelections(prev => ({ ...prev, [item.id]: '' }));
                                  }
                                }}
                              >
                                + Sumar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {item.description && (
                        <p className="hud-card-desc">{item.description}</p>
                      )}

                      {hasAttachments && (
                        <div className="hud-detail-attachments">
                          <span className="hud-detail-attachments-label">
                            Archivos / Imágenes adjuntas ({item.attachments!.length}):
                          </span>
                          <div className="hud-detail-attachments-grid">
                            {item.attachments!.map(att => (
                              <div key={att.id} className="hud-detail-attachment-card">
                                <button
                                  type="button"
                                  className="hud-detail-attachment-img-btn"
                                  onClick={() => setLightboxImage({ name: att.name, dataUrl: att.dataUrl })}
                                  title="Clic para ampliar imagen"
                                >
                                  <img src={att.dataUrl} alt={att.name} />
                                </button>
                                <span className="hud-detail-attachment-name">{att.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gmail-Style Thread Replies & Quick Reply Composer (RFC v3) */}
                      <div className="hud-thread-section">
                        {item.replies && item.replies.length > 0 && (
                          <div className="hud-thread-replies-list" aria-label="Respuestas en el hilo">
                            {item.replies.map(reply => {
                              const replyColor = getSenderColor(reply.author);
                              return (
                                <div key={reply.id} className="hud-thread-reply-item">
                                  <span
                                    className="hud-avatar-monogram small"
                                    style={{ background: replyColor }}
                                  >
                                    {getInitial(reply.author)}
                                  </span>
                                  <div className="hud-thread-reply-body">
                                    <div className="hud-thread-reply-meta">
                                      <strong style={{ color: replyColor }}>@{reply.author}</strong>
                                      <span>{formatArgentinaTime(reply.createdAt)}</span>
                                    </div>
                                    <p className="hud-thread-reply-text">{reply.content}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {onReplyItem && (
                          <div className="hud-thread-composer">
                            {presentUsers.length > 0 && (
                              <div className="hud-thread-tag-bar">
                                <span className="hud-thread-tag-hint">Etiquetar para dar acceso:</span>
                                {presentUsers
                                  .filter(u => u !== currentNickname)
                                  .map(person => (
                                    <button
                                      key={person}
                                      type="button"
                                      className="hud-tag-mention-chip"
                                      onClick={() => handleInsertTagInReply(item.id, person)}
                                    >
                                      @{person}
                                    </button>
                                  ))}
                              </div>
                            )}
                            <div className="hud-thread-input-row">
                              <input
                                type="text"
                                className="hud-form-input hud-reply-input"
                                aria-label={`Responder a ${item.title}`}
                                placeholder="Escribí una respuesta o mencioná con @nombre para compartir el hilo..."
                                value={replyDrafts[item.id] || ''}
                                onChange={e =>
                                  setReplyDrafts(prev => ({
                                    ...prev,
                                    [item.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={e => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSendReply(item.id);
                                  }
                                }}
                                onKeyUp={stopWorldEvent}
                              />
                              <button
                                type="button"
                                className="hud-reply-send-btn"
                                onClick={() => handleSendReply(item.id)}
                              >
                                Responder
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>

        {/* Footer Status Bar */}
        <div className="hud-inbox-footer">
          <span className="hud-inbox-footer-hint">
            Privacidad activa: solo participantes o etiquetados con @ ven cada hilo · Clic fuera para volver al 3D
          </span>
          <button
            type="button"
            className="hud-footer-create-btn"
            onClick={() => onOpenLeavePopover(undefined, activeTab)}
          >
            Dejar {activeTab === 'task' ? 'nueva tarea' : 'nueva nota'} a alguien
          </button>
        </div>
      </section>

      {/* Lightbox Modal for full-size image inspection */}
      {lightboxImage && (
        <div
          className="hud-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Vista ampliada de ${lightboxImage.name}`}
          onClick={event => {
            event.stopPropagation();
            setLightboxImage(null);
          }}
        >
          <div className="hud-lightbox-content" onClick={stopWorldEvent}>
            <div className="hud-lightbox-header">
              <span>{lightboxImage.name}</span>
              <button
                type="button"
                className="hud-inbox-close-btn"
                aria-label="Cerrar imagen ampliada"
                onClick={() => setLightboxImage(null)}
              >
                ✕
              </button>
            </div>
            <img src={lightboxImage.dataUrl} alt={lightboxImage.name} className="hud-lightbox-img" />
          </div>
        </div>
      )}
    </div>
  );
}
