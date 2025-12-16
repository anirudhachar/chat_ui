"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { 
  FiArrowLeft, 
  FiMoreVertical, 
  FiClock, 
  FiFile, 
  FiChevronDown, 
  FiCopy, 
  FiCornerUpLeft 
} from "react-icons/fi";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import Image from "next/image";

import { User, Message } from "./ChatInterface";
import MessageInput from "./MessageInput";
import styles from "./ChatPanel.module.scss";
import MessageSkeleton from "./MessageSkeleton/MessageSkeleton";

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
  onLoadMoreMessages: () => void;
  hasMoreMessages: boolean;
  resetKey?: string;
  // ✨ NEW: Callback to handle replies
  onReply?: (message: Message) => void;
}

export default function ChatPanel({
  selectedUser,
  messages,
  onSendMessage,
  onBack,
  onLoadMoreMessages,
  hasMoreMessages,
  resetKey,
  onReply,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const topMessageSentinelRef = useRef<HTMLDivElement>(null);

  const isFirstLoadRef = useRef(true);
  const isLoadingOlderRef = useRef(false);
  const prevScrollHeightRef = useRef(0);

  // ✨ NEW: Track which message has the dropdown open
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  /* 🔁 reset on chat switch */
  useEffect(() => {
    isFirstLoadRef.current = true;
    setActiveMessageId(null); // Close any open menus
  }, [resetKey]);

  /* ✨ NEW: Close dropdown when clicking outside */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMessageId && !(event.target as Element).closest(`.${styles.messageOptions}`)) {
        setActiveMessageId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMessageId]);

  /* ---------------- HANDLERS ---------------- */
  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setActiveMessageId(null);
    // Optional: Add toast success here
  };

  const handleReply = (msg: Message) => {
    if (onReply) onReply(msg);
    setActiveMessageId(null);
  };

  /* ---------------- SCROLL LOGIC ---------------- */
  useEffect(() => {
    const container = messagesAreaRef.current;
    if (!container || messages.length === 0) return;

    if (isFirstLoadRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      isFirstLoadRef.current = false;
      return;
    }

    if (isLoadingOlderRef.current) {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
      isLoadingOlderRef.current = false;
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!hasMoreMessages || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const container = messagesAreaRef.current;
          if (!container) return;

          isLoadingOlderRef.current = true;
          prevScrollHeightRef.current = container.scrollHeight;

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

  /* ---------- HELPERS ---------- */
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const getStatusIcon = (
    status?: "sending" | "sent" | "delivered" | "read" | "failed"
  ) => {
    if (!status) return null;
    if (status === "sending") return <FiClock className={styles.sendingIcon} />;
    if (status === "failed") return <span>❌</span>;
    if (status === "read")
      return <BsCheckAll className={`${styles.tickIcon} ${styles.read}`} />;
    if (status === "delivered")
      return <BsCheckAll className={styles.tickIcon} />;
    return <BsCheck className={styles.tickIcon} />;
  };

  /* ---------- MESSAGE CONTENT RENDERER ---------- */
  const renderMessageContent = (m: Message): ReactNode => {
    if (m.type === "offer" && m.offer) {
      return (
        <div className={`${styles.offerCard} ${m.sent ? styles.sent : styles.received}`}>
          <div className={styles.offerHeader}>
            <span className={styles.offerBadge}>📦 Offer</span>
            <span className={styles.offerType}>
              {m.offer.offerType === "PRICE" ? "Price Offer" : "Trade Offer"}
            </span>
          </div>
          {m.offer.imageUrl && (
            <div className={styles.offerImageWrapper}>
              <img src={m.offer.imageUrl} alt="Listing" className={styles.offerImage} />
            </div>
          )}
          <div className={styles.offerDetails}>
            {m.offer.offerType === "PRICE" && (
              <div className={styles.offerRow}>
                <span>Offered Price</span>
                <strong>{m.offer.currency} {m.offer.amount}</strong>
              </div>
            )}
            {m.offer.offerType === "TRADE" && (
              <div className={styles.offerRow}>
                <span>Trade Item</span>
                <strong>{m.offer.tradeDescription}</strong>
              </div>
            )}
          </div>
          {m.content && <p className={styles.offerMessage}>{m.content}</p>}
        </div>
      );
    }

    if (m.type === "image" && m.fileUrl) {
      return (
        <div className={styles.mediaContainer}>
          <img src={m.fileUrl} alt={m.content} className={styles.messageImage} />
          {m.content && m.content.trim() !== "📷 Photo" && (
            <p className={styles.messageCaption}>{m.content}</p>
          )}
        </div>
      );
    }

    if (m.type === "document" && m.fileUrl) {
      return (
        <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={styles.messageDocumentLink}>
          <div className={styles.documentIcon}><FiFile size={20} /></div>
          <div className={styles.documentInfo}>
            <p className={styles.documentName}>{m.fileName || m.content || "Document"}</p>
            {m.content && m.content.trim() !== m.fileName?.trim() && (
              <p className={styles.documentSize}>{m.content}</p>
            )}
          </div>
        </a>
      );
    }

    if (m.type === "link" && m.linkUrl) {
      if (m.linkTitle) {
        return (
          <>
            <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.messageLinkPreview}>
              {m.linkImage && <img src={m.linkImage} alt={m.linkTitle} className={styles.linkImage} />}
              <div className={styles.linkContent}>
                <p className={styles.linkSource}>{new URL(m.linkUrl).hostname}</p>
                <p className={styles.linkTitle}>{m.linkTitle}</p>
                {m.linkDescription && <p className={styles.linkDescription}>{m.linkDescription}</p>}
              </div>
            </a>
            {m.content && m.content.trim() !== m.linkUrl.trim() && (
              <p className={styles.messageText}>{m.content}</p>
            )}
          </>
        );
      }
      return (
        <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className={styles.messageText}>
          {m.content || m.linkUrl}
        </a>
      );
    }

    return <p className={styles.messageText}>{m.content}</p>;
  };

  /* ---------- EMPTY STATE ---------- */
  if (!selectedUser) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyCard}>
          <div className={styles.imageWrapper}>
            <Image src="/Frame 238021 (1).svg" alt="Chat illustration" width={90} height={90} priority />
          </div>
          <h2 className={styles.title}>Let’s start chatting</h2>
          <p className={styles.subtitle}>
            Search for a person from the left sidebar to start a conversation.
          </p>
          <div className={styles.hint}>Search a user • Start typing</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.chatPanel}>
      {/* HEADER */}
      <div className={styles.chatHeader}>
        <button className={styles.backButton} onClick={onBack}>
          <FiArrowLeft />
        </button>
        <div className={styles.avatarWrapper}>
          <div className={styles.avatar}>
            {selectedUser.avatar ? (
              <img
                src={selectedUser.avatar}
                alt={selectedUser.name}
                className={styles.avatarImage}
                style={{ width: "36px", height: "36px", borderRadius: "50%" }}
              />
            ) : (
              getInitials(selectedUser.name)
            )}
          </div>
          {selectedUser.online && <div className={styles.onlineIndicator} />}
        </div>
        <div className={styles.userInfo}>
          <h2 className={styles.userName}>{selectedUser.name}</h2>
          <p className={styles.userStatus}>Stanford University</p>
        </div>
        <button className={styles.moreButton}>
          <FiMoreVertical />
        </button>
      </div>

      {/* MESSAGES */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        {messages.length === 0 && (
          <div className={styles.emptyConversation}>
            <div className={styles.profileRing}>
              {selectedUser.avatar ? (
                <img src={selectedUser.avatar} className={styles.emptyAvatar} />
              ) : (
                <div className={styles.emptyInitials}>{getInitials(selectedUser.name)}</div>
              )}
            </div>
            <h3 className={styles.emptyTitle}>
              You’re now connected with <span>{selectedUser.name}</span>
            </h3>
            <p className={styles.emptySubtitle}>Say hello 👋 and start your conversation.</p>
          </div>
        )}

        <div className={styles.messagesContainer}>
          {hasMoreMessages && (
            <div ref={topMessageSentinelRef}>
              {isLoadingOlderRef.current && <MessageSkeleton />}
            </div>
          )}

          {messages.map((m) => {
            const isDropdownOpen = activeMessageId === m.id;
            
            return (
              <div
                key={m.id}
                className={`${styles.messageWrapper} ${m.sent ? styles.sent : styles.received}`}
              >
                {/* ✨ MESSAGE BUBBLE WITH DROPDOWN TRIGGER */}
                <div className={styles.messageBubble}>
                  
                  {/* 1. Trigger Icon (Arrow) - Shows on Hover */}
                  <button 
                    className={`${styles.optionsTrigger} ${isDropdownOpen ? styles.active : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMessageId(isDropdownOpen ? null : m.id);
                    }}
                    aria-label="Message options"
                  >
                    <FiChevronDown />
                  </button>

                  {/* 2. Dropdown Menu - Shows on Click */}
                  {isDropdownOpen && (
                    <div className={styles.messageOptions}>
                      <button onClick={(e) => { e.stopPropagation(); handleReply(m); }}>
                        <FiCornerUpLeft /> Reply
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleCopy(m.content || ""); }}>
                        <FiCopy /> Copy
                      </button>
                    </div>
                  )}

                  {/* 3. Original Content */}
                  {renderMessageContent(m)}

                  <div className={styles.messageMeta}>
                    <span className={styles.messageTime}>{m.timestamp}</span>
                    {m.sent && getStatusIcon(m.status)}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* INPUT */}
      <MessageInput onSendMessage={onSendMessage} />
    </div>
  );
}