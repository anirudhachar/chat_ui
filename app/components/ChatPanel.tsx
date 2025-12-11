"use client";

import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiMoreVertical } from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import Image from "next/image";
import styles from "./ChatPanel.module.scss";
import type { User, Message } from "./ChatInterface";

interface ChatPanelProps {
  selectedUser: User | null;
  messages: Message[];
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link",
    file?: { name?: string; url?: string; image?: string; description?: string }
  ) => void;
  onBack: () => void;
  loadingMessages?: boolean;
}

export default function ChatPanel({
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  loadingMessages,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0] || "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      "#00a884",
      "#667781",
      "#0088cc",
      "#e9a944",
      "#9b72cb",
      "#00897b",
      "#ff6b6b",
      "#4fb3d4",
      "#f06292",
      "#ba68c8",
    ];
    // fallback numeric for uuid-like strings
    const num = Array.from(id).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const index = num % colors.length;
    return colors[index];
  };

  const getStatusIcon = (status?: "sent" | "delivered" | "read") => {
    if (!status) return null;
    if (status === "read") return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
    if (status === "delivered") return <BsCheckAll className={styles.tickIcon} />;
    return <BsCheck className={styles.tickIcon} />;
  };

  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyIcon}>
            {/* replace with your svg or image */}
            <div style={{ width: 100, height: 100, background: "#eee", borderRadius: 12 }} />
          </div>
          <h2 className={styles.emptyTitle}>Start a conversation</h2>
          <p className={styles.emptyText}>Select a chat from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      {/* Header */}
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back">
          <FiArrowLeft />
        </button>

        <div className={styles.avatarWrapper}>
          <div className={styles.avatar} style={{ backgroundColor: getAvatarColor(selectedUser.id) }}>
            {selectedUser.avatar ? (
              // using plain <img> so it works with external urls; if you prefer next/image adjust layout
              <img src={selectedUser.avatar} alt={selectedUser.name} className={styles.avatarImage} />
            ) : (
              <span className={styles.avatarInitials}>{getInitials(selectedUser.name)}</span>
            )}
          </div>
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>

        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>{selectedUser.online ? "Online" : "Offline"}</p>
        </div>

        <button className={styles.moreButton} aria-label="More">
          <FiMoreVertical />
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messagesArea}>
        <div className={styles.messagesContainer}>
          {loadingMessages ? (
            <div className={styles.loadingMessages}>Loading messages...</div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.messageWrapper} ${message.sent ? styles.sent : styles.received}`}
              >
                <div className={styles.messageBubble}>
                  {message.type === "image" && message.fileUrl && (
                    <div className={styles.messageImage}>
                      <img src={message.fileUrl} alt={message.fileName} />
                    </div>
                  )}

                  {message.type === "document" && message.fileName && (
                    <div className={styles.messageDocument}>
                      <div className={styles.documentIcon}>📄</div>
                      <div className={styles.documentInfo}>
                        <p className={styles.documentName}>{message.fileName}</p>
                      </div>
                    </div>
                  )}

                  {message.type === "link" && message.linkUrl && (
                    <a href={message.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.linkPreviewCard}>
                      {message.linkImage && <img src={message.linkImage} alt={message.linkTitle} className={styles.linkPreviewImage} />}
                      <div className={styles.linkPreviewContent}>
                        <p className={styles.linkPreviewTitle}>{message.linkTitle}</p>
                        <p className={styles.linkPreviewDescription}>{message.linkDescription}</p>
                        <p className={styles.linkPreviewUrl}>{message.linkUrl}</p>
                      </div>
                    </a>
                  )}

                  {message.content && <p className={styles.messageText}>{message.content}</p>}

                  <div className={styles.messageMeta}>
                    <span className={styles.messageTime}>{message.timestamp}</span>
                    {message.sent && getStatusIcon(message.status)}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <MessageInput
          onSend={(text) => {
            if (!text.trim()) return;
            onSendMessage(text, "text");
          }}
        />
      </div>
    </div>
  );
}

/**
 * Simple MessageInput component (local)
 * - textarea with Enter to send (Shift+Enter for newline)
 * - calls onSend(text)
 */
function MessageInput({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onSend(text.trim());
        setText("");
      }
    }
  };

  return (
    <div className={styles.messageInput}>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
        rows={1}
      />
      <button
        className={styles.sendButton}
        onClick={() => {
          if (!text.trim()) return;
          onSend(text.trim());
          setText("");
        }}
        aria-label="Send"
      >
        Send
      </button>
    </div>
  );
}
