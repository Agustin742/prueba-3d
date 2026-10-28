import React, { useEffect, useRef, useState } from 'react';

export function ChatOverlay({
  joined,
  onJoin,
  messages,
  onSendMessage,
  onlineCount,
}) {
  const [nicknameInput, setNicknameInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    if (nicknameInput.trim()) {
      onJoin(nicknameInput.trim());
    }
  };

  const handleChatSubmit = (e) => {
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
          <h2>Unirte a la sala</h2>
          <p>Ingresá tu nombre para interactuar y chatear en tiempo real con otros usuarios.</p>
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
            Entrar al espacio
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
          <span>Chat en vivo</span>
          <span className="online-count">({onlineCount} online)</span>
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
                <div key={msg.id || i} className="chat-message-item">
                  <span className="chat-sender">{msg.sender}:</span>
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
