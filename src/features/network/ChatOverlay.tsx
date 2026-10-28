import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './socket';
import { getSenderColor } from './sender-color';

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
}: ChatOverlayProps) {
  const [nicknameInput, setNicknameInput] = useState(currentNickname || '');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
                    <span className="chat-text">{msg.content}</span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-form" onSubmit={handleChatSubmit}>
            <input
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
            <button type="submit" className="chat-send-btn" disabled={!isConnected}>
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
