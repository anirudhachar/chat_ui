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
    file?: { 
      name: string; 
      url: string; 
      image?: string;
      description?: string;
    }
  ) => void;
  onBack: () => void;
  // NEW PROPS for message pagination
  onLoadMoreMessages: () => void;
  hasMoreMessages: boolean;
}

export default function ChatPanel({
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  onLoadMoreMessages, // NEW
  hasMoreMessages,    // NEW
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null); // Ref for the scrollable area
  const topMessageSentinelRef = useRef<HTMLDivElement>(null); // NEW Ref for IntersectionObserver

  // Helper to scroll to the bottom (used when sending a new message or first load)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll to bottom on initial load or new message
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]); // Scroll only when the total count changes

  // NEW: IntersectionObserver for message infinite scrolling
  useEffect(() => {
    if (!hasMoreMessages || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // If the sentinel (top of messages) is visible
        if (entries[0].isIntersecting) {
          onLoadMoreMessages();
        }
      },
      {
        root: messagesAreaRef.current, // Observe within the scrollable messages area
        rootMargin: "0px", 
        threshold: 0.1,
      }
    );

    const currentRef = topMessageSentinelRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMoreMessages, onLoadMoreMessages, messages.length]);


  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
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
    // Simple hash-like index based on ID
    const index = parseInt(id.replace(/\D/g, '').slice(-3) || '0', 10) % colors.length;
    return colors[index];
  };

 const getStatusIcon = (
  status?: "sending" | "sent" | "delivered" | "read" | "failed"
) => {
  if (!status) return null;

  if (status === "sending") {
    return <span className={styles.sendingDot}>●</span>;
  }

  if (status === "failed") {
    return <span className={styles.failedIcon}>❌</span>;
  }

  if (status === "read") {
    return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
  }

  if (status === "delivered") {
    return <BsCheckAll className={styles.tickIcon} />;
  }

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
          <p className={styles.emptyText}>
            Select a chat from the sidebar to start messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      {/* Chat Header */}
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack}>
          <FiArrowLeft />
        </button>

        <div className={styles.avatarWrapper}>
          <div
            className={styles.avatar}
            style={{ backgroundColor: getAvatarColor(selectedUser.id) }}
          >
            {selectedUser.avatar && (
              <img
                src={selectedUser.avatar}
                alt={selectedUser.name}
                style={{ width: "30px", height: "30px", borderRadius: "50%" }}
                className={styles.avatarImage}
              />
            )}
            {!selectedUser.avatar && getInitials(selectedUser.name)}
          </div>
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>

        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>
            {selectedUser.online ? "Online" : "Offline"}
          </p>
        </div>

        <button className={styles.moreButton}>
          <FiMoreVertical />
        </button>
      </div>

      {/* Messages Area */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        <div className={styles.messagesContainer}>
          {/* NEW: Loading/Sentinel Indicator for Infinite Scroll */}
          {hasMoreMessages && messages.length > 0 && (
             <div ref={topMessageSentinelRef} className={styles.loadingOlderMessages}>
                <p>Loading older messages...</p>
             </div>
          )}
          {!hasMoreMessages && messages.length > 0 && (
             <div className={styles.startOfConversation}>
                <p>Start of conversation</p>
             </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.messageWrapper} ${
                message.sent ? styles.sent : styles.received
              }`}
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

                {/* Link Preview Message */}
                {message.type === "link" && message.linkUrl && (
                  <a
                    href={message.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.linkPreviewCard}
                  >
                    {message.linkImage && (
                      <img
                        src={message.linkImage}
                        alt={message.linkTitle}
                        className={styles.linkPreviewImage}
                      />
                    )}

                    <div className={styles.linkPreviewContent}>
                      <p className={styles.linkPreviewTitle}>
                        {message.linkTitle}
                      </p>
                      <p className={styles.linkPreviewDescription}>
                        {message.linkDescription}
                      </p>
                      <p className={styles.linkPreviewUrl}>{message.linkUrl}</p>
                    </div>
                  </a>
                )}

                {message.content && (
                  <p className={styles.messageText}>{message.content}</p>
                )}

                <div className={styles.messageMeta}>
                  <span className={styles.messageTime}>
                    {message.timestamp}
                  </span>
                  {message.sent && getStatusIcon(message.status)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
}