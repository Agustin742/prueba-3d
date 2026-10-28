import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './socket';

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
}

export function ChatOverlay({
  joined,
  onJoin,
  onChangeNickname,
  messages,
  onSendMessage,
  onlineCount,
  currentNickname,
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
          <span className="online-indicator"></span>
          <span>Recepción</span>
          <span className="online-count">({onlineCount} online)</span>
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
              <div className="chat-empty">No hay mensajes todavía. ¡Saludá!</div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={msg.id || i}
                  className={`chat-message-item ${msg.isSystem ? 'chat-message-system' : ''}`}
                >
                  <div className="chat-message-header">
                    <span className="chat-sender">{msg.sender}</span>
                    <span className="chat-time">{formatTime(msg.createdAt)}</span>
                  </div>
                  <span className="chat-text">{msg.content}</span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-form" onSubmit={handleChatSubmit}>
            <input
              type="text"
              className="chat-input"
              placeholder="Escribí un mensaje..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              maxLength={120}
            />
            <button type="submit" className="chat-send-btn">
              Enviar
            </button>
          </form>
        </>
      )}
    </div>
  );
}
