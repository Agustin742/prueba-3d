import { Component, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { loadAvatar, type AvatarResource } from '../avatar/load-avatar';
import { loadCustomizedAvatar } from '../avatar/load-customized-avatar';
import type { AvatarConfiguration } from '../avatar/AvatarCustomizer';
import type { AppearanceCatalogue } from '../avatar/avatar-appearance';
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
  configuration?: AvatarConfiguration;
  catalogue?: AppearanceCatalogue;
}

function ReceptionContent({ multiplayer = false, configuration, catalogue }: ReceptionPreviewProps) {
  // Confirmed entry input is a mount-time seed, not an ongoing nickname override.
  const [localEntry] = useState(() => configuration && catalogue ? { configuration, catalogue } : undefined);
  const [avatar, setAvatar] = useState<AvatarResource>();
  const [npc, setNpc] = useState<AvatarResource>();
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

  // Persistent session nickname
  const [savedNick] = useState(() => {
    if (localEntry) return localEntry.configuration.nickname;
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem('avatar_nickname') || '') : '';
    } catch {
      return '';
    }
  });
  const [joined, setJoined] = useState(!multiplayer || Boolean(savedNick));
  const [nickname, setNickname] = useState(savedNick);
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
        playersMap[p.id] = p;
      });
      setRemotePlayers(playersMap);
      if (history && Array.isArray(history)) {
        setMessages(history);
      }
    };

    const onPlayerJoined = (player: PlayerState) => {
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

    // Register all event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room-joined', onRoomJoined);
    socket.on('player-joined', onPlayerJoined);
    socket.on('player-moved', onPlayerMoved);
    socket.on('player-left', onPlayerLeft);
    socket.on('chat-message', onChatMessage);

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
      socket.off('player-joined', onPlayerJoined);
      socket.off('player-moved', onPlayerMoved);
      socket.off('player-left', onPlayerLeft);
      socket.off('chat-message', onChatMessage);
    };
  }, [multiplayer, nickname, savedNick, showBubble]);

  const handleJoin = useCallback((name: string) => {
    setNickname(name);
    setJoined(true);
    try {
      localStorage.setItem('avatar_nickname', name);
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
  }, [nickname, showBubble]);

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
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const localAvatar = localEntry
      ? loadCustomizedAvatar(localEntry.configuration, localEntry.catalogue, reducedMotion)
      : loadAvatar(reducedMotion);
    localAvatar.then(resource => accept(resource, setAvatar)).catch(() => reject('avatar-error'));
    // The NPC is decoration: a failed download leaves the reception without it and never blocks readiness.
    loadAvatar(window.matchMedia('(prefers-reduced-motion: reduce)').matches, 'models/npc/monkey.glb')
      .then(resource => accept(resource, setNpc)).catch(() => {});
    loadReception().then(resource => accept(resource, setRoom)).catch(() => reject('room-error'));
    return cleanup;
  }, [failed, localEntry]);

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
              npc={npc}
              tick={controls.tick}
              onSelect={point => { setInteractionNote(null); controls.tapTarget(point); }}
              onInteract={triggerInteraction}
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
