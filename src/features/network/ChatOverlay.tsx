import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './socket';
import { getSenderColor } from './sender-color';
import { renderFilteredContent } from './profanity-filter';

export const CLASSIC_EMOJIS: readonly string[] = [
  '😀', '😂', '😎', '😍', '🥳', '🤔',
  '👍', '👋', '🙌', '❤️', '🔥', '🎉',
  '✨', '🚀', '💯', '👀', '💡', '💬',
];

function formatTime(isoString?: string): string {
  if (!isoString) {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

export interface ChatOverlayProps {
  joined: boolean;
  onJoin(nickname: string): void;
  onChangeNickname?(): void;
  messages: ChatMessage[];
  onSendMessage(content: string): void;
  onlineCount: number;
  currentNickname?: string;
  isConnected?: boolean;
  filterProfanity?: boolean;
  onToggleFilterProfanity?(enabled: boolean): void;
}

export function ChatOverlay({
  joined,
  onJoin,
  onChangeNickname,
  messages,
  onSendMessage,
  onlineCount,
  currentNickname,
  isConnected = true,
  filterProfanity,
  onToggleFilterProfanity,
}: ChatOverlayProps) {
  const [nicknameInput, setNicknameInput] = useState(currentNickname || '');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [localFilterProfanity, setLocalFilterProfanity] = useState(() => {
    try {
      const stored = localStorage.getItem('chat_filter_profanity');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const activeFilterProfanity = filterProfanity !== undefined ? filterProfanity : localFilterProfanity;

  const chatInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const handleToggleFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    setLocalFilterProfanity(nextVal);
    try {
      localStorage.setItem('chat_filter_profanity', String(nextVal));
    } catch {}
    onToggleFilterProfanity?.(nextVal);
  };

  const handleInsertEmoji = (emoji: string) => {
    setChatInput((prev) => prev + emoji);
    chatInputRef.current?.focus();
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nicknameInput.trim()) {
      onJoin(nicknameInput.trim());
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim()) {
      onSendMessage(chatInput.trim());
      setChatInput('');
      setShowEmojiPicker(false);
    }
  };

  if (!joined) {
    return (
      <div className="join-modal-backdrop">
        <form className="join-modal" onSubmit={handleJoinSubmit}>
          <div className="join-icon">👋</div>
          <h2>Unirte a la recepción</h2>
          <p>Ingresá tu nombre para interactuar y chatear en tiempo real con tus compañeros.</p>
          <input
            type="text"
            className="join-input"
            placeholder="Tu apodo o nombre..."
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            autoFocus
            maxLength={20}
            required
          />
          <button type="submit" className="join-button">
            Entrar a la sala
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div className="chat-header" onClick={() => setIsChatOpen(!isChatOpen)}>
        <div className="chat-header-title">
          <span
            className={`online-indicator ${isConnected ? 'online' : 'offline'}`}
            title={isConnected ? 'Conectado al servidor' : 'Desconectado del servidor (levantá el backend)'}
          />
          <span>Recepción</span>
          <span className="online-count">
            {isConnected ? `(${onlineCount} online)` : '(desconectado)'}
          </span>
          {currentNickname && onChangeNickname && (
            <button
              type="button"
              className="chat-change-nick-btn"
              title="Cambiar apodo"
              onClick={(e) => {
                e.stopPropagation();
                onChangeNickname();
              }}
            >
              cambiar
            </button>
          )}
          <label
            className="chat-filter-toggle"
            title="Filtrar groserías y reemplazar por Integrar"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={activeFilterProfanity}
              onChange={handleToggleFilter}
            />
            <span>Filtro</span>
          </label>
        </div>
        <button
          type="button"
          className="chat-toggle-btn"
          aria-label={isChatOpen ? 'Minimizar chat' : 'Abrir chat'}
        >
          {isChatOpen ? '−' : '+'}
        </button>
      </div>

      {isChatOpen && (
        <>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                {isConnected ? 'No hay mensajes todavía. ¡Saludá!' : 'Conectando con el servidor...'}
              </div>
            ) : (
              messages.map((msg, i) => {
                const senderColor = msg.isSystem ? undefined : getSenderColor(msg.sender);
                return (
                  <div
                    key={msg.id || i}
                    className={`chat-message-item ${msg.isSystem ? 'chat-message-system' : ''}`}
                    style={senderColor ? { borderLeftColor: senderColor } : undefined}
                  >
                    <div className="chat-message-header">
                      <span
                        className="chat-sender"
                        style={senderColor ? { color: senderColor } : undefined}
                      >
                        {msg.sender}
                      </span>
                      <span className="chat-time">{formatTime(msg.createdAt)}</span>
                    </div>
                    <span className="chat-text">
                      {renderFilteredContent(msg.content, activeFilterProfanity)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-form" onSubmit={handleChatSubmit}>
            {showEmojiPicker && (
              <div className="emoji-picker-popover" ref={emojiPickerRef}>
                <div className="emoji-picker-header">
                  <span>Emojis</span>
                  <button
                    type="button"
                    className="emoji-picker-close"
                    aria-label="Cerrar selector de emojis"
                    onClick={() => setShowEmojiPicker(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="emoji-picker-grid">
                  {CLASSIC_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-item-btn"
                      onClick={() => handleInsertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="chat-input-wrapper">
              <button
                type="button"
                className="chat-emoji-toggle-btn"
                title="Insertar emoji"
                disabled={!isConnected}
                onClick={() => setShowEmojiPicker((prev) => !prev)}
              >
                😊
              </button>
              <input
                ref={chatInputRef}
                type="text"
                className="chat-input"
                placeholder={isConnected ? 'Escribí un mensaje...' : 'Servidor desconectado...'}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                maxLength={120}
                disabled={!isConnected}
              />
            </div>
            <button type="submit" className="chat-send-btn" disabled={!isConnected}>
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
