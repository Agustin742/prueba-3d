import { Component, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { loadAvatar, type AvatarResource } from '../avatar/load-avatar';
import { loadReception, type ReceptionResource } from './load-reception';
import { ReceptionScene } from './ReceptionScene';
import {
  getReceptionInteraction,
  type ReceptionInteractionId,
} from './reception-interactions';
import { receptionAvatarRadius } from './reception-layout';
import { useNavigationControls } from './use-navigation-controls';
import { ChatOverlay } from '../network/ChatOverlay';
import { filterProfanityPlain } from '../network/profanity-filter';
import { socket, type ChatMessage, type PlayerState } from '../network/socket';
import {
  INITIAL_RECEPTION_ITEMS,
  PRIORITY_LABELS,
  canUserViewWorkItem,
  extractMentionedUsers,
  type HudItemKind,
  type HudItemReply,
  type HudWorkItem,
  type IncomingHudNotification,
  type LeaveItemDraft,
  type TaskStatus,
  type UserPresenceMode,
} from '../tasks/task-types';
import { TopNavbarIslands } from '../tasks/TopNavbarIslands';
import { TaskNotificationBanner } from '../tasks/TaskNotificationBanner';
import { TaskHudMenu } from '../tasks/TaskHudMenu';
import { LeaveItemPopover } from '../tasks/LeaveItemPopover';

const STORAGE_KEY_HUD_ITEMS = 'reception_hud_work_items_v1';

function resolveQueryPlayerNickname(): string {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('player') || params.get('nick') || '';
      if (fromQuery.trim()) return fromQuery.trim();
    }
  } catch {
    // Ignore URL parse errors
  }
  return '';
}

function loadInitialHudItems(): HudWorkItem[] {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_HUD_ITEMS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {
    // Fallback to seed items
  }
  return [...INITIAL_RECEPTION_ITEMS];
}

function WebGLFailure() {
  return <p role="alert">WebGL reception unavailable. Enable hardware acceleration or try another browser, then reload.</p>;
}
class ReceptionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <WebGLFailure /> : this.props.children; }
}

export interface ReceptionPreviewProps {
  multiplayer?: boolean;
}

function ReceptionContent({ multiplayer = false }: ReceptionPreviewProps) {
  const [avatar, setAvatar] = useState<AvatarResource>();
  const [room, setRoom] = useState<ReceptionResource>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'avatar-error' | 'room-error' | 'webgl-error'>('loading');
  const [interactionNote, setInteractionNote] = useState<string | null>(null);
  const [noticeboardOpen, setNoticeboardOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const release = useRef<() => void>(() => {});

  // Controls: cameraOriented = true so W is screen UP, S is screen DOWN, A is screen LEFT, D is screen RIGHT
  const controls = useNavigationControls(status === 'ready', receptionAvatarRadius, true);
  const dialogTitleId = useId();
  const ready = useCallback(() => setStatus(current => current === 'loading' ? 'ready' : current), []);
  const failed = useCallback(() => { release.current(); setStatus('webgl-error'); }, []);

  // Session nickname stored in sessionStorage per tab so multiple tabs in the same browser can test different players independently
  const [savedNick] = useState(() => {
    const queryNick = resolveQueryPlayerNickname();
    if (queryNick) return queryNick;
    try {
      return typeof window !== 'undefined' ? (sessionStorage.getItem('avatar_nickname') || '') : '';
    } catch {
      return '';
    }
  });
  const [joined, setJoined] = useState(!multiplayer || Boolean(savedNick));
  const [nickname, setNickname] = useState(savedNick);
  const [presenceMode, setPresenceMode] = useState<UserPresenceMode>('available');
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [filterProfanity, setFilterProfanity] = useState(() => {
    try {
      const stored = localStorage.getItem('chat_filter_profanity');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [remotePlayers, setRemotePlayers] = useState<Record<string, PlayerState>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const bubbleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const messageTimestamps = useRef<number[]>([]);

  // HUD Tasks & Notes state (TaskHudMenu starts collapsed per D2)
  const [hudItems, setHudItems] = useState<HudWorkItem[]>(loadInitialHudItems);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<HudItemKind>('task');
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeNotification, setActiveNotification] = useState<IncomingHudNotification | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [leavePopover, setLeavePopover] = useState<{
    isOpen: boolean;
    recipient?: string;
    kind: HudItemKind;
  }>({ isOpen: false, kind: 'task' });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_HUD_ITEMS, JSON.stringify(hudItems));
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [hudItems]);

  // Synchronize HUD items across browser tabs even if one tab modifies status/archive/delete
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY_HUD_ITEMS && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (Array.isArray(parsed)) {
            setHudItems(parsed);
          }
        } catch {
          // Ignore malformed storage payload
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Show or append bubble text; resets duration timer
  const showBubble = useCallback((sender: string, text: string) => {
    setBubbles(prev => {
      const existing = prev[sender];
      const combined = existing ? `${existing}\n${text}` : text;
      return { ...prev, [sender]: combined };
    });
    if (bubbleTimers.current[sender]) {
      clearTimeout(bubbleTimers.current[sender]);
    }
    // High-visibility display for 6 seconds, timer resets on each message
    bubbleTimers.current[sender] = setTimeout(() => {
      setBubbles(prev => {
        const next = { ...prev };
        delete next[sender];
        return next;
      });
    }, 6000);
  }, []);

  // Single unified socket lifecycle
  useEffect(() => {
    if (!multiplayer) return;

    const activeSelf = nickname || savedNick || 'Recepción';

    const onConnect = () => {
      setIsConnected(true);
      const activeName = nickname || savedNick;
      if (activeName) {
        socket.emit('join-room', {
          roomCode: 'global',
          nickname: activeName,
        });
      }
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    const onRoomJoined = ({ players, messages: history }: { players: PlayerState[]; messages: ChatMessage[] }) => {
      const playersMap: Record<string, PlayerState> = {};
      players.forEach((p: PlayerState) => {
        if (p.id !== socket.id) {
          playersMap[p.id] = p;
        }
      });
      setRemotePlayers(playersMap);
      if (history && Array.isArray(history)) {
        setMessages(history);
      }
    };

    const onRoomPlayers = (players: PlayerState[]) => {
      if (!Array.isArray(players)) return;
      const playersMap: Record<string, PlayerState> = {};
      players.forEach((p: PlayerState) => {
        if (p.id !== socket.id) {
          playersMap[p.id] = p;
        }
      });
      setRemotePlayers(playersMap);
    };

    const onPlayerJoined = (player: PlayerState) => {
      if (player.id === socket.id) return;
      setRemotePlayers(prev => ({ ...prev, [player.id]: player }));
    };

    const onPlayerMoved = (data: { id: string; position: [number, number, number]; rotation: number; animation: string }) => {
      setRemotePlayers(prev => {
        if (!prev[data.id]) return prev;
        return {
          ...prev,
          [data.id]: {
            ...prev[data.id],
            position: data.position,
            rotation: data.rotation,
            animation: data.animation,
          },
        };
      });
    };

    const onPlayerLeft = ({ id }: { id: string }) => {
      setRemotePlayers(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };

    const onChatMessage = (msg: ChatMessage) => {
      setMessages(prev => {
        const isDuplicate = prev.some(
          m => (m.id && m.id === msg.id)
            || (m.sender === msg.sender && m.content === msg.content && Math.abs(new Date(m.createdAt || 0).getTime() - new Date(msg.createdAt || 0).getTime()) < 4000)
        );
        if (isDuplicate) return prev;
        return [...prev, msg];
      });

      // Avoid showing bubble twice: local sender already rendered bubble optimistically in handleSendMessage
      const isSelf = msg.sender === (nickname || savedNick) || msg.sender === 'Yo';
      if (msg.sender && msg.content && !isSelf) {
        showBubble(msg.sender, filterProfanityPlain(msg.content, filterProfanity));
      }
    };

    const onHudItemCreated = (incoming: HudWorkItem) => {
      if (!incoming || !incoming.id) return;
      setHudItems(prev => {
        if (prev.some(existing => existing.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });

      // RFC v3 Privacy: only notify if the current user is allowed to see this item and is not the Focus/DND mode
      if (canUserViewWorkItem(incoming, activeSelf) && presenceMode !== 'focus') {
        setUnreadCount(count => count + 1);
        setActiveNotification({
          id: `notif-${incoming.id}`,
          itemId: incoming.id,
          kind: incoming.kind,
          title: incoming.title,
          sender: incoming.sender,
          recipient: incoming.recipient,
          priority: incoming.priority,
          createdAt: incoming.createdAt,
        });
      }
    };

    const onHudItemUpdated = (patch: { id: string; status?: TaskStatus; archived?: boolean; sharedWith?: string[] }) => {
      if (!patch || !patch.id) return;
      setHudItems(prev =>
        prev.map(item =>
          item.id === patch.id
            ? {
                ...item,
                ...(patch.status !== undefined ? { status: patch.status } : {}),
                ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
                ...(patch.sharedWith !== undefined ? { sharedWith: patch.sharedWith } : {}),
              }
            : item,
        ),
      );
    };

    const onHudItemReplied = (payload: { id: string; reply: HudItemReply; sharedWith?: string[] }) => {
      if (!payload || !payload.id || !payload.reply) return;
      setHudItems(prev =>
        prev.map(item => {
          if (item.id !== payload.id) return item;
          const existingReplies = item.replies || [];
          if (existingReplies.some(r => r.id === payload.reply.id)) return item;
          const nextItem: HudWorkItem = {
            ...item,
            replies: [...existingReplies, payload.reply],
            ...(payload.sharedWith ? { sharedWith: payload.sharedWith } : {}),
          };
          if (canUserViewWorkItem(nextItem, activeSelf) && presenceMode !== 'focus') {
            setUnreadCount(count => count + 1);
            setActiveNotification({
              id: `notif-reply-${payload.reply.id}`,
              itemId: nextItem.id,
              kind: nextItem.kind,
              title: nextItem.title,
              sender: payload.reply.author,
              recipient: nextItem.recipient,
              priority: nextItem.priority,
              isReply: true,
              createdAt: payload.reply.createdAt,
            });
          }
          return nextItem;
        }),
      );
    };

    const onHudItemDeleted = (payload: { id: string }) => {
      if (!payload || !payload.id) return;
      setHudItems(prev => prev.filter(item => item.id !== payload.id));
    };

    // Register all event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('room-players', onRoomPlayers);
    socket.on('player-joined', onPlayerJoined);
    socket.on('player-moved', onPlayerMoved);
    socket.on('player-left', onPlayerLeft);
    socket.on('chat-message', onChatMessage);
    socket.on('hud-item-created', onHudItemCreated);
    socket.on('hud-item-updated', onHudItemUpdated);
    socket.on('hud-item-replied', onHudItemReplied);
    socket.on('hud-item-deleted', onHudItemDeleted);

    // Initial connection or join
    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true);
      const activeName = nickname || savedNick;
      if (activeName) {
        socket.emit('join-room', {
          roomCode: 'global',
          nickname: activeName,
        });
      }
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room-joined', onRoomJoined);
      socket.off('room-players', onRoomPlayers);
      socket.off('player-joined', onPlayerJoined);
      socket.off('player-moved', onPlayerMoved);
      socket.off('player-left', onPlayerLeft);
      socket.off('chat-message', onChatMessage);
      socket.off('hud-item-created', onHudItemCreated);
      socket.off('hud-item-updated', onHudItemUpdated);
      socket.off('hud-item-replied', onHudItemReplied);
      socket.off('hud-item-deleted', onHudItemDeleted);
    };
  }, [multiplayer, nickname, savedNick, showBubble, filterProfanity, presenceMode]);

  const handleJoin = useCallback((name: string) => {
    setNickname(name);
    setJoined(true);
    try {
      sessionStorage.setItem('avatar_nickname', name);
    } catch {}

    const emitJoin = () => {
      socket.emit('join-room', {
        roomCode: 'global',
        nickname: name,
      });
    };

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
      socket.connect();
    }
  }, []);

  const handleChangeNickname = useCallback(() => {
    try {
      sessionStorage.removeItem('avatar_nickname');
      localStorage.removeItem('avatar_nickname');
    } catch {}
    setJoined(false);
  }, []);

  const handleSendMessage = useCallback((content: string) => {
    const now = Date.now();
    // Anti-spam rule: Maximum 5 messages in 10 seconds
    messageTimestamps.current = messageTimestamps.current.filter(t => now - t < 10000);

    if (messageTimestamps.current.length >= 5) {
      const warningMsg: ChatMessage = {
        id: `spam-${now}`,
        sender: 'Sistema',
        content: '⚠️ Enviaste muchos mensajes seguidos. Esperá unos segundos antes de volver a escribir.',
        createdAt: new Date().toISOString(),
        isSystem: true,
      };
      setMessages(prev => [...prev, warningMsg]);
      return;
    }

    messageTimestamps.current.push(now);

    const senderName = nickname || 'Yo';
    const localId = `local-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const newMsg: ChatMessage = {
      id: localId,
      sender: senderName,
      content,
      createdAt: new Date().toISOString(),
    };
    // 1. Optimistic update: appears in UI immediately
    setMessages(prev => [...prev, newMsg]);
    // 2. Show bubble above avatar
    showBubble(senderName, filterProfanityPlain(content, filterProfanity));

    // 3. Emit via socket to broadcast and persist in Postgres
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('chat-message', { content, sender: senderName });
  }, [nickname, showBubble, filterProfanity]);

  const handleAvatarMove = useCallback((pos: [number, number, number], rot: number, anim: string) => {
    if (multiplayer && socket.connected) {
      socket.emit('player-move', { position: pos, rotation: rot, animation: anim });
    }
  }, [multiplayer]);

  const triggerInteraction = useCallback((id: ReceptionInteractionId) => {
    if (status !== 'ready' || !controls.consumeTap()) return;
    const item = getReceptionInteraction(id);
    setInteractionNote(item.feedback);
    if (id === 'noticeboard') {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : controls.container.current;
      controls.stop();
      setNoticeboardOpen(true);
    }
  }, [controls, status]);

  // Clicking a 3D avatar in reception opens the popover to leave a Task or Note for that person (D3)
  const handleSelectAvatar = useCallback((targetNickname: string) => {
    if (status !== 'ready' || !controls.consumeTap()) return;
    controls.stop();
    const resolvedTarget = targetNickname || nickname || 'Recepción';
    setInteractionNote(`Interactuando con ${resolvedTarget} — dejale una tarea o nota rápida.`);
    setLeavePopover({
      isOpen: true,
      recipient: resolvedTarget,
      kind: 'note',
    });
  }, [controls, nickname, status]);

  const handleOpenLeavePopover = useCallback((recipient?: string, kind: HudItemKind = 'task') => {
    controls.stop();
    setLeavePopover({
      isOpen: true,
      recipient,
      kind,
    });
  }, [controls]);

  const handleSubmitLeaveItem = useCallback((draft: LeaveItemDraft) => {
    const now = new Date();
    const senderName = nickname || savedNick || 'Recepción';
    const mentionedInDesc = extractMentionedUsers(draft.description);
    const mergedShared = Array.from(
      new Set([...(draft.sharedWith || []), ...mentionedInDesc]),
    );

    const createdItem: HudWorkItem = {
      id: `item-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: draft.kind,
      title: draft.title,
      description: draft.description || undefined,
      attachments: draft.attachments && draft.attachments.length > 0 ? draft.attachments : undefined,
      sender: senderName,
      recipient: draft.recipient,
      ...(mergedShared.length > 0 ? { sharedWith: mergedShared } : {}),
      replies: [],
      roomCode: 'global',
      priority: draft.kind === 'task' ? draft.priority : undefined,
      status: 'todo',
      dueDate: draft.kind === 'task' && draft.dueDate ? draft.dueDate : undefined,
      archived: false,
      createdAt: now.toISOString(),
    };

    setHudItems(prev => [createdItem, ...prev]);
    setActiveTab(createdItem.kind);
    setHighlightedItemId(createdItem.id);

    // Trigger incoming HUD notification banner showing who sent it, whether it's a Note or Task, and priority (D2)
    setActiveNotification({
      id: `notif-${createdItem.id}`,
      itemId: createdItem.id,
      kind: createdItem.kind,
      title: createdItem.title,
      sender: createdItem.sender,
      recipient: createdItem.recipient,
      priority: createdItem.priority,
      createdAt: createdItem.createdAt,
    });

    if (!isTrayOpen) {
      setUnreadCount(count => count + 1);
    }

    const kindText = createdItem.kind === 'task'
      ? `Tarea (${PRIORITY_LABELS[createdItem.priority || 'medium']})`
      : 'Nota';
    setInteractionNote(`${kindText} enviada a ${createdItem.recipient}: “${createdItem.title}”.`);

    if (multiplayer && socket.connected) {
      socket.emit('hud-item-created', createdItem);
    }
  }, [nickname, savedNick, isTrayOpen, multiplayer]);

  const handleChangeItemStatus = useCallback((id: string, nextStatus: TaskStatus) => {
    setHudItems(prev =>
      prev.map(item => (item.id === id ? { ...item, status: nextStatus } : item)),
    );
    if (multiplayer && socket.connected) {
      socket.emit('hud-item-updated', { id, status: nextStatus });
    }
  }, [multiplayer]);

  const handleToggleItemArchive = useCallback((id: string) => {
    setHudItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const nextArchived = !item.archived;
        if (multiplayer && socket.connected) {
          socket.emit('hud-item-updated', { id, archived: nextArchived });
        }
        return { ...item, archived: nextArchived };
      }),
    );
  }, [multiplayer]);

  const handleReplyItem = useCallback((id: string, content: string, mentionedUsers: string[]) => {
    const author = nickname || savedNick || 'Recepción';
    const reply: HudItemReply = {
      id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author,
      content,
      mentionedUsers,
      createdAt: new Date().toISOString(),
    };

    setHudItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const nextShared = Array.from(
          new Set([...(item.sharedWith || []), ...mentionedUsers]),
        );
        if (multiplayer && socket.connected) {
          socket.emit('hud-item-replied', {
            id,
            reply,
            sharedWith: nextShared,
          });
        }
        return {
          ...item,
          sharedWith: nextShared,
          replies: [...(item.replies || []), reply],
        };
      }),
    );
  }, [nickname, savedNick, multiplayer]);

  const handleShareItem = useCallback((id: string, targetNickname: string) => {
    setHudItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const nextShared = Array.from(
          new Set([...(item.sharedWith || []), targetNickname]),
        );
        if (multiplayer && socket.connected) {
          socket.emit('hud-item-updated', { id, sharedWith: nextShared });
        }
        return { ...item, sharedWith: nextShared };
      }),
    );
  }, [multiplayer]);

  const handleDeleteItem = useCallback((id: string) => {
    setHudItems(prev => prev.filter(item => item.id !== id));
    if (multiplayer && socket.connected) {
      socket.emit('hud-item-deleted', { id });
    }
  }, [multiplayer]);

  const handleToggleTray = useCallback(() => {
    setIsTrayOpen(prev => {
      const next = !prev;
      if (next) {
        setUnreadCount(0);
      }
      return next;
    });
  }, []);

  const handleOpenInTray = useCallback((kind: HudItemKind, itemId: string) => {
    setActiveTab(kind);
    setIsTrayOpen(true);
    setUnreadCount(0);
    setHighlightedItemId(itemId);
    setActiveNotification(null);
  }, []);

  const closeNoticeboard = useCallback(() => {
    setNoticeboardOpen(false);
    const target = returnFocusRef.current ?? controls.container.current;
    target?.focus();
  }, [controls.container]);

  useEffect(() => {
    if (!noticeboardOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNoticeboard();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [noticeboardOpen, closeNoticeboard]);

  useEffect(() => {
    let active = true;
    const owned: { dispose(): void }[] = [];
    const cleanup = () => {
      active = false;
      for (const resource of owned.splice(0)) resource.dispose();
    };
    release.current = cleanup;
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      if (!context) { failed(); return cleanup; }
      context.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { failed(); return cleanup; }
    const accept = <T extends { dispose(): void }>(resource: T, publish: (resource: T) => void) => {
      if (!active) { resource.dispose(); return; }
      owned.push(resource); publish(resource);
    };
    const reject = (error: 'avatar-error' | 'room-error') => {
      if (active) { cleanup(); setStatus(error); }
    };
    loadAvatar(false)
      .then(resource => accept(resource, setAvatar)).catch(() => reject('avatar-error'));
    loadReception().then(resource => accept(resource, setRoom)).catch(() => reject('room-error'));
    return cleanup;
  }, [failed]);

  // Real connected users only (no hardcoded fake users)
  const presentUsers = useMemo(() => {
    const activeSelf = nickname || savedNick || 'Recepción';
    const remoteNames = Object.values(remotePlayers)
      .map(p => p.nickname)
      .filter(Boolean);
    return Array.from(new Set([activeSelf, ...remoteNames]));
  }, [nickname, savedNick, remotePlayers]);

  const activeCurrentNick = nickname || savedNick || 'Recepción';

  const activeTasksCount = useMemo(
    () =>
      hudItems.filter(
        item =>
          item.kind === 'task' &&
          !item.archived &&
          canUserViewWorkItem(item, activeCurrentNick),
      ).length,
    [hudItems, activeCurrentNick],
  );
  const activeNotesCount = useMemo(
    () =>
      hudItems.filter(
        item =>
          item.kind === 'note' &&
          !item.archived &&
          canUserViewWorkItem(item, activeCurrentNick),
      ).length,
    [hudItems, activeCurrentNick],
  );

  if (status === 'webgl-error') return <WebGLFailure />;
  if (status === 'avatar-error' || status === 'room-error') return <p role="alert">
    The original {status === 'avatar-error' ? 'avatar' : 'reception'} could not be loaded. Check the local model file and reload.
  </p>;

  const onlineCount = Object.keys(remotePlayers).length + (joined ? 1 : 0);

  return (
    <div className="reception-stage">
      {status !== 'ready' && (
        <p role="status" className="reception-loading">
          Loading original avatar and reception; preparing WebGL…
        </p>
      )}
      <div
        className="preview reception"
        ref={controls.container}
        tabIndex={0}
        role="region"
        aria-label="Local reception navigation"
        aria-busy={status !== 'ready'}
        {...controls.events}
      >
        {avatar && room && (
          <Canvas
            orthographic
            camera={{ position: [14, 14, 14], near: 0.1, far: 100 }}
            dpr={[1, 1.5]}
            onPointerMissed={() => controls.tapTarget(null)}
          >
            <ReceptionScene
              avatar={avatar}
              room={room}
              tick={controls.tick}
              onSelect={point => { setInteractionNote(null); controls.tapTarget(point); }}
              onInteract={triggerInteraction}
              onSelectAvatar={multiplayer ? handleSelectAvatar : undefined}
              onReady={ready}
              onFailure={failed}
              nickname={nickname}
              bubbleText={bubbles[nickname]}
              bubbles={bubbles}
              remotePlayers={multiplayer ? remotePlayers : undefined}
              onAvatarMove={multiplayer ? handleAvatarMove : undefined}
            />
          </Canvas>
        )}
      </div>

      {noticeboardOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby={dialogTitleId} className="reception-dialog">
          <h2 id={dialogTitleId}>Reception noticeboard</h2>
          <p>{getReceptionInteraction('noticeboard').detail}</p>
          <button ref={closeButtonRef} type="button" onClick={closeNoticeboard}>Close noticeboard</button>
        </div>
      )}

      {multiplayer && joined && (
        <>
          <TopNavbarIslands
            currentNickname={activeCurrentNick}
            currentRoomName="Recepción"
            isConnected={isConnected}
            presentUsers={presentUsers}
            activeTasksCount={activeTasksCount}
            activeNotesCount={activeNotesCount}
            unreadCount={unreadCount}
            isTrayOpen={isTrayOpen}
            presenceMode={presenceMode}
            onChangePresenceMode={setPresenceMode}
            onToggleTray={handleToggleTray}
            onOpenLeavePopover={handleOpenLeavePopover}
            onOpenQuickNoticeboard={() => {
              controls.stop();
              setNoticeboardOpen(true);
            }}
          />

          <TaskNotificationBanner
            notification={activeNotification}
            onOpenInTray={handleOpenInTray}
            onDismiss={() => setActiveNotification(null)}
          />

          <TaskHudMenu
            isOpen={isTrayOpen}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onClose={() => setIsTrayOpen(false)}
            items={hudItems}
            currentNickname={activeCurrentNick}
            presentUsers={presentUsers}
            highlightedItemId={highlightedItemId}
            onChangeStatus={handleChangeItemStatus}
            onToggleArchive={handleToggleItemArchive}
            onDeleteItem={handleDeleteItem}
            onReplyItem={handleReplyItem}
            onShareItem={handleShareItem}
            onOpenLeavePopover={handleOpenLeavePopover}
          />

          <LeaveItemPopover
            isOpen={leavePopover.isOpen}
            initialRecipient={leavePopover.recipient}
            initialKind={leavePopover.kind}
            presentUsers={presentUsers}
            currentNickname={activeCurrentNick}
            onClose={() => setLeavePopover(prev => ({ ...prev, isOpen: false }))}
            onSubmitItem={handleSubmitLeaveItem}
          />
        </>
      )}

      {multiplayer && (
        <ChatOverlay
          joined={joined}
          onJoin={handleJoin}
          onChangeNickname={handleChangeNickname}
          messages={messages}
          onSendMessage={handleSendMessage}
          onlineCount={onlineCount}
          currentNickname={nickname}
          isConnected={isConnected}
          filterProfanity={filterProfanity}
          onToggleFilterProfanity={setFilterProfanity}
        />
      )}

      <p role="status" aria-live="polite" className="reception-hud">
        {interactionNote ?? controls.feedback}
      </p>
    </div>
  );
}

export function ReceptionPreview(props: ReceptionPreviewProps) {
  return <ReceptionBoundary><ReceptionContent {...props} /></ReceptionBoundary>;
}
