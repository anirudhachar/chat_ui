"use client";

import { useEffect, useRef } from "react";
import { FiArrowLeft, FiMoreVertical } from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import { User, Message } from "./ChatInterface";
import styles from "./ChatPanel.module.scss";
import MessageInput from "./MessageInput";
import Image from "next/image";

interface ChatPanelProps {
  selectedUser: User | null;
  messages: Message[];
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link",
    file?: { name: string; url: string; image?: string; description?: string }
  ) => void;
  onBack: () => void;
}

export default function ChatPanel({ selectedUser, messages, onSendMessage, onBack }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => scrollToBottom(), [messages]);

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const getAvatarColor = (id: string) => {
    const colors = ["#00a884","#667781","#0088cc","#e9a944","#9b72cb","#00897b","#ff6b6b","#4fb3d4","#f06292","#ba68c8"];
    const index = parseInt(id, 10) % colors.length;
    return colors[index];
  };

  const getStatusIcon = (status?: "sending" | "sent" | "delivered" | "read" | "failed") => {
    if (!status) return null;
    if (status === "sending") return <span className={styles.sendingDot}>●</span>;
    if (status === "failed") return <span className={styles.failedIcon}>❌</span>;
    if (status === "read") return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
    if (status === "delivered") return <BsCheckAll className={styles.tickIcon} />;
    return <BsCheck className={styles.tickIcon} />;
  };

  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyContent}>
          <div className={styles.emptyIcon}>
            <Image src="Frame 238021 (1).svg" alt="" width={100} height={100} />
          </div>
          <h2 className={styles.emptyTitle}>Start a conversation</h2>
          <p className={styles.emptyText}>Select a chat from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack}><FiArrowLeft /></button>

        <div className={styles.avatarWrapper}>
          <div className={styles.avatar} style={{ backgroundColor: getAvatarColor(selectedUser.id) }}>
            {selectedUser.avatar && <img src={selectedUser.avatar} alt={selectedUser.name} style={{ width: "30px", height: "30px", borderRadius: "50%" }} />}
            {getInitials(selectedUser.name)}
          </div>
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>

        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>{selectedUser.online ? "Online" : "Offline"}</p>
        </div>

        <button className={styles.moreButton}><FiMoreVertical /></button>
      </div>

      <div className={styles.messagesArea}>
        <div className={styles.messagesContainer}>
          {messages.map((msg) => (
            <div key={msg.id} className={`${styles.messageWrapper} ${msg.sent ? styles.sent : styles.received}`}>
              <div className={styles.messageBubble}>
                {msg.type === "image" && msg.fileUrl && <img src={msg.fileUrl} alt={msg.fileName} className={styles.messageImage} />}
                {msg.type === "document" && msg.fileName && (
                  <div className={styles.messageDocument}>
                    <div className={styles.documentIcon}>📄</div>
                    <div className={styles.documentInfo}><p className={styles.documentName}>{msg.fileName}</p></div>
                  </div>
                )}
                {msg.type === "link" && msg.linkUrl && (
                  <a href={msg.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.linkPreviewCard}>
                    {msg.linkImage && <img src={msg.linkImage} alt={msg.linkTitle} className={styles.linkPreviewImage} />}
                    <div className={styles.linkPreviewContent}>
                      <p className={styles.linkPreviewTitle}>{msg.linkTitle}</p>
                      <p className={styles.linkPreviewDescription}>{msg.linkDescription}</p>
                      <p className={styles.linkPreviewUrl}>{msg.linkUrl}</p>
                    </div>
                  </a>
                )}
                {msg.content && <p className={styles.messageText}>{msg.content}</p>}

                <div className={styles.messageMeta}>
                  <span className={styles.messageTime}>{msg.timestamp}</span>
                  {msg.sent && getStatusIcon(msg.status)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
}
