"use client";

import { useEffect, useRef, memo } from "react";
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
  // PROPS for message pagination and scroll anchoring
  onLoadMoreMessages: (currentScrollHeight: number) => void;
  hasMoreMessages: boolean;
  prevScrollHeight: number | null; 
  setPrevScrollHeight: React.Dispatch<React.SetStateAction<number | null>>; 
  isLoadingMessages: boolean; // NEW: Loading state
}

export default memo(function ChatPanel({
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  onLoadMoreMessages,
  hasMoreMessages,
  prevScrollHeight,
  setPrevScrollHeight,
  isLoadingMessages, // Use new prop
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null); 
  const topMessageSentinelRef = useRef<HTMLDivElement>(null); 
  
  // Flag to manage initial scroll-to-bottom behavior
  const isInitialLoadRef = useRef(true); 

  // Helper to scroll to the bottom
  const scrollToBottom = (behavior: "auto" | "smooth" = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // ───────────────────────────────────────────────
  // SCROLL ANCHORING LOGIC (The Fix for the "Jump")
  // ───────────────────────────────────────────────
  useEffect(() => {
    const messagesArea = messagesAreaRef.current;
    
    // 1. Initial Load: Always scroll to bottom (using 'auto' for fast initial display)
    if (isInitialLoadRef.current) {
        scrollToBottom("auto"); 
        isInitialLoadRef.current = false;
        return;
    }

    // 2. Pagination Load (Scroll Up): Adjust position
    if (messagesArea && prevScrollHeight !== null) {
      const currentScrollHeight = messagesArea.scrollHeight;
      
      // Check if the scroll height increased (meaning content was prepended)
      if (currentScrollHeight > prevScrollHeight) {
        const scrollOffset = currentScrollHeight - prevScrollHeight;
        
        // Adjust the scroll position instantly
        messagesArea.scrollTo({
          top: scrollOffset,
          behavior: 'auto'
        });
      }
      
      // Reset the saved height after adjustment
      setPrevScrollHeight(null);
    }
    
    // 3. New Message: Scroll to bottom if new messages were added (not pagination)
    if (prevScrollHeight === null && messages.length > 0 && messagesArea) {
      const lastMessage = messages[messages.length - 1];
      // Heuristic: If it's a message sent by the user, ensure smooth scroll to bottom.
      if (lastMessage.sent) {
        scrollToBottom("smooth");
      }
    }

  }, [messages.length, prevScrollHeight, setPrevScrollHeight, messages]); // Added messages as dep to detect new messages

  // ───────────────────────────────────────────────
  // INTERSECTION OBSERVER (Fixed to prevent infinite loop)
  // ───────────────────────────────────────────────
  useEffect(() => {
    // If no more messages, or messages array is empty, or WE ARE LOADING, stop observation.
    if (!hasMoreMessages || messages.length === 0 || isLoadingMessages) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Double-check the loading status and visibility
        if (entries[0].isIntersecting && !isLoadingMessages) {
            const currentScrollHeight = messagesAreaRef.current?.scrollHeight || 0;
            // Pass the current scroll height to the parent component before fetching
            onLoadMoreMessages(currentScrollHeight);
        }
      },
      {
        root: messagesAreaRef.current,
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
  // Dependency array now includes isLoadingMessages to re-trigger observer when loading finishes.
  }, [hasMoreMessages, onLoadMoreMessages, messages.length, isLoadingMessages]);


  // ───────────────────────────────────────────────
  // UTILITY FUNCTIONS (Unchanged)
  // ───────────────────────────────────────────────
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
      {/* Chat Header (Unchanged) */}
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
          {/* Loading/Sentinel Indicator */}
          {hasMoreMessages && messages.length > 0 && (
             <div ref={topMessageSentinelRef} className={styles.loadingOlderMessages}>
                <p>{isLoadingMessages ? 'Loading messages...' : 'Scroll up to load older messages'}</p>
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
                {/* ... Message content rendering ... */}
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

      {/* Message Input (Unchanged) */}
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
});