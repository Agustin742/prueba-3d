import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Mesh, Group, Vector3, type Intersection } from 'three';
import { TopNavbarIslands } from './TopNavbarIslands';
import { TaskNotificationBanner } from './TaskNotificationBanner';
import { TaskHudMenu } from './TaskHudMenu';
import { LeaveItemPopover } from './LeaveItemPopover';
import {
  INITIAL_RECEPTION_ITEMS,
  canUserViewWorkItem,
  extractMentionedUsers,
  validateLeaveItemDraft,
  type HudWorkItem,
} from './task-types';
import { avatarInteractionTarget } from '../world/ReceptionScene';

describe('Task HUD & Floating Islands (PRD + RFC v3)', () => {
  it('validates task and note drafts and preserves field errors when invalid', () => {
    expect(
      validateLeaveItemDraft({
        kind: 'task',
        recipient: '',
        title: 'ab',
        description: '',
        priority: 'high',
        dueDate: '',
      }),
    ).toEqual({
      valid: false,
      errors: {
        recipient: 'Elegí a qué persona dejarle la tarea o nota.',
        title: 'El título debe tener al menos 3 caracteres.',
      },
    });

    expect(
      validateLeaveItemDraft({
        kind: 'note',
        recipient: 'Luis',
        title: 'Nota válida para Luis',
        description: 'Todo listo',
        priority: 'medium',
        dueDate: '',
      }),
    ).toEqual({
      valid: true,
      errors: {},
    });
  });

  it('enforces per-user privacy and @tag visibility (RFC v3)', () => {
    const privateItem: HudWorkItem = {
      id: 'priv-1',
      kind: 'note',
      title: 'Revisión privada de arquitectura',
      description: 'Revisar con @Agus antes del deploy',
      sender: 'Mati',
      recipient: 'Luis',
      roomCode: 'global',
      status: 'todo',
      archived: false,
      createdAt: '2026-10-28T16:00:00.000Z',
    };

    expect(extractMentionedUsers(privateItem.description)).toEqual(['Agus']);
    // Sender and recipient can view
    expect(canUserViewWorkItem(privateItem, 'Mati')).toBe(true);
    expect(canUserViewWorkItem(privateItem, 'Luis')).toBe(true);
    // Tagged user (@Agus) can view
    expect(canUserViewWorkItem(privateItem, 'Agus')).toBe(true);
    // Uninvolved user (Alejo) CANNOT view
    expect(canUserViewWorkItem(privateItem, 'Alejo')).toBe(false);

    // Once Alejo is tagged in a reply or sharedWith, Alejo can view
    const sharedItem: HudWorkItem = {
      ...privateItem,
      replies: [
        {
          id: 'rep-1',
          author: 'Luis',
          content: 'Sumo a @Alejo para que lo vea',
          mentionedUsers: ['Alejo'],
          createdAt: '2026-10-28T16:05:00.000Z',
        },
      ],
    };
    expect(canUserViewWorkItem(sharedItem, 'Alejo')).toBe(true);
  });

  it('renders TopNavbarIslands with real connected users, interactive presence status, and auto-closes dropdowns after timeout', () => {
    vi.useFakeTimers();
    const onToggleTray = vi.fn();
    const onOpenLeavePopover = vi.fn();
    const onChangePresenceMode = vi.fn();

    render(
      <TopNavbarIslands
        currentNickname="Mati"
        currentRoomName="Recepción"
        isConnected={true}
        presentUsers={['Mati', 'Luis']}
        activeTasksCount={2}
        activeNotesCount={1}
        unreadCount={1}
        isTrayOpen={false}
        autoCloseDropdownMs={4000}
        presenceMode="available"
        onChangePresenceMode={onChangePresenceMode}
        onToggleTray={onToggleTray}
        onOpenLeavePopover={onOpenLeavePopover}
      />,
    );

    expect(screen.getByText(/Mi Oficina/i)).toBeDefined();
    expect(screen.getByText('+1')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Bandeja/i }));
    expect(onToggleTray).toHaveBeenCalledOnce();

    // Open connected users dropdown
    fireEvent.click(screen.getByRole('button', { name: /2 presentes/i }));
    expect(screen.getByRole('menu', { name: /Personas conectadas en el servidor/i })).toBeDefined();

    // Auto-closes after 4000ms of inactivity
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByRole('menu', { name: /Personas conectadas en el servidor/i })).toBeNull();

    // Reopen and click action
    fireEvent.click(screen.getByRole('button', { name: /2 presentes/i }));
    const leaveNoteForLuis = screen.getByTitle('Dejar nota a Luis');
    fireEvent.click(leaveNoteForLuis);
    expect(onOpenLeavePopover).toHaveBeenCalledWith('Luis', 'note');

    vi.useRealTimers();
  });

  it('shows incoming notification banner and auto-closes after timeout unless hovered', () => {
    vi.useFakeTimers();
    const onOpenInTray = vi.fn();
    const onDismiss = vi.fn();

    render(
      <TaskNotificationBanner
        notification={{
          id: 'n1',
          itemId: 'item-1',
          kind: 'task',
          title: 'Revisar cámara isométrica',
          sender: 'Luis',
          recipient: 'Mati',
          priority: 'high',
          createdAt: '2026-10-28T15:00:00.000Z',
        }}
        autoCloseMs={3000}
        onOpenInTray={onOpenInTray}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText(/Prioridad Alta/i)).toBeDefined();
    expect(screen.getByText('@Luis')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Ver en Tareas/i }));
    expect(onOpenInTray).toHaveBeenCalledWith('task', 'item-1');

    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(onDismiss).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('starts TaskHudMenu collapsed, filters private items, minimizes/expands Gmail dock, replies in thread, and closes on backdrop click', () => {
    const onChangeTab = vi.fn();
    const onChangeStatus = vi.fn();
    const onToggleArchive = vi.fn();
    const onReplyItem = vi.fn();
    const onClose = vi.fn();

    const privateNoteForOther: HudWorkItem = {
      id: 'secret-note',
      kind: 'task',
      title: 'Secreto entre Luis y Agus',
      sender: 'Luis',
      recipient: 'Agus',
      roomCode: 'global',
      priority: 'high',
      status: 'todo',
      archived: false,
      createdAt: '2026-10-28T15:20:00.000Z',
    };

    const items = [...INITIAL_RECEPTION_ITEMS, privateNoteForOther];

    const { rerender } = render(
      <TaskHudMenu
        isOpen={false}
        activeTab="task"
        onChangeTab={onChangeTab}
        onClose={onClose}
        items={items}
        currentNickname="Mati"
        presentUsers={['Mati', 'Luis', 'Agus']}
        onChangeStatus={onChangeStatus}
        onToggleArchive={onToggleArchive}
        onReplyItem={onReplyItem}
        onOpenLeavePopover={vi.fn()}
      />,
    );

    expect(screen.queryByText('Bandeja de Recepción')).toBeNull();

    rerender(
      <TaskHudMenu
        isOpen={true}
        activeTab="task"
        onChangeTab={onChangeTab}
        onClose={onClose}
        items={items}
        currentNickname="Mati"
        presentUsers={['Mati', 'Luis', 'Agus']}
        onChangeStatus={onChangeStatus}
        onToggleArchive={onToggleArchive}
        onReplyItem={onReplyItem}
        onOpenLeavePopover={vi.fn()}
      />,
    );

    expect(screen.getByText('Bandeja de Recepción')).toBeDefined();
    // Mati cannot see private task between Luis and Agus
    expect(screen.queryByText('Secreto entre Luis y Agus')).toBeNull();

    // Expand thread and reply with @Agus tag
    fireEvent.click(screen.getByText(/Revisar colisiones del mostrador/i));
    const replyInput = screen.getByLabelText(/Responder a Revisar colisiones del mostrador/i);
    fireEvent.change(replyInput, { target: { value: 'Todo verificado con @Agus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }));
    expect(onReplyItem).toHaveBeenCalledWith(
      'seed-task-1',
      'Todo verificado con @Agus',
      ['Agus'],
    );

    // Minimize Gmail inbox to bottom dock and expand back
    fireEvent.click(screen.getByRole('button', { name: 'Minimizar bandeja' }));
    expect(screen.getByRole('region', { name: /Bandeja de recepción minimizada/i })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Expandir bandeja de recepción/i }));
    expect(screen.getByText('Bandeja de Recepción')).toBeDefined();

    // Close by clicking full-screen backdrop anywhere outside the modal
    fireEvent.click(screen.getByTestId('task-hud-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('auto-transitions a note from Por ver to Viendo on click and deletes completed items', () => {
    const onChangeStatus = vi.fn();
    const onDeleteItem = vi.fn();

    render(
      <TaskHudMenu
        isOpen={true}
        activeTab="note"
        onChangeTab={vi.fn()}
        onClose={vi.fn()}
        items={INITIAL_RECEPTION_ITEMS}
        currentNickname="Mati"
        onChangeStatus={onChangeStatus}
        onToggleArchive={vi.fn()}
        onDeleteItem={onDeleteItem}
        onOpenLeavePopover={vi.fn()}
      />,
    );

    const noteTitle = screen.getByText('Bienvenida en mostrador');
    fireEvent.click(noteTitle);
    expect(onChangeStatus).toHaveBeenCalledWith('seed-note-1', 'in-progress');

    const deleteBtn = screen.getByRole('button', { name: 'Borrar Bienvenida en mostrador' });
    fireEvent.click(deleteBtn);
    expect(onDeleteItem).toHaveBeenCalledWith('seed-note-1');
  });

  it('submits a task or note via LeaveItemPopover, isolates keyboard events, and closes when clicking the full-screen backdrop', () => {
    const onSubmitItem = vi.fn();
    const onClose = vi.fn();
    const outerKeyDown = vi.fn();

    render(
      <div onKeyDown={outerKeyDown}>
        <LeaveItemPopover
          isOpen={true}
          initialRecipient="Luis"
          initialKind="task"
          presentUsers={['Mati', 'Luis', 'Agus']}
          currentNickname="Mati"
          onClose={onClose}
          onSubmitItem={onSubmitItem}
        />
      </div>,
    );

    const titleInput = screen.getByLabelText(/Título de la tarea/i);
    fireEvent.keyDown(titleInput, { key: 'w' });
    expect(outerKeyDown).not.toHaveBeenCalled();

    fireEvent.change(titleInput, { target: { value: 'Preparar demo de recepción' } });
    fireEvent.click(screen.getByRole('button', { name: 'Alta' }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar tarea/i }));

    expect(onSubmitItem).toHaveBeenCalledWith({
      kind: 'task',
      recipient: 'Luis',
      title: 'Preparar demo de recepción',
      description: '',
      priority: 'high',
      dueDate: '',
    });

    fireEvent.click(screen.getByTestId('leave-popover-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('identifies 3D avatar intersections for direct click-to-leave-note/task interaction', () => {
    const avatarGroup = new Group();
    avatarGroup.userData = { isAvatar: true, avatarNickname: 'Luis' };
    const headMesh = new Mesh();
    avatarGroup.add(headMesh);

    const hit: Intersection = {
      object: headMesh,
      distance: 2,
      point: new Vector3(0, 1, 0),
    };

    expect(avatarInteractionTarget(hit)).toBe('Luis');
    expect(avatarInteractionTarget(undefined)).toBeNull();
  });
});
