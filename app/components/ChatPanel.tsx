"use client";

import { useEffect, useRef } from "react";
import { FiArrowLeft, FiMoreVertical } from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import Image from "next/image";

import { User, Message } from "./ChatInterface";
import MessageInput from "./MessageInput";
import styles from "./ChatPanel.module.scss";

interface ChatPanelProps {
  selectedUser: User | null;
  messages: Message[];
  onSendMessage: (
    content: string,
    type?: "text" | "image" | "document" | "link",
    file?: {
      name: string;
      url: string;
      image?: string;
      description?: string;
    }
  ) => void;
  onBack: () => void;

  // Pagination
  onLoadMoreMessages: () => void;
  hasMoreMessages: boolean;

  // 🔑 used to reset scroll when switching chat
  resetKey?: string;
}

export default function ChatPanel({
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  onLoadMoreMessages,
  hasMoreMessages,
  resetKey,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const topMessageSentinelRef = useRef<HTMLDivElement>(null);

  // 🔑 Track first load of a conversation
  const isFirstLoadRef = useRef(true);

  // 🔁 Reset when switching users
  useEffect(() => {
    isFirstLoadRef.current = true;
  }, [resetKey]);

  // ✅ Smart scrolling logic
  useEffect(() => {
    if (messages.length === 0) return;

    // Initial open → jump instantly (NO animation)
    if (isFirstLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoadRef.current = false;
      return;
    }

    // New message → smooth scroll
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 🔁 Infinite scroll (load older messages)
  useEffect(() => {
    if (!hasMoreMessages || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMoreMessages();
        }
      },
      {
        root: messagesAreaRef.current,
        threshold: 0.1,
      }
    );

    const el = topMessageSentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMoreMessages, onLoadMoreMessages, messages.length]);

  // Helpers
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

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
    ];
    return colors[parseInt(id.replace(/\D/g, "") || "0", 10) % colors.length];
  };

  const getStatusIcon = (
    status?: "sending" | "sent" | "delivered" | "read" | "failed"
  ) => {
    if (!status) return null;
    if (status === "sending") return <span className={styles.sendingDot}>●</span>;
    if (status === "failed") return <span>❌</span>;
    if (status === "read")
      return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
    if (status === "delivered")
      return <BsCheckAll className={styles.tickIcon} />;
    return <BsCheck className={styles.tickIcon} />;
  };

  // 🟡 Empty state
  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyContent}>
          <Image src="Frame 238021 (1).svg" alt="" width={100} height={100} />
          <h2>Start a conversation</h2>
          <p>Select a chat from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      {/* HEADER */}
      <div className={styles.chatHeader}>
        <button onClick={onBack} className={styles.backButton}>
          <FiArrowLeft />
        </button>

        <div
          className={styles.avatar}
          style={{ backgroundColor: getAvatarColor(selectedUser.id) }}
        >
          {selectedUser.avatar ? (
            <img src={selectedUser.avatar} alt={selectedUser.name} />
          ) : (
            getInitials(selectedUser.name)
          )}
        </div>

        <div className={styles.userInfo}>
          <h3>{selectedUser.name}</h3>
          <span>{selectedUser.online ? "Online" : "Offline"}</span>
        </div>

        <FiMoreVertical />
      </div>

      {/* MESSAGES */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        <div className={styles.messagesContainer}>
          {hasMoreMessages && (
            <div
              ref={topMessageSentinelRef}
              className={styles.loadingOlderMessages}
            >
              Loading older messages...
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`${styles.messageWrapper} ${
                m.sent ? styles.sent : styles.received
              }`}
            >
              <div className={styles.messageBubble}>
                <p>{m.content}</p>
                <div className={styles.messageMeta}>
                  <span>{m.timestamp}</span>
                  {m.sent && getStatusIcon(m.status)}
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
